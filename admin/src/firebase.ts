import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

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