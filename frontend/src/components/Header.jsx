import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import siteLogo from '../assets/logo.png'
import { getToken, getUser, clearAll } from '../utils/auth'
import '../styles/Header.css'

export default function Header({ variant = 'landing' }) {
  const navigate = useNavigate()
  const user = getUser()

  function handleLogout() {
    clearAll()
    navigate('/')
  }

  const isAuth = variant === 'auth'

  return (
    <header className={`site-header ${isAuth ? 'auth' : 'landing'}`}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            if (user && user.role) {
              const r = String(user.role).toLowerCase()
              if (r === 'official') return navigate('/dashboard/official')
              if (r === 'admin') return navigate('/dashboard/admin')
              return navigate('/dashboard/citizen')
            }
            navigate('/')
          }}
          className="header-brand"
        >
          <img src={siteLogo} alt="College Logo" className="header-logo" />
          <div>
            <div className="portal-title">Government Fund Transparency Portal</div>
            <div className="portal-sub">Citizen Portal</div>
          </div>
        </a>
      </div>

      <div className="header-actions">
        {user ? (
          <div className="user-block">
            <div className="user-avatar">{(user.name && user.name[0]) || '👤'}</div>
            <div className="user-info">
              <div className="user-name"><strong>{user.name || user.email}</strong></div>
              <div className="user-role">{user.role}</div>
            </div>
            <div>
              <select className="user-menu" onChange={(e) => { const v = e.target.value; if (v === 'profile') { } else if (v === 'dashboard') { navigate(user.role && user.role.toLowerCase() === 'official' ? '/dashboard/official' : user.role && user.role.toLowerCase() === 'admin' ? '/dashboard/admin' : '/dashboard/citizen'); } else if (v === 'logout') { handleLogout(); } }}>
                <option value="">Menu</option>
                <option value="dashboard">Go to Dashboard</option>
                <option value="profile">Profile</option>
                <option value="logout">Logout</option>
              </select>
            </div>
          </div>
        ) : (
          <>
            <Link to="/login" className="btn btn-login">Login</Link>
            <Link to="/register" className="btn btn-register">Register</Link>
          </>
        )}
      </div>
    </header>
  )
}
