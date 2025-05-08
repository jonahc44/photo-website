import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

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

export const Route = createFileRoute('/')({
  component: Index,
  beforeLoad: async ({ location }) => {
    const status = await fetch('https://localhost:5000/auth-status', {
      method: 'GET',
      credentials: 'include'
    })
    .then(response => response.text())
    .then(text => {
      console.log(text);console.log('clicked');
      return Number(text);
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

const fetchAlbums = async () => {
  const response = await fetch('https://localhost:5000/get-albums');

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  
  const resJson = await response.json();
  return Object.entries(resJson).map(([key, value]: [string, any]) => ({
    id: key,
    name: value.name,
    href: value.href,
    selected: value.selected,
    photos: value.photos
  }) as Album );
}

const updateAlbum = async (key: string) => {
  const response = await fetch(`https://localhost:5000/album-click/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
  });

  if (!response.ok) throw new Error('Failed to update album');
  return await response.json();
}

const Albums = () => {
  const queryClient = useQueryClient();
  const { status, data: albums, error } = useQuery({
    queryKey: ['albums'],
    queryFn: fetchAlbums
  });

  const mutation = useMutation({
    mutationFn: (key: string) => updateAlbum(key),
    onSettled: () => queryClient.invalidateQueries()
  })

  if (status === 'pending') {
    return <div>Loading...</div>
  }

  if (status === 'error') {
    return <div>Error: {error.message}</div>
  }

  return (
    <div className='p-5'>
      {albums.map((album: Album) => (
        <div key={album.id}>
          <label>
            <input
              className='mx-2'
              type='checkbox'
              checked={album.selected}
              onClick={() => mutation.mutate(album.id)}
            />
            {album.name}
          </label>
        </div>
      ))}
    </div>
  )
}

const logout = async () => {
  console.log('clicked');
  await fetch('https://localhost:5000/logout', {
    method: 'POST'
  });

  redirect({
    to: '/login',
    search: {
      redirect: location.pathname
    }
  });
}

const logoutButton = () => {
  return(
      <Link to='/login'>
        <button onClick={() => logout()} className='w-1/10 h-7 border-black border-4 rounded-xl self-end'>
            Logout
        </button>
      </Link>
  )
}

function Index() {
  return (
    <div className="flex flex-col min-h-screen">
      {logoutButton()}
      {Albums()}
    </div>
  )
}
