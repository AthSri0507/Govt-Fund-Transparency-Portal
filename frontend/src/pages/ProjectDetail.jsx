import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useParams } from 'react-router-dom'
import { getToken, getUser } from '../utils/auth'
import ProjectMap from '../components/ProjectMap'
// Removed duplicate import of React
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

function BudgetDonut({ total = 0, used = 0, size = 100 }) {
  const remaining = Math.max(0, total - used)
  const usedPct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const r = 40
  const stroke = 12
  const c = 2 * Math.PI * r
  const usedLength = Math.round((usedPct / 100) * c)
  const remainingLength = c - usedLength

  const fmt = n => n.toLocaleString()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <g transform="translate(50,50)">
          <circle r={r} cx="0" cy="0" fill="none" stroke="#e6f4ea" strokeWidth={stroke} />
          <circle r={r} cx="0" cy="0" fill="none" stroke="#ff8a65" strokeWidth={stroke}
            strokeDasharray={`${usedLength} ${remainingLength}`} strokeLinecap="round" transform="rotate(-90)" />
        </g>
      </svg>
      <div style={{ fontSize: 13 }}>
        <div><strong>Used:</strong> <span style={{ color: '#ff8a65' }}>₹{fmt(used)}</span> ({usedPct}%)</div>
        <div><strong>Remaining:</strong> <span style={{ color: '#4caf50' }}>₹{fmt(remaining)}</span></div>
      </div>
    </div>
  )
}

function BudgetSpendChart({ projectId }) {
  const [points, setPoints] = React.useState([])
  React.useEffect(()=>{
    let cancelled = false
    async function load(){
      try{
        const token = localStorage.getItem('accessToken')
        const res = await fetch(`/api/projects/${projectId}/budget-timeseries`, { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (cancelled) return
        const data = json.data || []
        // map to {x: date, y: cumulative}
        setPoints(data.map(d => ({ x: d.date, y: Number(d.cumulative) })))
      }catch(e){
        console.error('budget timeseries load error', e)
      }
    }
    load()
    return ()=>{ cancelled = true }
  }, [projectId])

  if (!points || points.length === 0) return <div style={{ color: '#666' }}>No budget transactions yet.</div>

  const labels = points.map(p => p.x)
  const data = {
    labels,
    datasets: [
      {
        label: 'Cumulative Spent',
        data: points.map(p => p.y),
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25,118,210,0.15)',
        fill: true,
        tension: 0.2,
        pointRadius: 3
      }
    ]
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true }
    }
  }
  return (
    <div style={{ marginTop: 12, height: 160 }}>
      <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Budget Spend Over Time</strong></div>
      <div style={{ height: 120, border: '1px solid #eee', background: '#fff', padding: 8 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  )
}

export default function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [comments, setComments] = useState([])
  const [timeline, setTimeline] = useState([])
  const [summary, setSummary] = useState(null)
  const [text, setText] = useState('')
  const [rating, setRating] = useState(5)
  const [err, setErr] = useState(null)
  const [commentSuccess, setCommentSuccess] = useState(null)
  const [commentSort, setCommentSort] = useState('newest')
  const token = getToken()
  const user = getUser()

  useEffect(() => {
    async function load() {
      try {
        const [pRes, cRes, sRes, tRes] = await Promise.all([
          axios.get(`/api/projects/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`/api/projects/${id}/comments`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`/api/projects/${id}/sentiment-summary`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null })),
          axios.get(`/api/projects/${id}/timeline`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
        ])
        setProject(pRes.data && pRes.data.data ? pRes.data.data : pRes.data)
        setComments(cRes.data && cRes.data.data ? cRes.data.data : cRes.data || [])
        setSummary(sRes && sRes.data && sRes.data.data ? sRes.data.data : sRes.data)
        setTimeline(tRes && tRes.data ? tRes.data : [])
        // add to recently viewed (most recent first, unique, keep 3)
        try {
          const key = 'recent_projects'
          const cur = JSON.parse(localStorage.getItem(key) || '[]')
          const entry = { id: pRes.data.data.id, name: pRes.data.data.name }
          const filtered = cur.filter(x=>x.id !== entry.id)
          filtered.unshift(entry)
          const top = filtered.slice(0,5)
          localStorage.setItem(key, JSON.stringify(top))
        } catch (e) {}
      } catch (e) {
        setErr(e.response?.data?.message || e.message)
      }
    }
    load()
  }, [id])

  async function submit(e) {
    e.preventDefault()
    setErr(null)
    setCommentSuccess(null)
    try {
      await axios.post(`/api/projects/${id}/comments`, { text, rating }, { headers: { Authorization: `Bearer ${token}` } })
      setText('')
      setRating(5)
      const [cRes, sRes] = await Promise.all([
        axios.get(`/api/projects/${id}/comments`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/api/projects/${id}/sentiment-summary`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null }))
      ])
      setComments(cRes.data && cRes.data.data ? cRes.data.data : cRes.data || [])
      setSummary(sRes && sRes.data && sRes.data.data ? sRes.data.data : sRes.data)
      // refresh project and timeline so avg_rating and timeline include the new comment
      try {
        const [pRef, tRef] = await Promise.all([
          axios.get(`/api/projects/${id}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null })),
          axios.get(`/api/projects/${id}/timeline`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
        ])
        if (pRef && pRef.data && pRef.data.data) setProject(pRef.data.data)
        if (tRef && tRef.data) setTimeline(tRef.data)
      } catch (e) {
        // non-fatal
      }
      setCommentSuccess('Comment posted')
    } catch (e) {
      setErr(e.response?.data?.message || e.message)
    }
  }

  return (
    <div>
      {!project && <div>Loading project...</div>}
      {project && (
        <div>
          <h2>{project.name}</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {project.avg_rating !== null && project.avg_rating !== undefined ? (
                <>
                  {renderStars(Math.round(project.avg_rating))}
                  <div style={{ fontSize: 12, color: '#666' }}>{Number(project.avg_rating).toFixed(1)} avg</div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#666' }}>No ratings yet</div>
              )}
              <div style={{ marginLeft: 10 }}>
                {summary && summary.count ? (
                  (() => {
                    const avg = typeof summary.average === 'number' ? summary.average : null
                    let label = 'Neutral'
                    let emoji = '🟡'
                    if (avg !== null) {
                      if (avg > 0) { label = 'Positive'; emoji = '🟢' }
                      else if (avg < 0) { label = 'Negative'; emoji = '🔴' }
                      else { label = 'Neutral'; emoji = '🟡' }
                    }
                    return (
                      <div style={{ fontSize: 13, color: '#444', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontWeight: 600 }}>{emoji} {label} sentiment</div>
                      </div>
                    )
                  })()
                ) : (
                  <div style={{ fontSize: 12, color: '#666', marginLeft: 6 }}>Waiting for processing</div>
                )}
              </div>
            </div>
            <div style={{ marginLeft: 12 }}>
              <FollowButton projectId={project.id} />
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            <p style={{ margin: 0 }}>
              <strong>Status:</strong>{' '}
              <span style={{
                color: project.status === 'Active' ? 'green' : project.status === 'Halted' ? 'orange' : 'red'
              }}>{project.status || 'Unknown'}</span>
            </p>
            {user && user.role && user.role.toLowerCase() === 'official' && (
              <div style={{ marginTop: 8 }}>
                <label>
                  Change Status:{' '}
                  <select value={project.status || 'Active'} onChange={async (e) => {
                    const newStatus = e.target.value
                    try {
                      const token = getToken()
                      await axios.put(`/api/projects/${project.id}/status`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } })
                      setProject({ ...project, status: newStatus })
                    } catch (err) {
                      console.error('status change failed', err)
                      alert('Failed to update status')
                    }
                  }}>
                    <option value="Active">Active</option>
                    <option value="Halted">Halted</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </label>
              </div>
            )}
          </div>

          <div style={{ marginTop: 8 }}>{project.description}</div>

          <div style={{ marginTop: 8 }}>
            <strong>Department:</strong> {project.department || '—'}
          </div>
          <div style={{ marginTop: 4 }}>
            <strong>Location:</strong> {project.state || ''}{project.city ? `, ${project.city}` : ''}{project.area ? `, ${project.area}` : ''}
          </div>

          {((project.contractor_name) || (project.contractor_company) || (project.contractor_contact)) && (
            <div style={{ marginTop: 8, padding: 12, border: '1px solid #eee', borderRadius: 8, background: '#fafafa' }}>
              <strong>Contractor</strong>
              <div style={{ marginTop: 6 }}>
                {project.contractor_name && <div>Name: {project.contractor_name}</div>}
                {project.contractor_company && <div>Company: {project.contractor_company}</div>}
                {project.contractor_contact && <div>Contact: {project.contractor_contact}</div>}
                {project.contractor_registration_id && <div>Registration ID: {project.contractor_registration_id}</div>}
                {project.contract_start_date && <div>Contract Start: {project.contract_start_date}</div>}
                {project.contract_end_date && <div>Contract End: {project.contract_end_date}</div>}
              </div>
            </div>
          )}

          <div style={{ marginTop: 10, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#fff', minWidth: 260 }}>
              <div style={{ marginBottom: 8 }}><strong>Budget</strong></div>
              <div>Total: ₹{project.budget_total ?? 0}</div>
              <div>Used: ₹{project.budget_used ?? 0}</div>
              <div>Remaining: ₹{(Number(project.budget_total || 0) - Number(project.budget_used || 0)).toFixed(2)}</div>
              <div style={{ marginTop: 12 }}>
                <BudgetDonut total={Number(project.budget_total || 0)} used={Number(project.budget_used || 0)} />
              </div>
            </div>
            <div style={{ flex: 1, padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
              <BudgetSpendChart projectId={project.id} />
            </div>
          </div>

          {project.latitude && project.longitude && (
            <div style={{ marginTop: 20, padding: 12, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
              {(!user || (user.role && user.role.toLowerCase() !== 'official' && user.role.toLowerCase() !== 'admin')) && (
                <h3 style={{ marginTop: 0 }}>Project Location</h3>
              )}
              <ProjectMap projects={[project]} single={true} />
            </div>
          )}
          <div style={{ marginTop: 20, padding: 12, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
            <h3 style={{ marginTop: 0 }}>Timeline</h3>
            {timeline && timeline.length ? (
              <ul>
                {timeline.map(item => (
                  <li key={`${item.type}-${item.id}`} style={{ marginBottom: 8 }}>
                    <div>
                      {item.type === 'fund_transaction' && <strong style={{ color: '#2e7d32' }}>Fund:</strong>}
                      {item.type === 'project_update' && <strong style={{ color: '#1976d2' }}>Update:</strong>}
                      {item.type === 'comment' && <strong style={{ color: '#ef6c00' }}>Comment:</strong>}
                      {' '}
                      {item.type === 'fund_transaction' && <span>₹{item.amount} — {item.purpose}</span>}
                      {item.type === 'project_update' && <span>{item.update_text || item.text}</span>}
                      {item.type === 'comment' && <span>{item.text}</span>}
                      <div style={{ fontSize: 12, color: '#666' }}>{new Date(item.occurred_at || item.created_at).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div>No timeline events yet.</div>
            )}
          </div>
        </div>
      )}

      <section style={{ marginTop: 16 }}>
        <h3>Sentiment</h3>
        {summary ? (
          <div>
            <div><strong>{summary.summary_text}</strong></div>
            {summary.top_keywords && <div>Top keywords: {summary.top_keywords.map(k=>k.word||k).slice(0,10).join(', ')}</div>}
            {summary.top_phrases && <div>Top phrases: {summary.top_phrases.map(p=>p.phrase||p).slice(0,10).join(', ')}</div>}
          </div>
        ) : (
          <div>No sentiment summary available yet.</div>
        )}
      </section>

      <section style={{ marginTop: 16 }}>
        {(!user || (user.role && user.role.toLowerCase() !== 'official' && user.role.toLowerCase() !== 'admin')) && (
          <h3>Comments</h3>
        )}
        {err && <div style={{ color: 'red' }}>{err}</div>}
        {/* Only citizens can post comments; hide form for officials/admins */}
        {(!user || (user.role && user.role.toLowerCase() !== 'official' && user.role.toLowerCase() !== 'admin')) && (
          <form onSubmit={submit} style={{ marginBottom: 12 }}>
            <div>
              <textarea value={text} onChange={e=>setText(e.target.value)} rows={3} cols={60} placeholder="Write your comment" />
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <label>Rating: </label>
                <select value={rating} onChange={e=>setRating(Number(e.target.value))}>
                  <option value={5}>5</option>
                  <option value={4}>4</option>
                  <option value={3}>3</option>
                  <option value={2}>2</option>
                  <option value={1}>1</option>
                </select>
              </div>
              <div>
                <button type="submit" disabled={!text || text.trim().length === 0}>Post comment</button>
              </div>
              {commentSuccess && <div style={{ color: 'green' }}>{commentSuccess}</div>}
            </div>
          </form>
        )}
        <div style={{ marginTop: 8, marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
          <label>Sort: <select value={commentSort} onChange={e=>setCommentSort(e.target.value)}><option value="newest">Newest</option><option value="rating">Highest rating</option></select></label>
        </div>
        {(!comments || comments.length === 0) ? (
          <div style={{ color: '#666' }}>Be the first to comment</div>
        ) : (
          <ul>
            {(comments || []).slice().sort((a,b)=>{
              if (commentSort === 'rating') return (b.rating||0) - (a.rating||0)
              return new Date(b.created_at) - new Date(a.created_at)
            }).map(c => (
              <li key={c.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.user_name || c.user_id || 'Citizen'}</div>
                    <div>{c.text}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div>{renderStars(Math.round(c.rating||0))}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{new Date(c.created_at).toLocaleString()}</div>
                  </div>
                </div>
                {c.sentiment_summary_cached && (()=>{
                  let s = c.sentiment_summary_cached
                  if (typeof s === 'string') { try { s = JSON.parse(s) } catch(e){} }
                  const score = s && typeof s.score === 'number' ? s.score : null
                  const label = score === null ? null : (score > 0 ? 'Positive' : score < 0 ? 'Negative' : 'Neutral')
                  return label ? <div style={{ marginTop: 6 }}><span style={{ padding: '2px 6px', background: '#f0f0f0', borderRadius: 6 }}>{label}</span></div> : null
                })()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function renderStars(n) {
  const stars = []
  for (let i=0;i<5;i++) stars.push(<span key={i} style={{ color: i < n ? '#fbc02d' : '#e0e0e0' }}>★</span>)
  return <span>{stars}</span>
}

function FollowButton({ projectId }){
  const [followed, setFollowed] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(()=>{
    try{
      const f = JSON.parse(localStorage.getItem('followed_projects') || '[]')
      setFollowed(f.includes(projectId))
    }catch(e){ setFollowed(false) }
  }, [projectId])

  async function toggle(){
    setSaving(true)
    try{
      const key = 'followed_projects'
      const cur = JSON.parse(localStorage.getItem(key) || '[]')
      const s = new Set(cur)
      if (s.has(projectId)) s.delete(projectId)
      else s.add(projectId)
      const arr = Array.from(s)
      localStorage.setItem(key, JSON.stringify(arr))
      setFollowed(s.has(projectId))
    }catch(e){ console.error(e) }
    setSaving(false)
  }

  return (
    <button onClick={toggle} disabled={saving} style={{ padding: '6px 10px' }}>{followed ? '★ Unfollow' : '☆ Follow project'}</button>
  )
}
