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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { auth } from '@/main'
import Albums from './Albums'
import Thumbnail from './Thumbnails'

export interface Collection {
  name: string,
  album: string,
  thumbnail: string,
  selected: boolean,
  index: number
}

export const fetchCollections = async (home = false) => {
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
    if (!home) delete resJson.homepage;
    
    return Object.entries(resJson).map(([key, value]: [string, any]) => ({
      name: key,
      album: value.album,
      selected: value.selected,
      thumbnail: value.thumbnail
    }) as Collection);
  }

const reorderCollections = async (colls: Collection[]) => {
    const currentUser = auth.currentUser;
    const idToken = await currentUser?.getIdToken(true);
    const response = await fetch(`https://localhost:5000/reorder-collections`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(colls)
    });

    if (!response.ok) throw new Error('Failed to reorder collections');
    // return await response.json();
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

type CollectionProps = { setColl: React.Dispatch<React.SetStateAction<string>>, activeColl: string };
const Collection: React.FC<CollectionProps> = ({setColl, activeColl}) => {
    const [thumbnail, setThumbnail] = useState(false);
    const queryClient = useQueryClient();

    const { status, data: collections, error } = useQuery({
      queryKey: ['collections'],
      queryFn: () => fetchCollections()
    });

    const updateMutation = useMutation({
      mutationFn: (href: string) => updateCollections(href),
      onSettled: () => queryClient.invalidateQueries()
    });

    const delMutation = useMutation({
      mutationFn: (href: string) => delCollection(href),
      onSettled: () => queryClient.invalidateQueries()
    });

    if (status === 'pending') return <div>Loading...</div>;
    if (status === 'error' || !collections) return <div>Error: {error?.message || "Failed to load collections"}</div>;

    const collection = collections.find(coll => coll.name === activeColl);

    if (!collection) {
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
              /><label className='pr-50'>Enable</label>
              <button onClick={() => setThumbnail(true)}
              className='m-7 p-1 text-2xl border-4 hover:cursor-pointer'>Edit Photos</button>
          </div>
          <button onClick={() => {
            delMutation.mutate(collection.name);
            setColl('');
          }} className='m-7 mr-15 p-1 text-2xl text-red-700 border-4 w-min hover:cursor-pointer'>Delete</button>
        </div>
        <Albums activeColl={activeColl} />
        {thumbnail && <Thumbnail collectionKey={activeColl} setThumbnail={setThumbnail} />}
      </div>
    )
}

function SortableCollectionRow({
    collection,
    activeColl,
    setColl,
}: {
    collection: Collection;
    activeColl: string | null;
    setColl: (name: string) => void;
}) {
    const {
      setNodeRef,
      attributes,
      listeners,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: collection.name });

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
        className="flex flex-row items-center p-1"
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
        <button
          className={`w-fit h-fit p-1 m-1 ml-0 text-xl border-3 self-end hover:text-gray-500 hover:border-gray-500 hover:cursor-pointer 
                  ${activeColl == collection.name ? 'text-gray-500 border-gray-500' : 'border-black'}`}
          onClick={() => setColl(collection.name)}
        >
          {collection.name}
        </button>
      </div>
    );
}

type CollectionsProps = { setColl: React.Dispatch<React.SetStateAction<string>>, activeColl: string };
const Collections: React.FC<CollectionsProps> = ({setColl, activeColl}) => {
    const queryClient = useQueryClient();
    const { status, data: collections, error } = useQuery({
      queryKey: ['collections'],
      queryFn: () => fetchCollections()
    });

    const addMutation = useMutation({
      mutationFn: (href: string) => addCollection(href),
      onSettled: () => queryClient.invalidateQueries()
    });

    const reorderMutation = useMutation({
      mutationFn: (colls: Collection[]) => reorderCollections(colls),
    });

    const [value, setValue] = useState('');
    const [colls, setColls] = useState<Collection[]>();
    useEffect(() => {
      if (collections) setColls(collections);
    }, [collections]);
    // const [activeId, setId] = useState('');
    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      if (!colls) return;
      const oldInd = colls?.findIndex(c => c.name === active.id);
      const newInd = colls?.findIndex(c => c.name === over.id);
      console.log(`Moving from ${oldInd} to ${newInd}`);
      const newList = arrayMove(colls, oldInd, newInd);
      const indexedList = newList.map((item, idx) => ({ ...item, index: idx }));
      setColls(indexedList);
      reorderMutation.mutate(indexedList);
    };

    if (status === 'pending') {
      return <div>Loading...</div>
    }

    if (status === 'error') {
      return <div>Error: {error.message}</div>
    }

    if (!colls) {
      console.log('Collection type is undefined');
      return <div>Unexpected error occurred</div>;
    };

    return (
    <div>
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={colls.map((c) => c.name)}
          strategy={verticalListSortingStrategy}
        >
          {colls.map((collection) => (
            <SortableCollectionRow
              key={collection.index}
              collection={collection}
              activeColl={activeColl}
              setColl={setColl}
            />
            ))}
          </SortableContext>
        </DndContext>
      <input
        placeholder="Enter collection name here"
        type="text"
        value={value}
        className="m-5 p-2 border-3 border-black"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          addMutation.mutate(`${value}`);
          setValue('');
        }}
      />
      {activeColl && (
        <div className="fixed top-0 left-0 w-full h-full z-50 overflow-y-scroll">
          <Collection setColl={setColl} activeColl={activeColl} />
        </div>
      )}
    </div>
    );
}

export default Collections;