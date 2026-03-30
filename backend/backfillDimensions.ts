import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import sizeOf from 'image-size';

// 1. Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'src/serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Replace with your actual bucket name from the Firebase console
  storageBucket: "photo-website-f20b9.firebasestorage.app" 
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const backfillDimensions = async () => {
  console.log("🚀 Starting dimension backfill...");
  const albumsRef = db.collection('photo_metadata').doc('albums');
  
  try {
    const doc = await albumsRef.get();
    
    if (!doc.exists) {
      console.error("No albums document found in Firestore.");
      return;
    }

    const albums = doc.data();
    let photosUpdated = 0;

    if (albums && typeof albums === 'object') {
      
      // 2. Loop through every album
      for (const albumKey in albums) {
        const photos = albums[albumKey]?.photos;
        if (!photos) continue;

        console.log(`Processing album: ${albumKey}...`);

        for (const photoKey in photos) {
          const photo = photos[photoKey];

          // 3. Only process if width OR height is missing
          if (!photo.width || !photo.height) {
            try {
              // Use the storage path stored in photo.url (e.g. "photos/image1.jpg")
              const file = bucket.file(photo.url);
              const [exists] = await file.exists();

              if (!exists) {
                console.warn(`   ⚠️ Skipping ${photoKey}: File not found at ${photo.url}`);
                continue;
              }

              // Download the buffer to "sniff" the dimensions
              const [buffer] = await file.download();
              const dimensions = sizeOf(buffer);

              if (dimensions.width && dimensions.height) {
                albums[albumKey].photos[photoKey].width = dimensions.width;
                albums[albumKey].photos[photoKey].height = dimensions.height;
                photosUpdated++;
                console.log(`   ✅ Set ${dimensions.width}x${dimensions.height} for ${photoKey}`);
              }

            } catch (err: any) {
              console.error(`   ❌ Failed to process ${photoKey}:`, err.message);
            }
          }
        }
      }

      // 4. Save the updated object back to Firestore
      if (photosUpdated > 0) {
        console.log(`\nFound ${photosUpdated} photos missing dimensions. Pushing to Firestore...`);
        await albumsRef.set(albums);
        console.log("🎉 Backfill complete! Your UI should now be stable.");
      } else {
        console.log("\n✨ All photos already have dimensions. No changes made.");
      }

    } else {
      console.error("Backfill failed: The 'albums' data is not a valid object.");
    }

  } catch (error) {
    console.error("Error during backfill:", error);
  }
}

backfillDimensions();