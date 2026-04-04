import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function useUser() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const enrichWithProfile = async (authUser: any) => {
    if (!authUser) return null
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier, tokens')
        .eq('id', authUser.id)
        .single()

      return {
        ...authUser,
        user_metadata: {
          ...authUser.user_metadata,
          tier:   profile?.tier   ?? authUser.user_metadata?.tier   ?? 'free',
          tokens: profile?.tokens ?? authUser.user_metadata?.tokens ?? 0,
        }
      }
    } catch {
      return authUser
    }
  }

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const enriched = await enrichWithProfile(data.session.user)
        setUser(enriched)
      } else {
        setUser(null)
      }
      setLoading(false)

      // Clean OAuth hash from URL
      if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    })

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        return
      }
      if (session?.user) {
        const enriched = await enrichWithProfile(session.user)
        setUser(enriched)
      } else {
        setUser(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return { user, loading }
}
