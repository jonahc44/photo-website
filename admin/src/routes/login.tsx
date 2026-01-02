import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login')({
    component: Login,
})

const loginButton = () => {
    return(
        <a href='https://photo-website-backend--photo-website-f20b9.us-central1.hosted.app/auth' className='bg-red-700 text-white w-1/4 h-20 border-black border-4 rounded-xl text-3xl flex flex-col place-content-center place-items-center'>
            Login with Adobe
        </a>
    )
}

async function Login() {
    return (
        <div className='flex flex-col place-content-center place-items-center min-h-screen'>
            {loginButton()}
        </div>
    )
}