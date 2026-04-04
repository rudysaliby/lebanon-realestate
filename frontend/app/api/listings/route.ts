import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const PAGE_SIZE = 1000

function median(arr: number[]) {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

async function fetchAllListings(filters: any) {
  let allRows: any[] = []
  let from = 0

  while (true) {
    let query = supabase
      .from('listings')
      .select([
        'id', 'source', 'url', 'title', 'description',
        'price', 'currency', 'price_period',
        'property_type', 'size_sqm',
        'area', 'subregion', 'region',
        'lat', 'lng',
        'image_url',
        'furnished', 'condition', 'view_type', 'floor_type',
        'bedrooms', 'bathrooms', 'features',
        'payment_type', 'building_age', 'lifestyle',
      ].join(','))
      .eq('is_active', true)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .range(from, from + PAGE_SIZE - 1)

    if (filters.period && filters.period !== 'all')
      query = query.eq('price_period', filters.period)

    if (filters.type_group && filters.type_group !== 'all') {
      if (filters.type_group === 'residential')
        // Apartments & Villas (OLX residential category)
        query = query.in('property_type', ['apartment', 'villa', 'duplex', 'triplex', 'penthouse', 'studio'])
      else if (filters.type_group === 'land')
        query = query.eq('property_type', 'land')
      else if (filters.type_group === 'commercial')
        // All commercial subtypes from OLX
        query = query.in('property_type', ['commercial', 'shop', 'building', 'office', 'warehouse', 'restaurant', 'clinic', 'showroom', 'factory', 'gym', 'hotel', 'salon'])
      else if (filters.type_group === 'chalet')
        query = query.eq('property_type', 'chalet')
    }

    if (filters.minPrice) query = query.gte('price', parseFloat(filters.minPrice))
    if (filters.maxPrice) query = query.lte('price', parseFloat(filters.maxPrice))
    if (filters.region && filters.region !== 'all') query = query.eq('region', filters.region)
    if (filters.furnished && filters.furnished !== 'all') query = query.eq('furnished', filters.furnished)
    if (filters.condition && filters.condition !== 'all') query = query.eq('condition', filters.condition)

    if (filters.bedrooms && filters.bedrooms !== 'all') {
      if (filters.bedrooms === '5+') query = query.gte('bedrooms', 5)
      else query = query.eq('bedrooms', parseInt(filters.bedrooms))
    }

    if (filters.view && filters.view !== 'all')
      query = query.contains('view_type', [filters.view])

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
    minPrice:   searchParams.get('min_price'),
    maxPrice:   searchParams.get('max_price'),
    period:     searchParams.get('period'),
    type_group: searchParams.get('type_group'),
    region:     searchParams.get('region'),
    furnished:  searchParams.get('furnished'),
    condition:  searchParams.get('condition'),
    bedrooms:   searchParams.get('bedrooms'),
    view:       searchParams.get('view'),
  }

  try {
    const rows = await fetchAllListings(filters)

    // Build area stats for valuation (separate by type: land vs built)
    const areaStats: Record<string, { built: number[], land: number[] }> = {}

    rows.forEach(r => {
      if (!r.area || !r.price || !r.size_sqm) return
      const ppsqm = Number(r.price) / Number(r.size_sqm)
      if (!areaStats[r.area]) areaStats[r.area] = { built: [], land: [] }
      if (r.property_type === 'land') areaStats[r.area].land.push(ppsqm)
      else areaStats[r.area].built.push(ppsqm)
    })

    const medianMap: Record<string, number | null> = {}
    Object.entries(areaStats).forEach(([area, stats]) => {
      const isLandMode = filters.type_group === 'land'
      const arr = isLandMode ? stats.land : stats.built
      medianMap[area] = arr.length >= 5 ? median(arr) : null
    })

    const features = rows.map(r => {
      const price   = r.price   ? Number(r.price)   : null
      const sizeSqm = r.size_sqm ? Number(r.size_sqm) : null
      const ppsqm   = price && sizeSqm ? Math.round(price / sizeSqm) : null
      const areaMedian = r.area ? medianMap[r.area] : null

      let valuation = 'unknown'
      if (ppsqm && areaMedian) {
        const diff = ((ppsqm - areaMedian) / areaMedian) * 100
        valuation = diff > 15 ? 'overvalued' : diff < -15 ? 'undervalued' : 'fair'
      }

      const { lat, lng, ...rest } = r

      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
        properties: {
          // Ensure all numeric fields are actual numbers, not strings
          ...rest,
          price:         price,
          size_sqm:      sizeSqm,
          bedrooms:      r.bedrooms  ? Number(r.bedrooms)  : null,
          bathrooms:     r.bathrooms ? Number(r.bathrooms) : null,
          price_per_sqm: ppsqm,
          area_median_ppsqm: areaMedian ? Math.round(areaMedian) : null,
          valuation,
        }
      }
    })

    return NextResponse.json(
      { type: 'FeatureCollection', features },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    console.error('Listings API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
