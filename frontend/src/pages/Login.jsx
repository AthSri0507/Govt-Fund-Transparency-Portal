import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { setToken, setUser } from '../utils/auth'

export default function Login() {
  const [email, setEmail] = useState('official@example.com')
  const [password, setPassword] = useState('OfficialPass123!')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setError(null)
    try {
      const res = await axios.post('/api/auth/login', { email, password })
      const token = res.data && res.data.accessToken
      const user = res.data && res.data.user
      if (token) {
        setToken(token)
        setUser(user)
        // redirect based on role
        const role = (user && user.role) || 'Citizen'
        if (role.toLowerCase() === 'official') navigate('/dashboard/official')
        else if (role.toLowerCase() === 'admin') navigate('/dashboard/admin')
        else navigate('/dashboard/citizen')
      } else {
        setError('No token returned')
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message)
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2>Login</h2>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 8 }}>
          <label>Email</label><br />
          <input value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Password</label><br />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <button type="submit">Login</button>
      </form>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  )
}
