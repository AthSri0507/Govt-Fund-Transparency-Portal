import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getToken, getUser, getUserScopedItem } from '../utils/auth'
import './DashboardCitizen.css'

export default function DashboardCitizen(){
  const user = getUser()
  const [followedProjects, setFollowedProjects] = useState([])
  const [recent, setRecent] = useState([])
  const navigate = useNavigate()

  const fmtDate = (v) => {
    if (!v) return ''
    try{ const d = new Date(v); return d.toLocaleString() }catch(e){ return '' }
  }
  useEffect(()=>{
    // load followed ids from localStorage and fetch their details
    try{
      const ids = JSON.parse(getUserScopedItem('followed_projects') || '[]')
      if (ids && ids.length){
        const token = getToken()
        Promise.all(ids.map(id => axios.get(`/api/projects/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data.data).catch(()=>null)))
          .then(rows => setFollowedProjects(rows.filter(Boolean)))
      }
    }catch(e){}
    try{
      const rec = JSON.parse(getUserScopedItem('recent_projects') || '[]')
      setRecent(rec)

      // If recent items lack status metadata, attempt to fetch it from the API
      const idsToFetch = (rec || [])
        .filter(r => !(r.status || r.project_status || r.state || r.status_label))
        .slice(0, 10)
        .map(r => r.id)

      if (idsToFetch.length){
        const token = getToken()
        Promise.all(idsToFetch.map(id =>
          axios.get(`/api/projects/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
            .then(r => r.data && r.data.data)
            .catch(() => null)
        )).then(rows => {
          const byId = {}
          rows.filter(Boolean).forEach(p => { if (p && p.id) byId[p.id] = p })
          setRecent(prev => {
            if (!prev) return prev
            return prev.map(item => {
              const p = byId[item.id]
              if (!p) return item
              return { ...item, status: p.status || p.state || p.status_label }
            })
          })
        })
      }
    }catch(e){}
  }, [])

  return (
    <div className="citizen-dashboard">
      <div className="welcome-card gov-accent">
        <h2>Citizen Dashboard</h2>
        <p className="welcome-sub">Welcome, {user?.name || user?.email || 'Citizen'}</p>
        <p>Track government projects, see how funds are being used, and share your feedback.</p>
        <ul>
          <li>Browse projects by location, department, and status</li>
          <li>View budgets, timelines, and maps</li>
          <li>Post comments and ratings to reflect public opinion</li>
        </ul>
      </div>

      <div className="quick-actions">
        <div className="action-card" onClick={()=>navigate('/citizen/projects')}>
          <div className="action-left">
            <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div className="action-label">Browse Government Projects</div>
          </div>
          <div className="action-right">→</div>
        </div>

        <div className="action-card" onClick={()=>navigate('/citizen/projects?filter=followed')}>
          <div className="action-left">
            <svg className="icon accent" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 17.3L5.6 20l1.1-6.4L2 9.6l6.5-.9L12 3l3.5 5.7 6.5.9-4.7 3.9L18.4 20z" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div className="action-label">View Followed Projects</div>
          </div>
          <div className="action-right">→</div>
        </div>

        <div className="action-card" onClick={()=>navigate('/citizen/comments')}>
          <div className="action-left">
            <svg className="icon green" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a1 1 0 0 1-1 1H6l-4 4V6a1 1 0 0 1 1-1h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div className="action-label">Review My Comments</div>
          </div>
          <div className="action-right">→</div>
        </div>
      </div>

      <div className="section-divider" />

      <div className="followed-section">
        <h3 className="section-title">⭐ Followed Government Projects</h3>
        {(!followedProjects || followedProjects.length === 0) ? (
          <div className="empty-state">You have not followed any government projects yet. Start by browsing active projects in your region.</div>
        ) : (
          <div className="project-grid">
            {followedProjects.map(p => (
              <div key={p.id} className="project-card">
                <div>
                  <div className="name">{p.name}</div>
                  <div className="meta">{p.status || 'Unknown'} · {p.department || ''}</div>
                  <div style={{ marginTop: 6 }}>Budget used: {p.budget_total ? `${Math.round((p.budget_used||0)/p.budget_total*100)}%` : '—'}</div>
                </div>
                <div className="controls">
                  <Link to={`/projects/${p.id}`}><button>View</button></Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="recent-section">
        <h3 className="section-title">Recently Viewed Projects</h3>
        {(!recent || recent.length === 0) ? (
          <div className="empty-state">You have not viewed any projects recently. Start by browsing projects.</div>
        ) : (
          <div className="recent-list">
            {recent.map(r => {
              const last = r.last_accessed || r.lastViewed || r.viewedAt || r.accessedAt || r.ts || r.lastSeen
              const status = r.status || r.project_status || r.state || r.statusText || r.status_label
              return (
                <Link to={`/projects/${r.id}`} key={r.id} className="recent-item">
                  <span className="recent-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 8v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <div className="recent-main">
                    <div className="recent-name">{r.name}</div>
                    {status ? (
                      <div className="recent-meta">Status: {status}</div>
                    ) : last ? (
                      <div className="recent-meta">Last accessed: {fmtDate(last)}</div>
                    ) : null}
                  </div>
                  <span className="recent-arrow">→</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <footer className="dashboard-footer">© Government Fund Transparency Portal | An Initiative for Public Accountability</footer>
    </div>
  )
}
