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

  return (
    <div>
      <h2>Create Project</h2>
      {err && <div style={{ color: 'red' }}>{err}</div>}
      <form onSubmit={createProject}>
        <div>
          <label>Name</label><br />
          <input value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label>Description</label><br />
          <input value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div>
          <label>Budget total</label><br />
          <input type="number" value={budget} onChange={e => setBudget(e.target.value)} />
        </div>
        <div>
          <label>State</label><br />
          <input value={stateName} onChange={e => setStateName(e.target.value)} required placeholder="State/Province" />
        </div>
        <div>
          <label>City</label><br />
          <input value={city} onChange={e => setCity(e.target.value)} required placeholder="e.g. Bengaluru" />
        </div>
        <div>
          <label>Area / Locality (optional)</label><br />
          <input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Rajarajeshwari Nagar" />
        </div>
        <fieldset style={{ marginTop: 12, padding: 8 }}>
          <legend>Contractor Details (optional)</legend>
          <div>
            <label>Contractor Name</label><br />
            <input value={contractorName} onChange={e => setContractorName(e.target.value)} placeholder="e.g. Ramesh Kumar" />
          </div>
          <div>
            <label>Company</label><br />
            <input value={contractorCompany} onChange={e => setContractorCompany(e.target.value)} placeholder="e.g. ABC Constructions Pvt Ltd" />
          </div>
          <div>
            <label>Contact (phone/email)</label><br />
            <input value={contractorContact} onChange={e => setContractorContact(e.target.value)} placeholder="e.g. 9876543210 or name@company.com" />
          </div>
          <div>
            <label>Registration / GST ID (optional)</label><br />
            <input value={contractRegistrationId} onChange={e => setContractRegistrationId(e.target.value)} placeholder="e.g. GSTIN..." />
          </div>
          <div>
            <label>Contract Start Date</label><br />
            <input type="date" value={contractStartDate} onChange={e => setContractStartDate(e.target.value)} />
          </div>
          <div>
            <label>Contract End Date</label><br />
            <input type="date" value={contractEndDate} onChange={e => setContractEndDate(e.target.value)} />
          </div>
        </fieldset>
        <div>
          <label>Department</label><br />
          <input value={department} onChange={e => setDepartment(e.target.value)} required placeholder="Department (e.g. Public Works)" />
        </div>
        <div>
          <label>Latitude (optional)</label><br />
          <input value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="e.g. 12.9121" />
        </div>
        <div>
          <label>Longitude (optional)</label><br />
          <input value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="e.g. 77.5195" />
        </div>
        <div>
          <button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Project'}</button>
        </div>
      </form>
    </div>
  )
}
