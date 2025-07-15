import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { useCallback } from 'react'

export function useBackendJwtQuery() {
  const { isSignedIn, getToken } = useAuth()
  
  return useQuery({
    queryKey: ['backend-jwt'],
    enabled: isSignedIn,
    queryFn: async () => {
      const jwt = await getToken()
      if (!jwt) throw new Error('No JWT')
      return jwt
    },
    staleTime: 55 * 60 * 1000,
    refetchInterval: 55 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

export function useBackendApi() {
  const { data: jwt } = useBackendJwtQuery()
  return useCallback(<T,>(fn: (t: string) => Promise<T>) => fn(jwt!), [jwt])
}

export function isAuthError(e: unknown) {
  return e instanceof Error && /401|jwt|unauth/i.test(e.message)
}