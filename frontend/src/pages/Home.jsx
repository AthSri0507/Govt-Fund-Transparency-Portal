import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useLocation } from 'react-router-dom'
import { getToken, getUser, getUserScopedItem, setUserScopedItem } from '../utils/auth'
import ProjectMap from '../components/ProjectMap'
import './Home.css'

export default function Home() {
  const [projects, setProjects] = useState([])
  const [err, setErr] = useState(null)
  const [filters, setFilters] = useState({ state: '', department: '', status: '', minRating: 0, name: '' })
  const [mapFilters, setMapFilters] = useState({ state: '', department: '', status: '' })
  const [followed, setFollowed] = useState(new Set())
  const [myCommentProjectIds, setMyCommentProjectIds] = useState(null)
  const [showMap, setShowMap] = useState(true)

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
    // load followed from localStorage (user-scoped)
    try {
      const f = JSON.parse(getUserScopedItem('followed_projects') || '[]')
      setFollowed(new Set(f))
    } catch (e) {}
  }, [location.search])


  function toggleFollow(projectId) {
    const s = new Set(followed)
    if (s.has(projectId)) s.delete(projectId)
    else s.add(projectId)
    setFollowed(new Set(s))
    try { setUserScopedItem('followed_projects', JSON.stringify(Array.from(s))) } catch (e) {}
  }

  return (
    <div className="home-container">
      <div className="home-title">Browse Projects</div>
      {err && <div className="error-text">{err}</div>}

      <div className={`home-grid ${!showMap ? 'map-hidden' : ''}`}>
        <div className="left-col">
          <div className="filter-box">
            <h3>Filters</h3>
            <div className="filter-row top">
              <div className="filter-field">
                <label className="filter-label">State</label>
                <select className="filter-control" value={filters.state} onChange={e=>setFilters(f=>({...f, state: e.target.value}))}>
                  <option value=''>All states</option>
                  {Array.from(new Set(projects.map(p=>p.state).filter(Boolean))).map(s=> <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="filter-field">
                <label className="filter-label">Department</label>
                <select className="filter-control" value={filters.department} onChange={e=>setFilters(f=>({...f, department: e.target.value}))}>
                  <option value=''>All departments</option>
                  {Array.from(new Set(projects.map(p=>p.department).filter(Boolean))).map(s=> <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="filter-field">
                <label className="filter-label">Status</label>
                <select className="filter-control" value={filters.status} onChange={e=>setFilters(f=>({...f, status: e.target.value}))}>
                  <option value=''>All statuses</option>
                  {Array.from(new Set(projects.map(p=>p.status).filter(Boolean))).map(s=> <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="filter-row bottom">
              <div className="filter-field small">
                <label className="filter-label">Min rating</label>
                <select className="filter-control" value={filters.minRating} onChange={e=>setFilters(f=>({...f, minRating: Number(e.target.value)}))}>
                  <option value={0}>Any</option>
                  <option value={1}>1+</option>
                  <option value={2}>2+</option>
                  <option value={3}>3+</option>
                  <option value={4}>4+</option>
                  <option value={5}>5</option>
                </select>
              </div>
              <div className="filter-field">
                <label className="filter-label">Project name</label>
                <input type="text" className="filter-control" placeholder="Search by name" value={filters.name} onChange={e=>setFilters(f=>({...f, name: e.target.value}))} />
              </div>
            </div>

            <div className="filter-actions">
              <button
                className="map-toggle"
                onClick={() => setShowMap(s => !s)}
              >
                {showMap ? '🗺️ Hide map view' : '🗺️ Filter projects by map'}
              </button>
            </div>
          </div>

          {showMap && (
            <div className="map-container">
                <div className="map-toolbar">
                  <div className="map-toolbar-title">Map</div>
                  <div className="map-toolbar-controls">
                    <select className="filter-control" value={mapFilters.state} onChange={e=>setMapFilters(m=>({...m, state: e.target.value}))}>
                      <option value=''>All states</option>
                      {Array.from(new Set(projects.map(p=>p.state).filter(Boolean))).map(s=> <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="filter-control" value={mapFilters.department} onChange={e=>setMapFilters(m=>({...m, department: e.target.value}))}>
                      <option value=''>All departments</option>
                      {Array.from(new Set(projects.map(p=>p.department).filter(Boolean))).map(s=> <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="filter-control" value={mapFilters.status} onChange={e=>setMapFilters(m=>({...m, status: e.target.value}))}>
                      <option value=''>All statuses</option>
                      {Array.from(new Set(projects.map(p=>p.status).filter(Boolean))).map(s=> <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              <ProjectMap projects={projects} mapFilters={mapFilters} />
            </div>
          )}

          <section className="projects-section">
            <h3 className="section-heading">Projects</h3>
            <div className="projects-list">
              {projects.filter(p => {
                if (filters.state && (p.state || '') !== filters.state) return false
                if (filters.department && (p.department || '') !== filters.department) return false
                if (filters.status && (p.status || '') !== filters.status) return false
                if (urlFilter === 'followed') {
                  const f = JSON.parse(getUserScopedItem('followed_projects') || '[]')
                  if (!f.includes(p.id)) return false
                }
                if (urlFilter === 'mycomments') {
                  if (!myCommentProjectIds) return false
                  if (!myCommentProjectIds.has(p.id)) return false
                }
                const avg = (p.avg_rating !== null && p.avg_rating !== undefined) ? Number(p.avg_rating) : 0
                if ((avg || 0) < (filters.minRating || 0)) return false
                // filter by name (substring, case-insensitive)
                if (filters.name && !(String(p.name || '').toLowerCase().includes(filters.name.trim().toLowerCase()))) return false
                return true
              }).map(p => (
                <div key={p.id} className="project-card">
                  <div className="project-info-col">
                    <Link to={`/projects/${p.id}`} className="project-title">{p.name}</Link>

                    <div className="project-meta-row">
                      <span className={`status-badge status-${String(p.status || 'unknown').toLowerCase()}`}>{p.status || 'Unknown'}</span>
                      <span className="project-department">{p.department || ''}</span>
                      <div className="project-rating">
                        {(p.avg_rating !== null && p.avg_rating !== undefined)
                          ? renderStars(Math.round(Number(p.avg_rating)))
                          : <em className="rating-muted">Not rated yet</em>
                        }
                      </div>
                    </div>

                    <div className="budget-section">
                      {
                        (() => {
                          if (p.budget_total) {
                            const percent = Math.round((p.budget_used||0)/p.budget_total*100)
                            return (
                              <>
                                <div className="budget-bar"><div className="budget-fill" style={{ width: `${percent}%` }} /></div>
                                <div className="budget-label">{percent}% budget used</div>
                              </>
                            )
                          }
                          return (
                            <>
                              <div className="project-rating">{p.rating ? <span className="rating-stars">{p.rating} ★</span> : <em className="rating-muted">Not rated yet</em>}</div>
                              <div className="budget-bar"><div className="budget-fill budget-empty" style={{ width: `0%` }} /></div>
                              <div className="budget-label">No budget info</div>
                            </>
                          )
                        })()
                      }
                    </div>
                  </div>

                  <div className="project-actions">
                    {!(user && user.role && (String(user.role).toLowerCase() === 'official' || String(user.role).toLowerCase() === 'admin')) && (
                      <button className="follow-btn" onClick={() => toggleFollow(p.id)} title="Follow project">{followed.has(p.id) ? '★' : '☆'}</button>
                    )}
                    <Link to={`/projects/${p.id}`} className="btn-primary">View →</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
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
