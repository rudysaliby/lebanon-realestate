import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const listing = await req.json()

  const prompt = `You are a Lebanese real estate expert. Analyze this property listing and give a concise investment insight.

Listing details:
- Title: ${listing.title || 'N/A'}
- Price: ${listing.price ? '$' + listing.price.toLocaleString() : 'N/A'} ${listing.price_period === 'monthly' ? '/month' : '(sale)'}
- Area: ${listing.area || 'N/A'}
- Size: ${listing.size_sqm ? listing.size_sqm + ' sqm' : 'N/A'}
- Price per sqm: ${listing.price_per_sqm ? '$' + listing.price_per_sqm : 'N/A'}
- Property type: ${listing.property_type || 'N/A'}
- Source: ${listing.source}
- Valuation vs area average: ${listing.valuation || 'unknown'}

Respond with ONLY a JSON object in this exact format, no markdown, no explanation:
{
  "verdict": "Buy" | "Watch" | "Skip",
  "verdict_reason": "one sentence why",
  "strengths": ["strength 1", "strength 2"],
  "red_flags": ["flag 1"],
  "fair_value_estimate": "$X,XXX - $X,XXX per sqm" or null,
  "score": 1-10
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const insight = JSON.parse(clean)
    return NextResponse.json(insight)
  } catch (e) {
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 })
  }
}
