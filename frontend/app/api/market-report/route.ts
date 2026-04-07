import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Fetch top areas with stats for the report
    const { data: listings } = await supabase
      .from('listings')
      .select('area, price, size_sqm, property_type, price_period')
      .eq('is_active', true)
      .not('price', 'is', null)
      .not('area', 'is', null)
      .limit(2000)

    if (!listings || listings.length === 0) {
      return NextResponse.json({ error: 'No listing data available' }, { status: 404 })
    }

    // Aggregate by area
    const areas: Record<string, { prices: number[], ppsqms: number[], count: number }> = {}
    for (const l of listings) {
      const key = l.area
      if (!areas[key]) areas[key] = { prices: [], ppsqms: [], count: 0 }
      areas[key].count++
      if (l.price) areas[key].prices.push(Number(l.price))
      if (l.price && l.size_sqm && Number(l.size_sqm) > 0) {
        areas[key].ppsqms.push(Number(l.price) / Number(l.size_sqm))
      }
    }

    const median = (arr: number[]) => {
      if (!arr.length) return 0
      const s = [...arr].sort((a, b) => a - b)
      const m = Math.floor(s.length / 2)
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
    }

    const areaStats = Object.entries(areas)
      .filter(([, v]) => v.ppsqms.length >= 3)
      .map(([area, v]) => ({
        area,
        count: v.count,
        medianPrice: Math.round(median(v.prices)),
        medianPpsqm: Math.round(median(v.ppsqms)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    const overallMedianPpsqm = Math.round(median(areaStats.map(a => a.medianPpsqm)))
    const totalListings = listings.length
    const totalAreas = areaStats.length

    // Build a prompt for Claude to generate a market report
    const prompt = `You are a Lebanese real estate market analyst. Generate a professional market report summary.

Data snapshot:
- Total listings analyzed: ${totalListings}
- Areas with 3+ listings: ${totalAreas}
- Overall median price/m²: $${overallMedianPpsqm.toLocaleString()}

Top areas by listing count:
${areaStats.map(a => `  ${a.area}: ${a.count} listings, median $${a.medianPrice.toLocaleString()}, $${a.medianPpsqm.toLocaleString()}/m²`).join('\n')}

Best value areas (lowest $/m²):
${[...areaStats].sort((a, b) => a.medianPpsqm - b.medianPpsqm).slice(0, 5).map(a => `  ${a.area}: $${a.medianPpsqm.toLocaleString()}/m²`).join('\n')}

Premium areas (highest $/m²):
${[...areaStats].sort((a, b) => b.medianPpsqm - a.medianPpsqm).slice(0, 5).map(a => `  ${a.area}: $${a.medianPpsqm.toLocaleString()}/m²`).join('\n')}

Write a concise 3-section market report in JSON format:
{
  "title": "Lebanon Real Estate Market Report",
  "date": "April 2026",
  "summary": "2-3 sentence executive summary",
  "sections": [
    { "heading": "Market Overview", "content": "paragraph about overall market conditions" },
    { "heading": "Top Value Areas", "content": "paragraph highlighting best value opportunities" },
    { "heading": "Premium Segments", "content": "paragraph about premium areas and trends" }
  ],
  "keyStats": [
    { "label": "Total Listings", "value": "${totalListings}" },
    { "label": "Median $/m²", "value": "$${overallMedianPpsqm.toLocaleString()}" },
    { "label": "Areas Tracked", "value": "${totalAreas}" }
  ]
}

Respond ONLY with the JSON object, no markdown.`

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Fallback: return a static report as CSV if no API key
      const csv = ['Area,Listings,Median Price,Median $/m²',
        ...areaStats.map(a => `${a.area},${a.count},${a.medianPrice},${a.medianPpsqm}`)
      ].join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="iqari-market-report.csv"',
        },
      })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const report = JSON.parse(clean)

    // Build an HTML report that can be opened/printed
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${report.title}</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .date { color: #666; font-size: 14px; margin-bottom: 24px; }
  .summary { font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 32px; padding: 16px; background: #f8f9fa; border-radius: 8px; }
  .stats { display: flex; gap: 16px; margin-bottom: 32px; }
  .stat { flex: 1; text-align: center; padding: 16px; background: #16a34a; color: white; border-radius: 8px; }
  .stat .val { font-size: 24px; font-weight: 700; }
  .stat .lbl { font-size: 12px; opacity: 0.85; margin-top: 4px; }
  h2 { font-size: 18px; color: #16a34a; margin-top: 28px; }
  p { line-height: 1.7; color: #444; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
</style></head><body>
<h1>${report.title || 'Market Report'}</h1>
<div class="date">${report.date || 'April 2026'} — Generated by IQARI</div>
<div class="summary">${report.summary || ''}</div>
<div class="stats">
${(report.keyStats || []).map((s: any) => `<div class="stat"><div class="val">${s.value}</div><div class="lbl">${s.label}</div></div>`).join('')}
</div>
${(report.sections || []).map((s: any) => `<h2>${s.heading}</h2><p>${s.content}</p>`).join('')}
<div class="footer">Report generated by IQARI Market Intelligence · iqari.com</div>
</body></html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': 'attachment; filename="iqari-market-report.html"',
      },
    })

  } catch (err: any) {
    console.error('Market report error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
