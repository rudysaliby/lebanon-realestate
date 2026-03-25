import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('listings')
    .select('area')
    .eq('is_active', true)
    .not('area', 'is', null)
    .order('area')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

const areas = Array.from(new Set((data || []).map((r: any) => r.area))).sort()
  return NextResponse.json({ areas })
}
