export class CacheManager<T> {
  private cache: Map<
    string,
    {
      data: T;
      timestamp: number;
      hits: number;
      lastAccessed: number;
    }
  > = new Map();

  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly cleanupInterval: number;

  constructor(
    maxSize: number = 1000,
    ttlMinutes: number = 5,
    cleanupIntervalMinutes: number = 1
  ) {
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
    this.cleanupInterval = cleanupIntervalMinutes * 60 * 1000;
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  private evict(): void {
    if (this.cache.size >= this.maxSize) {
      // Sort by last accessed and hits
      const entries = Array.from(this.cache.entries()).sort((a, b) => {
        const scoreA = a[1].hits / (Date.now() - a[1].lastAccessed);
        const scoreB = b[1].hits / (Date.now() - b[1].lastAccessed);
        return scoreA - scoreB;
      });

      // Remove 10% of least valuable entries
      const removeCount = Math.ceil(this.maxSize * 0.1);
      entries.slice(0, removeCount).forEach(([key]) => this.cache.delete(key));
    }
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update stats
    entry.hits++;
    entry.lastAccessed = now;
    return entry.data;
  }

  set(key: string, data: T): void {
    this.evict();

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 1,
      lastAccessed: Date.now(),
    });
  }

  invalidate(prefix?: string): void {
    if (prefix) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  getStats(): { size: number; hitRatio: number } {
    let hits = 0;
    let total = 0;

    this.cache.forEach((entry) => {
      hits += entry.hits;
      total++;
    });

    return {
      size: this.cache.size,
      hitRatio: total ? hits / total : 0,
    };
  }
}

export const globalCache = new CacheManager();
