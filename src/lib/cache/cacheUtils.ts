import { ListingDocument } from '../types/Listing';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private readonly defaultExpiration: number;

  constructor(defaultExpiration = 5 * 60 * 1000) { // 5 minutes default
    this.cache = new Map();
    this.defaultExpiration = defaultExpiration;
    this.setupCleanupInterval();
  }

  private setupCleanupInterval() {
    setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // Clean up every minute
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  set<T>(key: string, data: T, expiration?: number): void {
    const timestamp = Date.now();
    const expiresAt = timestamp + (expiration || this.defaultExpiration);

    try {
      // Test if data is serializable
      JSON.stringify(data);

      this.cache.set(key, {
        data,
        timestamp,
        expiresAt,
      });

      // Also store in localStorage for persistence
      try {
        localStorage.setItem(
          `cache_${key}`,
          JSON.stringify({
            data,
            timestamp,
            expiresAt,
          })
        );
      } catch (e) {
        // Handle localStorage errors (e.g., quota exceeded)
        console.warn('Failed to store in localStorage:', e);
      }
    } catch (e) {
      console.error('Failed to cache data:', e);
    }
  }

  get<T>(key: string): T | null {
    // First check memory cache
    const memoryEntry = this.cache.get(key);
    if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
      return memoryEntry.data as T;
    }

    // Then check localStorage
    try {
      const storedData = localStorage.getItem(`cache_${key}`);
      if (storedData) {
        const entry: CacheEntry<T> = JSON.parse(storedData);
        if (entry.expiresAt > Date.now()) {
          // Restore to memory cache
          this.cache.set(key, entry);
          return entry.data;
        } else {
          // Clean up expired data
          localStorage.removeItem(`cache_${key}`);
        }
      }
    } catch (e) {
      console.warn('Failed to retrieve from localStorage:', e);
    }

    return null;
  }

  remove(key: string): void {
    this.cache.delete(key);
    try {
      localStorage.removeItem(`cache_${key}`);
    } catch (e) {
      console.warn('Failed to remove from localStorage:', e);
    }
  }

  clear(): void {
    this.cache.clear();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
  }

  // Helper method for fetching and caching listing data
  async fetchWithCache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    expiration?: number
  ): Promise<T> {
    const cachedData = this.get<T>(key);
    if (cachedData) {
      return cachedData;
    }

    const data = await fetchFn();
    this.set(key, data, expiration);
    return data;
  }

  // Specific method for caching listing data
  async cacheListing(listing: ListingDocument): Promise<void> {
    this.set(`listing_${listing.id}`, listing);
  }

  // Specific method for retrieving cached listing data
  getCachedListing(listingId: string): ListingDocument | null {
    return this.get<ListingDocument>(`listing_${listingId}`);
  }
}

// Export a singleton instance
export const cacheManager = new CacheManager();