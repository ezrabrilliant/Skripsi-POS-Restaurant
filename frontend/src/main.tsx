import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { MotionConfig } from 'framer-motion'
import App from './App'
import './index.css'
import { ConfirmProvider } from './design-system/hooks/useConfirm'
import { TooltipProvider } from './design-system/primitives/Tooltip'

// Configure React Query for slow networks
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </TooltipProvider>
        <Toaster
          position="top-center"
          gutter={8}
          containerStyle={{
            top: 'max(env(safe-area-inset-top), 12px)',
          }}
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1a201c',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '14px',
              maxWidth: '92vw',
            },
            success: {
              iconTheme: { primary: '#22c55e', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#fff' },
              duration: 4500,
            },
          }}
        />
      </QueryClientProvider>
    </MotionConfig>
  </React.StrictMode>,
)
