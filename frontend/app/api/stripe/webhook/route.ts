import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const PLAN_TOKENS: Record<string, { tier: string, tokens: number }> = {
  'price_explorer_monthly': { tier: 'explorer', tokens: 50 },
  'price_analyst_monthly':  { tier: 'analyst',  tokens: 300 },
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

  const sig  = req.headers.get('stripe-signature')!
  const body = await req.text()

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const userId  = session.client_reference_id
    const planId  = session.metadata?.planId
    const plan    = PLAN_TOKENS[planId]

    if (userId && plan) {
      // Update user_profiles table
      await supabaseAdmin
        .from('user_profiles')
        .upsert({ id: userId, tier: plan.tier, tokens: plan.tokens }, { onConflict: 'id' })

      // Also update auth metadata so app sees it immediately
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { tier: plan.tier, tokens: plan.tokens }
      })
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    // Downgrade to free on cancellation
    const sub    = event.data.object as any
    const userId = sub.metadata?.userId
    if (userId) {
      await supabaseAdmin
        .from('user_profiles')
        .update({ tier: 'free', tokens: 0 })
        .eq('id', userId)

      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { tier: 'free', tokens: 0 }
      })
    }
  }

  return NextResponse.json({ received: true })
}
