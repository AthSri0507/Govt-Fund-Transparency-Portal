import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { getToken } from '../utils/auth'
import { Link } from 'react-router-dom'
import './AdminDeletedProject.css'

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
    <main className="admin-deleted-container">
      <header className="admin-page-header">
        <h1 className="admin-title">Deleted Projects (Admin)</h1>
        <p className="admin-subtitle">Soft-deleted projects that can be restored by administrators.</p>
      </header>

      {err && <div className="admin-error">{err}</div>}

      {loading ? (
        <div className="admin-loading">Loading...</div>
      ) : (
        <section>
          {items.length === 0 ? (
            <div className="no-items">No deleted projects.</div>
          ) : (
            items.map(p => (
              <article key={p.id} className="deleted-card">
                <div className="card-left">
                  <div className="card-header">
                    <h3 className="project-name">{p.name}</h3>
                    <span className="deleted-badge">Deleted</span>
                  </div>
                  {p.description && <div className="project-desc">{p.description}</div>}

                  <div className="budget-row">
                    <div className="budget-item"><span className="label">Budget Total:</span> <span className="value">₹{p.budget_total}</span></div>
                    <div className="budget-item"><span className="label">Amount Used:</span> <span className="value">₹{p.budget_used}</span></div>
                  </div>

                  <div className="open-link-row"><Link className="open-link" to={`/dashboard/official/projects/${p.id}/view`}>Open (admin)</Link></div>
                </div>

                <div className="card-right">
                  <button className="restore-btn" onClick={()=>restore(p.id)}>Restore</button>
                </div>
              </article>
            ))
          )}
        </section>
      )}
    </main>
  )
}
