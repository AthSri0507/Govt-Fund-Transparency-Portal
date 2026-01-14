import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useLocation } from 'react-router-dom'
import { getToken, getUser } from '../utils/auth'
import ProjectMap from '../components/ProjectMap'

export default function Home() {
  const [projects, setProjects] = useState([])
  const [err, setErr] = useState(null)
  const [filters, setFilters] = useState({ state: '', department: '', status: '', minRating: 0, minBudgetPct: 0, maxBudgetPct: 100 })
  const [followed, setFollowed] = useState(new Set())
  const [myCommentProjectIds, setMyCommentProjectIds] = useState(null)

  const location = useLocation()
  const urlFilter = new URLSearchParams(location.search).get('filter')
  const user = getUser()

  useEffect(() => {
    const token = getToken();
    axios.get('/api/projects', { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        const data = r.data.data || []
        setProjects(data)
        // if user requested "mycomments", find project ids where this user commented
        if (urlFilter === 'mycomments') {
          if (!user) {
            setErr('Please log in to view your comments')
            return
          }
          try {
            const ids = []
            // fetch comments for each project (projects capped at 100)
            await Promise.all(data.map(async p => {
              try {
                const c = await axios.get(`/api/projects/${p.id}/comments`, { headers: { Authorization: `Bearer ${token}` } })
                const comments = c.data && c.data.data ? c.data.data : []
                if (comments.some(cm => String(cm.user_id) === String(user.id))) ids.push(p.id)
              } catch (e) {
                // ignore per-project errors
              }
            }))
            setMyCommentProjectIds(new Set(ids))
          } catch (e) {
            // ignore
          }
        }
      })
      .catch(e => setErr(e.response?.data?.message || e.message))
    // load followed from localStorage
    try {
      const f = JSON.parse(localStorage.getItem('followed_projects') || '[]')
      setFollowed(new Set(f))
    } catch (e) {}
  }, [location.search])


  function toggleFollow(projectId) {
    const s = new Set(followed)
    if (s.has(projectId)) s.delete(projectId)
    else s.add(projectId)
    setFollowed(new Set(s))
    try { localStorage.setItem('followed_projects', JSON.stringify(Array.from(s))) } catch (e) {}
  }

  return (
    <div>
      <h2>Projects</h2>
      {err && <div style={{ color: 'red' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h3>Browse Projects</h3>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={filters.state} onChange={e=>setFilters(f=>({...f, state: e.target.value}))}>
              <option value=''>All states</option>
              {Array.from(new Set(projects.map(p=>p.state).filter(Boolean))).map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.department} onChange={e=>setFilters(f=>({...f, department: e.target.value}))}>
              <option value=''>All departments</option>
              {Array.from(new Set(projects.map(p=>p.department).filter(Boolean))).map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.status} onChange={e=>setFilters(f=>({...f, status: e.target.value}))}>
              <option value=''>All statuses</option>
              {Array.from(new Set(projects.map(p=>p.status).filter(Boolean))).map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
            <label style={{ display:'flex', alignItems:'center', gap:6 }}>
              Min rating:
              <select value={filters.minRating} onChange={e=>setFilters(f=>({...f, minRating: Number(e.target.value)}))}>
                <option value={0}>Any</option>
                <option value={1}>1+</option>
                <option value={2}>2+</option>
                <option value={3}>3+</option>
                <option value={4}>4+</option>
                <option value={5}>5</option>
              </select>
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:6 }}>
              Budget %:
              <input type="number" value={filters.minBudgetPct} onChange={e=>setFilters(f=>({...f, minBudgetPct: Number(e.target.value)}))} style={{ width: 60 }} />
              —
              <input type="number" value={filters.maxBudgetPct} onChange={e=>setFilters(f=>({...f, maxBudgetPct: Number(e.target.value)}))} style={{ width: 60 }} />
            </label>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {projects.filter(p => {
              if (filters.state && (p.state || '') !== filters.state) return false
              if (filters.department && (p.department || '') !== filters.department) return false
              if (filters.status && (p.status || '') !== filters.status) return false
              // support URL filters: followed and mycomments
              if (urlFilter === 'followed') {
                const f = JSON.parse(localStorage.getItem('followed_projects') || '[]')
                if (!f.includes(p.id)) return false
              }
              if (urlFilter === 'mycomments') {
                if (!myCommentProjectIds) return false // loading
                if (!myCommentProjectIds.has(p.id)) return false
              }
              const avg = (p.avg_rating !== null && p.avg_rating !== undefined) ? Number(p.avg_rating) : 0
              if ((avg || 0) < (filters.minRating || 0)) return false
              const total = p.budget_total || 0
              const used = p.budget_used || 0
              const pct = total > 0 ? Math.round((used/total)*100) : 0
              if (pct < (filters.minBudgetPct || 0) || pct > (filters.maxBudgetPct || 100)) return false
              return true
            }).map(p => (
              <div key={p.id} style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Link to={`/projects/${p.id}`} style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</Link>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ padding: '4px 8px', borderRadius: 12, background: p.status === 'Active' ? '#e8f5e9' : p.status === 'Halted' ? '#fff3e0' : p.status === 'ffebee', color: p.status === 'Active' ? '#2e7d32' : p.status === 'Halted' ? '#ef6c00' : '#c62828' }}>{p.status || 'Unknown'}</span>
                    <span style={{ marginLeft: 12 }}>{p.department || ''}</span>
                    <div style={{ marginTop: 6 }}>Budget used: {p.budget_total ? `${Math.round((p.budget_used||0)/p.budget_total*100)}%` : '—'}</div>
                    <div style={{ marginTop: 6 }}>Avg rating: {(p.avg_rating !== null && p.avg_rating !== undefined) ? renderStars(Math.round(Number(p.avg_rating))) : '—'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <button onClick={() => toggleFollow(p.id)} style={{ fontSize: 18 }} title="Follow project">{followed.has(p.id) ? '★' : '☆'}</button>
                  <Link to={`/projects/${p.id}`}><button>View</button></Link>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 2 }}>
          <h3>Map</h3>
          <ProjectMap projects={projects} />
        </div>
      </div>
    </div>
  )
}

function renderStars(n) {
  const stars = []
  for (let i=0;i<5;i++) stars.push(<span key={i} style={{ color: i < n ? '#fbc02d' : '#e0e0e0' }}>★</span>)
  return <span>{stars}</span>
}
