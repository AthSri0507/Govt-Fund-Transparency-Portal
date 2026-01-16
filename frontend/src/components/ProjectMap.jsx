import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default icon URLs (use unpkg CDN to avoid bundler asset issues)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png'
})

export default function ProjectMap({ projects = [], single = false, mapFilters = { state: '', department: '', status: '' } }){
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const filters = mapFilters || { state: '', department: '', status: '' }

  useEffect(()=>{
    if (!mapRef.current) {
      mapRef.current = L.map('project-map', { center: [20, 78], zoom: 5 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current)
      layerRef.current = L.layerGroup().addTo(mapRef.current)
    }
    return () => {
      // do not destroy map to keep single instance while mounted
    }
  }, [])

  useEffect(()=>{
    // update markers when projects or filters change
    if (!layerRef.current) return
    layerRef.current.clearLayers()
    const filtered = projects.filter(p => {
      if (filters.state && String(p.state || '').toLowerCase() !== String(filters.state).toLowerCase()) return false
      if (filters.department && String(p.department || '').toLowerCase() !== String(filters.department).toLowerCase()) return false
      if (filters.status && String(p.status || '').toLowerCase() !== String(filters.status).toLowerCase()) return false
      const lat = Number(p.latitude)
      const lng = Number(p.longitude)
      if (Number.isNaN(lat) || Number.isNaN(lng)) return false
      return true
    })
    const markers = []
    filtered.forEach(p => {
      try {
        const lat = Number(p.latitude)
        const lng = Number(p.longitude)
        const m = L.marker([lat, lng])
        const budgetTotal = p.budget_total ? Number(p.budget_total) : 0
        const budgetUsed = p.budget_used ? Number(p.budget_used) : 0
        const pct = budgetTotal > 0 ? Math.round((budgetUsed / budgetTotal) * 100) : '—'
        const popupHtml = `<div style="min-width:180px"><strong>${p.name}</strong><br/>${p.department || ''} — ${p.status || ''}<br/>Budget: ${pct}% used<br/><a href=\"/projects/${p.id}\"><button style=\"margin-top:6px;padding:6px 8px\">View project</button></a></div>`
        m.bindPopup(popupHtml)
        m.addTo(layerRef.current)
        markers.push(m)
      } catch (e) {
        // ignore invalid coords
      }
    })
    if (markers.length) {
      const group = L.featureGroup(markers)
      try { mapRef.current.fitBounds(group.getBounds().pad(0.5)) } catch (e) {}
    }
  }, [projects, filters])

  // build filter option sets (used by parent toolbar if needed)
  const regions = Array.from(new Set(projects.map(p => p.state).filter(Boolean)))
  const departments = Array.from(new Set(projects.map(p => p.department).filter(Boolean)))
  const statuses = Array.from(new Set(projects.map(p => p.status).filter(Boolean)))

  return (
    <div>
      <div id="project-map" style={{ height: 400, width: '100%', border: '1px solid #ddd' }} />
    </div>
  )
}
