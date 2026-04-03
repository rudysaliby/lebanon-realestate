import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const period     = searchParams.get('period') || 'sale'
  const type_group = searchParams.get('type_group') || 'residential'

  // Build property type filter
  let typeFilter: string[]
  if (type_group === 'residential') typeFilter = ['apartment','villa','chalet','duplex','triplex']
  else if (type_group === 'land')   typeFilter = ['land']
  else                              typeFilter = ['commercial','shop','building','office']

  const { data } = await supabase
    .from('listings')
    .select('price')
    .eq('is_active', true)
    .eq('price_period', period)
    .in('property_type', typeFilter)
    .not('price', 'is', null)
    .gt('price', 0)

  if (!data?.length) {
    return NextResponse.json({ min: 0, max: 5000000, p5: 50000, p95: 2000000 })
  }

  const prices = data.map(r => Number(r.price)).sort((a, b) => a - b)
  const p5  = prices[Math.floor(prices.length * 0.05)]
  const p95 = prices[Math.floor(prices.length * 0.95)]
  const min = prices[0]
  const max = prices[prices.length - 1]

  return NextResponse.json({ min, max, p5: Math.round(p5), p95: Math.round(p95) })
}
