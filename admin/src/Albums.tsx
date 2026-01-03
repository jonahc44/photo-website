import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { auth } from '@/main'
import { apiUrl } from './config'

export interface Album {
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

export const fetchAlbums = async (activeColl: string) => {
    const currentUser = auth.currentUser;
    const idToken = await currentUser?.getIdToken(true);
    const response = await fetch(`${apiUrl}/get-albums/${activeColl}`, {
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

export const updateAlbum = async (href: string) => {
    const currentUser = auth.currentUser;
    const idToken = await currentUser?.getIdToken(true);
    const response = await fetch(`${apiUrl}/album-click/${href}`, {
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

type AlbumsProps = { activeColl: string };
export const Albums: React.FC<AlbumsProps> = ({activeColl}) => {
    const queryClient = useQueryClient();
    const { status, data: albums, error } = useQuery({
      queryKey: ['albums'],
      queryFn: () => fetchAlbums(activeColl)
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
                className='mx-2 disabled:opacity-50 disabled:cursor-not-allowed'
                type='checkbox'
                disabled={mutation.isPending}
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

export default Albums;