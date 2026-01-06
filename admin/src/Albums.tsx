import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { auth } from '@/main'
import { apiUrl } from './config'

export interface Album {
  id: string,
  name: string,
  href: string,
  collection: string,
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
    const albumsArray = Object.entries(resJson).map(([key, value]: [string, any]) => ({
      id: key,
      name: value.name,
      href: value.href,
      collection: value.collection,
      photos: value.photos
    }) as Album).filter(album => album.name !== undefined);

    return albumsArray.sort((a, b) => a.name.localeCompare(b.name));
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

    const currentAlbum = albums.find((a: Album) => a.collection === activeColl);
    console.log(activeColl);

    return (
      <div className='p-5'>
        {mutation.isPending && <div className="text-sm text-gray-500 mb-2">Syncing...</div>}
        <p className='p-1 mb-3 h-min text-2xl'>
          Currently Selected: <span className="font-bold">{currentAlbum ? currentAlbum.name : 'None'}</span>
        </p>
        {albums.map((album: Album) => (
          <div key={album.id}>
            <label className={`flex items-center space-x-2 ${mutation.isPending ? 'opacity-50' : ''}`}>
              <input
                className='mx-2 cursor-pointer disabled:cursor-not-allowed'
                type='checkbox'
                disabled={mutation.isPending}
                checked={album === currentAlbum}
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