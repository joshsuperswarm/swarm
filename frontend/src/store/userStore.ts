import { create } from 'zustand'
import { ApiService } from '@/services/api'
import type { UserWithDefaultRepo } from '@/types/generated/UserWithDefaultRepo'

interface UserState {
  user: UserWithDefaultRepo | null
  loading: boolean
  error: string | null
  
  // Actions
  loadUserProfile: (token?: string) => Promise<void>
  refreshUserProfile: (token?: string) => Promise<void>
  clearUserProfile: () => void
  setUser: (user: UserWithDefaultRepo | null) => void
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  loading: false,
  error: null,

  loadUserProfile: async (token?: string) => {
    // Don't load if already loading or already have user data, or if no token
    const { loading, user } = get()
    if (loading || user || !token) return

    set({ loading: true, error: null })
    
    try {
      const userData = await ApiService.getUserProfile(token)
      set({ user: userData, loading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load user profile'
      set({ error: errorMessage, loading: false })
      console.error('Failed to load user profile:', error)
    }
  },

  refreshUserProfile: async (token?: string) => {
    if (!token) return
    
    set({ loading: true, error: null })
    
    try {
      const userData = await ApiService.getUserProfile(token)
      set({ user: userData, loading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh user profile'
      set({ error: errorMessage, loading: false })
      console.error('Failed to refresh user profile:', error)
    }
  },

  clearUserProfile: () => {
    set({ user: null, loading: false, error: null })
  },

  setUser: (user: UserWithDefaultRepo | null) => {
    set({ user })
  }
}))