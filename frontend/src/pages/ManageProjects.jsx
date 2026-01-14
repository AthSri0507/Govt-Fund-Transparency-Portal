import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { getToken } from '../utils/auth'

export default function ManageProjects() {
  const [projects, setProjects] = useState([])
  const [err, setErr] = useState(null)

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
      await axios.post(`/api/projects/${projectId}/updates`, { text }, { headers: { Authorization: `Bearer ${token}` } })
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
    <div>
      <h2>Manage Projects</h2>
      {err && <div style={{ color: 'red' }}>{err}</div>}

      <section>
        <h3>Your Projects</h3>
        <div>
          {projects.map(p => (
            <div key={p.id} style={{ border: '1px solid #ddd', padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0 }}>{p.name} <StatusBadge status={p.status} /></h4>
                <div>
                  {p.status !== 'Disabled' ? (
                      <button onClick={async ()=>{
                        const ok = window.confirm('Disabling a project hides it from citizens. Are you sure you want to disable this project?')
                        if (!ok) return
                        try {
                          const token = getToken()
                          await axios.post(`/api/projects/${p.id}/disable`, {}, { headers: { Authorization: `Bearer ${token}` } })
                          await loadProjects()
                        } catch(e){ alert(e.response?.data?.message || e.message) }
                      }}>Disable</button>
                    ) : (
                      <button onClick={async ()=>{
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
              <div>{p.description}</div>
              <div>Budget total: {p.budget_total} · Used: {p.budget_used}</div>
              <div style={{ marginTop: 8 }}>
                <AddFundForm projectId={p.id} onDone={() => loadProjects()} addFund={addFund} />
              </div>
              <div style={{ marginTop: 8 }}>
                <AddUpdateForm projectId={p.id} addUpdate={addUpdate} />
              </div>
              <div style={{ marginTop: 8 }}>
                <Link to={`/projects/${p.id}`}>View Project</Link>
                <Link to={`/projects/${p.id}/timeline`} style={{ marginLeft: 12 }}>View Timeline</Link>
              </div>
            </div>
          ))}
        </div>
      </section>
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
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="amount" />
        <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="purpose" />
        <button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Fund'}</button>
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
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input style={{ flex: 1 }} value={text} onChange={e => setText(e.target.value)} placeholder="Timeline update (optional status)" />
        <button type="submit" disabled={submitting}>{submitting ? 'Posting...' : 'Post Update'}</button>
      </div>
      {localErr && <div style={{ color: 'red' }}>{localErr}</div>}
    </form>
  )
}
