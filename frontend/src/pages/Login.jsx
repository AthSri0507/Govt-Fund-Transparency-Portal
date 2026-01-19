import React, { useState } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import { setToken, setUser, setRefreshToken } from '../utils/auth'
import './login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await axios.post('/api/auth/login', { email, password })
      const token = res.data && res.data.accessToken
      const user = res.data && res.data.user
      const refresh = res.data && res.data.refreshToken
      if (token) {
        setToken(token)
        if (refresh) setRefreshToken(refresh)
        setUser(user)
        const role = (user && user.role) || 'Citizen'
        if (role.toLowerCase() === 'official') navigate('/dashboard/official')
        else if (role.toLowerCase() === 'admin') navigate('/dashboard/admin')
        else navigate('/dashboard/citizen')
      } else {
        setError('No token returned')
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-wrap">
        <div className="login-card" role="main" aria-labelledby="login-heading">
          <div className="login-brand">
            <div className="login-icon" aria-hidden>🔒</div>
          </div>
          <h1 id="login-heading" className="login-title">Login</h1>
          <p className="login-sub">Access your account securely.</p>

          <form className="login-form" onSubmit={submit} noValidate>
            <label className="login-label" htmlFor="email">Email</label>
            <input
              id="email"
              className="login-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@domain.gov"
              required
              aria-invalid={!!error}
            />
            {error && <div className="login-error">{error}</div>}

            <label className="login-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="login-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              required
            />

            <div className="login-row">
              <Link to="/forgot" className="login-forgot">Forgot password?</Link>
            </div>

            <button className="login-btn" type="submit" disabled={loading} aria-busy={loading}>
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <div className="login-divider" aria-hidden />

          <div className="login-footer">
            <div>Don’t have an account? <Link to="/register" className="login-register-link">Register</Link></div>
          </div>
        </div>
      </div>
    </div>
  )
}
