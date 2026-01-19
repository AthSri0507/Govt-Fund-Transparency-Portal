import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { getToken } from '../utils/auth'
import { Link } from 'react-router-dom'
import ProjectMap from '../components/ProjectMap'
import './AdminProjects.css'

export default function AdminProjects(){
  const [items, setItems] = useState([])
  const [deletedItems, setDeletedItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [showMap, setShowMap] = useState(false)

  useEffect(()=>{ load() }, [])

  async function load(){
    setErr(null)
    setLoading(true)
    try{
      const token = getToken()
      const [allRes, delRes] = await Promise.all([
        axios.get('/api/projects', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/admin/projects/deleted', { headers: { Authorization: `Bearer ${token}` } }).catch(()=>({ data: { data: [] } }))
      ])
      setItems(allRes.data?.data || [])
      setDeletedItems(delRes.data?.data || [])
    }catch(e){ setErr(e.response?.data?.message || e.message) }
    finally{ setLoading(false) }
  }

  function calcUsedPercent(p){
    try{
      const total = Number(p.budget_total || 0)
      const used = Number(p.budget_used || 0)
      if (!total) return 0
      return Math.round((used / total) * 100)
    }catch(e){ return 0 }
  }

  function statusStyle(s){
    const st = String(s || '').toLowerCase()
    if (st === 'active') return { color:'#065f46', background:'#bbf7d0' }
    if (st === 'halted') return { color:'#92400e', background:'#fff4e6' }
    if (st === 'cancelled' || st === 'cancel') return { color:'#9b1c1c', background:'#ffe6e6' }
    if (st === 'disabled') return { color:'#374151', background:'#f3f4f6' }
    return { color:'#374151', background:'#f3f4f6' }
  }

  async function doDisable(id){
    if (!window.confirm('Disabling a project hides it from citizens. Continue?')) return
    try{ const token = getToken(); await axios.post(`/api/projects/${id}/disable`, {}, { headers: { Authorization: `Bearer ${token}` } }); await load() }catch(e){ alert(e.response?.data?.message || e.message) }
  }

  async function doRestore(id){
    if (!window.confirm('Restore this project and make it visible to citizens?')) return
    try{ const token = getToken(); await axios.post(`/api/projects/${id}/restore`, {}, { headers: { Authorization: `Bearer ${token}` } }); await load() }catch(e){ alert(e.response?.data?.message || e.message) }
  }

  async function toggleFlag(id, current){
    try{
      const token = getToken();
      await axios.patch(`/api/admin/projects/${id}/flag`, { flagged: !current }, { headers: { Authorization: `Bearer ${token}` } });
      await load()
    }catch(e){ alert(e.response?.data?.message || e.message) }
  }

  const combined = [...items, ...deletedItems]
    .map(p=>({ ...p, _deleted: !!p.is_deleted }))
    .filter(p => {
      if (statusFilter){ if (String(p.status || '').toLowerCase() !== String(statusFilter).toLowerCase()) return false }
      if (deptFilter){ if (String(p.department || '').toLowerCase() !== String(deptFilter).toLowerCase()) return false }
      if (riskFilter){ const pct = calcUsedPercent(p); if (riskFilter === '80' && pct <= 80) return false; if (riskFilter === '100' && pct <= 100) return false }
      return true
    })

  // derive unique departments for filter
  const departments = Array.from(new Set(combined.map(p => p.department || '').filter(Boolean)))

  return (
    <main className="ap-container">
      <header className="ap-header">
        <h1 className="ap-title">Admin — Project Control</h1>
        <p className="ap-subtitle">Manage and monitor all government registered projects.</p>
      </header>

      <div className="ap-filters" style={{ marginBottom: 12 }}>
        <label>Status: <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value=''>All</option><option>Active</option><option>Halted</option><option>Cancelled</option><option>Disabled</option></select></label>
        <label>Department: <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)}><option value=''>All</option>{departments.map(d => <option key={d}>{d}</option>)}</select></label>
        <label>Budget risk: <select value={riskFilter} onChange={e=>setRiskFilter(e.target.value)}><option value=''>All</option><option value='80'>&gt; 80% used</option><option value='100'>&gt; 100% (overrun)</option></select></label>
        <label style={{ marginLeft: 12 }}><input type='checkbox' checked={showMap} onChange={e=>setShowMap(e.target.checked)} /> Show Map</label>
        <button onClick={load}>Refresh</button>
      </div>

      {err && <div className="ap-error">{err}</div>}

      {loading ? <div className="ap-loading">Loading...</div> : (
        <div className="ap-content">
          <div className="ap-list">
            {combined.map(p => ({ ...p, _pct: calcUsedPercent(p) })).filter(p => {
              if (statusFilter && String(p.status || '').toLowerCase() !== String(statusFilter).toLowerCase()) return false
              if (deptFilter && String(p.department || '').toLowerCase() !== String(deptFilter).toLowerCase()) return false
              if (riskFilter){ const pct = calcUsedPercent(p); if (riskFilter === '80' && pct <= 80) return false; if (riskFilter === '100' && pct <= 100) return false }
              return true
            }).map(p => (
              <article className="ap-card" key={p.id}>
                <div className="ap-card-top">
                  <div className="ap-card-title">
                    <Link to={`/projects/${p.id}`} className="ap-link">{p.name}</Link>
                    <div className="ap-dept">{p.department}</div>
                  </div>
                  <div className="ap-status">
                    <span className="ap-badge" style={statusStyle(p.status)}>{p.status}</span>
                    {p._deleted ? <span className="ap-deleted">Deleted</span> : null}
                  </div>
                </div>

                <div className="ap-card-mid">
                  <p className="ap-desc">{p.description || ''}</p>
                  <div className="ap-budget">Total: ₹{p.budget_total || 0} • Used: ₹{p.budget_used || 0} ({calcUsedPercent(p)}%)</div>
                </div>

                <div className="ap-card-bottom">
                  <div className="ap-updated">{p.updated_at || p.created_at}</div>
                  <div className="ap-actions">
                    <Link to={`/dashboard/official/projects/${p.id}/view`} className="ap-btn ap-btn-primary">View</Link>
                    {!p._deleted ? (
                      <button className="ap-btn ap-btn-danger-outline" onClick={()=>doDisable(p.id)}>Disable</button>
                    ) : (
                      <button className="ap-btn ap-btn-secondary" onClick={()=>doRestore(p.id)}>Restore</button>
                    )}
                    <button className="ap-btn ap-btn-outline" onClick={()=>toggleFlag(p.id, !!p.is_flagged)}>{p.is_flagged ? 'Unflag' : 'Flag'}</button>
                    <Link to={`/projects/${p.id}/timeline`} className="ap-link-small">Timeline</Link>
                  </div>
                </div>
              </article>
            ))}

            {combined.filter(p => {
              if (statusFilter && String(p.status || '').toLowerCase() !== String(statusFilter).toLowerCase()) return false
              if (deptFilter && String(p.department || '').toLowerCase() !== String(deptFilter).toLowerCase()) return false
              if (riskFilter){ const pct = calcUsedPercent(p); if (riskFilter === '80' && pct <= 80) return false; if (riskFilter === '100' && pct <= 100) return false }
              return true
            }).length === 0 && (
              <div className="ap-empty">No registered projects found.</div>
            )}
          </div>

          {showMap ? (
            <aside className="ap-map">
              <ProjectMap projects={combined} />
            </aside>
          ) : null}
        </div>
      )}
    </main>
  )
}
