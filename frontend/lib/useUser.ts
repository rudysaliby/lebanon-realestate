import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ADMIN_EMAIL = 'rudysaliby@hotmail.com'

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

      // Auto-create profile for new users who don't have one yet
      if (!profile) {
        const isAdmin = authUser.email === ADMIN_EMAIL
        const newProfile = {
          id: authUser.id,
          email: authUser.email,
          full_name:
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.email?.split('@')[0],
          tier: isAdmin ? 'admin' : 'free',
          tokens: isAdmin ? 999999 : 0,
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

      // Use the database as the source of truth for tier and tokens
      return {
        ...authUser,
        user_metadata: {
          ...authUser.user_metadata,
          tier:      profile.tier      ?? 'free',
          tokens:    profile.tokens    ?? 0,
          full_name: profile.full_name ?? authUser.user_metadata?.full_name ?? authUser.user_metadata?.name,
        }
      }
    } catch {
      return authUser
    }
  }

  // Refresh user data from database — call this after token deduction
  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) {
      const enriched = await enrichWithProfile(data.session.user)
      setUser(enriched)
      return enriched
    }
    return null
  }, [])

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

  return { user, loading, refreshUser }
}
