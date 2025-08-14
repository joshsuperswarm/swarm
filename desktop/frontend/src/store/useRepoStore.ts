import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { RepoSummary, FileMeta, TokenReport } from '../types'

interface RepoStore {
  repo: RepoSummary | null
  files: FileMeta[]
  selectedFiles: string[]
  tokenReport: TokenReport | null
  
  openRepo: () => Promise<void>
  loadRecent: () => Promise<void>
  loadFiles: () => Promise<void>
  toggleFile: (relpath: string) => void
  removeFile: (relpath: string) => void
  clearFiles: () => void
  updateTokens: () => Promise<void>
}

export const useRepoStore = create<RepoStore>((set, get) => ({
  repo: null,
  files: [],
  selectedFiles: [],
  tokenReport: null,

  openRepo: async () => {
    try {
      const repo = await invoke<RepoSummary>('repo_open')
      set({ repo, selectedFiles: [] })
      await get().loadFiles()
    } catch (error) {
      console.error('Failed to open repo:', error)
    }
  },

  loadRecent: async () => {
    try {
      const repo = await invoke<RepoSummary | null>('repo_recent')
      if (repo) {
        set({ repo })
        await get().loadFiles()
        
        // Load saved selected files
        const savedFiles = await invoke<string[]>('load_selected_files')
        if (savedFiles.length > 0) {
          set({ selectedFiles: savedFiles })
          await get().updateTokens()
        }
      }
    } catch (error) {
      console.error('Failed to load recent repo:', error)
    }
  },

  loadFiles: async () => {
    try {
      const files = await invoke<FileMeta[]>('repo_list_files')
      set({ files })
    } catch (error) {
      console.error('Failed to load files:', error)
    }
  },

  toggleFile: async (relpath: string) => {
    const { selectedFiles } = get()
    let newSelectedFiles: string[]
    if (selectedFiles.includes(relpath)) {
      newSelectedFiles = selectedFiles.filter(f => f !== relpath)
    } else {
      newSelectedFiles = [...selectedFiles, relpath]
    }
    set({ selectedFiles: newSelectedFiles })
    
    // Save to persistence
    await invoke('save_selected_files', { files: newSelectedFiles })
    get().updateTokens()
  },

  removeFile: async (relpath: string) => {
    const newSelectedFiles = get().selectedFiles.filter(f => f !== relpath)
    set({ selectedFiles: newSelectedFiles })
    
    // Save to persistence
    await invoke('save_selected_files', { files: newSelectedFiles })
    get().updateTokens()
  },

  clearFiles: async () => {
    set({ selectedFiles: [], tokenReport: null })
    await invoke('save_selected_files', { files: [] })
  },

  updateTokens: async () => {
    const { selectedFiles } = get()
    if (selectedFiles.length === 0) {
      set({ tokenReport: null })
      return
    }

    try {
      const report = await invoke<TokenReport>('repo_count_tokens', {
        relpaths: selectedFiles
      })
      set({ tokenReport: report })
    } catch (error) {
      console.error('Failed to count tokens:', error)
    }
  },
}))