import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { getToken } from '../utils/auth'
import './PendingRequests.css'

export default function PendingRequests() {
  const [pendingRequests, setPendingRequests] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [activeTab, setActiveTab] = useState('pending')

  useEffect(() => {
    loadRequests()
  }, [])

  async function loadRequests() {
    setLoading(true)
    setErr(null)
    try {
      const token = getToken()
      const [pendingRes, sentRes] = await Promise.all([
        axios.get('/api/project-requests/pending', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/project-requests/sent', { headers: { Authorization: `Bearer ${token}` } })
      ])
      setPendingRequests(pendingRes.data?.data || [])
      setSentRequests(sentRes.data?.data || [])
    } catch (e) {
      setErr(e.response?.data?.message || e.message)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="pending-requests-container">
      <div className="pr-header">
        <h1>Collaboration Requests</h1>
        <p className="pr-subtitle">Manage requests to complete project fields</p>
      </div>

      {err && <div className="pr-error">{err}</div>}

      <div className="pr-tabs">
        <button 
          className={`pr-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Requests ({pendingRequests.length})
        </button>
        <button 
          className={`pr-tab ${activeTab === 'sent' ? 'active' : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          Sent Requests ({sentRequests.length})
        </button>
      </div>

      {loading ? (
        <div className="pr-loading">Loading requests...</div>
      ) : (
        <div className="pr-content">
          {activeTab === 'pending' && (
            <div className="pr-section">
              <h2>Requests Assigned to You</h2>
              {pendingRequests.length === 0 ? (
                <div className="pr-empty">No pending requests assigned to you</div>
              ) : (
                <div className="pr-list">
                  {pendingRequests.map(req => (
                    <div key={req.id} className="pr-card">
                      <div className="pr-card-header">
                        <h3>{req.project_name}</h3>
                        <span className="pr-badge pending">PENDING</span>
                      </div>
                      <div className="pr-card-body">
                        <p><strong>Department:</strong> {req.project_department}</p>
                        <p><strong>Requested by:</strong> {req.requested_by_name} ({req.requested_by_email})</p>
                        <p><strong>Requested on:</strong> {formatDate(req.created_at)}</p>
                        <div className="pr-fields">
                          <strong>Fields to complete:</strong>
                          <ul>
                            {(req.requested_fields || []).map(f => (
                              <li key={f}>{f.replace(/_/g, ' ')}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="pr-card-footer">
                        <Link to={`/dashboard/official/requests/${req.id}/complete`} className="pr-btn complete">
                          Complete Request
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sent' && (
            <div className="pr-section">
              <h2>Requests You Sent</h2>
              {sentRequests.length === 0 ? (
                <div className="pr-empty">You haven't sent any requests yet</div>
              ) : (
                <div className="pr-list">
                  {sentRequests.map(req => (
                    <div key={req.id} className="pr-card">
                      <div className="pr-card-header">
                        <h3>{req.project_name}</h3>
                        <span className={`pr-badge ${req.status.toLowerCase()}`}>{req.status}</span>
                      </div>
                      <div className="pr-card-body">
                        <p><strong>Department:</strong> {req.project_department}</p>
                        <p><strong>Sent to:</strong> {req.requested_from_name} ({req.requested_from_email})</p>
                        <p><strong>Created:</strong> {formatDate(req.created_at)}</p>
                        {req.completed_at && (
                          <p><strong>Completed:</strong> {formatDate(req.completed_at)}</p>
                        )}
                        <div className="pr-fields">
                          <strong>Requested fields:</strong>
                          <ul>
                            {(req.requested_fields || []).map(f => (
                              <li key={f}>{f.replace(/_/g, ' ')}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
