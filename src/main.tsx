import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { Toaster } from 'react-hot-toast'

import './styles.css'
import { routeTree } from './router'
import { TRPCReactProvider } from './trpc/react'
import { useAuthStore } from './stores/auth'

// Create a new router instance
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister().then(() => {
          console.log('Old SW unregistered')
        })
      }
    })

    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('New SW registered: ', registration)
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError)
    })
  })
}

// Theme initialization
const { user } = useAuthStore.getState()
if (user?.preferences?.theme === 'dark') {
  document.documentElement.classList.add('dark')
}

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = createRoot(rootElement)
  root.render(
    <StrictMode>
      <TRPCReactProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" />
      </TRPCReactProvider>
    </StrictMode>,
  )
} 