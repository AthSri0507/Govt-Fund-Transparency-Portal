import React, { useState } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import './register.css'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [stateVal, setStateVal] = useState('')
  const [idType, setIdType] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function validate() {
    const fe = {}
    if (!name || name.trim().length < 3) fe.name = 'Full name is required (min 3 chars)'
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fe.email = 'Valid email required'
    if (!password) fe.password = 'Password is required'
    const pwdRe = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}/
    if (password && !pwdRe.test(password)) fe.password = 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
    if (password && confirm && password !== confirm) fe.confirm = 'Passwords do not match'
    if (phone && !/^\+?[0-9 \-]{7,15}$/.test(phone)) fe.phone = 'Phone number looks invalid'
    if (idType && idNumber && idNumber.length < 4) fe.id = 'ID number looks too short'
    setFieldErrors(fe)
    return Object.keys(fe).length ? fe : null
  }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    const v = validate()
    if (v) { return }
    setLoading(true)
    try {
      const payload = { name, email, password, phone: phone || null, city: city || null, state: stateVal || null, id_type: idType || null, id_number: idNumber || null }
      await axios.post('/api/auth/register', payload)
      navigate('/login')
    } catch (e) {
      setError(e.response?.data?.message || e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-page">
      <div className="register-card">
        <div className="register-brand">🏛</div>
        <div className="brand-divider" />
        <h2 className="register-title">Citizen Registration</h2>
        <p className="register-sub">Create an account to track public projects and participate in oversight.</p>
        <p className="gov-note">Government Transparency Platform</p>

        <form className="register-form" onSubmit={submit} noValidate>
          <div className="section-header">Personal Information</div>
          <div className="form-row">
            <div className="form-group">
              <label>Full Name <span className="required">*</span></label>
              <input className={fieldErrors.name ? 'input error' : 'input'} value={name} onChange={e => setName(e.target.value)} />
              {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
            </div>
            <div className="form-group">
              <label>Email <span className="required">*</span></label>
              <input className={fieldErrors.email ? 'input error' : 'input'} value={email} onChange={e => setEmail(e.target.value)} />
              {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
            </div>
          </div>

          <div className="section-header">Account Security</div>
          <div className="form-row">
            <div className="form-group">
              <label>Password <span className="required">*</span></label>
              <input type="password" className={fieldErrors.password ? 'input error' : 'input'} value={password} onChange={e => setPassword(e.target.value)} />
              <div className="hint">Password must be at least 8 characters, include a number and symbol.</div>
              {fieldErrors.password && <div className="field-error">{fieldErrors.password}</div>}
            </div>
            <div className="form-group">
              <label>Confirm Password <span className="required">*</span></label>
              <input type="password" className={fieldErrors.confirm ? 'input error' : 'input'} value={confirm} onChange={e => setConfirm(e.target.value)} />
              {fieldErrors.confirm && <div className="field-error">{fieldErrors.confirm}</div>}
            </div>
          </div>

          <div className="section-header">Contact & Location</div>
          <div className="form-row">
            <div className="form-group">
              <label>Phone Number</label>
              <input className={fieldErrors.phone ? 'input error' : 'input'} value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +91 98765 43210" />
              {fieldErrors.phone && <div className="field-error">{fieldErrors.phone}</div>}
            </div>
            <div className="form-group">
              <label>City / District</label>
              <input className="input" value={city} onChange={e => setCity(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group state">
              <label>State</label>
              <input className="input" value={stateVal} onChange={e => setStateVal(e.target.value)} />
            </div>
          </div>

          <div className="section-header">Identity Verification</div>
          <div className="identity-block">
            <div className="form-row">
              <div className="form-group">
                <label>ID Type</label>
                <select className="input" value={idType} onChange={e => setIdType(e.target.value)}>
                  <option value="">None</option>
                  <option value="Aadhaar">Aadhaar</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Driving License">Driving License</option>
                </select>
              </div>
              <div className="form-group">
                <label>ID Number</label>
                <input
                  className={fieldErrors.id ? 'input error' : 'input'}
                  value={idNumber}
                  onChange={e => setIdNumber(e.target.value)}
                  disabled={!idType}
                />
                {fieldErrors.id && <div className="field-error">{fieldErrors.id}</div>}
              </div>
            </div>
          </div>

          <div className="req-note">Fields marked with <span className="required">*</span> are required</div>
          <div className="form-actions">
            <button className="register-btn" type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="register-footer">Already have an account? <Link to="/login" className="link">Login</Link></div>
        </form>
      </div>
    </div>
  )
}
