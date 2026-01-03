import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query';
import { Footer } from '@/Footer';
import { HeaderController } from '@/Header';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { apiUrl } from '@/config';
import '../global.css'

interface Collection {
  name: string,
  album: string,
  thumbnail: string,
  thumbnailUrl: string,
  selected: boolean,
  index: number
}

const fetchCollections = async () => {
  // const response = await fetch(`${apiUrl}/get-collections`);
  // if (!response.ok) {
  //   throw new Error('Network response was not ok');
  // }
  
  // const resJson = await response.json();
  // delete resJson.homepage;
  // return Object.entries(resJson).map(([key, value]: [string, any]) => (({
  //   name: key,
  //   album: value.album,
  //   selected: value.selected,
  //   thumbnail: value.thumbnail,
  //   thumbnailUrl: value.thumbnailUrl
  // }) as Collection));

  try {
      const collRef = doc(db, 'photo_metadata', 'collections');
      const collSnapshot = await getDoc(collRef);
  
      if (collSnapshot.exists()) {
        const colls = collSnapshot.data();
        return Object.entries(colls).map(([key, value]: [string, any]) => (({
          name: key,
          album: value.album,
          selected: value.selected,
          thumbnail: value.thumbnail,
          thumbnailUrl: value.thumbnailUrl
        }) as Collection));
      }
      return [];
    } catch (error) {
      console.error("Error fetching photos:", error);
      return [];
    }
}

export const Route = createFileRoute('/collections/')({
  component: Collections,
  loader: fetchCollections
})

const AllCollections = () => {
  const { status, data: collections, error } = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
  });

  if (status === 'pending') {
    return <div>Loading...</div>
  }

  if (status === 'error') {
    return <div>Error: {error.message}</div>
  }

  const visibleCollections = (collections || [])
    .filter((c: any) => c && c.selected) 
    .sort((a: Collection, b: Collection) => a.index - b.index);

  // if (typeof collections === 'object') {
  //   for (let key in collections) {
  //     if (!collections[key].selected) {
  //       delete collections[key];
  //     }
  //   }
  // }

  if (Object.values(collections).length === 0) {
    console.log('No collections have been selected');
    return (
      <div className="flex flex-col place-items-center text-2xl first:pt-50 last:pb-20">
        There are no collections available at the moment
      </div>
    )
  }

  console.log(collections);

  return (
    <div className="flex flex-col p-10 place-items-center first:pt-40 last:pb-20">
      {visibleCollections.map((coll: Collection) => (
        <Link 
          key={coll.index ?? coll.name} 
          to='/collections/$collectionId' 
          params={{collectionId: coll.name}} 
          onClick={() => console.log(`Clicked on ${coll.name}`)}
          className='m-5 p-2 text-3xl border-4 border-onyx text-center font-bold text-onyx hover:text-gray-600 hover:border-gray-600 focus:text-gray-600 focus:border-gray-600'
        >
          <img
            src={coll.thumbnailUrl}
            alt={`Thumbnail for collection ${coll.name}`}
            className='p-1 pb-3'
          />
          {coll.name}
        </Link>
      ))}
    </div>
  );
}

function Collections() {
    return (
      <div className='bg-eggshell max-w-screen min-h-screen flex flex-col'>
          <header>
              <HeaderController />
          </header>
          <main id='main' className='flex-1'>
              <AllCollections />
          </main>
          <footer>
              <Footer />
          </footer>
      </div>
    )
}