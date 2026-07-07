import { create } from 'zustand'

/** Estado del drawer del sidebar en móvil/tablet (< lg). */
interface SidebarState {
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
  close: () => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),
}))
