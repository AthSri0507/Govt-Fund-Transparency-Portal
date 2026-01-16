import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { getToken } from '../utils/auth'
import './DashboardOfficial.css'

export default function DashboardOfficial() {
  const [projects, setProjects] = useState([])
  const [err, setErr] = useState(null)

  // create project form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState(10000)
  const [stateName, setStateName] = useState('')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [department, setDepartment] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)

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

  async function createProject(e) {
    e.preventDefault()
    setErr(null)
    if (!name.trim()) return setErr('Name required')
    if (!stateName) return setErr('State required')
    if (!city) return setErr('City required')
    if (!department) return setErr('Department required')
    try {
      setCreateSubmitting(true)
      const token = getToken()
      const payload = { name, description, budget_total: Number(budget), state: stateName, city, area, department }
      if (latitude) payload.latitude = Number(latitude)
      if (longitude) payload.longitude = Number(longitude)
      const res = await axios.post('/api/projects', payload, { headers: { Authorization: `Bearer ${token}` } })
      setName('')
      setDescription('')
      setBudget(10000)
      setStateName('')
      setCity('')
      setArea('')
      setDepartment('')
      setLatitude('')
      setLongitude('')
      await loadProjects()
    } catch (e) {
      setErr(e.response?.data?.message || e.message)
    } finally {
      setCreateSubmitting(false)
    }
  }

  // per-project actions: add fund, add update, view timeline
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

  return (
    <div className="do-page">
      <div className="do-tricolor" />
      <div className="do-container">
        <main className="do-main">
          <header className="do-welcome">
            <h1 className="do-title">Welcome, atharva</h1>
            {err && <div className="do-error">{err}</div>}
            <div className="do-welcome-sub">What would you like to do?</div>
            <div className="do-actions">
              <button className="do-action-btn">Create New Project</button>
              <button className="do-action-btn">Manage Existing Projects</button>
              <Link to="/citizen/projects"><button className="do-action-btn">Browse Projects</button></Link>
            </div>
          </header>

          <section className="do-card do-create" aria-labelledby="create-project">
            <h2 id="create-project" className="do-card-title">Create Project</h2>
            <form onSubmit={createProject} className="do-form">
              <div className="do-form-row"><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} required /></div>
              <div className="do-form-row"><label>Description</label><input value={description} onChange={e=>setDescription(e.target.value)} /></div>
              <div className="do-form-row"><label>Budget total</label><input type="number" value={budget} onChange={e=>setBudget(e.target.value)} /></div>
              <div className="do-form-row"><label>State</label><select value={stateName} onChange={e=>setStateName(e.target.value)} required>
                <option value="">Select state</option>
                <option>Karnataka</option>
                <option>Maharashtra</option>
                <option>Tamil Nadu</option>
                <option>Delhi</option>
                <option>West Bengal</option>
              </select></div>
              <div className="do-form-row"><label>City</label><input value={city} onChange={e=>setCity(e.target.value)} required placeholder="e.g. Bengaluru" /></div>
              <div className="do-form-row"><label>Area / Locality (optional)</label><input value={area} onChange={e=>setArea(e.target.value)} placeholder="e.g. Rajarajeshwari Nagar" /></div>
              <div className="do-form-row"><label>Department</label><select value={department} onChange={e=>setDepartment(e.target.value)} required>
                <option value="">Select department</option>
                <option>Public Works</option>
                <option>Health</option>
                <option>Education</option>
                <option>Transport</option>
                <option>Urban Development</option>
              </select></div>
              <div className="do-form-row do-row-flex">
                <div><label>Latitude (optional)</label><input value={latitude} onChange={e=>setLatitude(e.target.value)} placeholder="e.g. 12.9121" /></div>
                <div><label>Longitude (optional)</label><input value={longitude} onChange={e=>setLongitude(e.target.value)} placeholder="e.g. 77.5195" /></div>
              </div>
              <div className="do-form-row"><button type="submit" className="do-submit">Create Project</button></div>
            </form>
          </section>

          <section className="do-card do-projects" aria-labelledby="your-projects">
            <h2 id="your-projects" className="do-card-title">Your Projects</h2>
            <div className="do-project-list">
              {projects.map(p => (
                <div key={p.id} className="do-project-item">
                  <div className="do-project-left">
                    <div className="do-project-name">{p.name}</div>
                    <div className="do-project-desc">{p.description}</div>
                    <div className="do-project-budget">Budget total: {p.budget_total} · Used: {p.budget_used}</div>
                    <div className="do-project-forms">
                      <AddFundForm projectId={p.id} onDone={()=>loadProjects()} addFund={addFund} />
                      <AddUpdateForm projectId={p.id} addUpdate={addUpdate} />
                    </div>
                  </div>
                  <div className="do-project-right">
                    <div className="do-links">
                      <Link to={`/projects/${p.id}`} className="do-link">View Project</Link>
                      <Link to={`/projects/${p.id}/timeline`} className="do-link">View Timeline</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="do-sidebar">
          <div className="do-quick">
            <h3 className="do-quick-title">Quick Actions</h3>
            <div className="do-quick-body">
              <button className="do-quick-btn">Create New Project</button>
              <button className="do-quick-btn">Manage Projects</button>
              <Link to="/citizen/projects"><button className="do-quick-btn">Browse Projects</button></Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function AddFundForm({ projectId, addFund, onDone }) {
  const [amount, setAmount] = useState(0)
  const [purpose, setPurpose] = useState('')
  const [localErr, setLocalErr] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  return (
    <form onSubmit={async (e)=>{ 
      e.preventDefault(); 
      setLocalErr(null); 
      const num = Number(amount)
      if (!num || num <= 0) return setLocalErr('Amount must be positive')
      try {
        setSubmitting(true)
        await addFund(projectId, num, purpose, setLocalErr, ()=>{ setAmount(0); setPurpose(''); if(onDone) onDone(); })
      } finally {
        setSubmitting(false)
      }
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="amount" />
        <input value={purpose} onChange={e=>setPurpose(e.target.value)} placeholder="purpose" />
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
    <form onSubmit={async (e)=>{ 
      e.preventDefault(); 
      setLocalErr(null); 
      if (!text.trim()) return setLocalErr('Update text required')
      try {
        setSubmitting(true)
        await addUpdate(projectId, text, setLocalErr, ()=>setText(''))
      } finally {
        setSubmitting(false)
      }
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input style={{ flex: 1 }} value={text} onChange={e=>setText(e.target.value)} placeholder="Timeline update (optional status)" />
        <button type="submit" disabled={submitting}>{submitting ? 'Posting...' : 'Post Update'}</button>
      </div>
      {localErr && <div style={{ color: 'red' }}>{localErr}</div>}
    </form>
  )
}
