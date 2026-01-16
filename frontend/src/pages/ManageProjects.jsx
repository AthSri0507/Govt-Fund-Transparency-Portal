import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { getToken } from '../utils/auth'
import './ManageProjects.css'

export default function ManageProjects() {
  const [projects, setProjects] = useState([])
  const [err, setErr] = useState(null)
  const [filterName, setFilterName] = useState('')

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setErr(null)
    try {
      const token = getToken()
      const res = await axios.get('/api/projects', { headers: { Authorization: `Bearer ${token}` } })
      setProjects(res.data && res.data.data ? res.data.data : res.data || [])
    } catch (e) {
      setErr(e.response?.data?.message || e.message)
    }
  }

  async function addFund(projectId, amount, purpose, setLocalErr, onDone) {
    try {
      const token = getToken()
      await axios.post(`/api/projects/${projectId}/funds`, { amount: Number(amount), purpose }, { headers: { Authorization: `Bearer ${token}` } })
      if (onDone) onDone()
      await loadProjects()
    } catch (e) {
      setLocalErr(e.response?.data?.message || e.message)
    }
  }

  async function addUpdate(projectId, text, setLocalErr, onDone) {
    try {
      const token = getToken()
      await axios.post(`/api/projects/${projectId}/updates`, { update_text: text }, { headers: { Authorization: `Bearer ${token}` } })
      if (onDone) onDone()
    } catch (e) {
      setLocalErr(e.response?.data?.message || e.message)
    }
  }

  async function changeStatus(projectId, newStatus) {
    const token = getToken()
    await axios.patch(`/api/projects/${projectId}`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } })
  }

  return (
    <div className="manage-container">
      <div className="manage-title">Manage Projects</div>
      {err && <div className="error-text">{err}</div>}

      <div className="manage-grid">
        <div className="left-col">
          <div className="filter-box">
            <h3>Filters</h3>
            <div className="filter-row">
              <input
                className="filter-item"
                placeholder="Filter by project name"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
              />
            </div>
          </div>

          <section className="projects-section">
            <h3 className="section-heading">Your Projects</h3>
            <div className="projects-list">
              {projects
                .filter(p => !filterName || String(p.name || '').toLowerCase().includes(filterName.trim().toLowerCase()))
                .map(p => (
                <div key={p.id} className="project-card">
                  <div className="project-header">
                    <h4 className="project-title">{p.name} <StatusBadge status={p.status} /></h4>
                    <div className="project-actions">
                      {p.status !== 'Disabled' ? (
                        <button className="btn-secondary" onClick={async ()=>{
                          const ok = window.confirm('Disabling a project hides it from citizens. Are you sure you want to disable this project?')
                          if (!ok) return
                          try {
                            const token = getToken()
                            await axios.post(`/api/projects/${p.id}/disable`, {}, { headers: { Authorization: `Bearer ${token}` } })
                            await loadProjects()
                          } catch(e){ alert(e.response?.data?.message || e.message) }
                        }}>Disable</button>
                      ) : (
                        <button className="btn-secondary" onClick={async ()=>{
                          const ok = window.confirm('Restore this project and make it visible to citizens?')
                          if (!ok) return
                          try {
                            const token = getToken()
                            await axios.post(`/api/projects/${p.id}/restore`, {}, { headers: { Authorization: `Bearer ${token}` } })
                            await loadProjects()
                          } catch(e){ alert(e.response?.data?.message || e.message) }
                        }}>Restore</button>
                      )}
                    </div>
                  </div>
                  <div className="project-body">{p.description}</div>
                  <div className="project-meta">Budget total: {p.budget_total} · Used: {p.budget_used}</div>

                  <div className="form-row">
                    <AddFundForm projectId={p.id} onDone={() => loadProjects()} addFund={addFund} />
                  </div>

                  <div className="form-row">
                    <AddUpdateForm projectId={p.id} addUpdate={addUpdate} />
                  </div>

                  <div className="project-links">
                    <Link to={`/projects/${p.id}`} className="btn-primary">View Project</Link>
                    <Link to={`/projects/${p.id}/timeline`} className="link-muted">View Timeline</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="map-container">
          {/* Map is placed here for layout; existing map initialization logic (if any) remains untouched */}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }){
  const s = String(status || 'Unknown')
  let color = '#6b7280', bg = '#f3f4f6'
  if (s === 'Active'){ color = '#065f46'; bg = '#bbf7d0' }
  if (s === 'Halted'){ color = '#92400e'; bg = '#fff4e6' }
  if (s === 'Cancelled' || s === 'Deleted'){ color = '#9b1c1c'; bg = '#ffe6e6' }
  if (s === 'Disabled'){ color = '#374151'; bg = '#f3f4f6' }
  return <span style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 8, background: bg, color, fontSize: 12 }}>{s}</span>
}

function AddFundForm({ projectId, addFund, onDone }) {
  const [amount, setAmount] = useState(0)
  const [purpose, setPurpose] = useState('')
  const [localErr, setLocalErr] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      setLocalErr(null);
      const num = Number(amount)
      if (!num || num <= 0) return setLocalErr('Amount must be positive')
      try {
        setSubmitting(true)
        await addFund(projectId, num, purpose, setLocalErr, () => { setAmount(0); setPurpose(''); if (onDone) onDone(); })
      } finally {
        setSubmitting(false)
      }
    }}>
        <div className="form-inline">
          <input className="input-small" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="amount" />
          <input className="input-flex" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="purpose" />
          <button className="btn-primary" type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Fund'}</button>
        </div>
      {localErr && <div style={{ color: 'red' }}>{localErr}</div>}
    </form>
  )
}

function AddUpdateForm({ projectId, addUpdate }) {
  const [text, setText] = useState('')
  const [localErr, setLocalErr] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      setLocalErr(null);
      if (!text.trim()) return setLocalErr('Update text required')
      try {
        setSubmitting(true)
        await addUpdate(projectId, text, setLocalErr, () => setText(''))
      } finally {
        setSubmitting(false)
      }
    }}>
      <div className="form-inline">
        <input className="input-flex" value={text} onChange={e => setText(e.target.value)} placeholder="Timeline update (optional status)" />
        <button className="btn-primary" type="submit" disabled={submitting}>{submitting ? 'Posting...' : 'Post Update'}</button>
      </div>
      {localErr && <div style={{ color: 'red' }}>{localErr}</div>}
    </form>
  )
}
