import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { auth } from '@/config'
import { AuthError, authFetch, authInitializedPromise } from '@/auth'
import { signInWithCustomToken, signOut } from 'firebase/auth'
import Albums from '@/Albums'
import Thumbnail from '@/Thumbnails'
import Collections from '@/Collections'
import About from '@/About'
import { z } from 'zod'

const searchSchema = z.object({
  token: z.string().optional(),
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/')({
  component: Index,
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: async ({ location, search }) => {
    const customToken = search.token;

    if (customToken) {
      console.log('Found custom token, signing in with it...');
      try {
        await signInWithCustomToken(auth, customToken);
      } catch (err) {
        console.log('Error when logging in with custom token: ', err);
      }
    }

    await authInitializedPromise;

    // Anything that stops us from confirming the session - no signed in user, an
    // id token we can't refresh, a 401 from the backend - means the session is
    // stale, so send the user to the login page instead of loading the page.
    let authenticated = false;
    try {
      console.log('Fetching auth status...');
      const response = await authFetch('/auth/status', { method: 'GET' });
      const json = await response.json();
      authenticated = Boolean(json.isAuthenticated);
    } catch (err) {
      if (err instanceof AuthError) {
        console.log('Session is no longer valid: ', err.message);
      } else {
        console.error('Could not verify the session: ', err);
      }
    }

    if (!authenticated) {
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
  const [activeColl, setColl] = useState('homepage');
  const pages = ['Home', 'Collections', 'About'];

  const Header = () => {
    return (
      <header className='flex flex-row text-3xl gap-25 place-content-center my-6'>
        {pages.map((label, ind) => (
          <button key={ind} className={`w-fit h-fit p-1 text-2xl border-4 self-end hover:text-gray-500 hover:border-gray-500 hover:cursor-pointer 
            ${activeInd == ind ? 'text-gray-500 border-gray-500' : 'border-black'}`} onClick={() => {
              setInd(ind);
              if (pages[ind] == 'Home') {
                setColl('homepage');
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

  const Home: React.FC = () => {
    const [editing, setEditing] = useState(false);
    
    const refreshMutation = useMutation({
      mutationFn: async () => {
        const response = await authFetch('/api/refresh', {
          method: 'POST'
        });

        if (!response.ok) {
          throw new Error('Failed to refresh data');
        }
        
        return response.json();
      },
      onSuccess: () => {
        alert("Refresh successful!");
      },
      onError: (error) => {
        console.error(error);
        alert("Failed to refresh.");
      }
    });

    return (
      <div className='flex flex-col w-full'>
        <div className='flex flex-row w-full'>
          <button onClick={() => setEditing(true)}
          className='m-5 p-1 w-35 h-min text-2xl border-4 hover:cursor-pointer hover:text-gray-600 hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
          disabled={refreshMutation.isPending}
          >
            Edit Photos</button>
          {/* <button 
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              className='m-7 p-1 text-2xl w-45 h-min border-4 ml-auto hover:cursor-pointer hover:text-gray-600 hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {refreshMutation.isPending ? 'Refreshing...' : 'Refresh Photos'}
            </button> */}
          </div>
        <Albums activeColl={activeColl} />
        {editing && (
          <div>
            <Thumbnail collectionKey={'homepage'} setThumbnail={setEditing} />
          </div>
        )}
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
        return <Home />;
      case 1:
        return <Collections setColl={setColl} activeColl={activeColl} />;
      case 2:
        return <About />;
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {logoutButton()}
      <Header />
      <PageSelector />
    </div>
  )
}
