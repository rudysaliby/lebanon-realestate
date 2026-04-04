'use client'
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useTheme } from '@/components/ThemeContext'
import type { Mode } from '@/app/page'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

// Store area data OUTSIDE Mapbox — Mapbox stringifies all properties
const areaDataStore: Record<string, any> = {}

function processGeoJSON(geojson: any) {
  if (!geojson?.features) return { type: 'FeatureCollection', features: [] }

  const areas: Record<string, any> = {}

  for (const f of geojson.features) {
    const p = f.properties
    const key = (p.area || p.region || 'Unknown') + '|' + (p.region || '')
    const areaName = p.area || p.region || 'Unknown'

    if (!areas[key]) {
      areas[key] = {
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        count: 0, ppsqms: [], prices: [],
        listings: [], area: areaName, region: p.region || '',
      }
    }
    const a = areas[key]
    a.count++
    if (p.price_per_sqm) a.ppsqms.push(Number(p.price_per_sqm))
    if (p.price) a.prices.push(Number(p.price))
    // Store clean listing with proper types
    a.listings.push({
      ...p,
      price: p.price ? Number(p.price) : null,
      size_sqm: p.size_sqm ? Number(p.size_sqm) : null,
      bedrooms: p.bedrooms ? Number(p.bedrooms) : null,
      bathrooms: p.bathrooms ? Number(p.bathrooms) : null,
      price_per_sqm: p.price_per_sqm ? Number(p.price_per_sqm) : null,
      area_median_ppsqm: p.area_median_ppsqm ? Number(p.area_median_ppsqm) : null,
    })
  }

  const med = (arr: number[]) => {
    if (!arr.length) return null
    const s = [...arr].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  }

  const allPpsqms = Object.values(areas).flatMap((a: any) => a.ppsqms).sort((a: any, b: any) => a - b)
  const p25 = allPpsqms[Math.floor(allPpsqms.length * 0.25)] || 0
  const p75 = allPpsqms[Math.floor(allPpsqms.length * 0.75)] || 1

  // Clear and repopulate store
  Object.keys(areaDataStore).forEach(k => delete areaDataStore[k])

  const features = Object.entries(areas).map(([key, a]: [string, any]) => {
    const mp = med(a.ppsqms)
    const score = mp && p75 > p25 ? Math.min(1, Math.max(0, (mp - p25) / (p75 - p25))) : 0.5
    const medPrice = med(a.prices)

    // Sort listings by deal score (cheapest $/sqm first)
    const sortedListings = [...a.listings].sort((x: any, y: any) => {
      const xs = x.price_per_sqm || 999999
      const ys = y.price_per_sqm || 999999
      return xs - ys
    })

    // Store in external ref — NOT in Mapbox properties
    areaDataStore[a.area] = {
      area: a.area,
      region: a.region,
      count: a.count,
      median_price: medPrice ? Math.round(medPrice) : null,
      median_ppsqm: mp ? Math.round(mp) : null,
      total_listings: a.listings.length,
      listings: sortedListings,
    }

    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      properties: {
        area: a.area,        // string — safe in Mapbox
        region: a.region,    // string — safe
        count: a.count,      // number — safe
        median_price: medPrice ? Math.round(medPrice) : 0,
        median_ppsqm: mp ? Math.round(mp) : 0,
        valuation_score: score,
      }
    }
  })

  return { type: 'FeatureCollection', features }
}

export default function MapView({ geojson, mode, onAreaClick }: {
  geojson: any, mode: Mode, onAreaClick: (d: any) => void
}) {
  const { theme } = useTheme()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const popup = useRef<mapboxgl.Popup | null>(null)
  const currentTheme = useRef(theme)
  const onAreaClickRef = useRef(onAreaClick)
  onAreaClickRef.current = onAreaClick

  const addLayers = (m: mapboxgl.Map, thm: string) => {
    if (!m.getSource('areas')) {
      m.addSource('areas', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any })
    }
    for (const l of ['area-heat', 'area-click', 'area-names']) {
      if (m.getLayer(l)) m.removeLayer(l)
    }

    // Heatmap — color by valuation_score (0=cheap=green, 1=expensive=red)
    m.addLayer({
      id: 'area-heat', type: 'heatmap', source: 'areas',
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 0, 0.2, 500, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 2],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0,   'rgba(0,0,0,0)',
          0.15, thm === 'dark' ? 'rgba(74,222,128,0.3)' : 'rgba(22,163,74,0.3)',
          0.4, 'rgba(74,222,128,0.65)',
          0.65, 'rgba(250,204,21,0.8)',
          0.85, 'rgba(248,113,113,0.85)',
          1.0, 'rgba(220,38,38,0.95)',
        ],
        'heatmap-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 35, 50, 65, 300, 100],
        'heatmap-opacity': 0.8,
      },
    })

    // Invisible clickable hit areas
    m.addLayer({
      id: 'area-click', type: 'circle', source: 'areas',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 16, 50, 28, 300, 42],
        'circle-opacity': 0,
        'circle-stroke-width': 0,
      },
    })

    // Area name + count labels
    m.addLayer({
      id: 'area-names', type: 'symbol', source: 'areas',
      layout: {
        'text-field': ['concat', ['get', 'area'], '\n', ['to-string', ['get', 'count']]],
        'text-size': 10, 'text-allow-overlap': false,
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-line-height': 1.3,
      },
      paint: {
        'text-color': thm === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)',
        'text-halo-color': thm === 'dark' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
        'text-halo-width': 1.5,
      },
    })
  }

  useEffect(() => {
    if (map.current || !mapContainer.current) return
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
      center: [35.5018, 33.8938], zoom: 8.5,
    })
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    map.current.on('load', () => {
      addLayers(map.current!, theme)
      popup.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 5 })

      map.current!.on('mouseenter', 'area-click', (e) => {
        map.current!.getCanvas().style.cursor = 'pointer'
        const p = e.features![0].properties!
        const isDark = currentTheme.current === 'dark'
        const bg = isDark ? 'rgba(15,15,15,0.97)' : 'rgba(255,255,255,0.97)'
        const txt = isDark ? '#f0ede6' : '#111'
        const sub = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)'
        popup.current!
          .setLngLat((e.features![0].geometry as any).coordinates)
          .setHTML(`<div style="font-family:DM Sans,sans-serif;padding:12px 16px;background:${bg};border-radius:10px;min-width:150px">
            <div style="font-weight:700;font-size:13px;color:${txt};margin-bottom:3px">${p.area}</div>
            <div style="font-size:11px;color:${sub};margin-bottom:7px">${p.region}</div>
            ${p.median_price > 0 ? `<div style="font-size:13px;color:#16a34a;font-weight:700">$${Number(p.median_price).toLocaleString()}</div>` : ''}
            ${p.median_ppsqm > 0 ? `<div style="font-size:11px;color:${sub}">$${Number(p.median_ppsqm).toLocaleString()}/m²</div>` : ''}
            <div style="font-size:10px;color:${sub};margin-top:6px">${p.count} listings · click to explore</div>
          </div>`)
          .addTo(map.current!)
      })
      map.current!.on('mouseleave', 'area-click', () => {
        map.current!.getCanvas().style.cursor = ''
        popup.current!.remove()
      })
      map.current!.on('click', 'area-click', (e) => {
        // Read from our external store — NOT from Mapbox properties
        const areaName = e.features![0].properties!.area
        const data = areaDataStore[areaName]
        if (data) onAreaClickRef.current(data)
      })
    })
  }, [])

  useEffect(() => {
    currentTheme.current = theme
    if (!map.current) return
    map.current.setStyle(theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11')
    map.current.once('styledata', () => {
      addLayers(map.current!, theme)
      const src = map.current!.getSource('areas') as mapboxgl.GeoJSONSource
      if (src && geojson) src.setData(processGeoJSON(geojson) as any)
    })
  }, [theme])

  useEffect(() => {
    if (!map.current || !geojson) return
    const update = () => {
      const src = map.current!.getSource('areas') as mapboxgl.GeoJSONSource
      if (src) src.setData(processGeoJSON(geojson) as any)
    }
    if (map.current.loaded()) update()
    else map.current.on('load', update)
  }, [geojson])

  return (
    <>
      <style>{`
        .mapboxgl-popup-content{background:transparent!important;border:none!important;padding:0!important;border-radius:10px!important;box-shadow:0 8px 32px rgba(0,0,0,0.35)!important}
        .mapboxgl-popup-tip{display:none!important}
        .mapboxgl-ctrl-group{background:rgba(15,15,15,0.9)!important;border:1px solid rgba(255,255,255,0.1)!important}
        .mapboxgl-ctrl-group button{background:transparent!important}
        .mapboxgl-ctrl-icon{filter:invert(1) opacity(0.5)!important}
      `}</style>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
