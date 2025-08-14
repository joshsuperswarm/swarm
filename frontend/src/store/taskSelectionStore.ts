import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type TaskSelectionState = {
  selectedTaskId: number | null
  setSelectedTaskId: (taskId: number | null) => void
  clearSelection: () => void
}

export const useTaskSelectionStore = create<TaskSelectionState>()(
  persist(
    (set) => ({
      selectedTaskId: null,
      setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),
      clearSelection: () => set({ selectedTaskId: null }),
    }),
    {
      name: 'task-selection-storage',
    }
  )
)