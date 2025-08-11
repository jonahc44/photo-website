import { StrictMode } from 'react'
import * as ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'

// Import the generated route tree
import { routeTree } from './routeTree.gen.ts'

import './styles.css'
import reportWebVitals from './reportWebVitals.ts'

import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'

// Initialize firebase
const firebaseConfig = {
  apiKey: "AIzaSyDY5B4yYYjaM1mj1U2tlrtbAr-jpMBUIkU",
  authDomain: "photo-website-f20b9.firebaseapp.com",
  databaseURL: "https://photo-website-f20b9-default-rtdb.firebaseio.com",
  projectId: "photo-website-f20b9",
  storageBucket: "photo-website-f20b9.firebasestorage.app",
  messagingSenderId: "68823767939",
  appId: "1:68823767939:web:95764f4ab07c1e3e4074b6",
  measurementId: "G-LTE32NVHF6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const authInitializedPromise = new Promise<User | null>((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    resolve(user); // Resolve the promise with the user object (or null)
    unsubscribe(); // Unsubscribe after the first call
  });
});


// Create a new router instance
const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.getElementById('app')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()

export { auth, authInitializedPromise };