import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './features/auth/AuthProvider'
import Splash from './components/layout/Splash'
import { router } from './routes/router'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Splash>
          <RouterProvider router={router} />
        </Splash>
      </AuthProvider>
    </QueryClientProvider>
  )
}