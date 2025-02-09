import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase/clientApp';
import { useQuery } from '@tanstack/react-query';
import { getListingsByStatus } from '../lib/firebase/firestore';
import { useToast } from '../hooks/useToast';
import type { ListingDocument } from '../lib/types/Listing';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { Check, X, Eye } from 'lucide-react';

const ListingsTab = () => {
  const { toast } = useToast();
  const { data: pendingListings = [], refetch } = useQuery<ListingDocument[]>({
    queryKey: ['pending-listings'],
    queryFn: () => getListingsByStatus('pending_review'),
    refetchInterval: 30000,
  });

  const handleListingAction = async (listingId: string, approved: boolean) => {
    try {
      await runTransaction(db, async (transaction) => {
        const listingRef = doc(db, 'listings', listingId);
        
        transaction.update(listingRef, {
          status: approved ? 'published' : 'denied',
          reviewedAt: new Date(),
        });
      });

      await refetch();
      toast({
        title: 'Success',
        description: `Listing ${approved ? 'approved' : 'denied'} successfully`,
      });
    } catch (error) {
      console.error('Error processing listing:', error);
      toast({
        title: 'Error',
        description: 'Failed to process listing',
        variant: 'error',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Listings</CardTitle>
        <CardDescription>Review and approve new or updated listings</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {pendingListings.length === 0 ? (
            <p className="text-center text-gray-500">No listings pending review</p>
          ) : (
            <div className="space-y-4">
              {pendingListings.map((listing: ListingDocument) => (
                <Card key={listing.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{listing.title}</h3>
                          <Badge>PENDING REVIEW</Badge>
                        </div>
                        <p className="text-sm text-gray-500">
                          {listing.location.area}, {listing.location.city}
                        </p>
                        <p className="text-sm">
                          ${listing.price}/month • {listing.bedrooms} beds •{' '}
                          {listing.bathrooms} baths
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => window.open(`/listing/${listing.id}`, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="default"
                          size="icon"
                          onClick={() => handleListingAction(listing.id, true)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleListingAction(listing.id, false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default ListingsTab;