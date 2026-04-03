import { NextRequest, NextResponse } from 'next/server'

const LS_API_KEY = process.env.LEMONSQUEEZY_API_KEY || ''
const LS_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID || ''

const VARIANT_IDS: Record<string, string> = {
  'price_explorer_monthly': process.env.LS_EXPLORER_VARIANT_ID || '945033',
  'price_analyst_monthly':  process.env.LS_ANALYST_VARIANT_ID  || '945035',
}

export async function POST(req: NextRequest) {
  try {
    const { priceId, userId, email } = await req.json()

    if (!LS_API_KEY) {
      return NextResponse.json({ error: 'Payment not configured' }, { status: 503 })
    }

    const variantId = VARIANT_IDS[priceId]
    if (!variantId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lebanon-realestate.vercel.app'

    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LS_API_KEY}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              email,
              custom: { user_id: userId },
            },
            product_options: {
              redirect_url: `${appUrl}?upgrade=success&plan=${priceId}`,
            },
          },
          relationships: {
            store: {
              data: { type: 'stores', id: LS_STORE_ID }
            },
            variant: {
              data: { type: 'variants', id: variantId }
            },
          },
        }
      }),
    })

    const data = await response.json()
    const checkoutUrl = data?.data?.attributes?.url

    if (!checkoutUrl) {
      console.error('LemonSqueezy error:', JSON.stringify(data))
      return NextResponse.json({ error: 'Could not create checkout' }, { status: 500 })
    }

    return NextResponse.json({ url: checkoutUrl })

  } catch (err: any) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}