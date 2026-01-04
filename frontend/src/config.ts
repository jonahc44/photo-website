import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFirestore, getDoc, doc } from 'firebase/firestore';

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
        console.log(photosArray);
        return photosArray;
      }
    }
    return [];
  } catch (error) {
    console.error("Error fetching photos:", error);
    return [];
  }
}