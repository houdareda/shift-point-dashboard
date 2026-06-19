'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function SessionGuard() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let channel: any

    const setupListener = async () => {
      // 1. Get current logged in user session
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      // 2. Subscribe to realtime updates on this specific user profile
      channel = supabase
        .channel(`kick-out-guard-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`
          },
          async (payload) => {
            console.log('Realtime profile update received in SessionGuard:', payload.new)
            
            // If the user role changes to suspended, sign out immediately
            if (payload.new && payload.new.role?.toLowerCase() === 'suspended') {
              console.warn('Your account has been suspended. Kicking out...')
              await supabase.auth.signOut()
              router.push('/login')
              router.refresh()
            }
          }
        )
        .subscribe()
    }

    setupListener()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [router])

  // Disable mouse scroll / wheel value changes on focused number inputs globally
  useEffect(() => {
    const handleWheel = () => {
      const activeEl = document.activeElement
      if (
        activeEl &&
        activeEl.tagName === 'INPUT' &&
        (activeEl as HTMLInputElement).type === 'number'
      ) {
        ;(activeEl as HTMLInputElement).blur()
      }
    }

    document.addEventListener('wheel', handleWheel)
    return () => {
      document.removeEventListener('wheel', handleWheel)
    }
  }, [])

  return null
}
