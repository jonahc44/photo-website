import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// 1. Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const migrateUrls = async () => {
  console.log("Starting URL migration...");
  const albumsRef = db.collection('photo_metadata').doc('albums');
  
  try {
    const doc = await albumsRef.get();
    
    if (!doc.exists) {
      console.error("No albums document found in Firestore.");
      return;
    }

    const albums = doc.data();
    let updatedCount = 0;

    // --- ADDED TYPE CHECK ---
    // Ensure albums exists and is actually an object before manipulating it
    if (albums && typeof albums === 'object') {
      
      // 2. Loop through every album and its photos
      for (const albumKey in albums) {
        const photos = albums[albumKey]?.photos;
        if (!photos) continue;

        for (const photoKey in photos) {
          const photo = photos[photoKey];

          // 3. Check and fix the main URL
          if (photo.url && photo.url.startsWith('http')) {
            albums[albumKey].photos[photoKey].url = `photos/${photoKey}.jpg`;
            updatedCount++;
          }

          // 4. Check and fix the thumbnail URL
          if (photo.thumbnail && photo.thumbnail.startsWith('http')) {
            albums[albumKey].photos[photoKey].thumbnail = `thumbnails/${photoKey}.jpg`;
            updatedCount++;
          }
        }
      }

      // 5. Save the cleaned data back to the database
      if (updatedCount > 0) {
        console.log(`Found ${updatedCount} messy URLs. Pushing updates to Firestore...`);
        await albumsRef.set(albums);
        console.log("Migration complete! Your database is now clean.");
      } else {
        console.log("No HTTP URLs found. Your database is already using clean storage paths!");
      }

    } else {
      console.error("Migration failed: The 'albums' data is not a valid object.");
    }

  } catch (error) {
    console.error("Error migrating URLs:", error);
  }
}

migrateUrls();