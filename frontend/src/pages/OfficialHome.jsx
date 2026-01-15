import React from 'react'
import { useNavigate } from 'react-router-dom'
import { getUser, getToken } from '../utils/auth'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function OfficialHome() {
  const navigate = useNavigate()
  const user = getUser()
  const [statusCounts, setStatusCounts] = React.useState([])

  React.useEffect(()=>{
    let cancelled = false
    async function load(){
      try{
        const token = getToken()
        const headers = { Accept: 'application/json' }
        if (token) headers.Authorization = `Bearer ${token}`
        const res = await fetch('/api/projects/status-distribution', { headers })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        setStatusCounts(json.data || [])
      }catch(e){
        console.error('status distribution load', e)
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
      <div style={{ padding: 18, border: '1px solid #e8e8e8', borderRadius: 8, background: '#fff' }}>
        <h2 style={{ marginTop: 0 }}>Welcome, {user?.name || user?.email}</h2>
        <p style={{ marginTop: 6 }}>What would you like to do?</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => navigate('/dashboard/official/create')}>Create New Project</button>
          <button onClick={() => navigate('/dashboard/official/projects')}>Manage Existing Projects</button>
          <button onClick={() => navigate('/projects')}>Browse Projects</button>
        </div>

        <div style={{ marginTop: 18 }}>
          <h3 style={{ marginBottom: 8 }}>Project Status Distribution</h3>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <div style={{ width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 8 }}>
              <ProjectStatusPie data={statusCounts} />
            </div>
            <div>
              {(!statusCounts || statusCounts.length === 0) && <div style={{ color: '#666' }}>No status data</div>}
              {statusCounts.map((s,i)=>{
                const label = s && s.status && s.status.length ? s.status : 'Unknown'
                return (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <strong style={{ color: label === 'Unknown' ? '#f44336' : 'inherit' }}>{label}</strong>: {s.count}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 18 }}>
        <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8, background: '#fff' }}>
          <h3 style={{ marginTop: 0 }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => navigate('/dashboard/official/create')}>Create New Project</button>
            <button onClick={() => navigate('/dashboard/official/projects')}>Manage Projects</button>
            <button onClick={() => navigate('/projects')}>Browse Projects</button>
          </div>
        </div>
      </div>
    </div>
  )
}
