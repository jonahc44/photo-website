import { useState } from 'react'

type Photo = {
  url: string,
  index: number,
  width: number,
  height: number
}

const globalLoadedImages = new Set<string>();

export const IndividualPhoto = ({ photo }: { photo: Photo }) => {
  const [isLoaded, setIsLoaded] = useState(() => globalLoadedImages.has(photo.url));

  const handleImageLoad = () => {
    globalLoadedImages.add(photo.url);
    setIsLoaded(true);
  };

  return (
    <a
      key={photo.index}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full break-inside-avoid shadow-2xl relative"
      style={{ 
        aspectRatio: `${photo.width} / ${photo.height}`, 
      }}
    >
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-gray-300" />
      )}

      <img
        src={photo.url}
        alt={`Image ${photo.index + 1}`}
        loading="lazy"
        className={`absolute inset-0 w-full h-auto object-cover shadow-xl transition-opacity duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-0 absolute top-0'
        }`}
        onLoad={handleImageLoad}
      />
    </a>
  );
}; 