import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const PLAN_MAP: Record<string, { tier: string, tokens: number }> = {
  '945033': { tier: 'explorer', tokens: 50 },
  '945035': { tier: 'analyst',  tokens: 300 },
}

function verifySignature(payload: string, secret: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return hmac === signature
}

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('x-signature') || ''
  const secret    = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || ''

  if (secret && !verifySignature(body, secret, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body)
  const eventName = event.meta?.event_name

  if (eventName === 'order_created' || eventName === 'subscription_created') {
    const variantId = String(event.data?.attributes?.variant_id || event.data?.relationships?.variant?.data?.id || '')
    const userId    = event.meta?.custom_data?.user_id
    const plan      = PLAN_MAP[variantId]

    if (userId && plan) {
      // Update user_profiles
      await supabaseAdmin
        .from('user_profiles')
        .upsert({ id: userId, tier: plan.tier, tokens: plan.tokens }, { onConflict: 'id' })

      // Update auth metadata
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { tier: plan.tier, tokens: plan.tokens }
      })

      console.log(`✓ Upgraded user ${userId} to ${plan.tier}`)
    }
  }

  if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
    const userId = event.meta?.custom_data?.user_id
    if (userId) {
      await supabaseAdmin
        .from('user_profiles')
        .update({ tier: 'free', tokens: 0 })
        .eq('id', userId)

      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { tier: 'free', tokens: 0 }
      })

      console.log(`↓ Downgraded user ${userId} to free`)
    }
  }

  return NextResponse.json({ received: true })
}