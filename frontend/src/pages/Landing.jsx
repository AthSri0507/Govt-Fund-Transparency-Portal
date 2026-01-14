import React from 'react'
import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Government Project Monitor</h1>
      <p>Welcome. View projects, post feedback, and track project budgets.</p>
      <div style={{ marginTop: 16 }}>
        <Link to="/login">Login</Link> · <Link to="/register">Register (Citizen)</Link>
      </div>
    </div>
  )
}
