import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import type { ListingDocument } from "../../lib/types/Listing";
import type { ListingAnalytics } from "../../lib/types/Analytics";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { UseQueryResult } from "@tanstack/react-query";
import NumberFlow from "@number-flow/react";
import MetricCard from "../MetricCard";
import { getLast24hMetricsForListings } from "../../lib/firebase/analytics";

interface AnalyticsTabProps {
  listings: ListingDocument[];
  analyticsQuery: UseQueryResult<ListingAnalytics[], Error>;
}

// Removed legacy localStorage key for growth snapshot; now using rolling 30-day metrics

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  listings,
  analyticsQuery,
}) => {
  const analytics = analyticsQuery.data || [];
  const publishedListings = listings.filter((l) => l.status === "published");
  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(false);
  const [last24h, setLast24h] = useState({ views: 0, bookmarks: 0, flags: 0 });

  const getAnalytics = (listingId: string) => {
    const analyticsData = analytics.find((a) => a.listingId === listingId);
    if (analyticsData) {
      return {
        ...analyticsData,
        lastUpdated:
          analyticsData.lastUpdated instanceof Date
            ? analyticsData.lastUpdated
            : new Date(),
      };
    }
    return {
      listingId,
      viewCount: 0,
      bookmarkCount: 0,
      flagCount: 0,
      lastUpdated: new Date(),
    };
  };

  const totalStats = publishedListings.reduce(
    (acc, listing) => {
      const stats = getAnalytics(listing.id);
      return {
        views: acc.views + stats.viewCount,
        bookmarks: acc.bookmarks + stats.bookmarkCount,
        flags: acc.flags + stats.flagCount,
      };
    },
    { views: 0, bookmarks: 0, flags: 0 }
  );

  // Growth percentage removed in favor of last 24 hours chips

  // Transform analytics data for the chart
  const chartData = publishedListings.map((listing) => {
    const stats = getAnalytics(listing.id);
    return {
      name: listing.slug || listing.title,
      views: stats.viewCount,
      bookmarks: stats.bookmarkCount,
      flags: stats.flagCount,
    };
  });

  // Removed rolling 30-day growth fetching; we show last 24h chips instead

  // Fetch last 24h totals; refresh every 15 minutes
  useEffect(() => {
    let cancelled = false;
    const fetch24h = async () => {
      try {
        const ids = publishedListings.map((l) => l.id);
        const totals = await getLast24hMetricsForListings(ids);
        if (!cancelled) setLast24h(totals);
      } catch (e) {
        console.error("Failed to fetch last 24h metrics", e);
      }
    };
    fetch24h();
    const interval = setInterval(fetch24h, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [listings.length]);

  // Refetch analytics data when needed
  useEffect(() => {
    if (analyticsQuery.refetch) {
      const refetchInterval = setInterval(() => {
        analyticsQuery.refetch();
      }, 3600000); // Refetch every 1 hour

      return () => clearInterval(refetchInterval);
    }
  }, [analyticsQuery]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsSmallScreen((e as MediaQueryList).matches ?? (e as MediaQueryListEvent).matches);
    };
    handler(mq);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler as (e: MediaQueryListEvent) => void);
      return () => mq.removeEventListener('change', handler as (e: MediaQueryListEvent) => void);
    } else {
      mq.addListener(handler as (this: MediaQueryList, ev: MediaQueryListEvent) => void);
      return () => mq.removeListener(handler as (this: MediaQueryList, ev: MediaQueryListEvent) => void);
    }
  }, []);

  if (publishedListings.length === 0) {
    return (
      <Card className="w-full h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center py-12">
            <p className="text-lg text-gray-500">
              No published listings to analyze
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Publish some listings to see analytics here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  

  return (
    <ScrollArea className="h-[calc(100vh-6rem)]">
      <div className="space-y-6">
        {/* <AnalyticsDebug listings={listings} analyticsQuery={analyticsQuery} /> */}
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 md:gap-6 gap-2">
          <MetricCard 
            title="Total Views" 
            value={totalStats.views} 
            last24h={last24h.views}
            last24hLabel="in the last 24 hours"
            storageKey="analytics_views"
          />
          <MetricCard 
            title="Total Bookmarks" 
            value={totalStats.bookmarks} 
            last24h={last24h.bookmarks}
            last24hLabel="in the last 24 hours"
            storageKey="analytics_bookmarks"
          />
          <MetricCard 
            title="Total Flags" 
            value={totalStats.flags} 
            last24h={last24h.flags}
            last24hLabel="in the last 24 hours"
            storageKey="analytics_flags"
          />
        </div>

        {/* Performance Chart */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Performance Overview</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 px-4">
            <div className="text-xs text-white/70 mb-2">Totals per listing • 24h activity shown in cards above</div>
            <div className="w-full h-[260px] sm:h-[340px] md:h-[420px] lg:h-[520px]">
              <ChartContainer
                className="w-full h-full aspect-auto"
                config={{
                  views: {
                    label: "Views",
                    theme: {
                      light: "#1f2937",
                      dark: "#ffffff",
                    },
                  },
                  bookmarks: {
                    label: "Bookmarks",
                    theme: {
                      light: "#6b7280",
                      dark: "#ffffff",
                    },
                  },
                  flags: {
                    label: "Flags",
                    theme: {
                      light: "#9ca3af",
                      dark: "#ffffff",
                    },
                  },
                }}
              >
                <BarChart
                  data={chartData}
                  margin={isSmallScreen ? { top: 16, right: 12, left: 12, bottom: 24 } : { top: 24, right: 24, left: 24, bottom: 56 }}
                  barGap={6}
                  barCategoryGap={isSmallScreen ? 24 : 20}
                >
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={false}
                    tickLine={false}
                    axisLine={true}
                    height={12}
                    stroke="#9ca3af"
                  />
                  <YAxis
                    fontSize={isSmallScreen ? 10 : 12}
                    tickLine={false}
                    axisLine={true}
                    stroke="#9ca3af"
                    tickFormatter={(value) => `${value}`}
                    width={isSmallScreen ? 28 : 36}
                  />
                  <Bar
                    dataKey="views"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={isSmallScreen ? 28 : 36}
                    fill="var(--color-views)"
                  />
                  <Bar
                    dataKey="bookmarks"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={isSmallScreen ? 28 : 36}
                    fill="var(--color-bookmarks)"
                    fillOpacity={0.9}
                  />
                  <Bar
                    dataKey="flags"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={isSmallScreen ? 28 : 36}
                    fill="var(--color-flags)"
                    fillOpacity={0.85}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const name = (payload[0]?.payload as { name?: string })?.name || '';
                      return (
                        <div className="rounded-lg border-black/10 dark:border-white/10 border bg-white/95 dark:bg-black/50 px-3 py-2 shadow-sm">
                          <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1">{name}</div>
                          <ChartTooltipContent
                            active={active}
                            payload={payload}
                            labelKey="name"
                          />
                        </div>
                      );
                    }}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Listing Details */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Listing Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {publishedListings.map((listing) => {
                const stats = getAnalytics(listing.id);
                return (
                  <Card
                    key={listing.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="border-b p-4">
                      <CardTitle className="text-sm font-medium">
                        {listing.slug}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <dt className="text-sm text-muted-foreground font-medium text-gray-600 dark:text-white">
                            Views
                          </dt>
                          <dd className="text-2xl font-sans font-semibold text-gray-900 dark:text-white/80">
                            <NumberFlow value={stats.viewCount} />
                          </dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-sm text-muted-foreground font-medium text-gray-600 dark:text-white">
                            Bookmarks
                          </dt>
                          <dd className="text-2xl font-sans font-semibold text-gray-900 dark:text-white/80">
                            <NumberFlow value={stats.bookmarkCount} />
                          </dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-sm text-muted-foreground font-medium text-gray-600 dark:text-white">
                            Flags
                          </dt>
                          <dd className="text-2xl font-sans font-semibold text-gray-900 dark:text-white/80">
                            <NumberFlow value={stats.flagCount} />
                          </dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-sm text-muted-foreground text-gray-600 dark:text-white">
                            Last Updated
                          </dt>
                          <dd className="text-xs">
                            {stats.lastUpdated instanceof Date
                              ? stats.lastUpdated.toLocaleString()
                              : new Date().toLocaleString()}
                          </dd>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

export default AnalyticsTab;
