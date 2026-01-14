import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { setToken, setUser } from '../utils/auth'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setError(null)
    try {
      const res = await axios.post('/api/auth/register', { name, email, password })
      const token = res.data && res.data.accessToken
      const user = res.data && res.data.user
      if (token) {
        setToken(token)
        setUser(user)
        // auto-assign citizen and redirect
        navigate('/dashboard/citizen')
      } else {
        setError('Registration returned no token')
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message)
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2>Register (Citizen)</h2>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 8 }}>
          <label>Name</label><br />
          <input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Email</label><br />
          <input value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Password</label><br />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <button type="submit">Register</button>
      </form>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  )
}
