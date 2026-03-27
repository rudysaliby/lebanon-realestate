import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const minPrice  = searchParams.get('min_price')
  const maxPrice  = searchParams.get('max_price')
  const type      = searchParams.get('type')
  const area      = searchParams.get('area')
  const region    = searchParams.get('region')
  const subregion = searchParams.get('subregion')
  const furnished = searchParams.get('furnished')
  const condition = searchParams.get('condition')
  const bedrooms  = searchParams.get('bedrooms')
  const view      = searchParams.get('view')
  const limit     = Math.min(parseInt(searchParams.get('limit') || '400'), 500)

  let query = supabase
    .from('listings')
    .select('id,source,url,title,price,currency,price_period,property_type,size_sqm,location_raw,area,subregion,region,city,lat,lng,price_per_sqm,image_url,furnished,condition,view_type,floor_type,bedrooms,bathrooms,features,payment_type,lifestyle,scraped_at')
    .eq('is_active', true)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(limit)

  if (minPrice)  query = query.gte('price', parseFloat(minPrice))
  if (maxPrice)  query = query.lte('price', parseFloat(maxPrice))
  if (type && type !== 'all')       query = query.eq('property_type', type)
  if (area && area !== 'all')       query = query.eq('area', area)
  if (region && region !== 'all')   query = query.eq('region', region)
  if (subregion && subregion !== 'all') query = query.eq('subregion', subregion)
  if (furnished && furnished !== 'all') query = query.eq('furnished', furnished)
  if (condition && condition !== 'all') query = query.eq('condition', condition)
  if (bedrooms && bedrooms !== 'all') {
    const n = parseInt(bedrooms)
    if (bedrooms === '5+') query = query.gte('bedrooms', 5)
    else query = query.eq('bedrooms', n)
  }
  if (view && view !== 'all') query = query.contains('view_type', [view])

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const areas = [...new Set((data || []).map((r: any) => r.area).filter(Boolean))]
  let statsMap: Record<string, number> = {}
  if (areas.length > 0) {
    const { data: stats } = await supabase.from('area_stats').select('area,avg_price_per_sqm').in('area', areas)
    statsMap = Object.fromEntries((stats || []).filter((s: any) => s.avg_price_per_sqm).map((s: any) => [s.area, Number(s.avg_price_per_sqm)]))
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
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
