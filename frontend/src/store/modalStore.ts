import { create } from 'zustand'

type ModalState = {
  createTaskOpen: boolean
  openCreateTask: () => void
  closeCreateTask: () => void
}

export const useModalStore = create<ModalState>((set) => ({
  createTaskOpen: false,
  openCreateTask: () => set({ createTaskOpen: true }),
  closeCreateTask: () => set({ createTaskOpen: false }),
}))