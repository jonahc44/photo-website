import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query';
import React from 'react'
import { Footer } from '@/Footer';
import { HeaderController } from '@/Header';
import { fetchPhotos } from '@/firebase';
import '../global.css'

type Photo = {
  url: string,
  thumbnail: string,
  index: number
}

// const fetchPhotos = async (collectionId: string) => {
//   console.log(collectionId);
//   const response = await fetch(`${apiUrl}/photos/${collectionId}`);
//   if (!response.ok) {
//     throw new Error('Network response was not ok');
//   }
  
//   return response.json();
// }

export const Route = createFileRoute('/collections/$collectionId')({
  component: Collection,
  loader: ({ params }) => {
    return fetch(params.collectionId)
  }
})

const Photos = () => {
  const { collectionId } = Route.useParams();
  const { status, data: photos, error } = useQuery({
    queryKey: [collectionId],
    queryFn: () => fetchPhotos(collectionId),
    enabled: !!collectionId
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

const CollectionMain: React.FC = () => {
  const photos = Photos();
  const { collectionId } = Route.useParams();
  
  return (
    <div className="grid gap-14 place-items-center h-full max-w-fit auto-rows-min last:pb-20 min-h-screen">
      <h1 className='w-screen text-4xl font-semibold sm:text-5xl text-onyx p-10 pt-45 grid place-content-center'>
        {collectionId}
      </h1>
      {photos}
    </div>
  )
}

function Collection() {
  return (
    <div className='bg-eggshell max-w-screen'>
      <header>
        <HeaderController />
      </header>
      <main id='main'>
        <CollectionMain />
      </main>
      <footer>
        <Footer />
      </footer>
    </div>
  )
}
