import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { getToken } from '../utils/auth'
import './CreateRequestModal.css'

const FIELD_OPTIONS = [
  { value: 'name', label: 'Project Name' },
  { value: 'department', label: 'Department' },
  { value: 'state', label: 'State' },
  { value: 'city', label: 'City' },
  { value: 'area', label: 'Area' },
  { value: 'latitude', label: 'Latitude' },
  { value: 'longitude', label: 'Longitude' },
  { value: 'budget_total', label: 'Total Budget' },
  { value: 'status', label: 'Status' },
  { value: 'start_date', label: 'Start Date' },
  { value: 'end_date', label: 'End Date' },
  { value: 'description', label: 'Description' },
  { value: 'contractor_name', label: 'Contractor Name' },
  { value: 'contractor_company', label: 'Contractor Company' },
  { value: 'contractor_contact', label: 'Contractor Contact' },
  { value: 'contractor_registration_id', label: 'Contractor Registration ID' },
  { value: 'contract_start_date', label: 'Contract Start Date' },
  { value: 'contract_end_date', label: 'Contract End Date' }
]

export default function CreateRequestModal({ projectId, projectName, onClose, onCreated }) {
  const [officials, setOfficials] = useState([])
  const [selectedOfficial, setSelectedOfficial] = useState('')
  const [selectedFields, setSelectedFields] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingOfficials, setLoadingOfficials] = useState(true)
  const [err, setErr] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadOfficials()
  }, [])

  async function loadOfficials() {
    setLoadingOfficials(true)
    try {
      const token = getToken()
      const res = await axios.get('/api/project-requests/officials/list', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setOfficials(res.data?.data || [])
    } catch (e) {
      setErr('Failed to load officials')
    } finally {
      setLoadingOfficials(false)
    }
  }

  function handleFieldToggle(field) {
    setSelectedFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErr(null)

    if (!selectedOfficial) {
      setErr('Please select an official')
      return
    }
    if (selectedFields.length === 0) {
      setErr('Please select at least one field')
      return
    }

    setLoading(true)
    try {
      const token = getToken()
      await axios.post('/api/project-requests', {
        project_id: projectId,
        requested_from: Number(selectedOfficial),
        requested_fields: selectedFields
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSuccess(true)
      setTimeout(() => {
        if (onCreated) onCreated()
        onClose()
      }, 1500)
    } catch (e) {
      setErr(e.response?.data?.message || e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="crm-overlay" onClick={onClose}>
      <div className="crm-modal" onClick={e => e.stopPropagation()}>
        <div className="crm-header">
          <h2>Create Collaboration Request</h2>
          <button className="crm-close" onClick={onClose}>&times;</button>
        </div>

        <div className="crm-body">
          <div className="crm-project-info">
            <strong>Project:</strong> {projectName}
          </div>

          {err && <div className="crm-error">{err}</div>}
          {success && <div className="crm-success">Request created successfully!</div>}

          <form onSubmit={handleSubmit}>
            <div className="crm-field">
              <label>Select Official to Request</label>
              {loadingOfficials ? (
                <div className="crm-loading-small">Loading officials...</div>
              ) : (
                <select 
                  value={selectedOfficial} 
                  onChange={e => setSelectedOfficial(e.target.value)}
                  disabled={loading || success}
                >
                  <option value="">-- Select an Official --</option>
                  {officials.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.email})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="crm-field">
              <label>Select Fields to Complete</label>
              <div className="crm-fields-grid">
                {FIELD_OPTIONS.map(opt => (
                  <label key={opt.value} className="crm-checkbox-label">
                    <input 
                      type="checkbox"
                      checked={selectedFields.includes(opt.value)}
                      onChange={() => handleFieldToggle(opt.value)}
                      disabled={loading || success}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="crm-footer">
              <button type="button" className="crm-btn cancel" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="crm-btn submit" disabled={loading || success}>
                {loading ? 'Creating...' : 'Create Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
