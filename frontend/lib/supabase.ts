import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Listing = {
  id: string
  source: string
  url: string
  title: string | null
  price: number | null
  currency: string
  price_period: string | null
  property_type: string | null
  size_sqm: number | null
  location_raw: string | null
  area: string | null
  city: string | null
  lat: number | null
  lng: number | null
  price_per_sqm: number | null
  scraped_at: string
}

export type AreaStat = {
  area: string
  property_type: string | null
  listing_count: number
  avg_price: number
  median_price: number
  avg_price_per_sqm: number | null
  min_price: number
  max_price: number
}
