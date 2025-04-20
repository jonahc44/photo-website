import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faInstagram } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import '../global.css'

export const Route = createFileRoute('/')({
  component: Index,
})

library.add(faInstagram);

interface HeaderProps {
  handleClick: () => void;
  handleScroll: () => void;
  isHidden: boolean;
  isClicked: boolean;
}

const HeaderController: React.FC = () => {
  // For clicking on menu
  const [isHeaderHidden, setIsHeaderHidden] = useState<boolean>(false);
  const [isButtonHidden, setIsButtonHidden] = useState<boolean>(true);
  const [isButtonClicked, setIsButtonClicked] = useState<boolean>(false);
  const [lastScrollTop, setLastScrollTop] = useState(0);

  const handleClick = () => {
    setIsHeaderHidden((prev) => !prev);
    setIsButtonHidden((prev) => !prev);
    setIsButtonClicked((prev) => !prev);
    setLastScrollTop(0);
  };

  const handleScroll = () => {
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (currentScrollTop > lastScrollTop) {
      // User is scrolling down
      setIsButtonHidden(false);
    } else {
      // User is scrolling up
      setIsButtonHidden(true);
    }

    setLastScrollTop(currentScrollTop <= 0 ? 0 : currentScrollTop);
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollTop]);

  return (
    <div>
      <IndexHeader handleClick={handleClick} handleScroll={handleScroll} isHidden={isButtonHidden} isClicked={isButtonClicked} />
      <OpenMenu handleClick={handleClick} handleScroll={handleScroll} isHidden={isButtonHidden} isClicked={isButtonClicked} />
      <IndexHeaderMenu handleClick={handleClick} handleScroll={handleScroll} isHidden={isHeaderHidden} isClicked={isButtonClicked} />
    </div>
  );
}

const fetchPhotos = async () => {
  const response = await fetch('http://localhost:5000/photos');
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
}

const Photos = () => {
  const { status, data: photos, error } = useQuery({
    queryKey: ['photos'],
    queryFn: fetchPhotos
  })

  if (status === 'pending') {
    return <div>Loading...</div>
  }

  if (status === 'error') {
    return <div>Error: {error.message}</div>
  }

  return (
    <div className="grid gap-14 justify-items-center h-full w-5/6 auto-rows-min last:pb-20">
      {photos.map((url: string, index: string) => (
        <a key={index} href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt={`Image ${index + 1}`} className="max-h-screen" />
        </a>
      ))}
    </div>
  );
}

const OpenMenu: React.FC<HeaderProps> = ({handleClick, isHidden, isClicked}: HeaderProps) => {
  return (
    <button onClick={handleClick}>
      <span className={`fixed right-6 top-1 text-6xl text-eggshell z-6 p-5 hover:text-white hover:cursor-pointer focus:text-white transition-transform duration-350 delay-100 ease-in-out ${
        isHidden ? (isClicked ? 'invisible' : '' ) : (isClicked ? 'invisible' : 'translate-y-[-140px]')}`}>
        &#9776;
      </span>
    </button>
  )
} 

const IndexHeaderMenu: React.FC<HeaderProps> = ({handleClick, isHidden}: HeaderProps) => {
  return (
    <div className={`fixed top-0 left-0 right-0 z-10 w-full h-min row-start-1 grid grid-cols-3 auto-rows-min gap-8 justify-items-center bg-onyx text-eggshell text-5xl p-20 transition-all duration-600 ease-in-out ${
      isHidden ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <button onClick={handleClick}>
        <svg xmlns="http://www.w3.org/2000/svg" strokeWidth={2} stroke="currentColor" className="w-6 h-6 hover:text-white hover:cursor-pointer fixed right-12 top-12">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 22 22 2M2 2l20 20" />
        </svg>
      </button>
      <a href="/" className={`hover:text-white hover:cursor-pointer h-min col-start-2 col-2`}>Home</a>
      <a href="/" className={`hover:text-white hover:cursor-pointer h-min col-start-2 col-2`}>About</a>
    </div>
  )
}

const IndexHeader: React.FC<HeaderProps> = ({isHidden, isClicked}: HeaderProps) => {
  return (
    <div className={`fixed z-4 flex-auto justify-items-start justify-start align-middle w-screen min-h-32 bg-onyx text-eggshell transition-transform duration-350 delay-100 ease-in-out ${
      isHidden ? (isClicked ? 'invisible' : '' ) : (isClicked ? 'invisible' : 'translate-y-[-140px]')}`} >
        <a href='/' className='flex text-4xl items-center justify-start z-5 h-32 pl-10 hover:text-white'>Tommy Gillis</a>
    </div>
  )
}

const IndexMain: React.FC = () => {
  const photos = Photos();
  
  return (
    <div className="grid gap-14 justify-items-center h-full max-w-fit auto-rows-min last:pb-20">
      <h1 className='w-screen text-6xl text-jet p-10 pt-45 grid justify-center'>
        Recent Photos
      </h1>
      {photos}
    </div>
  )
}

const IndexFooter: React.FC = () => {
  return (
    <div className='flex justify-between items-center h-20 bg-onyx align-center text-eggshell text-2xl'>
      <p className='pl-4'>&copy; {new Date().getFullYear()} Tommy Gillis</p>
      <a href='https://www.instagram.com/strato.stella?igsh=M3Bsc200Nm5nc2hw' className='pl-50'>
        <FontAwesomeIcon icon={faInstagram} size='xl' />
      </a>
      <a href='mailto:humdjg@gmail.com' className='pr-8'>Contact Me</a>
    </div>
  )
}

function Index() {
  return (
    <div className='bg-eggshell'>
      <header>
        <HeaderController />
      </header>
      <main>
        <IndexMain />
      </main>
      <footer>
        <IndexFooter />
      </footer>
    </div>
  )
}