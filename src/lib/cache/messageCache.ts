import { Message } from "../firebase/chat";
import { globalCache } from "./cacheManager";

// Constants for message cache configuration
export const MESSAGE_PAGE_SIZE = 10; // Default page size for pagination
// Cache expiration time in minutes
export const MESSAGE_CACHE_TTL = 30; // Time to live in minutes
// Maximum number of messages to cache per chat
export const MESSAGE_CACHE_SIZE = 500;
// Cache hit threshold before considering data as "fresh"
export const CACHE_FRESHNESS_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

// Interface for cached message pages
interface MessagePage {
  messages: Message[];
  startCursor: string | null;
  endCursor: string | null;
  hasMore: boolean;
  timestamp: number;
  lastAccessed?: number; // Track when the page was last accessed
}

// Interface for message cache stats
interface MessageCacheStats {
  totalCachedMessages: number;
  totalCachedPages: number;
  chatIds: string[];
  oldestMessageTimestamp: number | null;
}

/**
 * MessageCache - Specialized cache for chat messages with pagination support
 */
export class MessageCache {
  private static instance: MessageCache;

  // Private constructor for singleton pattern
  private constructor() {}

  // Get singleton instance
  public static getInstance(): MessageCache {
    if (!MessageCache.instance) {
      MessageCache.instance = new MessageCache();
    }
    return MessageCache.instance;
  }

  /**
   * Cache a page of messages for a specific chat
   */
  public cacheMessagePage(chatId: string, page: number, messages: Message[], hasMore: boolean): void {
    if (!messages.length) return;
    
    const cacheKey = this.getPageCacheKey(chatId, page);
    const startCursor = messages[0]?.id || null;
    const endCursor = messages[messages.length - 1]?.id || null;
    
    const pageData: MessagePage = {
      messages,
      startCursor,
      endCursor,
      hasMore,
      timestamp: Date.now(),
      lastAccessed: Date.now(), // Initialize lastAccessed
    };
    
    globalCache.set(cacheKey, pageData);
    
    // Update the chat's message index
    this.updateMessageIndex(chatId, page, startCursor, endCursor);
  }

  /**
   * Get a cached page of messages for a specific chat
   */
  public getCachedMessagePage(chatId: string, page: number): MessagePage | undefined {
    const cacheKey = this.getPageCacheKey(chatId, page);
    const pageData = globalCache.get(cacheKey) as MessagePage | undefined;

    if (pageData) {
      const now = Date.now();
      const age = now - pageData.timestamp;
      
      // Update last accessed time
      pageData.lastAccessed = now;
      globalCache.set(cacheKey, pageData);

      // If cache is older than TTL but was recently accessed, extend its life
      if (age > MESSAGE_CACHE_TTL * 60 * 1000) {
        const timeSinceLastAccess = now - (pageData.lastAccessed || pageData.timestamp);
        if (timeSinceLastAccess < CACHE_FRESHNESS_THRESHOLD) {
          // Refresh the timestamp to extend cache life
          pageData.timestamp = now;
          globalCache.set(cacheKey, pageData);
          return pageData;
        }
        // Cache is stale but return it while marking it for refresh
        return {
          ...pageData,
          hasMore: true, // Force hasMore to true so UI will try to refresh
        };
      }
    }

    return pageData;
  }

  /**
   * Cache a single message and update relevant pages
   */
  public cacheMessage(message: Message): void {
    const { chatId, id } = message;
    const messageCacheKey = this.getMessageCacheKey(chatId, id);
    
    // Cache individual message
    globalCache.set(messageCacheKey, message);
    
    // Update the most recent page
    const recentPageKey = this.getPageCacheKey(chatId, 0);
    const recentPage = globalCache.get(recentPageKey) as MessagePage | undefined;
    
    if (recentPage) {
      // Add to recent page and maintain sort order by timestamp
      const updatedMessages = [...recentPage.messages, message].sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : a.timestamp?.seconds * 1000 || 0;
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : b.timestamp?.seconds * 1000 || 0;
        return timeA - timeB;
      });
      
      // If page exceeds size, remove oldest message
      if (updatedMessages.length > MESSAGE_PAGE_SIZE) {
        updatedMessages.shift();
      }
      
      this.cacheMessagePage(
        chatId, 
        0, 
        updatedMessages, 
        recentPage.hasMore || updatedMessages.length >= MESSAGE_PAGE_SIZE
      );
    }
  }

  /**
   * Get a cached message by ID
   */
  public getCachedMessage(chatId: string, messageId: string): Message | undefined {
    const cacheKey = this.getMessageCacheKey(chatId, messageId);
    return globalCache.get(cacheKey) as Message | undefined;
  }

  /**
   * Update read status for cached messages
   */
  public updateMessageReadStatus(chatId: string, messageIds: string[]): void {
    if (!messageIds.length) return;
    
    // Update individual cached messages
    messageIds.forEach(messageId => {
      const cacheKey = this.getMessageCacheKey(chatId, messageId);
      const message = globalCache.get(cacheKey) as Message | undefined;
      
      if (message) {
        globalCache.set(cacheKey, { ...message, read: true });
      }
    });
    
    // Update cached pages that might contain these messages
    const pageIndex = this.getMessagePageIndex(chatId);
    if (!pageIndex) return;
    
    Object.keys(pageIndex).forEach(pageKey => {
      const page = parseInt(pageKey);
      const cachedPage = this.getCachedMessagePage(chatId, page);
      
      if (cachedPage) {
        const updatedMessages = cachedPage.messages.map(msg => {
          if (messageIds.includes(msg.id)) {
            return { ...msg, read: true };
          }
          return msg;
        });
        
        this.cacheMessagePage(
          chatId,
          page,
          updatedMessages,
          cachedPage.hasMore
        );
      }
    });
  }

  /**
   * Clear cache for a specific chat
   */
  public clearChatCache(chatId: string): void {
    globalCache.invalidate(`message_${chatId}_`);
    globalCache.invalidate(`page_${chatId}_`);
    globalCache.invalidate(`index_${chatId}`);
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): MessageCacheStats {
    const stats = globalCache.getStats();
    const chatIds = new Set<string>();
    let totalMessages = 0;
    let totalPages = 0;
    let oldestTimestamp: number | null = null;
    
    // Analyze cache entries
    Array.from(Object.keys(stats)).forEach(key => {
      if (key.startsWith('message_')) {
        totalMessages++;
        const parts = key.split('_');
        if (parts.length >= 3) {
          chatIds.add(parts[1]);
        }
      } else if (key.startsWith('page_')) {
        totalPages++;
        const pageData = globalCache.get(key) as MessagePage | undefined;
        if (pageData && (!oldestTimestamp || pageData.timestamp < oldestTimestamp)) {
          oldestTimestamp = pageData.timestamp;
        }
      }
    });
    
    return {
      totalCachedMessages: totalMessages,
      totalCachedPages: totalPages,
      chatIds: Array.from(chatIds),
      oldestMessageTimestamp: oldestTimestamp,
    };
  }

  /**
   * Compress message content to save space
   * This is a simple implementation that could be expanded with actual compression
   */
  public compressMessageContent(content: string): string {
    // Simple truncation for very long messages
    if (content.length > 1000) {
      return content.substring(0, 997) + '...';
    }
    return content;
  }

  /**
   * Helper method to get cache key for a message
   */
  private getMessageCacheKey(chatId: string, messageId: string): string {
    return `message_${chatId}_${messageId}`;
  }

  /**
   * Helper method to get cache key for a page
   */
  private getPageCacheKey(chatId: string, page: number): string {
    return `page_${chatId}_${page}`;
  }

  /**
   * Helper method to get cache key for message index
   */
  private getMessageIndexKey(chatId: string): string {
    return `index_${chatId}`;
  }

  /**
   * Update the message page index for a chat
   */
  private updateMessageIndex(chatId: string, page: number, startCursor: string | null, endCursor: string | null): void {
    const indexKey = this.getMessageIndexKey(chatId);
    const currentIndex = globalCache.get(indexKey) as Record<number, { start: string | null, end: string | null }> || {};
    
    currentIndex[page] = { start: startCursor, end: endCursor };
    globalCache.set(indexKey, currentIndex);
  }

  /**
   * Get the message page index for a chat
   * @param chatId The chat ID to get the page index for
   * @param messageId Optional message ID to find which page contains this message
   * @returns The page index record or the page number containing the message
   */
  public getMessagePageIndex(chatId: string, messageId?: string): Record<number, { start: string | null, end: string | null }> | undefined | number {
    const indexKey = this.getMessageIndexKey(chatId);
    const pageIndex = globalCache.get(indexKey) as Record<number, { start: string | null, end: string | null }> | undefined;
    
    // If messageId is provided, find which page contains this message
    if (messageId && pageIndex) {
      for (const [pageNum] of Object.entries(pageIndex)) {
        // Get the page data to check if message is in this page
        const page = this.getCachedMessagePage(chatId, parseInt(pageNum));
        if (page && page.messages.some(msg => msg.id === messageId)) {
          return parseInt(pageNum);
        }
      }
      // Message not found in any cached page
      return undefined;
    }
    
    return pageIndex;
  }
}

// Export singleton instance
export const messageCache = MessageCache.getInstance();