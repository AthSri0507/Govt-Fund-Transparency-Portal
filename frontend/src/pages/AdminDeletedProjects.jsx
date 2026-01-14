import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { getToken } from '../utils/auth'
import { Link } from 'react-router-dom'

export default function AdminDeletedProjects(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(()=>{ load() }, [])

  async function load(){
    setErr(null)
    setLoading(true)
    try{
      const token = getToken()
      const res = await axios.get('/api/admin/projects/deleted', { headers: { Authorization: `Bearer ${token}` } })
      setItems(res.data?.data || [])
    }catch(e){ setErr(e.response?.data?.message || e.message) }
    finally{ setLoading(false) }
  }

  async function restore(id){
    try{
      const token = getToken()
      await axios.post(`/api/projects/${id}/restore`, {}, { headers: { Authorization: `Bearer ${token}` } })
      await load()
    }catch(e){ alert(e.response?.data?.message || e.message) }
  }

  return (
    <div>
      <h2>Deleted Projects (Admin)</h2>
      <p style={{ marginTop: 6, marginBottom: 12 }}>Projects that were soft-deleted. You can restore them to visibility.</p>
      {err && <div style={{ color: 'red' }}>{err}</div>}
      {loading ? <div>Loading...</div> : (
        <div>
          {items.length === 0 ? <div>No deleted projects.</div> : items.map(p => (
            <div key={p.id} style={{ border: '1px solid #ddd', padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: 0 }}>{p.name} <span style={{ fontSize: 12, color: '#9b1c1c', background: '#ffe6e6', padding: '2px 6px', borderRadius: 8 }}>Deleted</span></h4>
                  <div style={{ fontSize: 13 }}>{p.description}</div>
                </div>
                <div>
                  <button onClick={()=>restore(p.id)}>Restore</button>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>Budget total: {p.budget_total} · Used: {p.budget_used}</div>
              <div style={{ marginTop: 8 }}><Link to={`/projects/${p.id}`}>Open (admin)</Link></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
