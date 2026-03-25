import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const area = searchParams.get('area')
  const type = searchParams.get('type')

  let query = supabase.from('area_stats').select('*')
  if (area) query = query.eq('area', area)
  if (type && type !== 'all') query = query.eq('property_type', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ stats: data || [] })
}
