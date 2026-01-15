import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { setToken, setUser } from '../utils/auth'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [stateVal, setStateVal] = useState('')
  const [idType, setIdType] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  function validate() {
    if (!name || name.trim().length < 3) return 'Full name is required (min 3 chars)'
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Valid email required'
    // require strong password: min 8 chars, uppercase, lowercase, digit, special char
    if (!password) return 'Password is required'
    const pwdRe = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}/
    if (!pwdRe.test(password)) return 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
    if (phone && !/^\+?[0-9 \-]{7,15}$/.test(phone)) return 'Phone number looks invalid'
    if (idType && idNumber && idNumber.length < 4) return 'ID number looks too short'
    return null
  }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    const v = validate()
    if (v) { setError(v); return }
    try {
      const payload = { name, email, password, phone: phone || null, city: city || null, state: stateVal || null, id_type: idType || null, id_number: idNumber || null }
      await axios.post('/api/auth/register', payload)
      // Do not auto-login; redirect user to login screen
      navigate('/login')
    } catch (e) {
      setError(e.response?.data?.message || e.message)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 420, border: '1px solid #eee', borderRadius: 8, padding: 20, boxShadow: '0 6px 18px rgba(0,0,0,0.04)', background: '#fff' }}>
        <h2 style={{ marginTop: 0 }}>Register (Citizen)</h2>
        <p style={{ fontSize: 13, color: '#666' }}>For academic demonstration only. ID fields are not validated against government databases.</p>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 8 }}>
            <label>Full Name *</label><br />
            <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Email *</label><br />
            <input value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Password *</label><br />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%' }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>Phone Number (recommended)</label><br />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +91 98765 43210" style={{ width: '100%' }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label>City / District</label><br />
              <input value={city} onChange={e => setCity(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div style={{ width: 140 }}>
              <label>State</label><br />
              <input value={stateVal} onChange={e => setStateVal(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label>ID Type (optional)</label><br />
              <select value={idType} onChange={e => setIdType(e.target.value)} style={{ width: '100%' }}>
                <option value="">None</option>
                <option value="Aadhaar">Aadhaar</option>
                <option value="Voter ID">Voter ID</option>
                <option value="Driving License">Driving License</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>ID Number (optional)</label><br />
              <input value={idNumber} onChange={e => setIdNumber(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#777' }}>* Required</div>
            <div>
              <button type="submit">Register</button>
            </div>
          </div>
        </form>
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  )
}
