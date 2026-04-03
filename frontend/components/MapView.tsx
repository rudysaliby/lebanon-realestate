'use client'
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useTheme } from '@/components/ThemeContext'
import type { Mode } from '@/app/page'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

function buildAreaGeoJSON(geojson: any) {
  if (!geojson?.features) return { type: 'FeatureCollection', features: [] }

  const areas: Record<string, {
    lat: number, lng: number, count: number,
    ppsqms: number[], prices: number[], listings: any[], area: string, region: string
  }> = {}

  for (const f of geojson.features) {
    const p = f.properties
    const key = p.area || p.region || 'Unknown'
    if (!areas[key]) {
      areas[key] = {
        lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
        count: 0, ppsqms: [], prices: [], listings: [],
        area: p.area || key, region: p.region || '',
      }
    }
    const a = areas[key]
    a.count++
    if (p.price && p.size_sqm) a.ppsqms.push(Number(p.price) / Number(p.size_sqm))
    if (p.price) a.prices.push(Number(p.price))
    a.listings.push(p)
  }

  const med = (arr: number[]) => {
    if (!arr.length) return null
    const s = [...arr].sort((a,b) => a-b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m-1]+s[m])/2
  }

  const allPpsqms = Object.values(areas).flatMap(a => a.ppsqms).sort((a,b)=>a-b)
  const p25 = allPpsqms[Math.floor(allPpsqms.length*0.25)] || 0
  const p75 = allPpsqms[Math.floor(allPpsqms.length*0.75)] || 1

  return {
    type: 'FeatureCollection',
    features: Object.values(areas).map(a => {
      const mp = med(a.ppsqms)
      const score = mp && p75 > p25 ? Math.min(1, Math.max(0, (mp - p25)/(p75 - p25))) : 0.5
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
        properties: {
          area: a.area, region: a.region, count: a.count,
          median_price: med(a.prices) ? Math.round(med(a.prices)!) : null,
          median_ppsqm: mp ? Math.round(mp) : null,
          valuation_score: score,
          total_listings: a.listings.length,
          listings: JSON.stringify(a.listings.slice(0, 50)),
        }
      }
    })
  }
}

export default function MapView({ geojson, mode, onAreaClick }: {
  geojson: any, mode: Mode, onAreaClick: (d: any) => void
}) {
  const { theme } = useTheme()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const popup = useRef<mapboxgl.Popup | null>(null)
  const currentTheme = useRef(theme)

  // Init map
  useEffect(() => {
    if (map.current || !mapContainer.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
      center: [35.5018, 33.8938],
      zoom: 8.5,
    })

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    map.current.on('load', () => {
      map.current!.addSource('areas', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] } as any,
      })

      map.current!.addLayer({
        id: 'area-bubbles', type: 'circle', source: 'areas',
        paint: {
          'circle-radius': ['interpolate',['linear'],['get','count'],1,10,10,16,50,22,200,30,500,38],
          'circle-color': ['interpolate',['linear'],['get','valuation_score'],0,'#4ade80',0.5,'#facc15',1,'#f87171'],
          'circle-opacity': 0.82,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['case',['==',theme,'light'],'rgba(255,255,255,0.6)','rgba(255,255,255,0.15)'],
        },
      })

      map.current!.addLayer({
        id: 'area-labels', type: 'symbol', source: 'areas',
        layout: { 'text-field': ['get','count'], 'text-size': 11, 'text-font': ['DIN Offc Pro Medium','Arial Unicode MS Bold'] },
        paint: { 'text-color': '#0a0a0a', 'text-halo-color': 'rgba(0,0,0,0.15)', 'text-halo-width': 1 },
      })

      map.current!.addLayer({
        id: 'area-names', type: 'symbol', source: 'areas',
        layout: { 'text-field': ['get','area'], 'text-size': 10, 'text-font': ['DIN Offc Pro Medium','Arial Unicode MS Bold'], 'text-offset': [0,2.2] },
        paint: { 'text-color': theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)', 'text-halo-color': theme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)', 'text-halo-width': 1.5 },
      })

      popup.current = new mapboxgl.Popup({ closeButton:false, closeOnClick:false, offset:5 })

      map.current!.on('mouseenter', 'area-bubbles', (e) => {
        map.current!.getCanvas().style.cursor = 'pointer'
        const p = e.features![0].properties!
        const isDark = currentTheme.current === 'dark'
        popup.current!.setLngLat((e.features![0].geometry as any).coordinates)
          .setHTML(`<div style="font-family:DM Sans,sans-serif;padding:10px 14px;background:${isDark?'rgba(15,15,15,0.97)':'rgba(255,255,255,0.97)'};border-radius:10px">
            <div style="font-weight:700;font-size:13px;color:${isDark?'#f0ede6':'#111827'};margin-bottom:3px">${p.area}</div>
            <div style="font-size:11px;color:${isDark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.4)'}">${p.region}</div>
            ${p.median_price ? `<div style="font-size:12px;color:#16a34a;margin-top:6px;font-weight:600">$${Number(p.median_price).toLocaleString()} median</div>` : ''}
            ${p.median_ppsqm ? `<div style="font-size:11px;color:${isDark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.4)'}">$${Number(p.median_ppsqm).toLocaleString()}/m²</div>` : ''}
            <div style="font-size:10px;color:${isDark?'rgba(255,255,255,0.25)':'rgba(0,0,0,0.3)'};margin-top:4px">${p.count} listings — click to explore</div>
          </div>`)
          .addTo(map.current!)
      })

      map.current!.on('mouseleave', 'area-bubbles', () => {
        map.current!.getCanvas().style.cursor = ''
        popup.current!.remove()
      })

      map.current!.on('click', 'area-bubbles', (e) => {
        const p = e.features![0].properties!
        onAreaClick({
          area: p.area, region: p.region, count: p.count,
          median_price: p.median_price, median_ppsqm: p.median_ppsqm,
          total_listings: p.total_listings,
          listings: JSON.parse(p.listings || '[]'),
        })
      })
    })
  }, [])

  // Update map style when theme changes
  useEffect(() => {
    currentTheme.current = theme
    if (!map.current) return
    const style = theme === 'dark'
      ? 'mapbox://styles/mapbox/dark-v11'
      : 'mapbox://styles/mapbox/light-v11'
    map.current.setStyle(style)
    // Re-add sources/layers after style change
    map.current.once('styledata', () => {
      if (!map.current!.getSource('areas')) {
        map.current!.addSource('areas', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any })
        map.current!.addLayer({
          id: 'area-bubbles', type: 'circle', source: 'areas',
          paint: {
            'circle-radius': ['interpolate',['linear'],['get','count'],1,10,10,16,50,22,200,30,500,38],
            'circle-color': ['interpolate',['linear'],['get','valuation_score'],0,'#4ade80',0.5,'#facc15',1,'#f87171'],
            'circle-opacity': 0.82,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'rgba(255,255,255,0.15)',
          },
        })
        map.current!.addLayer({
          id: 'area-labels', type: 'symbol', source: 'areas',
          layout: { 'text-field': ['get','count'], 'text-size': 11, 'text-font': ['DIN Offc Pro Medium','Arial Unicode MS Bold'] },
          paint: { 'text-color': '#0a0a0a' },
        })
        map.current!.addLayer({
          id: 'area-names', type: 'symbol', source: 'areas',
          layout: { 'text-field': ['get','area'], 'text-size': 10, 'text-font': ['DIN Offc Pro Medium','Arial Unicode MS Bold'], 'text-offset': [0,2.2] },
          paint: { 'text-color': theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)', 'text-halo-color': theme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)', 'text-halo-width': 1.5 },
        })
      }
      // Re-apply data
      if (geojson) {
        const src = map.current!.getSource('areas') as mapboxgl.GeoJSONSource
        if (src) src.setData(buildAreaGeoJSON(geojson) as any)
      }
    })
  }, [theme])

  // Update data
  useEffect(() => {
    if (!map.current || !geojson) return
    const areaGeo = buildAreaGeoJSON(geojson)
    const update = () => {
      const src = map.current!.getSource('areas') as mapboxgl.GeoJSONSource
      if (src) src.setData(areaGeo as any)
    }
    if (map.current.loaded()) update()
    else map.current.on('load', update)
  }, [geojson])

  return (
    <>
      <style>{`
        .mapboxgl-popup-content { background: transparent !important; border: none !important; padding: 0 !important; box-shadow: 0 8px 32px rgba(0,0,0,0.3) !important; border-radius: 10px !important; }
        .mapboxgl-popup-tip { display: none !important; }
        .mapboxgl-ctrl-group { background: rgba(15,15,15,0.9) !important; border: 1px solid rgba(255,255,255,0.1) !important; }
        .mapboxgl-ctrl-group button { background: transparent !important; }
        .mapboxgl-ctrl-icon { filter: invert(1) opacity(0.5) !important; }
      `}</style>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
