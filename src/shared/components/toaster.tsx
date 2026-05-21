'use client'

import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#1E293B',
          border: '1px solid #334155',
          color: '#F1F5F9',
        },
      }}
    />
  )
}
