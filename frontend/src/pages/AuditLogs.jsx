import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getToken } from '../utils/auth'

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ entity_type: '', entity_id: '', actor_id: '' })
  const [includeRelated, setIncludeRelated] = useState(true)
  const [err, setErr] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(()=>{
    // If URL contains query params, apply them as filters and load accordingly
    const qs = new URLSearchParams(location.search)
    const entity_type = qs.get('entity_type') || ''
    const entity_id_q = qs.get('entity_id') || ''
    const project_id_q = qs.get('project_id') || ''
    const actor_id = qs.get('actor_id') || ''
    const include_related_q = qs.get('include_related')
    const limit = qs.get('limit') ? Number(qs.get('limit')) : undefined
    const offset = qs.get('offset') ? Number(qs.get('offset')) : undefined
    const params = {}
    if (entity_type) params.entity_type = entity_type
    // prefer explicit project_id param (search by reference inside details), otherwise use entity_id
    if (project_id_q) params.project_id = project_id_q
    else if (entity_id_q) params.entity_id = entity_id_q
    if (actor_id) params.actor_id = actor_id
    if (limit) params.limit = limit
    if (offset) params.offset = offset
    const incl = include_related_q === null ? true : (include_related_q === 'true')
    setIncludeRelated(incl)
    if (Object.keys(params).length) {
      setFilters(f=>({ ...f, entity_type: params.entity_type || '', entity_id: params.project_id || params.entity_id || '', actor_id: params.actor_id || '' }))
      if (incl && (params.project_id || params.entity_id)) {
        load({ project_id: params.project_id || params.entity_id, limit: params.limit, offset: params.offset, actor_id: params.actor_id })
      } else {
        load(params)
      }
    } else {
      load()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  function renderSummary(log) {
    // try to create a human-friendly one-line summary from details
    try {
      const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details || {};
      if (String(log.entity_type).toLowerCase().includes('fund') || (d && d.amount && d.project_id)) {
        const amt = d.amount || d.amount === 0 ? d.amount : null;
        const pid = d.project_id || d.project || log.entity_id;
        const purpose = d.purpose || d.reason || '';
        return `Fund transaction of ₹${amt} for project #${pid}${purpose ? ` — Purpose: ${purpose}` : ''}`;
      }
      if (String(log.entity_type).toLowerCase() === 'user' || String(log.action).toLowerCase().includes('role') || (d && d.role)) {
        if (d && d.role) return `User ${d.user_id || log.entity_id} role changed to ${d.role}`;
      }
      if (String(log.entity_type).toLowerCase() === 'project' && log.action === 'status_change') {
        const oldS = d && d.old_status; const newS = d && d.new_status;
        return `Project #${log.entity_id} status: ${oldS || 'unknown'} → ${newS || 'unknown'}`;
      }
      // fallback
      if (d && Object.keys(d).length) return Object.entries(d).map(([k,v])=>`${k}: ${v}`).join(', ');
    } catch (e) {
      // ignore parse errors
    }
    return typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {})
  }

  async function load(params = {}){
    setErr(null)
    setLoading(true)
    try{
      const token = getToken()
      // merge filters + explicit params; when including related activity for projects,
      // prefer asking backend with `project_id` so entries referencing project in details are matched.
      const merged = { ...filters, ...params }
      if (includeRelated && String(merged.entity_type).toLowerCase() === 'project' && merged.entity_id && !merged.project_id) {
        merged.project_id = merged.entity_id
        delete merged.entity_id
      }
      const qs = new URLSearchParams(merged)
      // ensure we request newest -> oldest via server (server orders by created_at DESC)
      const res = await axios.get(`/api/admin/audit-logs?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      const rows = res.data?.data || []
      // resolve actor names and project names for clarity
      const userRes = await axios.get('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      const users = userRes.data?.data || []
      const userMap = Object.fromEntries(users.map(u => [String(u.id), u.name]))
      // gather unique project ids from both direct project entity rows and from details.project_id
      const projIdsSet = new Set()
      const parsedDetails = {}
      rows.forEach(r=>{
        // direct project entity
        try{
          if (String(r.entity_type).toLowerCase() === 'project' && r.entity_id) projIdsSet.add(String(r.entity_id))
        }catch(e){}
        // try parse details and pick up any project_id inside
        try{
          const d = typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {});
          parsedDetails[r.id] = d
          if (d && (d.project_id || d.project)) projIdsSet.add(String(d.project_id || d.project))
        }catch(e){ parsedDetails[r.id] = null }
      })
      const projIds = Array.from(projIdsSet)
      const projMap = {}
      await Promise.all(projIds.map(async id=>{
        try{
          const pr = await axios.get(`/api/projects/${id}`, { headers: { Authorization: `Bearer ${token}` } })
          projMap[String(id)] = pr.data && pr.data.data ? pr.data.data.name : null
        }catch(e){ projMap[String(id)] = null }
      }))
      const enriched = rows.map(r => {
        const d = parsedDetails[r.id]
        const projectRef = (d && (d.project_id || d.project)) ? (d.project_id || d.project) : (String(r.entity_type).toLowerCase() === 'project' ? r.entity_id : null)
        return {
          ...r,
          actor_name: userMap[String(r.actor_id)] || null,
          entity_name: projectRef ? projMap[String(projectRef)] || String(projectRef) : projMap[String(r.entity_id)] || null,
          _project_ref: projectRef || null
        }
      })
      setLogs(enriched)
    }catch(e){ setErr(e.response?.data?.message || e.message) }
    finally{ setLoading(false) }
  }

  const [limit, setLimit] = useState(20)
  const [offset, setOffset] = useState(0)

  return (
    <div>
      <h2>Audit Logs</h2>
      <div style={{ marginBottom: 8 }}>
        <label style={{ marginRight: 8 }}>Entity Type: <input value={filters.entity_type} onChange={(e)=>setFilters(f=>({...f, entity_type: e.target.value}))} /></label>
        <label style={{ marginRight: 8 }}>Entity ID: <input value={filters.entity_id} onChange={(e)=>setFilters(f=>({...f, entity_id: e.target.value}))} /></label>
        <label style={{ marginRight: 8 }}>Actor ID: <input value={filters.actor_id} onChange={(e)=>setFilters(f=>({...f, actor_id: e.target.value}))} /></label>
        <label style={{ marginLeft: 8 }}>
          <input type="checkbox" checked={includeRelated} onChange={e=>setIncludeRelated(Boolean(e.target.checked))} /> Include related activity
        </label>
        <button onClick={()=>{ const p = {}; if (filters.entity_type) p.entity_type = filters.entity_type; if (filters.entity_id) { if (includeRelated && filters.entity_type === 'project') p.project_id = filters.entity_id; else p.entity_id = filters.entity_id } if (filters.actor_id) p.actor_id = filters.actor_id; if (!includeRelated) p.include_related = 'false'; load(p) }}>Filter</button>
      </div>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
        <button onClick={()=>{ setFilters(f=>({...f, entity_type: 'fund_transaction'})); load({ entity_type: 'fund_transaction' }) }}>Only fund transactions</button>
        <button onClick={()=>{ setFilters(f=>({...f, entity_type: 'project'})); load({ entity_type: 'project' }) }}>Only project actions</button>
        <button onClick={()=>{ setFilters(f=>({...f, entity_type: 'user'})); load({ entity_type: 'user' }) }}>Only user actions</button>
        <button onClick={()=>{ setFilters({ entity_type: '', actor_id: '' }); load({}); }}>Clear filters</button>
      </div>
      {err && <div style={{ color: 'red' }}>{err}</div>}
      <div style={{ marginBottom: 8 }}>
        <label style={{ marginRight: 8 }}>Search: <input onChange={(e)=>{ const q=e.target.value.toLowerCase(); setLogs(l=> l.filter(x=> (String(x.entity_name||'').toLowerCase().includes(q) || String(x.actor_name||'').toLowerCase().includes(q) || String(x.action||'').toLowerCase().includes(q)))) }} /></label>
        <label style={{ marginLeft: 12 }}>Per page: <select value={limit} onChange={(e)=>{ setLimit(Number(e.target.value)); setOffset(0); load({ limit: Number(e.target.value), offset: 0 }) }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
        <button style={{ marginLeft: 12 }} onClick={()=>{ const no = Math.max(0, offset - limit); setOffset(no); load({ limit, offset: no }) }}>Prev</button>
        <button style={{ marginLeft: 6 }} onClick={()=>{ const no = offset + limit; setOffset(no); load({ limit, offset: no }) }}>Next</button>
      </div>
      {loading ? <div>Loading...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th>ID</th><th>Entity</th><th>Entity</th><th>Action</th><th>Actor</th><th>Details</th><th>When</th></tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: 8, verticalAlign: 'top' }}>{l.id}</td>
                <td style={{ padding: 8, verticalAlign: 'top' }}>{l.entity_type}</td>
                <td style={{ padding: 8, verticalAlign: 'top' }}>{l.entity_name || l.entity_id}{String(l.entity_type).toLowerCase() === 'project' && l.entity_id ? (<span> <a href={`/projects/${l.entity_id}`}>(open)</a></span>) : null}</td>
                <td style={{ padding: 8, verticalAlign: 'top' }}>{l.action}</td>
                <td style={{ padding: 8, verticalAlign: 'top' }}>{l.actor_name || l.actor_id} {l.actor_id ? <a href={`/admin/audit-logs?actor_id=${l.actor_id}`}>(actions)</a> : null}</td>
                <td style={{ padding: 8, maxWidth: 400 }}>
                  <div style={{ fontSize: 13, color: '#111' }}>{renderSummary(l)}</div>
                  <details style={{ marginTop: 6 }}><summary>Raw</summary><pre style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(l, null, 2)}</pre></details>
                </td>
                <td style={{ padding: 8, verticalAlign: 'top' }}>{l.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
