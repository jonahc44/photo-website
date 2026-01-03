import { Footer } from '@/Footer'
import { Link } from '@tanstack/react-router';

const strConf = `hover:text-gray-400 hover:cursor-pointer focus:text-gray-400 h-min col-start-2 col-2 p-3 border-4`

export function NotFound() {
  return (
    <div className='max-w-screen min-h-screen h-full flex flex-col bg-eggshell'>
      <main className='flex-grow'>
        <h1 className='pt-30 pl-20 p-10 text-9xl'>404</h1>
        <p className='pl-20 mr-10 text-3xl'>The page you're looking for doesn't exist!</p>
        <h2 className='p-20 pb-10 text-5xl'>Go back to:</h2>
        <div className='flex flex-row text-5xl pb-10 justify-center gap-30'>
          <Link to='/' className={strConf} aria-label='Go to home page'>Home</Link>
          <Link to='/collections' className={strConf} aria-label='Go to collections page'>Collections</Link>
          <Link to="/about" className={strConf} aria-label='Go to about page'>About</Link>
        </div>
      </main>
      <footer>
        <Footer />
      </footer>
    </div>
  )
}