import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const PAGE_SIZE = 1000

async function fetchAllListings(filters: any) {
  let allRows: any[] = []
  let from = 0
  
  while (true) {
    let query = supabase
      .from('listings')
      .select('id,source,url,title,price,currency,price_period,property_type,size_sqm,location_raw,area,subregion,region,city,lat,lng,price_per_sqm,image_url,furnished,condition,view_type,floor_type,bedrooms,bathrooms,features,payment_type,lifestyle,scraped_at')
      .eq('is_active', true)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .range(from, from + PAGE_SIZE - 1)

    if (filters.minPrice)  query = query.gte('price', parseFloat(filters.minPrice))
    if (filters.maxPrice)  query = query.lte('price', parseFloat(filters.maxPrice))
    if (filters.type && filters.type !== 'all')           query = query.eq('property_type', filters.type)
    if (filters.area && filters.area !== 'all')           query = query.eq('area', filters.area)
    if (filters.region && filters.region !== 'all')       query = query.eq('region', filters.region)
    if (filters.subregion && filters.subregion !== 'all') query = query.eq('subregion', filters.subregion)
    if (filters.furnished && filters.furnished !== 'all') query = query.eq('furnished', filters.furnished)
    if (filters.condition && filters.condition !== 'all') query = query.eq('condition', filters.condition)
    if (filters.bedrooms && filters.bedrooms !== 'all') {
      if (filters.bedrooms === '5+') query = query.gte('bedrooms', 5)
      else query = query.eq('bedrooms', parseInt(filters.bedrooms))
    }
    if (filters.view && filters.view !== 'all') query = query.contains('view_type', [filters.view])

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
  const filters = {
    minPrice:  searchParams.get('min_price'),
    maxPrice:  searchParams.get('max_price'),
    type:      searchParams.get('type'),
    area:      searchParams.get('area'),
    region:    searchParams.get('region'),
    subregion: searchParams.get('subregion'),
    furnished: searchParams.get('furnished'),
    condition: searchParams.get('condition'),
    bedrooms:  searchParams.get('bedrooms'),
    view:      searchParams.get('view'),
  }

  try {
    const rows = await fetchAllListings(filters)

    // Compute area average price/sqm inline
    const areaStats: Record<string, number[]> = {}
    rows.forEach((r: any) => {
      if (r.area && r.price_per_sqm) {
        if (!areaStats[r.area]) areaStats[r.area] = []
        areaStats[r.area].push(Number(r.price_per_sqm))
      }
    })
    const avgMap: Record<string, number> = {}
    Object.entries(areaStats).forEach(([a, prices]) => {
      avgMap[a] = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
    })

    const features = rows.map((r: any) => {
      const avg = avgMap[r.area]
      let valuation = 'unknown'
      if (r.price_per_sqm && avg && areaStats[r.area]?.length >= 3) {
        const diff = ((Number(r.price_per_sqm) - avg) / avg) * 100
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}