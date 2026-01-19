import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import axios from 'axios'
import { getToken } from '../utils/auth'
import './AdminUser.css'

export default function UsersAdmin() {
  // Hide the admin top header when this page is active to avoid duplicate headers
  useEffect(() => {
    const hdr = document.querySelector('.admin-header')
    const origDisplay = hdr ? hdr.style.display : null
    if (hdr) hdr.style.display = 'none'
    return () => { if (hdr) hdr.style.display = origDisplay }
  }, [])

  const [users, setUsers] = useState([])
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(false)
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { loadUsers() }, [])
  const location = useLocation()

  useEffect(() => {
    const qs = new URLSearchParams(location.search)
    const status = qs.get('status') || ''
    const role = qs.get('role') || ''
    const q = qs.get('q') || ''
    if (status) setStatusFilter(status.toLowerCase() === 'disabled' ? 'disabled' : status)
    if (role) setRoleFilter(role)
    if (q) setSearch(q)
    // reload with applied filters
    loadUsers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  async function loadUsers() {
    setErr(null)
    setLoading(true)
    try {
      const token = getToken()
      const res = await axios.get('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      setUsers(res.data && res.data.data ? res.data.data : [])
    } catch (e) {
      setErr(e.response?.data?.message || e.message)
    } finally { setLoading(false) }
  }

  async function changeRole(id, role, setLocalErr) {
    setLocalErr(null)
    try {
      const ok = window.confirm(`Are you sure you want to change this user's role to ${role}?\nThis action will affect permissions immediately.`)
      if (!ok) return
      const token = getToken()
      await axios.patch(`/api/admin/users/${id}`, { role }, { headers: { Authorization: `Bearer ${token}` } })
      await loadUsers()
    } catch (e) {
      setLocalErr(e.response?.data?.message || e.message)
    }
  }

  async function deactivate(id, active, setLocalErr) {
    setLocalErr(null)
    try {
      const msg = active ? 'Are you sure you want to activate this user?' : 'Are you sure you want to deactivate this user?\nThis action will affect permissions immediately.'
      const ok = window.confirm(msg)
      if (!ok) return
      const token = getToken()
      await axios.patch(`/api/admin/users/${id}`, { is_active: active }, { headers: { Authorization: `Bearer ${token}` } })
      await loadUsers()
    } catch (e) {
      setLocalErr(e.response?.data?.message || e.message)
    }
  }

  return (
    <div className="admin-user-page">
      <div className="admin-user-inner">
        <h2 className="admin-title">User Management</h2>
        {err && <div className="error-inline">{err}</div>}

        <div className="filters-card">
          <input className="search-input" placeholder="Search name or email" value={search} onChange={(e)=>setSearch(e.target.value)} />
          <select className="filter-select" value={roleFilter} onChange={(e)=>setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            <option>Admin</option>
            <option>Official</option>
            <option>Citizen</option>
          </select>
          <select className="filter-select" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <button className="refresh-button" onClick={loadUsers} disabled={loading}>Refresh</button>
        </div>

        {loading ? <div>Loading...</div> : (
          <div className="table-card">
            <table className="users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => {
                  if (roleFilter && String(u.role).toLowerCase() !== String(roleFilter).toLowerCase()) return false;
                  if (statusFilter) {
                    const isActive = !!u.is_active;
                    if (statusFilter === 'active' && !isActive) return false;
                    if (statusFilter === 'disabled' && isActive) return false;
                  }
                  if (search) {
                    const s = search.toLowerCase();
                    if (!String(u.name).toLowerCase().includes(s) && !String(u.email).toLowerCase().includes(s)) return false;
                  }
                  return true;
                }).map(u => (
                  <UserRow key={u.id} user={u} changeRole={changeRole} deactivate={deactivate} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function UserRow({ user, changeRole, deactivate }) {
  const [localErr, setLocalErr] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  return (
    <tr className="user-row">
      <td className="td-cell">{user.id}</td>
      <td className="td-cell">{user.name}</td>
      <td className="td-cell">{user.email}</td>
      <td className="td-cell">{user.role}</td>
      <td className="td-cell">
        <span className={`status-badge ${user.is_active ? 'active' : 'disabled'}`}>{user.is_active ? 'Active' : 'Disabled'}</span>
      </td>
      <td className="td-cell">
        <div className="actions-cell">
          <select className="role-select" defaultValue={user.role} onChange={async (e)=>{ setSubmitting(true); setLocalErr(null); await changeRole(user.id, e.target.value, setLocalErr); setSubmitting(false); }} disabled={submitting}>
            <option>Citizen</option>
            <option>Official</option>
            <option>Admin</option>
          </select>
          <div className="action-button-wrap">
            <button className="action-button" onClick={async ()=>{ setSubmitting(true); setLocalErr(null); await deactivate(user.id, user.is_active ? false : true, setLocalErr); setSubmitting(false); }} disabled={submitting}>{user.is_active ? 'Deactivate' : 'Activate'}</button>
            <button className="info-btn" aria-label="Why disable?" tabIndex={0}>
              <span className="info-icon" aria-hidden="true">i</span>
              <span className="info-tooltip" role="tooltip">Disabling prevents login and activity</span>
            </button>
          </div>
        </div>
        {localErr && <div className="local-error">{localErr}</div>}
      </td>
    </tr>
  )
}
