import React from 'react'
import { useNavigate } from 'react-router-dom'
import { getUser, getToken } from '../utils/auth'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import './DashboardOfficial.css'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function OfficialHome() {
  const navigate = useNavigate()
  const user = getUser()
  const [statusCounts, setStatusCounts] = React.useState([])
  const [err, setErr] = React.useState(null)

  React.useEffect(()=>{
    let cancelled = false
    async function load(){
      try{
        setErr(null)
        const token = getToken()
        const headers = { Accept: 'application/json' }
        if (token) headers.Authorization = `Bearer ${token}`
        const res = await fetch('/api/projects/status-distribution', { headers })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        setStatusCounts(json.data || [])
      }catch(e){
        console.error('status distribution load', e)
        if (!cancelled) setErr(e?.message || String(e))
      }
    }
    load()
    return ()=>{ cancelled = true }
  }, [])

  function ProjectStatusPie({ data }){
    const rawLabels = (data || []).map(d => d.status)
    const labels = rawLabels.map(l => (l && l.length ? l : 'Unknown'))
    const counts = (data || []).map(d => Number(d.count || 0))
    const total = counts.reduce((s, n) => s + n, 0)
    // map statuses to requested colors
    const colorFor = (label) => {
      const l = (label || '').toString().toLowerCase();
      if (l === 'active') return '#4caf50' // green
      if (l === 'halted') return '#ff9800' // orange
      if (l === 'cancelled' || l === 'canceled') return '#f44336' // red
      if (l === 'unknown') return '#f44336'
      return '#bdbdbd' // other / grey
    }
    const colors = labels.map(colorFor)
    if (!total) {
      const placeholder = { labels: ['No data'], datasets: [{ data: [1], backgroundColor: ['#f3f4f6'] }] }
      const opts = { cutout: '70%', plugins: { legend: { display: false } }, maintainAspectRatio: true }
      return (
        <div style={{ position: 'relative', width: 140, height: 140 }}>
          <Doughnut data={placeholder} options={opts} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777', fontSize: 12 }}>No status data</div>
        </div>
      )
    }
    const chartData = { labels, datasets: [{ data: counts, backgroundColor: colors }] }
    // hide internal legend (we render a clean external list) and give chart a bit more room
    const options = { cutout: '50%', plugins: { legend: { display: false } }, maintainAspectRatio: true }
    return (
      <div style={{ width: 160, height: 160 }}>
        <Doughnut data={chartData} options={options} />
      </div>
    )
  }

  return (
    <div className="do-page">
      <div className="do-tricolor" />
      <div className="do-container">
        <main className="do-main">
          <header className="do-welcome">
            <h1 className="do-title">🏛️ Official Dashboard</h1>
            {err && <div className="do-error">{err}</div>}
            <div className="do-welcome-sub">Administrative control panel for managing government-funded projects.</div>
            <div className="do-admin-meta">
              <div>Role: <span className="do-admin-muted">Official User</span></div>
              <div>Access Level: <span className="do-admin-muted">Administrative</span></div>
            </div>
          </header>

          <section className="do-card do-actions-card" aria-labelledby="admin-actions">
            <h2 id="admin-actions" className="do-card-title">Quick Administrative Actions</h2>
            <div className="do-quick-body">
              <div className="do-action-row">
                <button className="do-action-btn" onClick={() => navigate('/dashboard/official/create')}>Create New Project</button>
                <div className="do-helper">Register a new government-funded initiative</div>
              </div>
              <div className="do-action-row">
                <button className="do-action-btn" onClick={() => navigate('/dashboard/official/projects')}>Manage Projects</button>
                <div className="do-helper">Approve, update, or close existing projects</div>
              </div>
              <div className="do-action-row">
                <button className="do-action-btn" onClick={() => navigate('/projects')}>View Projects</button>
                <div className="do-helper">Browse all registered public projects</div>
              </div>
            </div>
          </section>

          <section className="do-card do-projects" aria-labelledby="status-overview">
            <h2 id="status-overview" className="do-card-title">Project Status Overview</h2>
            <div className="do-project-status">
              <div className="do-project-status-chart">
                <ProjectStatusPie data={statusCounts} />
              </div>
              <div className="do-project-status-legend">
                {(!statusCounts || statusCounts.length === 0) && (
                  <div className="do-muted">
                    <div>No project status information available.</div>
                    <div>Project analytics will appear once data is recorded.</div>
                  </div>
                )}
                {statusCounts.map((s,i)=>{
                  const label = s && s.status && s.status.length ? s.status : 'Unknown'
                  return (
                    <div key={i} className="do-status-row">
                      <strong className={label === 'Unknown' ? 'do-status-unknown' : ''}>{label}</strong>: {s.count}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
