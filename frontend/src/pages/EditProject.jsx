import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { getToken } from '../utils/auth'
import './CreateProject.css'

export default function EditProject() {
  const { id } = useParams()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState(10000)
  const [status, setStatus] = useState('Active')
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

  useEffect(() => {
    async function load() {
      if (!id) return
      try {
        const token = getToken()
        const res = await axios.get(`/api/projects/${id}`, { headers: { Authorization: `Bearer ${token}` } })
        const p = res.data && res.data.data ? res.data.data : null
        if (!p) return
        setName(p.name || '')
        setDescription(p.description || '')
        setBudget(p.budget_total ?? 0)
        setStateName(p.state || '')
        setCity(p.city || '')
        setArea(p.area || '')
        setDepartment(p.department || '')
        setContractorName(p.contractor_name || '')
        setContractorCompany(p.contractor_company || '')
        setContractorContact(p.contractor_contact || '')
        setContractRegistrationId(p.contractor_registration_id || '')
        setContractStartDate(p.contract_start_date ? String(p.contract_start_date).slice(0,10) : '')
        setContractEndDate(p.contract_end_date ? String(p.contract_end_date).slice(0,10) : '')
        setLatitude(p.latitude ?? '')
        setLongitude(p.longitude ?? '')
        setStatus(p.status || 'Active')
      } catch (e) {
        console.error('Failed to load project for edit', e)
      }
    }
    load()
  }, [id])

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
      // include status when editing (or if explicit)
      if (id && status) payload.status = status
      if (latitude) payload.latitude = Number(latitude)
      if (longitude) payload.longitude = Number(longitude)
      if (contractorName) payload.contractor_name = contractorName
      if (contractorCompany) payload.contractor_company = contractorCompany
      if (contractorContact) payload.contractor_contact = contractorContact
      if (contractRegistrationId) payload.contractor_registration_id = contractRegistrationId
      if (contractStartDate) payload.contract_start_date = contractStartDate
      if (contractEndDate) payload.contract_end_date = contractEndDate
      if (id) {
        // update existing project
        await axios.patch(`/api/projects/${id}`, payload, { headers: { Authorization: `Bearer ${token}` } })
      } else {
        await axios.post('/api/projects', payload, { headers: { Authorization: `Bearer ${token}` } })
      }
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
    <div className="cp-page">
      <div className="cp-tricolor" />
      <div className="cp-header">
        <h1 className="cp-title">Edit Your Project</h1>
        <div className="cp-sub">Official project editing registration form for government-funded initiatives.</div>
        <div className="cp-helper">All information entered here will be used for official government project records. Ensure accuracy before submission.</div>
        {err && <div style={{ color: 'red' }}>{err}</div>}
      </div>

      <form onSubmit={createProject} className="cp-form">
        <div className="cp-grid">
          <div className="cp-card cp-project-info" style={card}>
            <h3 className="cp-card-title">Project Information</h3>
            <div className="cp-row">
              <label className="cp-label">Name</label>
              <input className="cp-input" style={inputStyle} value={name} onChange={e => setName(e.target.value)} required />
            </div>

            <div className="cp-row">
              <label className="cp-label">Description</label>
              <textarea className="cp-textarea" style={{ ...inputStyle, minHeight: 90 }} value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <div className="cp-row">
              <label className="cp-label">Budget total</label>
              <input type="number" className="cp-input" style={inputStyle} value={budget} onChange={e => setBudget(e.target.value)} />
            </div>

            <div className="cp-row">
              <label className="cp-label">Department</label>
              <input className="cp-input" style={inputStyle} value={department} onChange={e => setDepartment(e.target.value)} required placeholder="Department (e.g. Public Works)" />
            </div>
            {id && (
              <div className="cp-row">
                <label className="cp-label">Status</label>
                <select className="cp-input" style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
                  <option>Active</option>
                  <option>Halted</option>
                  <option>Cancelled</option>
                </select>
              </div>
            )}
            
          </div>

          <div className="cp-card cp-contractor" style={card}>
              <h3 className="cp-card-title">Contractor Details <span className="cp-optional">(optional)</span></h3>
              <div className="cp-row">
                <label className="cp-label">Contractor Name</label>
                <input className="cp-input" style={inputStyle} value={contractorName} onChange={e => setContractorName(e.target.value)} placeholder="e.g. Ramesh Kumar" />
              </div>
              <div className="cp-row">
                <label className="cp-label">Company</label>
                <input className="cp-input" style={inputStyle} value={contractorCompany} onChange={e => setContractorCompany(e.target.value)} placeholder="e.g. ABC Constructions Pvt Ltd" />
              </div>
              <div className="cp-row">
                <label className="cp-label">Contact</label>
                <input className="cp-input" style={inputStyle} value={contractorContact} onChange={e => setContractorContact(e.target.value)} placeholder="e.g. 9876543210 or name@company.com" />
              </div>
              <div className="cp-row">
                <label className="cp-label">Registration / GST ID <span className="cp-optional">(optional)</span></label>
                <input className="cp-input" style={inputStyle} value={contractRegistrationId} onChange={e => setContractRegistrationId(e.target.value)} placeholder="e.g. GSTIN..." />
              </div>
              <div className="cp-row cp-dates">
                <div>
                  <label className="cp-label">Contract Start Date</label>
                  <input type="date" className="cp-input" style={inputStyle} value={contractStartDate} onChange={e => setContractStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="cp-label">Contract End Date</label>
                  <input type="date" className="cp-input" style={inputStyle} value={contractEndDate} onChange={e => setContractEndDate(e.target.value)} />
                </div>
              </div>
            </div>

          <div className="cp-card cp-location" style={card}>
              <h3 className="cp-card-title">Location</h3>
              <div className="cp-row cp-grid-2">
                <div>
                  <label className="cp-label">State</label>
                  <input className="cp-input" style={inputStyle} value={stateName} onChange={e => setStateName(e.target.value)} required placeholder="State/Province" />
                </div>
                <div>
                  <label className="cp-label">City</label>
                  <input className="cp-input" style={inputStyle} value={city} onChange={e => setCity(e.target.value)} required placeholder="e.g. Bengaluru" />
                </div>
              </div>

              <div className="cp-row">
                <label className="cp-label">Area / Locality <span className="cp-optional">(optional)</span></label>
                <input className="cp-input" style={inputStyle} value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Rajarajeshwari Nagar" />
              </div>

              <div className="cp-row cp-grid-2">
                <div>
                  <label className="cp-label">Latitude <span className="cp-optional">(optional)</span></label>
                  <input className="cp-input" style={inputStyle} value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="e.g. 12.9121" />
                </div>
                <div>
                  <label className="cp-label">Longitude <span className="cp-optional">(optional)</span></label>
                  <input className="cp-input" style={inputStyle} value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="e.g. 77.5195" />
                </div>
              </div>

            </div>
        </div>
      
        <div className="cp-submit-container">
          <button type="submit" className="cp-submit-large" disabled={submitting}>{submitting ? 'Updating...' : 'Confirm Edited Details'}</button>
         </div>
       </form>
     </div>
   )
 }
