import { create } from 'zustand'

type TaskSelectionState = {
  selectedTaskId: number | null
  setSelectedTaskId: (taskId: number | null) => void
}

export const useTaskSelectionStore = create<TaskSelectionState>((set) => ({
  selectedTaskId: null,
  setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),
}))