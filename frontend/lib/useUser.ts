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
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('tier, tokens, full_name')
        .eq('id', authUser.id)
        .single()

      // Auto-create profile for Google OAuth users who slipped through
      if (!profile) {
        const newProfile = {
          id: authUser.id,
          email: authUser.email,
          full_name:
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.email?.split('@')[0],
          tier: authUser.email === 'rudysaliby@hotmail.com' ? 'admin' : 'free',
          tokens: authUser.email === 'rudysaliby@hotmail.com' ? 999999 : 0,
        }
        await supabase.from('user_profiles').upsert(newProfile, { onConflict: 'id' })

        return {
          ...authUser,
          user_metadata: {
            ...authUser.user_metadata,
            tier: newProfile.tier,
            tokens: newProfile.tokens,
            full_name: newProfile.full_name,
          }
        }
      }

      return {
        ...authUser,
        user_metadata: {
          ...authUser.user_metadata,
          tier:      profile?.tier      ?? 'free',
          tokens:    profile?.tokens    ?? 0,
          full_name: profile?.full_name ?? authUser.user_metadata?.full_name ?? authUser.user_metadata?.name,
        }
      }
    } catch {
      return authUser
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const enriched = await enrichWithProfile(data.session.user)
        setUser(enriched)
      } else {
        setUser(null)
      }
      setLoading(false)

      if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
        return
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          const enriched = await enrichWithProfile(session.user)
          setUser(enriched)
          setLoading(false)
        }
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return { user, loading }
}
