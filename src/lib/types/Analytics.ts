export interface ListingAnalytics {
  listingId: string;
  viewCount: number;
  bookmarkCount: number;
  flagCount: number;
  lastUpdated: Date;
}

export interface AnalyticsUpdate {
  type: 'view' | 'bookmark' | 'flag';
  value: number;
  timestamp: Date;
}

// Rolling window totals across a set of listings
export interface RollingMetricsTotals {
  views: number;
  bookmarks: number;
  flags: number;
}

// Current vs previous window (e.g., current 30 days vs previous 30 days)
export interface RollingWindowMetrics {
  currentWindow: RollingMetricsTotals;
  previousWindow: RollingMetricsTotals;
}