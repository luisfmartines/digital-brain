import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './features/auth/AuthProvider'
import Splash from './components/layout/Splash'
import ThemeSync from './features/profile/ThemeSync'
import { router } from './routes/router'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeSync />
        <Splash>
          <Suspense fallback={<p className="route-loading" role="status">Carregando…</p>}>
            <RouterProvider router={router} />
          </Suspense>
        </Splash>
      </AuthProvider>
    </QueryClientProvider>
  )
}