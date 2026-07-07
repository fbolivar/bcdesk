'use client'

import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#FFFFFF',
          border: '1px solid #E6EBF2',
          color: '#0B2545',
        },
      }}
    />
  )
}
