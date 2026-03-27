import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const PAGE_SIZE = 1000

async function fetchAll(period: string, propType: string) {
  let allRows: any[] = []
  let from = 0

  while (true) {
    let query = supabase
      .from('listings')
      .select('id,source,url,title,price,currency,price_period,property_type,size_sqm,area,subregion,region,price_per_sqm,image_url,bedrooms,bathrooms,furnished,features,view_type,scraped_at,lat,lng')
      .eq('is_active', true)
      .not('price_per_sqm', 'is', null)
      .not('area', 'is', null)
      .not('lat', 'is', null)
      .range(from, from + PAGE_SIZE - 1)

    if (period !== 'all') query = query.eq('price_period', period)
    if (propType !== 'all') query = query.eq('property_type', propType)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break

    allRows = allRows.concat(data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return allRows
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const period   = searchParams.get('period') || 'all'
  const propType = searchParams.get('type') || 'all'

  try {
    const rows = await fetchAll(period, propType)

    // Compute area stats on the fly
    const areaMap: Record<string, number[]> = {}
    rows.forEach((l: any) => {
      if (l.area && l.price_per_sqm) {
        if (!areaMap[l.area]) areaMap[l.area] = []
        areaMap[l.area].push(Number(l.price_per_sqm))
      }
    })

    const statsMap: Record<string, any> = {}
    Object.entries(areaMap).forEach(([area, prices]) => {
      const sorted = [...prices].sort((a, b) => a - b)
      const avg = prices.reduce((s, p) => s + p, 0) / prices.length
      const median = sorted.length % 2 === 0
        ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2
        : sorted[Math.floor(sorted.length/2)]
      statsMap[area] = {
        area,
        avg_price_per_sqm: Math.round(avg),
        median_price_per_sqm: Math.round(median),
        listing_count: prices.length,
        min_psqm: Math.round(sorted[0]),
        max_psqm: Math.round(sorted[sorted.length - 1]),
      }
    })

    // Score each listing — need min 3 listings in area for reliable valuation
    const scored = rows.map((l: any) => {
      const stat = statsMap[l.area]
      let discount = 0
      let valuation = 'unknown'
      if (stat && stat.listing_count >= 3 && l.price_per_sqm) {
        discount = ((stat.avg_price_per_sqm - Number(l.price_per_sqm)) / stat.avg_price_per_sqm) * 100
        valuation = discount > 15 ? 'undervalued' : discount < -15 ? 'overvalued' : 'fair'
      }
      return { ...l, discount: Math.round(discount), valuation, area_avg_psqm: stat?.avg_price_per_sqm }
    })

    scored.sort((a: any, b: any) => b.discount - a.discount)

    // Area analytics
    const areaAnalytics = Object.values(statsMap)
      .filter((s: any) => s.listing_count >= 3)
      .sort((a: any, b: any) => b.listing_count - a.listing_count)
      .slice(0, 25)

    // Region summary
    const regionMap: Record<string, number[]> = {}
    rows.forEach((l: any) => {
      if (l.region && l.price_per_sqm) {
        if (!regionMap[l.region]) regionMap[l.region] = []
        regionMap[l.region].push(Number(l.price_per_sqm))
      }
    })
    const regionAnalytics = Object.entries(regionMap).map(([region, prices]) => ({
      region,
      avg_price_per_sqm: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
      listing_count: prices.length,
    })).sort((a, b) => b.listing_count - a.listing_count)

    // Price distribution
    const buckets = [
      { label: '<$200k', min: 0, max: 200000 },
      { label: '$200-500k', min: 200000, max: 500000 },
      { label: '$500k-1M', min: 500000, max: 1000000 },
      { label: '>$1M', min: 1000000, max: Infinity },
    ]
    const priceDistribution = buckets.map(b => ({
      label: b.label,
      count: rows.filter((l: any) => l.price >= b.min && l.price < b.max).length,
    }))

    const undervaluedCount = scored.filter((l: any) => l.valuation === 'undervalued').length
    const overvaluedCount  = scored.filter((l: any) => l.valuation === 'overvalued').length
    const fairCount        = scored.filter((l: any) => l.valuation === 'fair').length

    return NextResponse.json({
      deals: scored,
      areaAnalytics,
      regionAnalytics,
      priceDistribution,
      summary: {
        totalListings: rows.length,
        avgPsqm: rows.length > 0 ? Math.round(rows.reduce((s: number, l: any) => s + Number(l.price_per_sqm), 0) / rows.length) : 0,
        undervaluedCount,
        overvaluedCount,
        fairCount,
      },
      statsMap,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}