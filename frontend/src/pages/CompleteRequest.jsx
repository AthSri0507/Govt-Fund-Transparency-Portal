import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useParams, useNavigate } from 'react-router-dom'
import { getToken } from '../utils/auth'
import './CompleteRequest.css'

const FIELD_CONFIG = {
  name: { label: 'Project Name', type: 'text' },
  department: { label: 'Department', type: 'text' },
  state: { label: 'State', type: 'text' },
  city: { label: 'City', type: 'text' },
  area: { label: 'Area', type: 'text' },
  latitude: { label: 'Latitude', type: 'number', step: '0.0000001' },
  longitude: { label: 'Longitude', type: 'number', step: '0.0000001' },
  budget_total: { label: 'Total Budget', type: 'number', step: '0.01' },
  status: { label: 'Status', type: 'select', options: ['Planning', 'In Progress', 'Completed', 'On Hold', 'Cancelled'] },
  start_date: { label: 'Start Date', type: 'date' },
  end_date: { label: 'End Date', type: 'date' },
  description: { label: 'Description', type: 'textarea' },
  contractor_name: { label: 'Contractor Name', type: 'text' },
  contractor_company: { label: 'Contractor Company', type: 'text' },
  contractor_contact: { label: 'Contractor Contact', type: 'text' },
  contractor_registration_id: { label: 'Contractor Registration ID', type: 'text' },
  contract_start_date: { label: 'Contract Start Date', type: 'date' },
  contract_end_date: { label: 'Contract End Date', type: 'date' }
}

export default function CompleteRequest() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [request, setRequest] = useState(null)
  const [fieldValues, setFieldValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadRequest()
  }, [id])

  async function loadRequest() {
    setLoading(true)
    setErr(null)
    try {
      const token = getToken()
      const res = await axios.get(`/api/project-requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = res.data?.data
      if (!data) {
        setErr('Request not found')
        return
      }
      if (data.status === 'COMPLETED') {
        setErr('This request has already been completed')
      }
      setRequest(data)
      // Initialize field values
      const initial = {}
      const fields = data.requested_fields || []
      fields.forEach(f => { initial[f] = '' })
      setFieldValues(initial)
    } catch (e) {
      setErr(e.response?.data?.message || e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleFieldChange(field, value) {
    setFieldValues(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErr(null)

    // Validate at least one field has value
    const filledFields = Object.entries(fieldValues).filter(([k, v]) => v !== '' && v !== null)
    if (filledFields.length === 0) {
      setErr('Please fill at least one field')
      return
    }

    // Build payload with only filled fields
    const payload = {}
    filledFields.forEach(([k, v]) => {
      payload[k] = v
    })

    setSubmitting(true)
    try {
      const token = getToken()
      await axios.post(`/api/project-requests/${id}/complete`, {
        field_values: payload
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSuccess(true)
      setTimeout(() => {
        navigate('/dashboard/official/requests')
      }, 2000)
    } catch (e) {
      setErr(e.response?.data?.message || e.message)
    } finally {
      setSubmitting(false)
    }
  }

  function renderField(field) {
    const config = FIELD_CONFIG[field] || { label: field.replace(/_/g, ' '), type: 'text' }
    const value = fieldValues[field] || ''

    if (config.type === 'textarea') {
      return (
        <textarea
          value={value}
          onChange={e => handleFieldChange(field, e.target.value)}
          placeholder={`Enter ${config.label}`}
          rows={4}
          disabled={submitting || success}
        />
      )
    }

    if (config.type === 'select') {
      return (
        <select
          value={value}
          onChange={e => handleFieldChange(field, e.target.value)}
          disabled={submitting || success}
        >
          <option value="">-- Select --</option>
          {(config.options || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    return (
      <input
        type={config.type}
        value={value}
        onChange={e => handleFieldChange(field, e.target.value)}
        placeholder={`Enter ${config.label}`}
        step={config.step}
        disabled={submitting || success}
      />
    )
  }

  if (loading) {
    return (
      <div className="complete-request-container">
        <div className="cr-loading">Loading request details...</div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="complete-request-container">
        <div className="cr-error">{err || 'Request not found'}</div>
        <button className="cr-back-btn" onClick={() => navigate('/dashboard/official/requests')}>
          Back to Requests
        </button>
      </div>
    )
  }

  return (
    <div className="complete-request-container">
      <div className="cr-header">
        <button className="cr-back-btn" onClick={() => navigate('/dashboard/official/requests')}>
          ← Back to Requests
        </button>
        <h1>Complete Request</h1>
      </div>

      <div className="cr-info-card">
        <h2>{request.project_name}</h2>
        <div className="cr-info-row">
          <span><strong>Department:</strong> {request.project_department}</span>
          <span><strong>Location:</strong> {request.project_city}, {request.project_state}</span>
        </div>
        <div className="cr-info-row">
          <span><strong>Requested by:</strong> {request.requested_by_name} ({request.requested_by_email})</span>
        </div>
      </div>

      {err && <div className="cr-error">{err}</div>}
      {success && <div className="cr-success">Request completed successfully! Redirecting...</div>}

      {request.status !== 'COMPLETED' && (
        <form onSubmit={handleSubmit} className="cr-form">
          <h3>Fields to Complete</h3>
          <p className="cr-form-hint">Fill in the fields requested. At least one field is required.</p>

          <div className="cr-fields">
            {(request.requested_fields || []).map(field => (
              <div key={field} className="cr-field-group">
                <label>{FIELD_CONFIG[field]?.label || field.replace(/_/g, ' ')}</label>
                {renderField(field)}
              </div>
            ))}
          </div>

          <div className="cr-actions">
            <button 
              type="button" 
              className="cr-btn cancel"
              onClick={() => navigate('/dashboard/official/requests')}
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="cr-btn submit"
              disabled={submitting || success}
            >
              {submitting ? 'Submitting...' : 'Complete Request'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
