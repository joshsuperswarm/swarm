import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from './ui/dialog'
import { Settings, Eye, EyeOff } from 'lucide-react'

interface ApiKeySettingsProps {
  required?: boolean
  onApiKeySet?: () => void
}

export default function ApiKeySettings({ required = false, onApiKeySet }: ApiKeySettingsProps) {
  const [isOpen, setIsOpen] = useState(required)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (required) {
      setIsOpen(true)
    }
  }, [required])

  useEffect(() => {
    if (isOpen && !required) {
      // Load existing API key when opening settings
      loadApiKey()
    }
  }, [isOpen, required])

  const loadApiKey = async () => {
    try {
      const existingKey = await invoke<string | null>('get_openai_api_key')
      if (existingKey) {
        setApiKey(existingKey)
      }
    } catch (error) {
      console.error('Failed to load API key:', error)
    }
  }

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await invoke('set_openai_api_key', { apiKey: apiKey.trim() })
      setIsOpen(false)
      if (onApiKeySet) {
        onApiKeySet()
      }
    } catch (error) {
      setError('Failed to save API key')
      console.error('Failed to save API key:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (required) {
      // Cannot cancel if API key is required
      return
    }
    setIsOpen(false)
    setError('')
  }

  const content = (
    <DialogContent className="max-w-md" aria-describedby="api-key-description">
      <DialogTitle className="sr-only">
        OpenAI API Key
      </DialogTitle>
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">
            {required ? 'OpenAI API Key Required' : 'OpenAI API Key Settings'}
          </h2>
          <p id="api-key-description" className="text-sm text-gray-600">
            {required 
              ? 'Please enter your OpenAI API key to continue using the chat feature.'
              : 'Configure your OpenAI API key for the chat feature.'
            }
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">API Key</label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSave()
                }
              }}
              placeholder="sk-..."
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2">
          {!required && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              disabled={isLoading}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isLoading || !apiKey.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </DialogContent>
  )

  if (required) {
    return (
      <Dialog open={isOpen} onOpenChange={() => {}}>
        {content}
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100">
          <Settings size={16} />
        </button>
      </DialogTrigger>
      {content}
    </Dialog>
  )
}