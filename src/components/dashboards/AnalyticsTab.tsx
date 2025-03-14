import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import type { ListingDocument } from "../../lib/types/Listing";
import type { ListingAnalytics } from "../../lib/types/Analytics";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../ui/chart";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { UseQueryResult } from "@tanstack/react-query";
import NumberFlow from "@number-flow/react";
import MetricCard from "../MetricCard";

interface AnalyticsTabProps {
  listings: ListingDocument[];
  analyticsQuery: UseQueryResult<ListingAnalytics[], Error>;
}

const STORAGE_KEY = 'previous_analytics_stats';

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  listings,
  analyticsQuery,
}) => {
  const analytics = analyticsQuery.data || [];
  const publishedListings = listings.filter((l) => l.status === "published");
  const [previousStats, setPreviousStats] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { views: 0, bookmarks: 0, flags: 0, timestamp: 0 };
  });

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

  // Calculate growth percentages
  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) {
      // If previous is 0 and current is greater than 0, return 100% growth
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  };

  const growthStats = {
    views: calculateGrowth(totalStats.views, previousStats.views),
    bookmarks: calculateGrowth(totalStats.bookmarks, previousStats.bookmarks),
    flags: calculateGrowth(totalStats.flags, previousStats.flags),
  };

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

  // Initialize previous stats on first load and update periodically
  useEffect(() => {
    const now = Date.now();
    const ONE_HOUR = 3600000; // 1 hour in milliseconds

    // If there's no previous data or it's been more than an hour, update the stored stats
    if (!previousStats.timestamp || now - previousStats.timestamp > ONE_HOUR) {
      // Only store new stats if we have actual data to store
      if (Object.values(totalStats).some(val => val > 0)) {
        const newPreviousStats = {
          ...totalStats,
          timestamp: now,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreviousStats));
        setPreviousStats(newPreviousStats);
      }
    }
  }, [totalStats, previousStats.timestamp]);

  // Refetch analytics data when needed
  useEffect(() => {
    if (analyticsQuery.refetch) {
      const refetchInterval = setInterval(() => {
        analyticsQuery.refetch();
      }, 3600000); // Refetch every 1 hour

      return () => clearInterval(refetchInterval);
    }
  }, [analyticsQuery]);

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
            growth={growthStats.views}
            storageKey="analytics_views"
          />
          <MetricCard 
            title="Total Bookmarks" 
            value={totalStats.bookmarks} 
            growth={growthStats.bookmarks}
            storageKey="analytics_bookmarks"
          />
          <MetricCard 
            title="Total Flags" 
            value={totalStats.flags} 
            growth={growthStats.flags}
            storageKey="analytics_flags"
          />
        </div>

        {/* Performance Chart */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Performance Overview</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 px-6 md:block hidden">
            <div className="w-full h-[400px] md:h-[500px] lg:h-[600px]">
              <ChartContainer
                config={{
                  views: {
                    label: "Views",
                    theme: {
                      light: "#8752f3",
                      dark: "#8752f3",
                    },
                  },
                  bookmarks: {
                    label: "Bookmarks",
                    theme: {
                      light: "#8752f3",
                      dark: "#8752f3",
                    },
                  },
                  flags: {
                    label: "Flags",
                    theme: {
                      light: "#8752f3",
                      dark: "#8752f3",
                    },
                  },
                }}
              >
                <BarChart
                  data={chartData}
                  margin={{ top: 30, right: 40, left: 40, bottom: 90 }}
                  barGap={8}
                  barCategoryGap={20}
                >
                  <XAxis
                    dataKey="name"
                    fontSize={12}
                    tickLine={false}
                    axisLine={true}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    stroke="#888888"
                  />
                  <YAxis
                    fontSize={12}
                    tickLine={false}
                    axisLine={true}
                    stroke="#888888"
                    tickFormatter={(value) => `${value}`}
                    width={40}
                  />
                  <Bar
                    dataKey="views"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    fill="#8752f3"
                  />
                  <Bar
                    dataKey="bookmarks"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    fill="#8752f3"
                    fillOpacity={0.8}
                  />
                  <Bar
                    dataKey="flags"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    fill="#8752f3"
                    fillOpacity={0.6}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => (
                      <ChartTooltipContent
                        active={active}
                        payload={payload}
                        labelKey="name"
                      />
                      
                    )}
                    
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
                          <dd className="text-2xl font-semibold text-gray-900 dark:text-white/80">
                            <NumberFlow value={stats.viewCount} />
                          </dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-sm text-muted-foreground font-medium text-gray-600 dark:text-white">
                            Bookmarks
                          </dt>
                          <dd className="text-2xl font-semibold text-gray-900 dark:text-white/80">
                            <NumberFlow value={stats.bookmarkCount} />
                          </dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-sm text-muted-foreground font-medium text-gray-600 dark:text-white">
                            Flags
                          </dt>
                          <dd className="text-2xl font-semibold text-gray-900 dark:text-white/80">
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
