import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react'
import { Footer } from '@/Footer';
import { HeaderController } from '@/Header';
import { fetchPhotos } from '@/config';
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

const IndividualPhoto = ({ photo }: { photo: Photo }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <a
      key={photo.index}
      target="_blank"
      rel="noopener noreferrer"
      className="block break-inside-avoid shadow-2xl relative"
    >
      {!isLoaded && (
        <div className="w-full min-h-70 bg-gray-300 animate-pulse" />
      )}

      <img
        src={photo.url}
        alt={`Image ${photo.index + 1}`}
        loading="lazy"
        className={`w-full min-h-70 max-h-[70vh] h-auto object-cover shadow-xl transition-opacity duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-0 absolute top-0'
        }`}

        onLoad={() => setIsLoaded(true)}
      />
    </a>
  );
}; 

const IndexMain: React.FC = () => {
  const { status, data: photos = [], error } = useQuery({
    queryKey: ['photos', 'homepage'],
    queryFn: () => fetchPhotos('homepage'),
  });

  const Photos = () => {
    if (status === 'pending') {
      return <div>Loading...</div>
    }

    if (status === 'error') {
      return <div>Error: {error.message}</div>
    }

    return (
      <div className="w-11/12 mx-auto columns-sm gap-6 space-y-6 pb-20">
        {photos
        .sort((a: Photo, b: Photo) => a.index - b.index)
        .map((photo: Photo) => (
          <IndividualPhoto key={photo.index} photo={photo} />
        ))}
      </div>
    );
  }

  const text = (status === 'success' && photos.length === 0) 
    ? 'No Photos Available' 
    : 'Recent Photos';

  return (
    <div className="grid gap-14 place-items-center h-full max-w-fit auto-rows-min last:pb-20 min-h-screen">
      <h1 className='w-screen text-4xl font-semibold sm:text-5xl text-onyx p-10 pt-45 grid place-content-center'>
        {text}
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