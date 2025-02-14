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