import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId, amount, feature } = await req.json()

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Missing userId or invalid amount' }, { status: 400 })
    }

    // Fetch current token balance from user_profiles
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('tokens, tier')
      .eq('id', userId)
      .single()

    if (fetchError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Admin has unlimited tokens — don't deduct
    if (profile.tier === 'admin') {
      return NextResponse.json({
        success: true,
        newBalance: profile.tokens,
        deducted: 0,
        message: 'Admin — no tokens deducted',
      })
    }

    // Check sufficient balance
    if (profile.tokens < amount) {
      return NextResponse.json({
        error: 'Insufficient tokens',
        currentBalance: profile.tokens,
        required: amount,
      }, { status: 402 })
    }

    // Deduct tokens atomically
    const newBalance = profile.tokens - amount
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ tokens: newBalance, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to deduct tokens' }, { status: 500 })
    }

    // Sync to auth metadata so frontend sees updated balance
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { tokens: newBalance }
    })

    console.log(`⚡ Deducted ${amount} tokens from ${userId} for "${feature}" — new balance: ${newBalance}`)

    return NextResponse.json({
      success: true,
      newBalance,
      deducted: amount,
      feature,
    })

  } catch (err: any) {
    console.error('Token deduction error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
