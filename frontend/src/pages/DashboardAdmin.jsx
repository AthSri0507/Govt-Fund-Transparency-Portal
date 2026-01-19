import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { getToken } from '../utils/auth'
import './DashboardAdmin.css'

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

  // load a small list of flagged projects for quick card
  const [flagged, setFlagged] = useState(null)
  useEffect(()=>{ (async function(){ try{ const token = getToken(); const r = await axios.get('/api/admin/projects/flagged?limit=5', { headers: { Authorization: `Bearer ${token}` } }); setFlagged(r.data?.data || []); }catch(e){ setFlagged([]) } })() }, [])

  return (
    <div className="dashboard-admin">
      <div className="dashboard-inner">
        <div className="dashboard-tricolor" aria-hidden="true">
          <span className="tri saffron" />
          <span className="tri white" />
          <span className="tri green" />
        </div>
        <div className="dashboard-header">
          <div className="dashboard-header-left">
            <h2 className="page-title">Admin Dashboard</h2>
            <p className="page-subtitle">Review flagged projects, monitor fund transactions, and audit system activity.</p>
          </div>
          <div className="dashboard-header-right" aria-hidden="true" />
        </div>
        {err && (
        <div className="error-box">
          <div className="error-title">Failed to load summary</div>
          <div className="error-message">{err.message}</div>
          {err.status && <div className="error-meta">Status: {err.status} {err.statusText}</div>}
          {err.body && <pre className="error-body">{JSON.stringify(err.body, null, 2)}</pre>}
          <div className="error-actions">
            <button className="retry-button" onClick={load}>Retry</button>
          </div>
        </div>
      )}

        {stats ? (
          <div className="kpi-grid">
          <Link to="/projects?status=Active" className="kpi-link">
            <div className="kpi-card kpi-positive">
              <div className="kpi-top">
                <span className="kpi-dot kpi-dot-green" aria-hidden="true" />
                <span className="kpi-label">Active projects</span>
              </div>
              <strong className="kpi-value">{typeof stats.active_projects !== 'undefined' ? stats.active_projects : '-'}</strong>
            </div>
          </Link>

          <Link to="/users" className="kpi-link">
            <div className="kpi-card kpi-normal">
              <div className="kpi-top">
                <span className="kpi-dot kpi-dot-blue" aria-hidden="true" />
                <span className="kpi-label">Total users</span>
              </div>
              <strong className="kpi-value">{typeof stats.total_users !== 'undefined' ? stats.total_users : '-'}</strong>
            </div>
          </Link>

          <Link to="/admin/funds" className="kpi-link">
            <div className="kpi-card kpi-normal">
              <div className="kpi-top">
                <span className="kpi-dot kpi-dot-blue" aria-hidden="true" />
                <span className="kpi-label">Fund transactions</span>
              </div>
              <strong className="kpi-value">{typeof stats.total_fund_transactions !== 'undefined' ? stats.total_fund_transactions : '-'}</strong>
            </div>
          </Link>

          <Link to="/users?status=Disabled" className="kpi-link">
            <div className="kpi-card kpi-normal">
              <div className="kpi-top">
                <span className="kpi-dot kpi-dot-blue" aria-hidden="true" />
                <span className="kpi-label">Disabled users</span>
              </div>
              <strong className="kpi-value">{typeof stats.disabled_users !== 'undefined' ? stats.disabled_users : '-'}</strong>
            </div>
          </Link>

          <Link to="/projects?status=Halted" className="kpi-link">
            <div className="kpi-card kpi-warning">
              <div className="kpi-top">
                <span className="kpi-dot kpi-dot-orange" aria-hidden="true" />
                <span className="kpi-label">Halted projects</span>
              </div>
              <strong className="kpi-value">{typeof stats.halted_projects !== 'undefined' ? stats.halted_projects : '-'}</strong>
            </div>
          </Link>

          <Link to="/dashboard/admin/flagged" className="kpi-link">
            <div className="kpi-card kpi-warning">
              <div className="kpi-top">
                <span className="kpi-dot kpi-dot-orange" aria-hidden="true" />
                <span className="kpi-label">Flagged Projects</span>
              </div>
              <strong className="kpi-value">{flagged ? flagged.length : '-'}</strong>
            </div>
          </Link>
          </div>
        ) : (
          // If there was an error, don't show the generic loading placeholder
          err ? null : (<div>Loading summary...</div>)
        )}

        {/* Quick links removed per request */}
    </div>
  </div>
  )
}
