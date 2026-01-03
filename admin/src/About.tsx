import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { ref, uploadBytes, deleteObject, listAll, getDownloadURL } from "firebase/storage"
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { storage, db } from '@/firebase'
import { useRef, useState, useEffect } from 'react'

const fetchAboutImage = async () => {
  const folderRef = ref(storage, 'about/');
  const result = await listAll(folderRef);
  return result.items.length > 0 ? result.items[0].name : null;
}

const replaceImage = async (newFile: File) => {
    const folderRef = ref(storage, 'about/');
    const docRef = doc(db, 'about', 'bio');
    const result = await listAll(folderRef);
    
    const deletePromises = result.items.map((itemRef) => deleteObject(itemRef));
    await Promise.all(deletePromises);
    
    const newFileRef = ref(storage, `about/${newFile.name}`);
    const snapshot = await uploadBytes(newFileRef, newFile);

    const url = await getDownloadURL(snapshot.ref);
    await setDoc(docRef, { imageUrl: url }, { merge: true });
    
    return newFile.name;
}

const FileUploadButton = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: fileName, isLoading: isFetchingName } = useQuery({
    queryKey: ['aboutImage'],
    queryFn: fetchAboutImage,
  });

  const mutation = useMutation({
    mutationFn: replaceImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aboutImage'] });
      alert("Image updated successfully!");
    },
    onError: (error) => {
      console.error(error);
      alert("Upload failed.");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }
    mutation.mutate(file);
    e.target.value = '';
  };

  const getButtonLabel = () => {
    if (mutation.isPending) return 'Uploading...';
    if (isFetchingName) return 'Checking files...';
    if (fileName) return `Current File: ${fileName}`;
    return 'Upload About Image';
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: 'none' }}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={mutation.isPending || isFetchingName}
        className="px-6 py-3 m-10 mb-1 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors hover:cursor-pointer"
        >
        {getButtonLabel()}
      </button>
      
      {fileName && !mutation.isPending && (
        <p className="m-10 mt-1 text-sm text-gray-500">
          Uploading a new file will replace <strong>{fileName}</strong>
        </p>
      )}
    </div>
  );
}

const fetchBio = async () => {
  const docRef = doc(db, 'about', 'bio');
  const snapshot = await getDoc(docRef);
  
  return snapshot.exists() ? (snapshot.data().bio as string) : "";
};

const saveBio = async (newText: string) => {
  const docRef = doc(db, 'about', 'bio');
  await setDoc(docRef, { text: newText }, { merge: true });
};

const BioManager = () => {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  const { data, isLoading: isFetching } = useQuery({
    queryKey: ['aboutBio'],
    queryFn: fetchBio,
  });

  useEffect(() => {
    if (data !== undefined) {
      setText(data);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: saveBio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aboutBio'] });
      alert("Bio updated successfully!");
    },
    onError: (error) => {
      console.error(error);
      alert("Failed to save bio.");
    },
  });

  return (
    <div className="flex flex-col gap-3 max-w-xl w-full mr-10 ml-10">
      <label className="font-semibold text-gray-700">
        About Me — Bio Text
      </label>

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isFetching}
          rows={6}
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400 text-gray-800"
          placeholder={isFetching ? "Loading bio..." : "Tell your story here..."}
        />
        
        {isFetching && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-lg">
            <span className="text-sm font-medium text-gray-500">Loading...</span>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => mutation.mutate(text)}
          disabled={mutation.isPending || isFetching}
          className="px-6 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm hover:cursor-pointer"
        >
          {mutation.isPending ? "Saving..." : "Save Bio"}
        </button>
      </div>
      
      {mutation.isError && (
        <p className="text-sm text-red-600 mt-1">
          Error: {mutation.error.message}
        </p>
      )}
    </div>
  );
};

const About = () => {
    return (
        <div>
            <FileUploadButton />
            <BioManager />
        </div>
    )
}

export default About;