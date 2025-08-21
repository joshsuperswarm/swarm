import { memo, useMemo } from 'react'
import { UserButton } from '@clerk/clerk-react'
import ApiKeysPanel from '@/components/account/ApiKeysPanel'
import { Key } from 'lucide-react'

export const NavUserButton = memo(function NavUserButton() {
  const apiKeysPage = useMemo(
    () => (
      <UserButton.UserProfilePage
        label="API Keys"
        url="api-keys"
        labelIcon={<Key className="w-4 h-4" />}
      >
        <ApiKeysPanel />
      </UserButton.UserProfilePage>
    ),
    []
  )

  return <UserButton>{apiKeysPage}</UserButton>
})