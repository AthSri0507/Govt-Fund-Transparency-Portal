import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { getToken } from '../utils/auth'

export default function CreateProject() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState(10000)
  const [stateName, setStateName] = useState('')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [department, setDepartment] = useState('')
  const [contractorName, setContractorName] = useState('')
  const [contractorCompany, setContractorCompany] = useState('')
  const [contractorContact, setContractorContact] = useState('')
  const [contractRegistrationId, setContractRegistrationId] = useState('')
  const [contractStartDate, setContractStartDate] = useState('')
  const [contractEndDate, setContractEndDate] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [err, setErr] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function createProject(e) {
    e.preventDefault()
    setErr(null)
    if (!name.trim()) return setErr('Name required')
    if (!stateName) return setErr('State required')
    if (!city) return setErr('City required')
    if (!department) return setErr('Department required')
    try {
      setSubmitting(true)
      const token = getToken()
      const payload = { name, description, budget_total: Number(budget), state: stateName, city, area, department }
      if (latitude) payload.latitude = Number(latitude)
      if (longitude) payload.longitude = Number(longitude)
      if (contractorName) payload.contractor_name = contractorName
      if (contractorCompany) payload.contractor_company = contractorCompany
      if (contractorContact) payload.contractor_contact = contractorContact
      if (contractRegistrationId) payload.contractor_registration_id = contractRegistrationId
      if (contractStartDate) payload.contract_start_date = contractStartDate
      if (contractEndDate) payload.contract_end_date = contractEndDate
      await axios.post('/api/projects', payload, { headers: { Authorization: `Bearer ${token}` } })
      navigate('/dashboard/official/projects')
    } catch (e) {
      setErr(e.response?.data?.message || e.message)
    } finally {
      setSubmitting(false)
    }
  }
  const card = { padding: 18, border: '1px solid #e8e8e8', borderRadius: 8, background: '#fff' }
  const inputStyle = { width: '100%', padding: '6px 8px', marginTop: 6, marginBottom: 10 }

  return (
    <div>
      <h2>Create Project</h2>
      {err && <div style={{ color: 'red' }}>{err}</div>}

      <form onSubmit={createProject}>
        <div style={{ display: 'grid', gridTemplateColumns: '480px 1fr', gap: 20 }}>
          <div style={card}>
            <div>
              <label>Name</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} required />
            </div>

            <div>
              <label>Description</label>
              <textarea style={{ ...inputStyle, minHeight: 90 }} value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <div>
              <label>Budget total</label>
              <input type="number" style={inputStyle} value={budget} onChange={e => setBudget(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label>State</label>
                <input style={inputStyle} value={stateName} onChange={e => setStateName(e.target.value)} required placeholder="State/Province" />
              </div>
              <div style={{ flex: 1 }}>
                <label>City</label>
                <input style={inputStyle} value={city} onChange={e => setCity(e.target.value)} required placeholder="e.g. Bengaluru" />
              </div>
            </div>

            <div>
              <label>Area / Locality (optional)</label>
              <input style={inputStyle} value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Rajarajeshwari Nagar" />
            </div>

            <div>
              <label>Department</label>
              <input style={inputStyle} value={department} onChange={e => setDepartment(e.target.value)} required placeholder="Department (e.g. Public Works)" />
            </div>

            <div style={{ marginTop: 8 }}>
              <button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Project'}</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={card}>
              <h4 style={{ marginTop: 0, marginBottom: 8 }}>Contractor Details (optional)</h4>
              <div>
                <label>Contractor Name</label>
                <input style={inputStyle} value={contractorName} onChange={e => setContractorName(e.target.value)} placeholder="e.g. Ramesh Kumar" />
              </div>
              <div>
                <label>Company</label>
                <input style={inputStyle} value={contractorCompany} onChange={e => setContractorCompany(e.target.value)} placeholder="e.g. ABC Constructions Pvt Ltd" />
              </div>
              <div>
                <label>Contact (phone/email)</label>
                <input style={inputStyle} value={contractorContact} onChange={e => setContractorContact(e.target.value)} placeholder="e.g. 9876543210 or name@company.com" />
              </div>
              <div>
                <label>Registration / GST ID (optional)</label>
                <input style={inputStyle} value={contractRegistrationId} onChange={e => setContractRegistrationId(e.target.value)} placeholder="e.g. GSTIN..." />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label>Contract Start Date</label>
                  <input type="date" style={inputStyle} value={contractStartDate} onChange={e => setContractStartDate(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Contract End Date</label>
                  <input type="date" style={inputStyle} value={contractEndDate} onChange={e => setContractEndDate(e.target.value)} />
                </div>
              </div>
            </div>

            <div style={card}>
              <h4 style={{ marginTop: 0, marginBottom: 8 }}>Location / Preview</h4>
              <div>
                <label>Latitude (optional)</label>
                <input style={inputStyle} value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="e.g. 12.9121" />
              </div>
              <div>
                <label>Longitude (optional)</label>
                <input style={inputStyle} value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="e.g. 77.5195" />
              </div>
              <div style={{ height: 220, marginTop: 8, border: '1px dashed #ddd', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                Map / Preview (optional)
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
