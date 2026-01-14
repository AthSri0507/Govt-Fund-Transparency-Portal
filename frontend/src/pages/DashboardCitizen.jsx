import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getToken, getUser } from '../utils/auth'

export default function DashboardCitizen(){
  const user = getUser()
  const [followedProjects, setFollowedProjects] = useState([])
  const [recent, setRecent] = useState([])
  const navigate = useNavigate()

  useEffect(()=>{
    // load followed ids from localStorage and fetch their details
    try{
      const ids = JSON.parse(localStorage.getItem('followed_projects') || '[]')
      if (ids && ids.length){
        const token = getToken()
        Promise.all(ids.map(id => axios.get(`/api/projects/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data.data).catch(()=>null)))
          .then(rows => setFollowedProjects(rows.filter(Boolean)))
      }
    }catch(e){}
    try{
      const rec = JSON.parse(localStorage.getItem('recent_projects') || '[]')
      setRecent(rec)
    }catch(e){}
  }, [])

  return (
    <div>
      <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, background: '#fff', marginBottom: 12 }}>
        <h2>Welcome, {user?.name || user?.email || 'Citizen'}</h2>
        <p>Track government projects, see how funds are being used, and share your feedback.</p>
        <ul>
          <li>Browse projects by location, department, and status</li>
          <li>View budgets, timelines, and maps</li>
          <li>Post comments and ratings to reflect public opinion</li>
        </ul>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <button onClick={()=>navigate('/citizen/projects')} style={{ padding: '12px 18px' }}>📍 Browse Projects</button>
        <button onClick={()=>navigate('/citizen/projects?filter=followed')} style={{ padding: '12px 18px' }}>⭐ My Followed Projects</button>
        <button onClick={()=>navigate('/citizen/comments')} style={{ padding: '12px 18px' }}>📝 My Comments</button>
      </div>

      <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, background: '#fff', marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>⭐ Your Followed Projects</h3>
        {(!followedProjects || followedProjects.length === 0) ? (
          <div>Click ⭐ to follow</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {followedProjects.map(p => (
              <div key={p.id} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 13 }}>{p.status || 'Unknown'} · {p.department || ''}</div>
                  <div style={{ marginTop: 6 }}>Budget used: {p.budget_total ? `${Math.round((p.budget_used||0)/p.budget_total*100)}%` : '—'}</div>
                </div>
                <div>
                  <Link to={`/projects/${p.id}`}><button>View</button></Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>
        <h3 style={{ marginTop: 0 }}>Recently viewed</h3>
        {(!recent || recent.length === 0) ? (
          <div>No recently viewed projects yet.</div>
        ) : (
          <ul>
            {recent.map(r => (
              <li key={r.id}><Link to={`/projects/${r.id}`}>{r.name}</Link></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
