import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query';
import React from 'react'
import { Footer } from '@/Footer';
import { HeaderController } from '@/Header';
import { fetchPhotos } from '@/firebase';
import '../global.css'

type Photo = {
  url: string,
  index: number
}

// const fetchPhotos = async () => {
//   const response = await fetch(`${apiUrl}/photos/homepage`);
//   if (!response.ok) {
//     throw new Error('Network response was not ok');
//   }
  
//   return response.json();
// }

export const Route = createFileRoute('/')({
  component: Index,
  // loader: fetchPhotos
})

const Photos = () => {
  const { status, data: photos = [], error } = useQuery({
    queryKey: ['photos', 'homepage'],
    queryFn: () => fetchPhotos('homepage'),
  });

  if (status === 'pending') {
    return <div>Loading...</div>
  }

  if (status === 'error') {
    return <div>Error: {error.message}</div>
  }

  console.log(photos);

  return (
    <div className="grid gap-14 justify-items-center h-full w-5/6 auto-rows-min last:pb-20">
      {photos.sort((a: Photo, b: Photo) => a.index - b.index).map((photo: Photo) => (
        <a key={photo.index} target="_blank" rel="noopener noreferrer" className="place-self-center">
          <img src={photo.url} alt={`Image ${photo.index + 1}`} loading='lazy' className="max-h-[90vh]"/>
        </a>
      ))}
    </div>
  );
}

const IndexMain: React.FC = () => {
  return (
    <div className="grid gap-14 place-items-center h-full max-w-fit auto-rows-min last:pb-20 min-h-screen">
      <h1 className='w-screen text-4xl font-semibold sm:text-5xl text-onyx p-10 pt-45 grid place-content-center'>
        Recent Photos
      </h1>
      <Photos />
    </div>
  )
}

function Index() {
  return (
    <div className='bg-eggshell max-w-screen'>
      <header>
        <HeaderController />
      </header>
      <main id='main'>
        <IndexMain />
      </main>
      <footer>
        <Footer />
      </footer>
    </div>
  )
}