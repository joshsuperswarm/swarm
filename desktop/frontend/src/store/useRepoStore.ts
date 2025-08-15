import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { RepoSummary, FileMeta, TokenReport } from '../types'

// Debounce handle for token counting
let debounceHandle: any

interface RepoStore {
  repo: RepoSummary | null
  files: FileMeta[]
  selectedFiles: string[]
  selectedFolders: string[]
  tokenReport: TokenReport | null
  
  openRepo: () => Promise<void>
  loadRecent: () => Promise<void>
  loadFiles: () => Promise<void>
  toggleFile: (relpath: string) => void
  removeFile: (relpath: string) => void
  clearFiles: () => void
  toggleFolder: (relpath: string) => void
  removeFolder: (relpath: string) => void
  clearFolders: () => void
  updateTokens: () => Promise<void>
  expandedSelectedFiles: () => string[]
}

export const useRepoStore = create<RepoStore>((set, get) => ({
  repo: null,
  files: [],
  selectedFiles: [],
  selectedFolders: [],
  tokenReport: null,

  openRepo: async () => {
    try {
      const repo = await invoke<RepoSummary>('repo_open')
      set({ repo, selectedFiles: [], selectedFolders: [] })
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
        
        // Load saved selected files and folders
        const savedFiles = await invoke<string[]>('load_selected_files')
        const savedFolders = await invoke<string[]>('load_selected_folders')
        if (savedFiles.length > 0 || savedFolders.length > 0) {
          set({ selectedFiles: savedFiles, selectedFolders: savedFolders })
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
    set({ selectedFiles: [], selectedFolders: [], tokenReport: null })
    await invoke('save_selected_files', { files: [] })
    await invoke('save_selected_folders', { folders: [] })
  },

  toggleFolder: async (relpath: string) => {
    const { selectedFolders } = get()
    let newSelectedFolders: string[]
    if (selectedFolders.includes(relpath)) {
      newSelectedFolders = selectedFolders.filter(f => f !== relpath)
    } else {
      newSelectedFolders = [...selectedFolders, relpath]
    }
    set({ selectedFolders: newSelectedFolders })
    
    // Save to persistence
    await invoke('save_selected_folders', { folders: newSelectedFolders })
    get().updateTokens()
  },

  removeFolder: async (relpath: string) => {
    const newSelectedFolders = get().selectedFolders.filter(f => f !== relpath)
    set({ selectedFolders: newSelectedFolders })
    
    // Save to persistence
    await invoke('save_selected_folders', { folders: newSelectedFolders })
    get().updateTokens()
  },

  clearFolders: async () => {
    set({ selectedFolders: [] })
    await invoke('save_selected_folders', { folders: [] })
    get().updateTokens()
  },

  expandedSelectedFiles: () => {
    const { selectedFiles, selectedFolders, files } = get()
    const expanded = new Set<string>(selectedFiles)
    
    // Expand folders to include all files under them
    for (const folder of selectedFolders) {
      const prefix = folder.endsWith('/') ? folder : folder + '/'
      for (const file of files) {
        if (file.relpath.startsWith(prefix)) {
          expanded.add(file.relpath)
        }
      }
    }
    
    return [...expanded]
  },

  // Removed deriveAllFolders - moved to FilePicker component for better memoization

  updateTokens: async () => {
    const { expandedSelectedFiles } = get()
    const expandedFiles = expandedSelectedFiles()
    
    // Cancel any pending debounced calls
    if (debounceHandle) clearTimeout(debounceHandle)
    
    // Debounce token counting to avoid excessive calls
    debounceHandle = setTimeout(async () => {
      if (expandedFiles.length === 0) {
        set({ tokenReport: null })
        return
      }

      try {
        const report = await invoke<TokenReport>('repo_count_tokens', {
          relpaths: expandedFiles
        })
        set({ tokenReport: report })
      } catch (error) {
        console.error('Failed to count tokens:', error)
      }
    }, 200) // 200ms debounce delay
  },
}))