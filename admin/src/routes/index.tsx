import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { auth, authInitializedPromise } from '@/main'
import { signInWithCustomToken, signOut } from 'firebase/auth'

interface Album {
  id: string,
  name: string,
  href: string,
  selected: boolean,
  photos: {
      [key: string]: {
        name: string,
        href: string
    }
  }
}

interface Collection {
  name: string,
  album: string,
  selected: boolean
}

export const Route = createFileRoute('/')({
  component: Index,
  beforeLoad: async ({ location }) => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const customToken = params.get('token');

    if (customToken) {
      console.log('Found custom token, signing in with it...');
      try {
        await signInWithCustomToken(auth, customToken);
        window.location.hash = '';
      } catch (err) {
        console.log('Error when logging in with custom token');
      }
    }

    await authInitializedPromise;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log("No user signed in on the frontend. Skipping backend check.");
       throw redirect({
        to: '/login',
        search: {
          redirect: location.pathname
        }
      })
    }

    const idToken = await currentUser?.getIdToken(true);
    console.log('Fetching auth status...');

    const status = await fetch('https://localhost:5000/auth-status', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then(json => {
      console.log(json);console.log('clicked');
      return json.isAuthenticated;
    });

    if (!Boolean(status)) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.pathname
        }
      })
    }
  }
})

function Index() {
  const [activeInd, setInd] = useState(0);
  const [activeColl, setColl] = useState('Home');
  const pages = ['Home', 'Collections', 'About'];

  const fetchAlbums = async () => {
    const currentUser = auth.currentUser;
    const idToken = await currentUser?.getIdToken(true);
    const response = await fetch(`https://localhost:5000/get-albums/${activeColl}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    const resJson = await response.json();
    return Object.entries(resJson).map(([key, value]: [string, any]) => ({
      id: key,
      name: value.name,
      href: value.href,
      selected: key === resJson['selected'],
      photos: value.photos
    }) as Album).slice(0, -1);
  }

  const updateAlbum = async (href: string) => {
    const currentUser = auth.currentUser;
    const idToken = await currentUser?.getIdToken(true);
    const response = await fetch(`https://localhost:5000/album-click/${href}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) throw new Error('Failed to update album');
    return await response.json();
  }

  const Header = () => {
    return (
      <header className='flex flex-row text-3xl gap-25 place-content-center my-6'>
        {pages.map((label, ind) => (
          <button key={ind} className={`w-fit h-fit p-1 text-2xl border-4 self-end hover:text-gray-500 hover:border-gray-500 hover:cursor-pointer 
            ${activeInd == ind ? 'text-gray-500 border-gray-500' : 'border-black'}`} onClick={() => {
              setInd(ind);
              if (pages[ind] == 'Home') {
                setColl('Home');
              } else {
                setColl('');
              }
            }}>
            {label}
          </button>
        ))}
      </header>
    )
  }

  const Albums = () => {
    const queryClient = useQueryClient();
    const { status, data: albums, error } = useQuery({
      queryKey: ['albums'],
      queryFn: fetchAlbums
    });

    const mutation = useMutation({
      mutationFn: (href: string) => updateAlbum(href),
      onSettled: () => queryClient.invalidateQueries()
    })

    const [activeId, setId] = useState('');

    if (status === 'pending') {
      return <div>Loading...</div>
    }

    if (status === 'error') {
      return <div>Error: {error.message}</div>
    }

    console.log(albums);

    return (
      <div className='p-5'>
        {albums.map((album: Album) => (
          <div key={album.id}>
            <label>
              <input
                className='mx-2'
                type='checkbox'
                checked={album.selected}
                onChange={() => {
                  mutation.mutate(`${album.id}/${activeColl}`);
                  
                  if (activeId === album.id) {
                    setId('');
                  } else {
                    if (activeId != '') mutation.mutate(`${activeId}/${activeColl}`);
                    setId(album.id);
                  }
                }
              }
              />
              {album.name}
            </label>
          </div>
        ))}
      </div>
    )
  }

  const fetchCollections = async () => {
    const currentUser = auth.currentUser;
    const idToken = await currentUser?.getIdToken(true);
    const response = await fetch(`https://localhost:5000/get-collections`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    const resJson = await response.json();
    delete resJson.Home;
    return Object.entries(resJson).map(([key, value]: [string, any]) => ({
      name: key,
      album: value.album,
      selected: value.selected
    }) as Collection);
  }

  const updateCollections = async (href: string) => {
    const currentUser = auth.currentUser;
    const idToken = await currentUser?.getIdToken(true);
    const response = await fetch(`https://localhost:5000/collection-click/${href}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) throw new Error('Failed to update collections');
    return await response.json();
  }

  const delCollection = async (href: string) => {
    const currentUser = auth.currentUser;
    const idToken = await currentUser?.getIdToken(true);
    const response = await fetch(`https://localhost:5000/del-collection/${href}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) throw new Error('Failed to delete collection');
    return await response.json();
  }

  const addCollection = async (href: string) => {
    const currentUser = auth.currentUser;
    const idToken = await currentUser?.getIdToken(true);
    const response = await fetch(`https://localhost:5000/add-collection/${href}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) throw new Error('Failed to update collections');
    return await response.json();
  }

  const Collection = (collectionKey: string) => {
    const queryClient = useQueryClient();
    const cache: Collection[] | undefined = queryClient.getQueryData(['collections']);

    if (typeof cache !== 'undefined') {
      const updateMutation = useMutation({
        mutationFn: (href: string) => updateCollections(href),
        onSettled: () => queryClient.invalidateQueries()
      });

      const delMutation = useMutation({
        mutationFn: (href: string) => delCollection(href),
        onSettled: () => queryClient.invalidateQueries()
      });

      const collection = cache.find(coll => coll.name === collectionKey);

      if (typeof collection === 'undefined') {
        return (
          <div>
            An unexpected error occurred when accessing collection data
          </div>
        )
      }

      return (
        <div className='bg-white flex-col'>
          <button onClick={() => setColl('')} className="w-6 h-fit hover:text-gray-600 hover:cursor-pointer focus:test-white pt-7 pl-7" aria-label='Exit navigation menu'>
            <svg xmlns="http://www.w3.org/2000/svg" strokeWidth={2} stroke="currentColor" className='h-6'>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 22 22 2M2 2l20 20" />
            </svg>
          </button>
          <div className='flex flex-row justify-between'>
            <div className='flex flex-row items-center'>
              <h2 className='m-7 p-1 text-2xl border-4 w-min'>{activeColl}</h2>
              <input
                  className='mx-2'
                  type='checkbox'
                  checked={collection.selected}
                  onChange={() => {
                    updateMutation.mutate(collection.name);
                  }
                }
                /><label>Enable</label>
            </div>
            <button onClick={() => {
              delMutation.mutate(collection.name);
              setColl('');
            }} className='m-7 p-1 text-2xl text-red-700 border-4 w-min hover:cursor-pointer'>Delete</button>
          </div>
          {Albums()}
        </div>
      )
    } else {
      return (
        <div>
          An unexpected error occurred when accessing collection data
        </div>
      )
    }
  }

  const Collections = () => {
    const queryClient = useQueryClient();
    const { status, data: collections, error } = useQuery({
      queryKey: ['collections'],
      queryFn: fetchCollections
    });

    const mutation = useMutation({
      mutationFn: (href: string) => addCollection(href),
      onSettled: () => queryClient.invalidateQueries()
    })

    const [value, setValue] = useState('');
    // const [activeId, setId] = useState('');

    if (status === 'pending') {
      return <div>Loading...</div>
    }

    if (status === 'error') {
      return <div>Error: {error.message}</div>
    }

    return (
      <div>
        {collections.map((collection: Collection) => (
          <div key={collection.name}>
            <button
                className={`w-fit h-fit p-1 m-3 text-xl border-3 self-end hover:text-gray-500 hover:border-gray-500 hover:cursor-pointer 
                ${activeColl == collection.name ? 'text-gray-500 border-gray-500' : 'border-black'}`} onClick={() => setColl(collection.name)}
              >
              {collection.name}
            </button>
          </div>
        ))}
        <input placeholder='Enter collection name here' type='text' value={value} className='m-5 p-2 border-3 border-black' onChange={e => setValue(e.target.value)}
        onBlur={() => {
          mutation.mutate(`${value}`);
          setValue('');
        }}>
        </input>
        {activeColl && <div className='fixed top-0 left-0 w-full h-full z-100 overflow-y-scroll'>{Collection(activeColl)}</div>}
      </div>
    )
  }

  const About = () => {
    return (
      <div>

      </div>
    )
  }

  const logout = async () => {
    console.log('clicked');
    try {
      await signOut(auth);
      console.log('Logged out user');
    } catch (err) {
      console.log('Error when deleting current user: ', err);
    }

    redirect({
      to: '/login',
      search: {
        redirect: location.pathname
      }
    });
  }

  const logoutButton = () => {
    return(
        <Link to='/login' className='m-2 w-fit'>
          <button onClick={async () => await logout()} className='w-fit h-fit p-1 text-2xl border-black border-4 self-end hover:text-gray-500 hover:border-gray-500 hover:cursor-pointer'>
              Logout
          </button>
        </Link>
    )
  }

  const PageSelector = () => {
    switch(activeInd) {
      case 0:
        return <Albums />;
      case 1:
        return <Collections />;
      case 2:
        return <About />;
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {logoutButton()}
      {Header()}
      <PageSelector />
    </div>
  )
}
