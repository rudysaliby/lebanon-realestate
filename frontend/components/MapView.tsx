'use client'
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export default function MapView({ geojson, onSelect, selected }: {
  geojson: any; onSelect: (l: any) => void; selected: any
}) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (map.current || !mapContainer.current) return
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [35.5018, 33.8938],
      zoom: 9,
    })
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.current.on('load', () => {
      map.current!.addSource('listings', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 40,
      })

      // Clusters
      map.current!.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'listings',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#1a7a3c',
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 30],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#22c55e',
        },
      })
      map.current!.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'listings',
        filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12, 'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'] },
        paint: { 'text-color': '#fff' },
      })

      // Individual pins — colored by valuation
      map.current!.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'listings',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'case',
            ['==', ['get', 'valuation'], 'undervalued'], '#4ade80',
            ['==', ['get', 'valuation'], 'overvalued'],  '#f87171',
            ['==', ['get', 'valuation'], 'fair'],         '#818cf8',
            '#6b7280'
          ],
          'circle-radius': 7,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.9,
        },
      })

      map.current!.on('click', 'clusters', (e) => {
        const features = map.current!.queryRenderedFeatures(e.point, { layers: ['clusters'] })
        const clusterId = features[0].properties!.cluster_id
        const source = map.current!.getSource('listings') as mapboxgl.GeoJSONSource
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return
          map.current!.easeTo({ center: (features[0].geometry as any).coordinates, zoom: zoom! })
        })
      })

      map.current!.on('click', 'unclustered-point', (e) => {
        onSelect(e.features![0].properties)
      })

      for (const layer of ['clusters', 'unclustered-point']) {
        map.current!.on('mouseenter', layer, () => { map.current!.getCanvas().style.cursor = 'pointer' })
        map.current!.on('mouseleave', layer, () => { map.current!.getCanvas().style.cursor = '' })
      }
    })
  }, [])

  useEffect(() => {
    if (!map.current || !geojson) return
    const update = () => {
      const source = map.current!.getSource('listings') as mapboxgl.GeoJSONSource
      if (source) source.setData(geojson)
    }
    if (map.current.loaded()) update()
    else map.current.on('load', update)
  }, [geojson])

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
}
