import { collection, doc, getDocs, limit, query, writeBatch } from "firebase/firestore";
import { db } from "../clientApp";
import { generateLocationSearchKeywords } from "../firestore";

export const migrateListingsSearchKeywords = async () => {
    try {
      const batchSize = 500; // Process documents in batches to avoid memory issues
      const listingsRef = collection(db, "listings");
      const q = query(listingsRef, limit(batchSize));
      
      let totalProcessed = 0;
      
      while (true) {
        const batch = writeBatch(db);
        let batchCount = 0;
        
        // Get documents
        const snapshot = await getDocs(q);
        if (snapshot.empty) break;
        
        for (const docSnapshot of snapshot.docs) {
          const listingData = docSnapshot.data();
          const { area, city, neighborhood } = listingData.location;
          
          // Generate search keywords
          const searchKeywords = generateLocationSearchKeywords(
            area,
            city,
            neighborhood
          );
          
          // Update document
          const docRef = doc(db, "listings", docSnapshot.id);
          batch.update(docRef, {
            "location.searchKeywords": searchKeywords,
          });
          
          batchCount++;
        }
        
        // Commit batch
        await batch.commit();
        totalProcessed += batchCount;
        console.log(`Processed ${totalProcessed} documents`);
        
        if (batchCount < batchSize) break;
      }
      
      console.log(`Migration completed. Total documents processed: ${totalProcessed}`);
    } catch (error) {
      console.error("Error during migration:", error);
      throw error;
    }
  };