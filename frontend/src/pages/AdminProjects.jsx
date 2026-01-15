import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { getToken } from '../utils/auth'
import { Link } from 'react-router-dom'
import ProjectMap from '../components/ProjectMap'

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
    <div>
      <h2>Admin — Project Control</h2>
      <p style={{ marginTop: 6, marginBottom: 12 }}>Manage projects: control lifecycle, view risk, and take action.</p>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <label>Status: <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value=''>All</option><option>Active</option><option>Halted</option><option>Cancelled</option><option>Disabled</option></select></label>
        <label>Department: <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)}><option value=''>All</option>{departments.map(d => <option key={d}>{d}</option>)}</select></label>
        <label>Budget risk: <select value={riskFilter} onChange={e=>setRiskFilter(e.target.value)}><option value=''>All</option><option value='80'>&gt; 80% used</option><option value='100'>&gt; 100% (overrun)</option></select></label>
        <label style={{ marginLeft: 12 }}><input type='checkbox' checked={showMap} onChange={e=>setShowMap(e.target.checked)} /> Show Map</label>
        <button onClick={load}>Refresh</button>
      </div>

      {err && <div style={{ color: 'red' }}>{err}</div>}
      {loading ? <div>Loading...</div> : (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                  <th style={{ padding: 8 }}>ID</th>
                  <th style={{ padding: 8 }}>Name</th>
                  <th style={{ padding: 8 }}>Department</th>
                  <th style={{ padding: 8 }}>Status</th>
                  <th style={{ padding: 8 }}>Used %</th>
                  <th style={{ padding: 8 }}>Budget</th>
                  <th style={{ padding: 8 }}>Last Updated</th>
                  <th style={{ padding: 8 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {combined.map(p => ({...p, _pct: calcUsedPercent(p)})).filter(p => {
                  if (statusFilter && String(p.status || '').toLowerCase() !== String(statusFilter).toLowerCase()) return false
                  if (deptFilter && String(p.department || '').toLowerCase() !== String(deptFilter).toLowerCase()) return false
                  if (riskFilter){ if (riskFilter === '80' && p._pct <= 80) return false; if (riskFilter === '100' && p._pct <= 100) return false }
                  return true
                }).map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>{p.id}</td>
                    <td style={{ padding: 8 }}><Link to={`/projects/${p.id}`}>{p.name}</Link></td>
                    <td style={{ padding: 8 }}>{p.department}</td>
                    <td style={{ padding: 8 }}><span style={{ padding: '4px 8px', borderRadius: 8, ...statusStyle(p.status) }}>{p.status}</span>{p._deleted ? <span style={{ marginLeft: 8, fontSize: 12, color:'#9b1c1c' }}>Deleted</span> : null}</td>
                    <td style={{ padding: 8 }}>{p._pct}%</td>
                    <td style={{ padding: 8 }}>₹{p.budget_total || 0}</td>
                    <td style={{ padding: 8 }}>{p.updated_at || p.created_at}</td>
                    <td style={{ padding: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Link to={`/projects/${p.id}`}>View</Link>
                        {!p._deleted ? <button onClick={()=>doDisable(p.id)}>Disable</button> : <button onClick={()=>doRestore(p.id)}>Restore</button>}
                        <button onClick={()=>toggleFlag(p.id, !!p.is_flagged)} style={{ color: p.is_flagged ? '#9b1c1c' : undefined }}>{p.is_flagged ? 'Unflag' : 'Flag'}</button>
                        <Link to={`/admin/audit-logs?entity_type=project&entity_id=${p.id}&include_related=true`}>Audit</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showMap ? (
            <div style={{ width: 500 }}>
              <ProjectMap projects={combined} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
