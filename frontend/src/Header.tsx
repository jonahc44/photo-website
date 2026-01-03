import React, { useState, useEffect } from 'react'
import './global.css'
import { Link } from '@tanstack/react-router';

interface HeaderProps {
    handleClick: () => void;
    handleScroll: () => void;
    isHidden: boolean;
    isClicked: boolean;
  }

export const HeaderController: React.FC = () => {
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
        <Header handleClick={handleClick} handleScroll={handleScroll} isHidden={isButtonHidden} isClicked={isButtonClicked} />
        <HeaderMenu handleClick={handleClick} handleScroll={handleScroll} isHidden={isHeaderHidden} isClicked={isButtonClicked} />
      </div>
    );
  }

const SkipToMain: React.FC = () => {
    return (
        <a className={`text-eggshell bg-onyx text-2xl fixed p-2 -top-50 focus:top-31 z-30`} tabIndex={0} href='#main' aria-label='Skip to main'>
            Skip to Main
        </a>
    )
}

const HeaderMenu: React.FC<HeaderProps> = ({handleClick, isHidden}: HeaderProps) => {
  return (
    <div className={`fixed top-0 left-0 right-0 z-10 w-full h-min row-start-1 grid grid-cols-3 auto-rows-min gap-8 justify-items-center bg-onyx text-eggshell text-5xl p-20 transition-all duration-600 ease-in-out motion-reduce:transition-none ${
      isHidden ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <button onClick={handleClick} tabIndex={isHidden ? 0 : -1} className="w-6 h-fit hover:text-white hover:cursor-pointer focus:test-white fixed right-12 top-12" aria-label='Exit navigation menu'>
        <svg xmlns="http://www.w3.org/2000/svg" strokeWidth={2} stroke="currentColor" className='h-6'>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 22 22 2M2 2l20 20" />
        </svg>
      </button>
      <Link to='/' className={`hover:text-white hover:cursor-pointer focus:text-white h-min col-start-2 col-2`} tabIndex={isHidden ? 0 : -1} aria-label='Go to home page'>Home</Link>
      <Link to="/collections" className={`hover:text-white hover:cursor-pointer focus:text-white h-min col-start-2 col-2`} tabIndex={isHidden ? 0 : -1} aria-label='Go to collections page'>Collections</Link>
      <Link to="/about" className={`hover:text-white hover:cursor-pointer focus:text-white h-min col-start-2 col-2`} tabIndex={isHidden ? 0 : -1} aria-label='Go to about page'>About</Link>
    </div>
  )
}

const Header: React.FC<HeaderProps> = ({handleClick, handleScroll, isHidden, isClicked}: HeaderProps) => {
  return (
    <div className={`fixed z-4 flex flex-row justify-between items-center w-screen h-32 bg-onyx text-eggshell transition-transform duration-350 delay-100 ease-in-out motion-reduce:transition-none ${
      isHidden ? (isClicked ? 'invisible' : '' ) : (isClicked ? 'invisible' : 'translate-y-[-140px]')}`} >
        <SkipToMain />
        <Link to ='/' className='text-4xl font-semibold z-5 w-fit pl-10 hover:text-white focus:text-white' tabIndex={isHidden ? 0 : -1} aria-label='Go to home page'>Tommy Gillis</Link>
        <OpenMenu handleClick={handleClick} handleScroll={handleScroll} isHidden={isHidden} isClicked={isClicked}/>
    </div>
  )
}

const OpenMenu: React.FC<HeaderProps> = ({handleClick, isHidden, isClicked}: HeaderProps) => {
  return (
    <button onClick={handleClick} className='text-eggshell' tabIndex={isHidden ? 0 : -1} aria-label='Open navigation menu'>
      <svg xmlns="http://www.w3.org/2000/svg" stroke='currentColor' viewBox='0 0 40 26' className={`w-24 h-min text-eggshell z-6 hover:text-white hover:cursor-pointer focus:text-white transition-transform duration-350 delay-100 ease-in-out motion-reduce:transition-none ${
        isHidden ? (isClicked ? 'invisible' : '' ) : (isClicked ? 'invisible' : 'translate-y-[-140px]')}`}>
          <path d="M 3 5 A 1.0001 1.0001 0 1 0 3 7 L 21 7 A 1.0001 1.0001 0 1 0 21 5 L 3 5 z M 3 11 A 1.0001 1.0001 
          0 1 0 3 13 L 21 13 A 1.0001 1.0001 0 1 0 21 11 L 3 11 z M 3 17 A 1.0001 1.0001 0 1 0 3 19 L 21 19 A 1.0001 1.0001 0 1 0 21 17 L 3 17 z">
          </path>
      </svg>
    </button>
  )
} 