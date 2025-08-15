import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export function useApiKey() {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkApiKey = async () => {
    try {
      const apiKey = await invoke<string | null>('get_openai_api_key')
      setHasApiKey(!!apiKey && apiKey.trim().length > 0)
    } catch (error) {
      console.error('Failed to check API key:', error)
      setHasApiKey(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkApiKey()
  }, [])

  return {
    hasApiKey,
    isLoading,
    recheckApiKey: checkApiKey
  }
}