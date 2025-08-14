import { Folder } from 'lucide-react'
import { useRepoStore } from '../store/useRepoStore'

export default function OpenFolderEmptyState() {
  const { openRepo } = useRepoStore()

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <Folder className="h-6 w-6 text-gray-600" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">No folder open</h2>
        <p className="mb-4 text-sm text-gray-600">Open a folder to start chatting about your code</p>
        <button
          onClick={openRepo}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Folder className="h-4 w-4" />
          Open Folder
        </button>
      </div>
    </div>
  )
}