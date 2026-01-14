import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { getToken, getUser } from '../utils/auth'
import { Link } from 'react-router-dom'

export default function MyComments(){
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [err, setErr] = useState(null)
  const user = getUser()

  useEffect(()=>{
    if (!user) { setErr('Please log in'); setLoading(false); return }
    const token = getToken()
    let cancelled = false
    async function load(){
      try{
        const res = await axios.get('/api/projects', { headers: { Authorization: `Bearer ${token}` } })
        const projects = res.data && res.data.data ? res.data.data : []
        const out = []
        await Promise.all(projects.map(async p=>{
          try{
            const c = await axios.get(`/api/projects/${p.id}/comments`, { headers: { Authorization: `Bearer ${token}` } })
            const comments = c.data && c.data.data ? c.data.data : []
            comments.forEach(cm=>{
              if (String(cm.user_id) === String(user.id)) out.push({ project: p, comment: cm })
            })
          }catch(e){}
        }))
        if (cancelled) return
        // sort newest first
        out.sort((a,b)=> new Date(b.comment.created_at) - new Date(a.comment.created_at))
        setItems(out)
      }catch(e){ setErr(e.response?.data?.message || e.message) }
      setLoading(false)
    }
    load()
    return ()=>{ cancelled = true }
  }, [user])

  if (loading) return <div>Loading...</div>
  if (err) return <div style={{ color: 'red' }}>{err}</div>

  return (
    <div>
      <h2>My Comments</h2>
      {items.length === 0 ? (
        <div>You haven’t posted any comments yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map(it => (
            <div key={`${it.project.id}-${it.comment.id}`} style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{it.project.name}</div>
                  <div style={{ marginTop: 6 }}>{it.comment.text}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>Rating: {it.comment.rating || '—'}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{new Date(it.comment.created_at).toLocaleString()}</div>
                  <div style={{ marginTop: 8 }}><Link to={`/projects/${it.project.id}`}><button>View project</button></Link></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
