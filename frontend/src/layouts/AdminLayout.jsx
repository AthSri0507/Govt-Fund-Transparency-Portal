import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { getUser, clearAll } from '../utils/auth'
import logo from '../assets/logo.png'
import './adminlayout.css'

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const user = getUser();

  function handleLogout() {
    clearAll();
    navigate('/');
  }

  return (
    <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top header: branding left, utilities right on one horizontal bar */}
      <header className="admin-header">
        <a href="#" onClick={(e)=>{ e.preventDefault();
            if (user && user.role) {
              const r = String(user.role).toLowerCase()
              if (r === 'official') return navigate('/dashboard/official')
              if (r === 'admin') return navigate('/dashboard/admin')
              return navigate('/dashboard/citizen')
            }
            navigate('/')
          }} className="header-brand">
          <img src={logo} alt="Logo" className="header-logo" />
          <div className="title-wrapper">
            <div className="portal-title">Government Fund Transparency Portal</div>
            <div className="portal-sub">Admin Console</div>
          </div>
        </a>

        <div className="admin-header-utilities">
          {user ? (
            <div className="user-block">
              <div className="user-avatar">{(user.name && user.name[0]) || (user.email && user.email[0]) || 'A'}</div>
              <div className="user-info">
                <div className="user-name">{user.name || user.email}</div>
                <div className="user-role">{user.role}</div>
              </div>

              <select className="user-menu" onChange={(e) => { const v = e.target.value; if (v === 'dashboard') {
                  navigate(user.role && user.role.toLowerCase() === 'official' ? '/dashboard/official' : user.role && user.role.toLowerCase() === 'admin' ? '/dashboard/admin' : '/dashboard/citizen');
                } else if (v === 'profile') {
                  // placeholder
                } else if (v === 'logout') { handleLogout(); } }}>
                <option value="">Menu</option>
                <option value="dashboard">Go to Dashboard</option>
                <option value="profile">Profile</option>
                <option value="logout">Logout</option>
              </select>

              
            </div>
          ) : null}
        </div>
      </header>

      <div className="admin-body" style={{ display: 'flex', flex: 1 }}>
        <aside className="admin-sidebar">
          <nav>
            <NavLink to="/dashboard/admin" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>Dashboard</NavLink>
            <NavLink to="/dashboard/admin/projects" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>Projects</NavLink>
            <NavLink to="/dashboard/admin/flagged" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>Flagged Projects</NavLink>
            <NavLink to="/users" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>Users</NavLink>
            <NavLink to="/admin/audit-logs" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>Audit Logs</NavLink>
            <NavLink to="/admin/funds" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>Transactions</NavLink>
            <NavLink to="/admin/deleted-projects" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>Deleted Projects</NavLink>
          </nav>
        </aside>

        <main className="admin-content">
          <div className="admin-main-container">{children}</div>
        </main>
      </div>

      <footer className="admin-footer" style={{ padding: 12, borderTop: '1px solid #eee', textAlign: 'center', fontSize: 16, color: '#666' }}>
        Atharva Srivastava
      </footer>
    </div>
  )
}
