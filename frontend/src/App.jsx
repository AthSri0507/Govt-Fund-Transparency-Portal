import React from 'react'
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import siteLogo from './assets/logo.png'
import Header from './components/Header'
import Login from './pages/Login'
import Register from './pages/Register'
import Landing from './pages/Landing'
import Home from './pages/Home'
import ProjectDetail from './pages/ProjectDetail'
import ProjectTimeline from './pages/ProjectTimeline'
import DashboardCitizen from './pages/DashboardCitizen'
import MyComments from './pages/MyComments'
import OfficialHome from './pages/OfficialHome'
import CreateProject from './pages/CreateProject'
import EditProject from './pages/EditProject'
import OfficialProjectView from './pages/OfficialProjectView'
import ManageProjects from './pages/ManageProjects'
import DashboardAdmin from './pages/DashboardAdmin'
import UsersAdmin from './pages/UsersAdmin'
import AuditLogs from './pages/AuditLogs'
import FundTransactions from './pages/FundTransactions'
import AdminDeletedProjects from './pages/AdminDeletedProjects'
import AdminProjects from './pages/AdminProjects'
import AdminFlaggedProjects from './pages/AdminFlaggedProjects'
import AdminLayout from './layouts/AdminLayout'
import { getToken, getUser, clearAll } from './utils/auth'

function Protected({ children, allowedRoles }) {
  const token = getToken();
  const user = getUser();
  if (!token) return <Navigate to="/login" replace />;
  if (allowedRoles && allowedRoles.length && (!user || !user.role || !allowedRoles.map(r=>r.toLowerCase()).includes(String(user.role).toLowerCase()))) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const navigate = useNavigate();
  const user = getUser();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/dashboard/admin') || location.pathname.startsWith('/admin/');

  function handleLogout() {
    clearAll();
    navigate('/');
  }

  return (
    <div>
      {!isAdminRoute && (
        <Header variant={(location.pathname.startsWith('/login') || location.pathname.startsWith('/register') || location.pathname.startsWith('/forgot')) ? 'auth' : 'landing'} />
      )}
      <main style={{ padding: 16 }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Landing />} />
          <Route path="/projects" element={<Protected><Home /></Protected>} />
          <Route path="/projects/:id" element={<Protected><ProjectDetail /></Protected>} />
          <Route path="/projects/:id/timeline" element={<Protected><ProjectTimeline /></Protected>} />
          <Route path="/dashboard/citizen" element={<Protected allowedRoles={["Citizen"]}><DashboardCitizen /></Protected>} />
          <Route path="/citizen/projects" element={<Protected allowedRoles={["Citizen"]}><Home /></Protected>} />
          <Route path="/citizen/comments" element={<Protected allowedRoles={["Citizen"]}><MyComments /></Protected>} />
          <Route path="/dashboard/official" element={<Protected allowedRoles={["Official"]}><OfficialHome /></Protected>} />
          <Route path="/dashboard/official/create" element={<Protected allowedRoles={["Official"]}><CreateProject /></Protected>} />
          <Route path="/dashboard/official/projects/:id/edit" element={<Protected allowedRoles={["Official"]}><EditProject /></Protected>} />
          <Route path="/dashboard/official/projects/:id/view" element={<Protected allowedRoles={["Official"]}><OfficialProjectView /></Protected>} />
          <Route path="/dashboard/official/projects" element={<Protected allowedRoles={["Official"]}><ManageProjects /></Protected>} />
          <Route path="/dashboard/admin" element={<Protected allowedRoles={["Admin"]}><AdminLayout><DashboardAdmin /></AdminLayout></Protected>} />
          <Route path="/dashboard/admin/projects" element={<Protected allowedRoles={["Admin"]}><AdminLayout><AdminProjects /></AdminLayout></Protected>} />
          <Route path="/dashboard/admin/flagged" element={<Protected allowedRoles={["Admin"]}><AdminLayout><AdminFlaggedProjects /></AdminLayout></Protected>} />
          <Route path="/users" element={<Protected allowedRoles={["Admin"]}><AdminLayout><UsersAdmin /></AdminLayout></Protected>} />
          <Route path="/admin/audit-logs" element={<Protected allowedRoles={["Admin"]}><AdminLayout><AuditLogs /></AdminLayout></Protected>} />
          <Route path="/admin/funds" element={<Protected allowedRoles={["Admin"]}><AdminLayout><FundTransactions /></AdminLayout></Protected>} />
          <Route path="/admin/deleted-projects" element={<Protected allowedRoles={["Admin"]}><AdminLayout><AdminDeletedProjects /></AdminLayout></Protected>} />
        </Routes>
      </main>
    </div>
  )
}
