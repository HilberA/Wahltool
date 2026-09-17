import { useEffect, useState } from 'react'
import { subscribeToAdminUser } from '../lib/firebase'

// undefined = wird noch geladen, null = nicht eingeloggt, sonst der User.
export function useAdminUser() {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    const unsubscribe = subscribeToAdminUser(setUser)
    return unsubscribe
  }, [])

  return user
}
