import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { getToken } from '../utils/auth'

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
    <div>
      <h2>Official Dashboard</h2>
      {err && <div style={{ color: 'red' }}>{err}</div>}

      <section style={{ marginBottom: 24 }}>
        <h3>Create Project</h3>
        <form onSubmit={createProject}>
          <div>
            <label>Name</label><br />
            <input value={name} onChange={e=>setName(e.target.value)} required />
          </div>
          <div>
            <label>Description</label><br />
            <input value={description} onChange={e=>setDescription(e.target.value)} />
          </div>
          <div>
            <label>Budget total</label><br />
            <input type="number" value={budget} onChange={e=>setBudget(e.target.value)} />
          </div>
          <div>
            <label>State</label><br />
            <select value={stateName} onChange={e=>setStateName(e.target.value)} required>
              <option value="">Select state</option>
              <option>Karnataka</option>
              <option>Maharashtra</option>
              <option>Tamil Nadu</option>
              <option>Delhi</option>
              <option>West Bengal</option>
            </select>
          </div>
          <div>
            <label>City</label><br />
            <input value={city} onChange={e=>setCity(e.target.value)} required placeholder="e.g. Bengaluru" />
          </div>
          <div>
            <label>Area / Locality (optional)</label><br />
            <input value={area} onChange={e=>setArea(e.target.value)} placeholder="e.g. Rajarajeshwari Nagar" />
          </div>
          <div>
            <label>Department</label><br />
            <select value={department} onChange={e=>setDepartment(e.target.value)} required>
              <option value="">Select department</option>
              <option>Public Works</option>
              <option>Health</option>
              <option>Education</option>
              <option>Transport</option>
              <option>Urban Development</option>
            </select>
          </div>
          <div>
            <label>Latitude (optional)</label><br />
            <input value={latitude} onChange={e=>setLatitude(e.target.value)} placeholder="e.g. 12.9121" />
          </div>
          <div>
            <label>Longitude (optional)</label><br />
            <input value={longitude} onChange={e=>setLongitude(e.target.value)} placeholder="e.g. 77.5195" />
          </div>
          <div>
            <button type="submit">Create Project</button>
          </div>
        </form>
      </section>

      <section>
        <h3>Your Projects</h3>
        <div>
          {projects.map(p => (
            <div key={p.id} style={{ border: '1px solid #ddd', padding: 12, marginBottom: 12 }}>
              <h4>{p.name}</h4>
              <div>{p.description}</div>
              <div>Budget total: {p.budget_total} · Used: {p.budget_used}</div>
              <div style={{ marginTop: 8 }}>
                <AddFundForm projectId={p.id} onDone={()=>loadProjects()} addFund={addFund} />
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
