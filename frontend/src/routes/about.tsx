import { createFileRoute } from '@tanstack/react-router'
// import React, { useState } from 'react'
import { HeaderController } from '@/Header'
import { Footer } from '@/Footer'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import '../global.css'

export const Route = createFileRoute('/about')({
  component: About,
})

const fetchAboutData = async () => {
  const docRef = doc(db, 'about', 'bio');
  const snapshot = await getDoc(docRef);
  
  if (snapshot.exists()) {
    return snapshot.data() as { text?: string; imageUrl?: string };
  }
  return { text: '', imageUrl: '' };
};

function About() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['aboutPage'],
    queryFn: fetchAboutData,
    staleTime: 1000 * 60 * 5
  });

  return (
    <div className='bg-eggshell max-w-screen h-full min-h-screen flex flex-col'>
      <header>
        <HeaderController />
      </header>
      
      <main className='text-3xl text-onyx pt-45 flex flex-col flex-grow items-center w-full max-w-4xl mx-auto px-4'>
        <h1 className='text-7xl font-semibold pb-10'>About</h1>

        {isLoading ? (
          <p className="animate-pulse text-gray-400">Loading...</p>
        ) : isError ? (
          <p className="text-red-500">Failed to load content.</p>
        ) : (
          <div className="flex flex-col items-center gap-8 w-full">
            
            {data?.imageUrl && (
              <img 
                src={data.imageUrl} 
                alt="Portrait" 
                className="w-64 h-64 object-cover rounded-full shadow-lg"
              />
            )}

            <p className='p-12 text-center whitespace-pre-wrap'>
              {data?.text || "Tommy is a photographer based out of Chicago, IL."}
            </p>
          </div>
        )}
      </main>

      <footer>
        <Footer />
      </footer>
    </div>
  )
}