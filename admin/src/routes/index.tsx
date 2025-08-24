import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { auth, authInitializedPromise } from '@/main'
import { signInWithCustomToken, signOut } from 'firebase/auth'
import Albums from '@/Albums'
import Thumbnail from '@/Thumbnails'
import Collections from '@/Collections'

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
    

    return (
      <div>
        <button onClick={() => setEditing(true)}
        className='m-7 p-1 text-2xl border-4 hover:cursor-pointer'>Edit Photos</button>
        <Albums activeColl={activeColl} />
        {editing && (
          <div>
            <Thumbnail collectionKey={'homepage'} setThumbnail={setEditing} />
          </div>
        )}
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
