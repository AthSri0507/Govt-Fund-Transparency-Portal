import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useParams, useNavigate } from 'react-router-dom'
import { getToken } from '../utils/auth'

export default function ProjectTimeline() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [err, setErr] = useState(null)
  const token = getToken()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [pRes, tRes] = await Promise.all([
          axios.get(`/api/projects/${id}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null })),
          axios.get(`/api/projects/${id}/timeline`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
        ])
        if (cancelled) return
        const proj = pRes && pRes.data && pRes.data.data ? pRes.data.data : pRes.data
        setProject(proj)
        const tl = tRes && tRes.data && tRes.data.data ? tRes.data.data : (Array.isArray(tRes && tRes.data) ? tRes.data : [])
        // remove comment events from timeline (show only official updates and fund transactions)
        setTimeline((tl || []).filter(item => item && item.type !== 'comment'))
      } catch (e) {
        console.error('timeline load', e)
        if (!cancelled) setErr(e.response?.data?.message || e.message)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const colorFor = (type) => {
    if (!type) return '#9e9e9e'
    if (type === 'project_update') return '#1976d2'
    if (type === 'fund_transaction') return '#2e7d32'
    if (type === 'comment') return '#ef6c00'
    return '#9e9e9e'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>{project ? project.name : 'Timeline'}</h2>
        <div>
          <button onClick={() => navigate(`/projects/${id}`)}>View Project</button>
        </div>
      </div>

      {err && <div style={{ color: 'red', marginTop: 8 }}>{err}</div>}

      <div style={{ marginTop: 12, padding: 12, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>
        {(!timeline || timeline.length === 0) ? (
          <div>No timeline events yet.</div>
        ) : (
          <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
            {timeline.map(item => {
              const color = colorFor(item.type)
              return (
                <li key={`${item.type}-${item.id}`} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: 14, height: 14, borderRadius: 7, background: color, marginTop: 6 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.type === 'project_update' ? 'Official update' : item.type === 'fund_transaction' ? 'Fund transaction' : 'Comment'}</div>
                        <div style={{ color: '#222' }}>{item.type === 'fund_transaction' ? `₹${item.amount} — ${item.purpose}` : item.type === 'project_update' ? (item.update_text || item.text) : item.text}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#666', minWidth: 160, textAlign: 'right' }}>{new Date(item.occurred_at || item.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
