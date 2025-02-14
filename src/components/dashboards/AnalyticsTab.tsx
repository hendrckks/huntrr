import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import type { ListingDocument } from "../../lib/types/Listing";
import type { ListingAnalytics } from "../../lib/types/Analytics";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../ui/chart";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { UseQueryResult } from "@tanstack/react-query";
// import AnalyticsDebug from "./AnalyticsDebug";

interface AnalyticsTabProps {
  listings: ListingDocument[];
  analyticsQuery: UseQueryResult<ListingAnalytics[], Error>;
}

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  listings,
  analyticsQuery,
}) => {
  const analytics = analyticsQuery.data || [];
  const publishedListings = listings.filter((l) => l.status === "published");

  // Refetch analytics data when needed
  useEffect(() => {
    if (analyticsQuery.refetch) {
      const refetchInterval = setInterval(() => {
        analyticsQuery.refetch();
      }, 3600000); // Refetch every 1 hour

      return () => clearInterval(refetchInterval);
    }
  }, [analyticsQuery]);

  const getAnalytics = (listingId: string) => {
    const analyticsData = analytics.find((a) => a.listingId === listingId);
    if (analyticsData) {
      return {
        ...analyticsData,
        lastUpdated: analyticsData.lastUpdated instanceof Date 
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

  const chartData = publishedListings.map((listing) => {
    const stats = getAnalytics(listing.id);
    return {
      name:
        listing.slug.substring(0, 20) +
        (listing.slug.length > 20 ? "..." : ""),
      views: stats.viewCount,
      bookmarks: stats.bookmarkCount,
      flags: stats.flagCount,
    };
  });

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
      <div className="space-y-6 p-6">
        {/* <AnalyticsDebug listings={listings} analyticsQuery={analyticsQuery} /> */}
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-blue-50">
            <CardContent className="p-4">
              <div className="text-sm font-medium text-blue-600">
                Total Views
              </div>
              <div className="text-2xl font-bold text-blue-700">
                {totalStats.views}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50">
            <CardContent className="p-4">
              <div className="text-sm font-medium text-green-600">
                Total Bookmarks
              </div>
              <div className="text-2xl font-bold text-green-700">
                {totalStats.bookmarks}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-50">
            <CardContent className="p-4">
              <div className="text-sm font-medium text-yellow-600">
                Total Flags
              </div>
              <div className="text-2xl font-bold text-yellow-700">
                {totalStats.flags}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Chart */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Performance Overview</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 px-6">
            <div className="w-full h-[400px] md:h-[500px] lg:h-[600px]">
              <ChartContainer
                config={{
                  views: {
                    label: "Views",
                    theme: {
                      light: "#3b82f6",
                      dark: "#60a5fa",
                    },
                  },
                  bookmarks: {
                    label: "Bookmarks",
                    theme: {
                      light: "#22c55e",
                      dark: "#4ade80",
                    },
                  },
                  flags: {
                    label: "Flags",
                    theme: {
                      light: "#eab308",
                      dark: "#facc15",
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
                    fill="#3b82f6"
                  />
                  <Bar
                    dataKey="bookmarks"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    fill="#22c55e"
                  />
                  <Bar
                    dataKey="flags"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    fill="#eab308"
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
                          <dt className="text-sm text-muted-foreground">
                            Views
                          </dt>
                          <dd className="text-2xl font-semibold text-blue-600">
                            {stats.viewCount}
                          </dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-sm text-muted-foreground">
                            Bookmarks
                          </dt>
                          <dd className="text-2xl font-semibold text-green-600">
                            {stats.bookmarkCount}
                          </dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-sm text-muted-foreground">
                            Flags
                          </dt>
                          <dd className="text-2xl font-semibold text-yellow-600">
                            {stats.flagCount}
                          </dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-sm text-muted-foreground">
                            Last Updated
                          </dt>
                          <dd className="text-sm">
                            {stats.lastUpdated instanceof Date ? stats.lastUpdated.toLocaleString() : new Date().toLocaleString()}
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
