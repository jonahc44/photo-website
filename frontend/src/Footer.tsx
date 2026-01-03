import { library } from '@fortawesome/fontawesome-svg-core'
import { faInstagram } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

library.add(faInstagram);

export const Footer: React.FC = () => {
  return (
    <div className='flex flex-row justify-between items-center h-20 bg-onyx text-eggshell text-xl sm:text-2xl'>
      <p className='pl-10 w-fit justify-self-start'>&copy; {new Date().getFullYear()} Tommy Gillis</p>
      <div className='flex pr-10 space-x-10'>
        <a href='https://www.instagram.com/strato.stella?igsh=M3Bsc200Nm5nc2hw' className='hover:text-white' target='_blank' aria-label="Visit my Instagram page">
            <FontAwesomeIcon icon={faInstagram} size='xl' />
        </a>
        <a href='mailto:humdjg@gmail.com' className='hover:text-white' aria-label='Email me'>Contact Me</a>
      </div>
    </div>
  )
}