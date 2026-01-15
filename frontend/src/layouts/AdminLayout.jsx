import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getUser, clearAll } from '../utils/auth'
import logo from '../assets/logo.png'

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
      <header
        className="admin-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: '1px solid #ddd',
          background: '#fff',
          whiteSpace: 'nowrap',
          flexWrap: 'nowrap'
        }}
      >
        <a href="#" onClick={(e)=>{ e.preventDefault();
            if (user && user.role) {
              const r = String(user.role).toLowerCase()
              if (r === 'official') return navigate('/dashboard/official')
              if (r === 'admin') return navigate('/dashboard/admin')
              return navigate('/dashboard/citizen')
            }
            navigate('/')
          }} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
          <img src={logo} alt="Logo" style={{ width: 95, height: 65 }} />
          <div>
            <div style={{ fontSize: 24, fontWeight: 400 }}>
              Government Fund Transparency Portal
            </div>
            <div style={{ fontSize: 12, color: '#777' }}>Admin Console</div>
          </div>
        </a>

        <div
          className="admin-header-utilities"
          style={{ display: 'flex', alignItems: 'center', gap: 12 }}
        >
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right' }}>
                <strong>{user.name || user.email}</strong>
                <div style={{ fontSize: 12, color: '#777' }}>{user.role}</div>
              </div>

              <div>
                <select onChange={(e) => { const v = e.target.value; if (v === 'dashboard') {
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

              <button onClick={handleLogout}>Logout</button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="admin-body" style={{ display: 'flex', flex: 1 }}>
        <aside className="admin-sidebar" style={{ width: 220, borderRight: '1px solid #eee', padding: 12, background: '#fafafa' }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link to="/dashboard/admin">Dashboard</Link>
            <Link to="/dashboard/admin/projects">Projects</Link>
            <Link to="/dashboard/admin/flagged">Flagged Projects</Link>
            <Link to="/users">Users</Link>
            <Link to="/admin/audit-logs">Audit Logs</Link>
            <Link to="/admin/funds">Transactions</Link>
            <Link to="/admin/deleted-projects">Deleted Projects</Link>
          </nav>
        </aside>

        <main className="admin-content" style={{ flex: 1, padding: 16 }}>
          {children}
        </main>
      </div>

      <footer className="admin-footer" style={{ padding: 12, borderTop: '1px solid #eee', textAlign: 'center', fontSize: 16, color: '#666' }}>
        Atharva Srivastava
      </footer>
    </div>
  )
}
