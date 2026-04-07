import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// Admin email — only this user can manage tokens
const ADMIN_EMAIL = 'rudysaliby@hotmail.com'

export async function POST(req: NextRequest) {
  try {
    const { adminUserId, targetUserId, amount, action } = await req.json()

    // Verify the caller is admin
    const { data: adminProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('email, tier')
      .eq('id', adminUserId)
      .single()

    if (!adminProfile || (adminProfile.tier !== 'admin' && adminProfile.email !== ADMIN_EMAIL)) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 403 })
    }

    if (!targetUserId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Missing targetUserId or invalid amount' }, { status: 400 })
    }

    // Fetch target user's current balance
    const { data: targetProfile, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('tokens, email')
      .eq('id', targetUserId)
      .single()

    if (fetchError || !targetProfile) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    let newBalance: number

    if (action === 'set') {
      // Set tokens to exact amount
      newBalance = amount
    } else if (action === 'remove') {
      // Remove tokens
      newBalance = Math.max(0, targetProfile.tokens - amount)
    } else {
      // Default: add tokens
      newBalance = targetProfile.tokens + amount
    }

    // Update user_profiles
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ tokens: newBalance, updated_at: new Date().toISOString() })
      .eq('id', targetUserId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update tokens' }, { status: 500 })
    }

    // Sync to auth metadata
    await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      user_metadata: { tokens: newBalance }
    })

    console.log(`★ Admin ${action || 'add'}: ${amount} tokens for ${targetProfile.email} — new balance: ${newBalance}`)

    return NextResponse.json({
      success: true,
      targetUserId,
      previousBalance: targetProfile.tokens,
      newBalance,
      action: action || 'add',
    })

  } catch (err: any) {
    console.error('Admin token error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
