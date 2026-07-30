import { Outlet, createRootRoute } from '@tanstack/react-router'
// import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { AuthError, redirectToLogin } from '@/auth'

// A stale session shows up as a failing query/mutation on whatever page the user
// is sitting on. Handle it in one place: send them to the login page instead of
// rendering an error where the Adobe data should be.
const onError = (error: unknown) => {
  if (error instanceof AuthError) redirectToLogin();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => !(error instanceof AuthError) && failureCount < 3
    }
  },
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError })
});

export const Route = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      {/* <TanStackRouterDevtools /> */}
    </QueryClientProvider>
  ),
})
