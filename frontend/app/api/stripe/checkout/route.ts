import { NextRequest, NextResponse } from 'next/server'

// Install Stripe: npm install stripe
// Add to .env.local:
// STRIPE_SECRET_KEY=sk_live_...
// NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

const PRICE_IDS: Record<string, string> = {
  'price_explorer_monthly': process.env.STRIPE_EXPLORER_PRICE_ID || '',
  'price_analyst_monthly':  process.env.STRIPE_ANALYST_PRICE_ID  || '',
}

export async function POST(req: NextRequest) {
  try {
    const { priceId, userId, email } = await req.json()

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe not configured yet' },
        { status: 503 }
      )
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    })

    const stripePriceId = PRICE_IDS[priceId]
    if (!stripePriceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: stripePriceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}?upgrade=success&plan=${priceId}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}?upgrade=cancelled`,
      metadata: { userId, planId: priceId },
      subscription_data: {
        metadata: { userId, planId: priceId },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
