'use client'
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useTheme } from '@/components/ThemeContext'
import type { Mode } from '@/app/page'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

// External store — bypasses Mapbox property serialization
const areaDataStore: Record<string, any> = {}

function processGeoJSON(geojson: any, showDealsOnly: boolean) {
  if (!geojson?.features) return { type: 'FeatureCollection', features: [] }

  const areas: Record<string, any> = {}
  for (const f of geojson.features) {
    const p = f.properties
    const key = p.area || p.region || 'Unknown'
    if (!areas[key]) {
      areas[key] = {
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        area: p.area || key,
        region: p.region || '',
        subregion: p.subregion || '',
        count: 0,
        ppsqms: [],
        prices: [],
        listings: [],
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

  // Compute global percentiles for valuation
  const allPpsqms = Object.values(areas).flatMap((a: any) => a.ppsqms).sort((a: any, b: any) => a - b)
  const p25 = allPpsqms[Math.floor(allPpsqms.length * 0.25)] || 0
  const p75 = allPpsqms[Math.floor(allPpsqms.length * 0.75)] || 1

  const features: any[] = []

  Object.values(areas).forEach((a: any) => {
    const medPpsqm = med(a.ppsqms)
    const medPrice = med(a.prices)
    // valuation_score: 0=cheap(good deal), 1=expensive
    const score = medPpsqm && p75 > p25
      ? Math.min(1, Math.max(0, (medPpsqm - p25) / (p75 - p25)))
      : 0.5

    const dealScore = 1 - score // 1=great deal, 0=expensive

    // Count "good deal" listings (below area median ppsqm)
    const goodDealCount = a.ppsqms.filter((p: number) => medPpsqm && p < medPpsqm * 0.9).length

    // Sort listings: best deal first (lowest ppsqm)
    const sortedListings = [...a.listings].sort((x: any, y: any) => {
      const xs = x.price && x.size_sqm ? Number(x.price) / Number(x.size_sqm) : 999999
      const ys = y.price && y.size_sqm ? Number(y.price) / Number(y.size_sqm) : 999999
      return xs - ys
    })

    // In "deals only" mode, filter to only good deal listings
    const filteredListings = showDealsOnly
      ? sortedListings.filter((l: any) => {
          if (!l.price || !l.size_sqm || !medPpsqm) return false
          return (Number(l.price) / Number(l.size_sqm)) < medPpsqm * 0.95
        })
      : sortedListings

    // Skip areas with no matching listings in deals mode
    if (showDealsOnly && filteredListings.length === 0) return

    const areaData = {
      area: a.area,
      region: a.region,
      subregion: a.subregion,
      count: filteredListings.length,
      total_count: a.count,
      median_price: medPrice ? Math.round(medPrice) : null,
      median_ppsqm: medPpsqm ? Math.round(medPpsqm) : null,
      good_deal_count: goodDealCount,
      deal_score: dealScore,
      listings: filteredListings.slice(0, 60),
      show_deals_only: showDealsOnly,
    }

    // Store in external map (bypasses Mapbox serialization)
    areaDataStore[a.area] = areaData

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      properties: {
        area: a.area,
        count: showDealsOnly ? goodDealCount : a.count,
        deal_score: dealScore,
        good_deal_count: goodDealCount,
      }
    })
  })

  return { type: 'FeatureCollection', features }
}

export default function MapView({ geojson, mode, onAreaClick, showDealsOnly }: {
  geojson: any
  mode: Mode
  onAreaClick: (d: any) => void
  showDealsOnly: boolean
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
      m.addSource('areas', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] } as any,
      })
    }
    for (const l of ['area-heat', 'area-click', 'area-labels']) {
      if (m.getLayer(l)) m.removeLayer(l)
    }

    // Heatmap — green = good deals, intensity based on count of good deals
    m.addLayer({
      id: 'area-heat',
      type: 'heatmap',
      source: 'areas',
      paint: {
        // Weight by count of good deals
        'heatmap-weight': [
          'interpolate', ['linear'], ['get', 'count'],
          0, 0, 5, 0.4, 20, 0.7, 100, 1
        ],
        'heatmap-intensity': [
          'interpolate', ['linear'], ['zoom'],
          6, 0.5, 10, 1.5, 13, 2
        ],
        // Always green — brighter = more good deals
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0,    'rgba(0,0,0,0)',
          0.05, 'rgba(74,222,128,0.05)',
          0.2,  'rgba(74,222,128,0.25)',
          0.5,  'rgba(74,222,128,0.55)',
          0.8,  'rgba(74,222,128,0.8)',
          1.0,  'rgba(74,222,128,0.95)',
        ],
        'heatmap-radius': [
          'interpolate', ['linear'], ['get', 'count'],
          1, 25, 10, 45, 50, 65, 200, 90
        ],
        'heatmap-opacity': 0.8,
      },
    })

    // Invisible clickable layer
    m.addLayer({
      id: 'area-click',
      type: 'circle',
      source: 'areas',
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['get', 'count'],
          1, 14, 10, 20, 50, 28, 200, 36
        ],
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
        'text-color': thm === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)',
        'text-halo-color': thm === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
        'text-halo-width': 1.5,
      },
    })

    // Events
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
        .setHTML(`
          <div style="font-family:DM Sans,sans-serif;padding:12px 16px;background:${bg};border-radius:10px;min-width:160px;box-shadow:0 8px 32px rgba(0,0,0,0.3)">
            <div style="font-weight:700;font-size:13px;color:${tc};margin-bottom:2px">${data.area}</div>
            <div style="font-size:11px;color:${sub};margin-bottom:8px">${data.region}</div>
            ${data.median_price ? `<div style="font-size:13px;color:#4ade80;font-weight:700">$${Number(data.median_price).toLocaleString()}</div>` : ''}
            ${data.median_ppsqm ? `<div style="font-size:11px;color:${sub}">$${Number(data.median_ppsqm).toLocaleString()}/m²</div>` : ''}
            <div style="font-size:10px;color:${sub};margin-top:6px">${data.count} listings · click to explore</div>
          </div>
        `)
        .addTo(m)
    })

    m.on('mouseleave', 'area-click', () => {
      m.getCanvas().style.cursor = ''
      popup.current!.remove()
    })

    m.on('click', 'area-click', (e) => {
      const p = e.features![0].properties!
      const data = areaDataStore[p.area]
      if (data) {
        popup.current!.remove()
        onAreaClickRef.current(data)
      }
    })
  }

  useEffect(() => {
    if (map.current || !mapContainer.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: theme === 'dark'
        ? 'mapbox://styles/mapbox/dark-v11'
        : 'mapbox://styles/mapbox/light-v11',
      center: [35.5018, 33.8938],
      zoom: 8.5,
    })

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    popup.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })

    map.current.on('load', () => addLayers(map.current!, theme))
  }, [])

  // Theme switch
  useEffect(() => {
    currentTheme.current = theme
    if (!map.current) return
    const style = theme === 'dark'
      ? 'mapbox://styles/mapbox/dark-v11'
      : 'mapbox://styles/mapbox/light-v11'
    map.current.setStyle(style)
    map.current.once('styledata', () => {
      addLayers(map.current!, theme)
      if (geojson) {
        const src = map.current!.getSource('areas') as mapboxgl.GeoJSONSource
        if (src) src.setData(processGeoJSON(geojson, showDealsOnly) as any)
      }
    })
  }, [theme])

  // Data / mode update
  useEffect(() => {
    if (!map.current || !geojson) return
    const data = processGeoJSON(geojson, showDealsOnly)
    const update = () => {
      const src = map.current!.getSource('areas') as mapboxgl.GeoJSONSource
      if (src) src.setData(data as any)
    }
    if (map.current.loaded()) update()
    else map.current.once('load', update)
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
