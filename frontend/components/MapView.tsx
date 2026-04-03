'use client'
import { useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Mode } from '@/app/page'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

// Cluster listings by area name → area centroids with stats
function buildAreaGeoJSON(geojson: any, mode: Mode) {
  if (!geojson?.features) return { type: 'FeatureCollection', features: [] }

  const areas: Record<string, {
    lat: number, lng: number, count: number,
    prices: number[], ppsqms: number[],
    listings: any[], area: string, region: string
  }> = {}

  for (const f of geojson.features) {
    const p = f.properties
    const key = p.area || p.region || 'Unknown'
    if (!areas[key]) {
      areas[key] = {
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        count: 0, prices: [], ppsqms: [],
        listings: [], area: p.area || key, region: p.region || ''
      }
    }
    const a = areas[key]
    a.count++
    if (p.price) a.prices.push(Number(p.price))
    if (p.price_per_sqm) a.ppsqms.push(Number(p.price_per_sqm))
    a.listings.push(p)
  }

  // Compute medians
  const median = (arr: number[]) => {
    if (!arr.length) return null
    const s = [...arr].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2
  }

  // Global median for color scale
  const allPpsqms = Object.values(areas).flatMap(a => a.ppsqms).filter(Boolean)
  const globalMedian = median(allPpsqms) || 1
  const globalP25 = allPpsqms.sort((a,b)=>a-b)[Math.floor(allPpsqms.length*0.25)] || globalMedian * 0.7
  const globalP75 = allPpsqms.sort((a,b)=>a-b)[Math.floor(allPpsqms.length*0.75)] || globalMedian * 1.3

  return {
    type: 'FeatureCollection',
    features: Object.entries(areas).map(([key, a]) => {
      const medPpsqm = median(a.ppsqms)
      const medPrice = median(a.prices)

      // Valuation color: green=cheap, yellow=mid, red=expensive
      let valuationScore = 0.5 // neutral
      if (medPpsqm && allPpsqms.length > 5) {
        valuationScore = Math.min(1, Math.max(0, (medPpsqm - globalP25) / (globalP75 - globalP25)))
      }

      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
        properties: {
          area: a.area,
          region: a.region,
          count: a.count,
          median_price: medPrice ? Math.round(medPrice) : null,
          median_ppsqm: medPpsqm ? Math.round(medPpsqm) : null,
          valuation_score: valuationScore,
          listings: JSON.stringify(a.listings.slice(0, 50)), // cap for perf
          total_listings: a.listings.length,
        }
      }
    })
  }
}

export default function MapView({ geojson, mode, onAreaClick }: {
  geojson: any
  mode: Mode
  onAreaClick: (data: any) => void
}) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const popup = useRef<mapboxgl.Popup | null>(null)

  useEffect(() => {
    if (map.current || !mapContainer.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [35.5018, 33.8938],
      zoom: 8.5,
    })

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    map.current.on('load', () => {
      // Area source
      map.current!.addSource('areas', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Bubble layer — sized by count, colored by price/sqm
      map.current!.addLayer({
        id: 'area-bubbles',
        type: 'circle',
        source: 'areas',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'count'],
            1, 10,
            10, 16,
            50, 22,
            200, 30,
            500, 38,
          ],
          'circle-color': [
            'interpolate', ['linear'], ['get', 'valuation_score'],
            0,   '#4ade80',  // cheap = green
            0.5, '#facc15',  // mid = yellow
            1,   '#f87171',  // expensive = red
          ],
          'circle-opacity': 0.82,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.15)',
        },
      })

      // Count labels
      map.current!.addLayer({
        id: 'area-labels',
        type: 'symbol',
        source: 'areas',
        layout: {
          'text-field': ['get', 'count'],
          'text-size': 11,
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-allow-overlap': false,
        },
        paint: { 'text-color': '#0a0a0a', 'text-halo-color': 'rgba(0,0,0,0.2)', 'text-halo-width': 1 },
      })

      // Area name on hover
      map.current!.addLayer({
        id: 'area-names',
        type: 'symbol',
        source: 'areas',
        layout: {
          'text-field': ['get', 'area'],
          'text-size': 10,
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-offset': [0, 2.2],
          'text-allow-overlap': false,
        },
        paint: { 'text-color': 'rgba(255,255,255,0.5)', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.5 },
      })

      // Hover popup
      popup.current = new mapboxgl.Popup({
        closeButton: false, closeOnClick: false,
        className: 'propiq-popup',
        offset: 5,
      })

      map.current!.on('mouseenter', 'area-bubbles', (e) => {
        map.current!.getCanvas().style.cursor = 'pointer'
        const p = e.features![0].properties!
        const price = p.median_price ? `$${Number(p.median_price).toLocaleString()}` : 'N/A'
        const ppsqm = p.median_ppsqm ? `$${Number(p.median_ppsqm).toLocaleString()}/m²` : ''
        popup.current!.setLngLat((e.features![0].geometry as any).coordinates)
          .setHTML(`
            <div style="font-family:DM Sans,sans-serif;padding:8px 12px">
              <div style="font-weight:700;font-size:13px;color:#f0ede6;margin-bottom:4px">${p.area}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.5)">${p.region}</div>
              <div style="font-size:12px;color:#4ade80;margin-top:6px;font-weight:600">${price} median</div>
              ${ppsqm ? `<div style="font-size:11px;color:rgba(255,255,255,0.4)">${ppsqm}</div>` : ''}
              <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-top:4px">${p.count} listings — click to explore</div>
            </div>
          `)
          .addTo(map.current!)
      })

      map.current!.on('mouseleave', 'area-bubbles', () => {
        map.current!.getCanvas().style.cursor = ''
        popup.current!.remove()
      })

      // Click → open panel
      map.current!.on('click', 'area-bubbles', (e) => {
        const p = e.features![0].properties!
        onAreaClick({
          area: p.area,
          region: p.region,
          count: p.count,
          median_price: p.median_price,
          median_ppsqm: p.median_ppsqm,
          total_listings: p.total_listings,
          listings: JSON.parse(p.listings || '[]'),
        })
      })
    })
  }, [])

  // Update data when geojson changes
  useEffect(() => {
    if (!map.current || !geojson) return
    const areaGeo = buildAreaGeoJSON(geojson, mode)
    const update = () => {
      const src = map.current!.getSource('areas') as mapboxgl.GeoJSONSource
      if (src) src.setData(areaGeo as any)
    }
    if (map.current.loaded()) update()
    else map.current.on('load', update)
  }, [geojson, mode])

  return (
    <>
      <style>{`
        .mapboxgl-popup-content { background: rgba(15,15,15,0.95) !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 10px !important; padding: 0 !important; box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important; }
        .mapboxgl-popup-tip { display: none !important; }
        .mapboxgl-ctrl-group { background: rgba(15,15,15,0.9) !important; border: 1px solid rgba(255,255,255,0.1) !important; }
        .mapboxgl-ctrl-group button { background: transparent !important; }
        .mapboxgl-ctrl-icon { filter: invert(1) opacity(0.5) !important; }
      `}</style>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
