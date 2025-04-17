import { createFileRoute } from '@tanstack/react-router'
import React, { useState } from 'react'
import '../global.css'

export const Route = createFileRoute('/')({
  component: Index,
})

interface OpenHeaderProps {
  handleClick: () => void;
  isHidden: boolean;
}

interface IndexHeaderProps {
  isHidden: boolean;
}

const HeaderController: React.FC = () => {
  const [isHeaderHidden, setIsHeaderHidden] = useState<boolean>(false);
  const [isButtonHidden, setIsButtonHidden] = useState<boolean>(true);

  const handleClick = () => {
    setIsHeaderHidden((prev) => !prev);
    setIsButtonHidden((prev) => !prev);
  };

  return (
    <div>
      <OpenHeader handleClick={handleClick} isHidden={isButtonHidden}/>
      <IndexHeader isHidden={isHeaderHidden} />
    </div>
  );
}

const OpenHeader: React.FC<OpenHeaderProps> = ({handleClick, isHidden}: OpenHeaderProps) => {
  return (
    <button onClick={handleClick}>
      <span className={`text-6xl text-onyx p-5 hover:text-gray-400 hover:cursor-pointer ${isHidden ? '' : 'hidden'}`}>
        &#9776;
      </span>
    </button>
  )
} 

const IndexHeader: React.FC<IndexHeaderProps> = ({ isHidden }: IndexHeaderProps) => {
  return (
    <div id="header" className={`bg-onyx text-eggshell p-4 h-screen ${isHidden ? '' : 'hidden'}`}>
      <a href="/">Tommy Gillis</a>
    </div>
  )
}

// function IndexFooter() {
//   return (
//     <div className='Index-footer'>
//       <a>Tommy Gillis</a>
//     </div>
//   )
// }

function Index() {
  return (
    <header>
      <HeaderController />
      {/* <footer>
        { IndexFooter() }
      </footer> */}
    </header>
  )
}