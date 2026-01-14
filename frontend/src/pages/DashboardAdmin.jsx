import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { getToken } from '../utils/auth'

export default function DashboardAdmin(){
  const [stats, setStats] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(()=>{ load() }, [])
  async function load(){
    setErr(null)
    try{
      const token = getToken()
      const res = await axios.get('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      setStats(res.data && res.data.data ? res.data.data : null)
    }catch(e){
      const res = e.response;
      if (res) {
        setErr({ status: res.status, statusText: res.statusText, message: res.data?.message || e.message, body: res.data });
      } else {
        setErr({ message: e.message });
      }
    }
  }

  return (
    <div>
      <h2>Admin Dashboard</h2>
      <p style={{ marginTop: 6, marginBottom: 12 }}>This dashboard shows live system health and activity.</p>
      {err && (
        <div style={{ color: 'red', border: '1px solid #f5c6cb', background: '#fff0f0', padding: 10, borderRadius: 6, marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>Failed to load summary</div>
          <div>{err.message}</div>
          {err.status && <div>Status: {err.status} {err.statusText}</div>}
          {err.body && <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, maxHeight: 140, overflow: 'auto' }}>{JSON.stringify(err.body, null, 2)}</pre>}
          <div style={{ marginTop: 8 }}>
            <button onClick={load}>Retry</button>
          </div>
        </div>
      )}
      {stats ? (
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <Link to="/users" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>Total users<br/><strong>{typeof stats.total_users !== 'undefined' ? stats.total_users : '-'}</strong></div>
          </Link>
          <Link to="/projects?status=Active" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>Active projects<br/><strong>{typeof stats.active_projects !== 'undefined' ? stats.active_projects : '-'}</strong></div>
          </Link>
          <Link to="/projects?status=Halted" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>Halted projects<br/><strong>{typeof stats.halted_projects !== 'undefined' ? stats.halted_projects : '-'}</strong></div>
          </Link>
          <Link to="/admin/funds" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>Fund transactions<br/><strong>{typeof stats.total_fund_transactions !== 'undefined' ? stats.total_fund_transactions : '-'}</strong></div>
          </Link>
          <Link to="/users?status=Disabled" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>Disabled users<br/><strong>{typeof stats.disabled_users !== 'undefined' ? stats.disabled_users : '-'}</strong></div>
          </Link>
        </div>
      ) : (
        // If there was an error, don't show the generic loading placeholder
        err ? null : (<div>Loading summary...</div>)
      )}

      <p>Quick links:</p>
      <ul>
        <li><Link to="/dashboard/admin/projects">Projects (Admin)</Link></li>
        <li><Link to="/projects">Public Projects</Link></li>
        <li><Link to="/users">User management</Link></li>
        <li><Link to="/admin/audit-logs">Audit Logs</Link></li>
        <li><Link to="/admin/funds">Fund Transactions</Link></li>
        <li><Link to="/admin/deleted-projects">Deleted Projects</Link></li>
      </ul>
    </div>
  )
}
