import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator, ref, getDownloadURL } from 'firebase/storage';
import { getFirestore, getDoc, doc, connectFirestoreEmulator } from 'firebase/firestore';

type Photo = {
  url: string,
  thumbnail: string,
  index: number
}

export const apiUrl = import.meta.env.VITE_API_URL || "https://localhost:5000";

const firebaseConfig = {
  apiKey: "AIzaSyAwQyjYTGJnhn54DS0_qEC9gZjWLtDnwIs",
  authDomain: "photo-website-f20b9.firebaseapp.com",
  databaseURL: "https://photo-website-f20b9-default-rtdb.firebaseio.com",
  projectId: "photo-website-f20b9",
  storageBucket: "photo-website-f20b9.firebasestorage.app",
  messagingSenderId: "68823767939",
  appId: "1:68823767939:web:95764f4ab07c1e3e4074b6",
  measurementId: "G-LTE32NVHF6"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = getFirestore(app);

if (window.location.hostname === "localhost") {
  console.log("Running in development mode: Connecting to emulators");
  
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectAuthEmulator(auth, 'http://localhost:9099');
}

export const fetchPhotos = async (coll: string): Promise<Photo[]> => {
  try {
    const collRef = doc(db, 'photo_metadata', 'collections');
    const collSnapshot = await getDoc(collRef);

    if (collSnapshot.exists()) {
      const albumKey = collSnapshot.data()[coll]?.album;
      
      if (!albumKey) return [];

      const albumRef = doc(db, 'photo_metadata', 'albums');
      const snapshot = await getDoc(albumRef);
      
      if (snapshot.exists()) {
        const photos = snapshot.data()[albumKey]?.photos || [];
        const photosArray = Object.values(photos) as Photo[];

        const photosWithValidUrls = await Promise.all(
          photosArray.map(async (photo) => {
            try {
              const imageRef = ref(storage, photo.url);
              const actualImageUrl = await getDownloadURL(imageRef);

              let actualThumbnailUrl = photo.thumbnail;
              if (photo.thumbnail && !photo.thumbnail.startsWith('http')) {
                const thumbRef = ref(storage, photo.thumbnail);
                actualThumbnailUrl = await getDownloadURL(thumbRef);
              }

              return {
                ...photo,
                url: actualImageUrl,
                thumbnail: actualThumbnailUrl
              };
              
            } catch (err) {
              console.error(`Failed to generate URL for path: ${photo.url}`, err);
              return photo; 
            }
          })
        );

        if (window.location.hostname === "localhost") console.log("Photos with valid URLs:", photosWithValidUrls);
        return photosWithValidUrls;
      }
    }
    return [];
  } catch (error) {
    console.error("Error fetching photos:", error);
    return [];
  }
}