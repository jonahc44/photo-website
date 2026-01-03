import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { auth } from '@/main'
import { type Collection, fetchCollections } from '@/Collections'
import { apiUrl } from './config'

export type Photo = {
  thumbnail: string,
  index: number,
  href: string
}

export const fetchThumbnails = async (album: string) => {
    const response = await fetch(`${apiUrl}/thumbnails/${album}`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    return response.json();
}

export const updateThumbnails = async (href: string) => {
    const currentUser = auth.currentUser;
    const idToken = await currentUser?.getIdToken(true);
    const response = await fetch(`${apiUrl}/thumbnail-click/${href}`, {
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

export const reorderThumbnails = async (photos: Photo[], album: string) => {
    console.log('Reordering photos');
    const currentUser = auth.currentUser;
    const idToken = await currentUser?.getIdToken(true);
    const response = await fetch(`${apiUrl}/reorder-photos/${album}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(photos)
    });

    if (!response.ok) throw new Error('Failed to reorder collections');
}

type ThumbnailsProps = {
    collection: Collection;
    album: string;
};

export const Thumbnails: React.FC<ThumbnailsProps> = ({collection, album}) => {
    if (album === '') {
      return <div>Select an album to modify this collection's photos</div>
    }

    const { status, data: thumbnails, error } = useQuery({
      queryKey: [album],
      queryFn: () => fetchThumbnails(album),
      enabled: !!album
    });

    const [photos, setPhotos] = useState<Photo[]>([]);
    useEffect(() => {
      if (thumbnails) setPhotos(thumbnails);
    }, [thumbnails]);
    const queryClient = useQueryClient();
    const mutation = useMutation({
      mutationFn: (photos: Photo[]) => reorderThumbnails(photos, album),
      onSettled: () => queryClient.invalidateQueries()
    })

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      if (!photos) return;
      const oldInd = photos.findIndex(t => t.href === active.id);
      const newInd = photos.findIndex(t => t.href === over.id);
      console.log(`Moving from ${oldInd} to ${newInd}`);
      const newList = arrayMove(photos, oldInd, newInd);
      const indexedList = newList.map((item, idx) => ({ ...item, index: idx }));
      setPhotos(indexedList);
      mutation.mutate(indexedList);
    };

    console.log(collection);

    if (status === 'pending') {
      return <div>Loading...</div>
    }

    if (status === 'error') {
      return <div>Error: {error.message}</div>
    }

    return (
      <div className="flex flex-wrap gap-14 justify-items-center h-full w-full auto-rows-min first-line:pt-20 last:pb-20">
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={photos.map((t: Photo) => t.href)}
            // strategy={verticalListSortingStrategy}
          >
            {photos.sort((a: Photo, b: Photo) => a.index - b.index).map((thumbnail: Photo) => (
              <SortableThumbnails key={thumbnail.href} thumbnail={thumbnail} collection={collection}/>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    );
}

export function SortableThumbnails({
    thumbnail,
    collection,
  }: {
    thumbnail: Photo;
    collection: Collection
  }) {
    const {
      setNodeRef,
      attributes,
      listeners,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: thumbnail.href });

    const queryClient = useQueryClient();
    const mutation = useMutation({
      mutationFn: (href: string) => updateThumbnails(href),
      onSettled: () => queryClient.invalidateQueries()
    });

    // Style for smooth dragging
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.7 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex flex-row items-center p-1 max-w-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          stroke="currentColor"
          viewBox="0 0 40 26"
          className="w-12 h-min text-eggshell ml-2 hover:cursor-pointer"
          {...listeners}
          {...attributes}
          tabIndex={0}
          aria-label="Drag to reorder"
        >
          <path d="M 3 5 A 1.0001 1.0001 0 1 0 3 7 L 21 7 A 1.0001 1.0001 0 1 0 21 5 L 3 5 z M 3 11 A 1.0001 1.0001 
                  0 1 0 3 13 L 21 13 A 1.0001 1.0001 0 1 0 21 11 L 3 11 z M 3 17 A 1.0001 1.0001 0 1 0 3 19 L 21 19 A 1.0001 1.0001 0 1 0 21 17 L 3 17 z">
          </path>
        </svg>
        <label key={thumbnail.index} className="cursor-pointer">
          <input type='checkbox' checked={collection.thumbnail === thumbnail.href.replace('s/', '_')} 
            className='peer hidden' onChange={() => {
              mutation.mutate(`${collection.name}/${thumbnail.href.replace('s/', '_')}`);
              console.log(`${thumbnail.href.replace('s/', '_')} was clicked`);
            }}/>
          <img src={thumbnail.thumbnail} alt={`Image ${thumbnail.index + 1}`} loading='lazy' 
            className={`p-3 rounded border-2 
            ${collection.thumbnail === thumbnail.href.replace('s/', '_') ? 'border-blue-600' : 'border-gray-400'}`}/>
        </label>
      </div>
    );
  }

type ThumbnailProps = {
  collectionKey: string;
  setThumbnail: React.Dispatch<React.SetStateAction<boolean>>;
};

export const Thumbnail: React.FC<ThumbnailProps> = ({collectionKey, setThumbnail}) => {
    const { status, data: collections, error } = useQuery({
        queryKey: ['collections'],
        queryFn: () => fetchCollections(collectionKey === 'homepage')
    });

    if (typeof collections !== 'undefined') {
      const collection = collections.find(coll => coll.name === collectionKey);
      const album = collection?.album;

      if (!collection || !album) {
        return (
          <div>
            An unexpected error occurred when accessing collection data
          </div>
        )
      }

      return (
        <div className='bg-white flex-col min-h-screen fixed top-0 left-0 w-full h-full z-70 overflow-y-scroll'>
          <button onClick={() => setThumbnail(false)} className="w-6 h-fit hover:text-gray-600 hover:cursor-pointer focus:test-white pt-7 pl-7" aria-label='Exit navigation menu'>
            <svg xmlns="http://www.w3.org/2000/svg" strokeWidth={2} stroke="currentColor" className='h-min'>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 22 22 2M2 2l20 20" />
            </svg>
          </button>
          <Thumbnails collection={collection} album={album} />
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

export default Thumbnail;