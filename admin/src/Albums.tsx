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
export const Albums: React.FC<AlbumsProps> = ({ activeColl }) => {
    const queryClient = useQueryClient();
    
    const { status, data: albums, error } = useQuery({
      queryKey: ['albums', activeColl],
      queryFn: () => fetchAlbums(activeColl)
    });

    const mutation = useMutation({
      mutationFn: (id: string) => updateAlbum(`${id}/${activeColl}`),
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['albums', activeColl] });
      }
    });

    if (status === 'pending') return <div>Loading...</div>
    if (status === 'error') return <div>Error: {error.message}</div>

    return (
      <div className='p-5'>
        {mutation.isPending && <div className="text-sm text-gray-500 mb-2">Syncing...</div>}

        {albums.map((album: Album) => (
          <div key={album.id}>
            <label className={`flex items-center space-x-2 ${mutation.isPending ? 'opacity-50' : ''}`}>
              <input
                className='mx-2 cursor-pointer disabled:cursor-not-allowed'
                type='checkbox'
                disabled={mutation.isPending}
                checked={album.selected}
                onChange={() => {
                   mutation.mutate(album.id);
                }}
              />
              {album.name}
            </label>
          </div>
        ))}
      </div>
    )
}

export default Albums;