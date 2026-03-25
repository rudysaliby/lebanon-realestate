import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'all'
  const period = searchParams.get('period') || 'all'

  // Get listings with price_per_sqm and area stats
  let query = supabase
    .from('listings')
    .select('id,source,url,title,price,currency,price_period,property_type,size_sqm,area,city,price_per_sqm,image_url,scraped_at')
    .eq('is_active', true)
    .not('price_per_sqm', 'is', null)
    .not('area', 'is', null)
    .order('price_per_sqm', { ascending: true })
    .limit(200)

  if (type !== 'all') query = query.eq('property_type', type)
  if (period !== 'all') query = query.eq('price_period', period)

  const { data: listings, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get area stats
  const { data: stats } = await supabase
    .from('area_stats')
    .select('area,avg_price_per_sqm,avg_price,listing_count,median_price')

  const statsMap: Record<string, any> = Object.fromEntries(
    (stats || []).map((s: any) => [s.area, s])
  )

  // Score each listing
  const scored = (listings || []).map((l: any) => {
    const areaStat = statsMap[l.area]
    let discount = 0
    let valuation = 'unknown'
    if (areaStat?.avg_price_per_sqm && l.price_per_sqm) {
      discount = ((areaStat.avg_price_per_sqm - l.price_per_sqm) / areaStat.avg_price_per_sqm) * 100
      valuation = discount > 15 ? 'undervalued' : discount < -15 ? 'overvalued' : 'fair'
    }
    return { ...l, discount: Math.round(discount), valuation, area_avg_psqm: areaStat?.avg_price_per_sqm }
  })

  // Sort by discount descending (best deals first)
  scored.sort((a: any, b: any) => b.discount - a.discount)

  // Area analytics
  const areaAnalytics = Object.values(statsMap)
    .filter((s: any) => s.listing_count >= 2)
    .sort((a: any, b: any) => b.listing_count - a.listing_count)
    .slice(0, 15)

  return NextResponse.json({ deals: scored.slice(0, 50), areaAnalytics, statsMap })
}
