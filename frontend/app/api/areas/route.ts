import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const region = searchParams.get('region')

  const [areasRes, regionsRes, subregionsRes] = await Promise.all([
    supabase.from('listings').select('area').eq('is_active', true).not('area', 'is', null).order('area'),
    supabase.from('listings').select('region').eq('is_active', true).not('region', 'is', null).order('region'),
    region
      ? supabase.from('listings').select('subregion').eq('is_active', true).eq('region', region).not('subregion', 'is', null).order('subregion')
      : Promise.resolve({ data: [] }),
  ])

  const areas      = Array.from(new Set((areasRes.data || []).map((r: any) => r.area))).sort()
  const regions    = Array.from(new Set((regionsRes.data || []).map((r: any) => r.region))).sort()
  const subregions = Array.from(new Set(((subregionsRes as any).data || []).map((r: any) => r.subregion))).sort()

  return NextResponse.json({ areas, regions, subregions })
}
