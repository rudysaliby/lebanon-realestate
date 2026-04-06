'use client'
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useTheme } from '@/components/ThemeContext'
import type { Mode } from '@/app/page'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

const areaDataStore: Record<string, any> = {}

function processGeoJSON(geojson: any, showDealsOnly: boolean) {
  if (!geojson?.features) return { type: 'FeatureCollection', features: [] }

  const areas: Record<string, any> = {}
  for (const f of geojson.features) {
    const p = f.properties
    const key = p.area || p.region || 'Unknown'
    if (!areas[key]) {
      areas[key] = {
        lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
        area: p.area || key, region: p.region || '', subregion: p.subregion || '',
        count: 0, ppsqms: [], prices: [], listings: [],
      }
    }
    const a = areas[key]
    a.count++
    if (p.price && p.size_sqm) a.ppsqms.push(Number(p.price) / Number(p.size_sqm))
    if (p.price) a.prices.push(Number(p.price))
    a.listings.push({ ...p })
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

  const features: any[] = []

  Object.values(areas).forEach((a: any) => {
    const medPpsqm = med(a.ppsqms)
    const medPrice = med(a.prices)
    const score = medPpsqm && p75 > p25
      ? Math.min(1, Math.max(0, (medPpsqm - p25) / (p75 - p25))) : 0.5

    const sortedListings = [...a.listings].sort((x: any, y: any) => {
      const xs = x.price && x.size_sqm ? Number(x.price) / Number(x.size_sqm) : 999999
      const ys = y.price && y.size_sqm ? Number(y.price) / Number(y.size_sqm) : 999999
      return xs - ys
    })

    const goodDealListings = sortedListings.filter((l: any) => {
      if (!l.price || !l.size_sqm || !medPpsqm) return false
      return (Number(l.price) / Number(l.size_sqm)) < medPpsqm * 0.95
    })

    const filteredListings = showDealsOnly ? goodDealListings : sortedListings
    if (showDealsOnly && filteredListings.length === 0) return

    const areaData = {
      area: a.area, region: a.region, subregion: a.subregion,
      count: filteredListings.length,
      total_count: a.count,
      median_price: medPrice ? Math.round(medPrice) : null,
      median_ppsqm: medPpsqm ? Math.round(medPpsqm) : null,
      good_deal_count: goodDealListings.length,
      listings: filteredListings.slice(0, 60),
      show_deals_only: showDealsOnly,
    }

    areaDataStore[a.area] = areaData

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      properties: {
        area: a.area, region: a.region,
        count: showDealsOnly ? goodDealListings.length : a.count,
        lat: a.lat, lng: a.lng,
      }
    })
  })

  return { type: 'FeatureCollection', features }
}

export default function MapView({ geojson, mode, onAreaClick, showDealsOnly }: {
  geojson: any, mode: Mode, onAreaClick: (d: any) => void, showDealsOnly: boolean
}) {
  const { theme } = useTheme()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const popup = useRef<mapboxgl.Popup | null>(null)
  const currentTheme = useRef(theme)
  const onAreaClickRef = useRef(onAreaClick)
  onAreaClickRef.current = onAreaClick
  const showDealsRef = useRef(showDealsOnly)
  showDealsRef.current = showDealsOnly

  const addLayers = (m: mapboxgl.Map, thm: string, dealsOnly: boolean) => {
    if (!m.getSource('areas')) {
      m.addSource('areas', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any })
    }
    for (const l of ['area-heat', 'area-circles', 'area-click', 'area-labels']) {
      if (m.getLayer(l)) m.removeLayer(l)
    }

    if (dealsOnly) {
      // Good Deals mode — green heatmap
      m.addLayer({
        id: 'area-heat',
        type: 'heatmap',
        source: 'areas',
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 0, 0, 5, 0.4, 20, 0.7, 100, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 10, 1.5, 13, 2],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.05, 'rgba(74,222,128,0.05)',
            0.2, 'rgba(74,222,128,0.3)',
            0.5, 'rgba(74,222,128,0.6)',
            0.8, 'rgba(74,222,128,0.85)',
            1.0, 'rgba(74,222,128,1)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 25, 10, 45, 50, 65, 200, 90],
          'heatmap-opacity': 0.8,
        },
      })
    } else {
      // All listings mode — green circles, uniform size
      m.addLayer({
        id: 'area-circles',
        type: 'circle',
        source: 'areas',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 12, 10, 18, 13, 24],
          'circle-color': '#4ade80',
          'circle-opacity': 0.25,
          'circle-stroke-color': '#4ade80',
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': 0.6,
        },
      })
    }

    // Invisible clickable layer (always present)
    m.addLayer({
      id: 'area-click',
      type: 'circle',
      source: 'areas',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 16, 10, 22, 13, 30],
        'circle-color': 'transparent',
        'circle-opacity': 0,
      },
    })

    // Count labels
    m.addLayer({
      id: 'area-labels',
      type: 'symbol',
      source: 'areas',
      layout: {
        'text-field': ['get', 'count'],
        'text-size': 11,
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': thm === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
        'text-halo-color': thm === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
        'text-halo-width': 1.5,
      },
    })

    // Hover popup
    m.on('mouseenter', 'area-click', (e) => {
      m.getCanvas().style.cursor = 'pointer'
      const p = e.features![0].properties!
      const data = areaDataStore[p.area]
      if (!data) return
      const isDark = currentTheme.current === 'dark'
      const bg = isDark ? 'rgba(15,15,15,0.97)' : 'rgba(255,255,255,0.97)'
      const tc = isDark ? '#f0ede6' : '#111827'
      const sub = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'

      popup.current!
        .setLngLat((e.features![0].geometry as any).coordinates)
        .setHTML(`<div style="font-family:DM Sans,sans-serif;padding:12px 16px;background:${bg};border-radius:10px;min-width:160px;box-shadow:0 8px 32px rgba(0,0,0,0.3)">
          <div style="font-weight:700;font-size:13px;color:${tc};margin-bottom:2px">${data.area}</div>
          <div style="font-size:11px;color:${sub};margin-bottom:8px">${data.region}</div>
          ${data.median_price ? `<div style="font-size:13px;color:#4ade80;font-weight:700">$${Number(data.median_price).toLocaleString()}</div>` : ''}
          ${data.median_ppsqm ? `<div style="font-size:11px;color:${sub}">$${Number(data.median_ppsqm).toLocaleString()}/m²</div>` : ''}
          <div style="font-size:10px;color:${sub};margin-top:6px">${data.count} listings · click to explore</div>
        </div>`)
        .addTo(m)
    })

    m.on('mouseleave', 'area-click', () => {
      m.getCanvas().style.cursor = ''
      popup.current!.remove()
    })

    // Click — zoom in first if zoomed out, then open panel
    m.on('click', 'area-click', (e) => {
      const p = e.features![0].properties!
      const data = areaDataStore[p.area]
      if (!data) return

      popup.current!.remove()

      const currentZoom = m.getZoom()

      // If zoomed out (< 11), zoom into the area first
      if (currentZoom < 11) {
        m.flyTo({
          center: [Number(p.lng || data.listings?.[0]?.lng || e.lngLat.lng), 
                   Number(p.lat || data.listings?.[0]?.lat || e.lngLat.lat)],
          zoom: 12,
          duration: 800,
        })
        // Open panel after zoom completes
        setTimeout(() => {
          onAreaClickRef.current(data)
        }, 850)
      } else {
        onAreaClickRef.current(data)
      }
    })
  }

  useEffect(() => {
    if (map.current || !mapContainer.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
      center: [35.5018, 33.8938],
      zoom: 8.5,
    })

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    popup.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })
    map.current.on('load', () => addLayers(map.current!, theme, showDealsOnly))
  }, [])

  // Theme change
  useEffect(() => {
    currentTheme.current = theme
    if (!map.current) return
    map.current.setStyle(theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11')
    map.current.once('styledata', () => {
      addLayers(map.current!, theme, showDealsRef.current)
      const src = map.current!.getSource('areas') as mapboxgl.GeoJSONSource
      if (src && geojson) src.setData(processGeoJSON(geojson, showDealsRef.current) as any)
    })
  }, [theme])

  // Data / showDealsOnly update
  useEffect(() => {
    if (!map.current || !geojson) return
    const data = processGeoJSON(geojson, showDealsOnly)
    const apply = () => {
      // Rebuild layers when mode changes (heatmap ↔ circles)
      addLayers(map.current!, currentTheme.current, showDealsOnly)
      const src = map.current!.getSource('areas') as mapboxgl.GeoJSONSource
      if (src) src.setData(data as any)
    }
    if (map.current.loaded()) apply()
    else map.current.once('load', apply)
  }, [geojson, showDealsOnly])

  return (
    <>
      <style>{`
        .mapboxgl-popup-content{background:transparent!important;border:none!important;padding:0!important;box-shadow:none!important;}
        .mapboxgl-popup-tip{display:none!important;}
        .mapboxgl-ctrl-group{background:rgba(15,15,15,0.9)!important;border:1px solid rgba(255,255,255,0.1)!important;}
        .mapboxgl-ctrl-group button{background:transparent!important;}
        .mapboxgl-ctrl-icon{filter:invert(1)opacity(0.5)!important;}
      `}</style>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
