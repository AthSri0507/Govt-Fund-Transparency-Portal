import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { getToken } from '../utils/auth'
import { Link } from 'react-router-dom'

export default function AdminFlaggedProjects(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(()=>{ load() }, [])

  async function load(){
    setErr(null)
    setLoading(true)
    try{
      const token = getToken()
      const res = await axios.get('/api/admin/projects/flagged?limit=100', { headers: { Authorization: `Bearer ${token}` } })
      setItems(res.data?.data || [])
    }catch(e){ setErr(e.response?.data?.message || e.message) }
    finally{ setLoading(false) }
  }

  return (
    <div>
      <h2>Flagged Projects</h2>
      <p style={{ marginTop: 6, marginBottom: 12 }}>Projects flagged by administrators for review.</p>
      {err && <div style={{ color: 'red' }}>{err}</div>}
      {loading ? <div>Loading...</div> : (
        <div>
          {items.length === 0 ? <div>No flagged projects.</div> : (
            <ul>
              {items.map(p => (
                <li key={p.id} style={{ marginBottom: 8 }}>
                  <Link to={`/projects/${p.id}`}>{p.name}</Link> — {p.department} — <strong style={{ color: '#9b1c1c' }}>Flagged</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
