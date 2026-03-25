import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const minPrice = searchParams.get('min_price')
  const maxPrice = searchParams.get('max_price')
  const type     = searchParams.get('type')
  const area     = searchParams.get('area')
  const limit    = Math.min(parseInt(searchParams.get('limit') || '400'), 500)

  let query = supabase
    .from('listings')
    .select('id,source,url,title,price,currency,price_period,property_type,size_sqm,location_raw,area,city,lat,lng,price_per_sqm,image_url,scraped_at')
    .eq('is_active', true)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(limit)

  if (minPrice) query = query.gte('price', parseFloat(minPrice))
  if (maxPrice) query = query.lte('price', parseFloat(maxPrice))
  if (type && type !== 'all') query = query.eq('property_type', type)
  if (area && area !== 'all') query = query.eq('area', area)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch area stats to compute valuation
  const areas = Array.from(new Set((data || []).map((r: any) => r.area).filter(Boolean)))
  let statsMap: Record<string, number> = {}

  if (areas.length > 0) {
    const { data: stats } = await supabase
      .from('area_stats')
      .select('area,avg_price_per_sqm')
      .in('area', areas)

    statsMap = Object.fromEntries(
      (stats || []).filter((s: any) => s.avg_price_per_sqm).map((s: any) => [s.area, Number(s.avg_price_per_sqm)])
    )
  }

  const features = (data || []).map((r: any) => {
    const avgPsqm = statsMap[r.area]
    let valuation = 'unknown'
    if (r.price_per_sqm && avgPsqm) {
      const diff = ((r.price_per_sqm - avgPsqm) / avgPsqm) * 100
      valuation = diff > 15 ? 'overvalued' : diff < -15 ? 'undervalued' : 'fair'
    }
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: { ...r, lat: undefined, lng: undefined, valuation }
    }
  })

  return NextResponse.json(
    { type: 'FeatureCollection', features },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' } }
  )
}
