import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { getToken, getUser } from '../utils/auth'
import { Link } from 'react-router-dom'
import './MyComments.css'

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
    <div className="mc-page">
      <h2 className="mc-heading">My Comments</h2>
      {items.length === 0 ? (
        <div>You haven’t posted any comments yet.</div>
      ) : (
        <div className="mc-list">
          {items.map(it => (
            <article key={`${it.project.id}-${it.comment.id}`} className="mc-card">
              <div className="mc-inner">
                <div className="mc-left">
                  <div className="mc-project">{it.project.name}</div>
                  <div className="mc-text">{it.comment.text}</div>
                </div>
                <div className="mc-right">
                  <div className="mc-rating">
                    <div>Rating:</div>
                    <div className="mc-stars" aria-hidden>
                      {Array.from({length:5}).map((_,i)=> (
                        <span key={i} className={(i < (it.comment.rating||0)) ? 'on' : ''}>★</span>
                      ))}
                    </div>
                  </div>
                  <div className="mc-meta">{new Date(it.comment.created_at).toLocaleString()}</div>
                  <div className="mc-action"><Link to={`/projects/${it.project.id}`}><button className="mc-btn">View project</button></Link></div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
