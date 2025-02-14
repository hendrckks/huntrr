import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import type { ListingDocument } from "../../lib/types/Listing";
import type { ListingAnalytics } from "../../lib/types/Analytics";
import { UseQueryResult } from "@tanstack/react-query";

interface AnalyticsDebugProps {
  listings: ListingDocument[];
  analyticsQuery: UseQueryResult<ListingAnalytics[], Error>;
}

const AnalyticsDebug = ({ listings, analyticsQuery }: AnalyticsDebugProps) => {
  const analytics = analyticsQuery.data || [];

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Analytics Debug Info</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Query Status:</h3>
            <pre className="bg-gray-100 p-2 rounded">
              {JSON.stringify(
                {
                  isLoading: analyticsQuery.isLoading,
                  isError: analyticsQuery.isError,
                  isFetching: analyticsQuery.isFetching,
                  dataUpdatedAt: new Date(
                    analyticsQuery.dataUpdatedAt
                  ).toLocaleString(),
                },
                null,
                2
              )}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">
              Listings ({listings.length}):
            </h3>
            <div className="max-h-40 overflow-auto">
              {listings.map((listing) => (
                <div key={listing.id} className="text-sm mb-2">
                  ID: {listing.id} - Title: {listing.title}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">
              Analytics Data ({analytics.length}):
            </h3>
            <div className="max-h-40 overflow-auto">
              {analytics.map((stat: ListingAnalytics) => (
                <div key={stat.listingId} className="text-sm mb-2">
                  ListingID: {stat.listingId}
                  Views: {stat.viewCount}
                  Bookmarks: {stat.bookmarkCount}
                  Flags: {stat.flagCount}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Matches:</h3>
            <div className="max-h-40 overflow-auto">
              {listings.map((listing) => {
                const stat = analytics.find((a: ListingAnalytics) => a.listingId === listing.id);
                return (
                  <div key={listing.id} className="text-sm mb-2">
                    {listing.title}: {stat ? "✅ Found" : "❌ No Match"}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalyticsDebug;
