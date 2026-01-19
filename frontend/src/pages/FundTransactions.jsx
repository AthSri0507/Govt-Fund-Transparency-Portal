import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { getToken } from '../utils/auth'
import './FundTransactions.css'

export default function FundTransactions(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ project_name: '', amount: '' })
  const [err, setErr] = useState(null)

  useEffect(()=>{ load() }, [])

  async function load(){
    setErr(null)
    setLoading(true)
    try{
      const token = getToken()
      const qs = new URLSearchParams(filters)
      const res = await axios.get(`/api/admin/funds?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      setItems(res.data?.data || [])
    }catch(e){ setErr(e.response?.data?.message || e.message) }
    finally{ setLoading(false) }
  }

  // compute mini summary values
  const totalTransactions = items.length
  const totalAmount = items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
  const largest = items.reduce((m, it) => Math.max(m, Number(it.amount) || 0), 0)

  return (
    <div className="fund-page">
      <div className="fund-inner">
        <h2 className="fund-title">Fund Transactions</h2>

        {err && <div className="error-inline">{err}</div>}

        <div className="filter-card">
          <label className="filter-label">Project Name
            <input className="filter-input" placeholder="Project name or part of it" value={filters.project_name} onChange={(e)=>setFilters(f=>({...f, project_name: e.target.value}))} />
          </label>
          <label className="filter-label">Amount (min)
            <input className="filter-input" placeholder="Minimum amount" value={filters.amount} onChange={(e)=>setFilters(f=>({...f, amount: e.target.value}))} />
          </label>
          <button className="filter-button" onClick={load}>Filter</button>
        </div>

        <div className="metrics-row">
          <div className="metric-card">
            <div className="metric-label">Total Transactions</div>
            <div className="metric-value">{totalTransactions}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Total Amount</div>
            <div className="metric-value">₹{totalAmount}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Largest Transaction</div>
            <div className="metric-value">₹{largest}</div>
          </div>
        </div>

        {loading ? <div>Loading...</div> : (
          <div className="table-card">
            <table className="fund-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Project</th>
                  <th>Official</th>
                  <th className="col-amount">Amount</th>
                  <th>Purpose</th>
                  <th className="col-date">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => {
                  const amt = Number(i.amount) || 0
                  const red = amt > 200000
                  const yellow = amt > 50000 && amt <= 200000
                  const rowClass = red ? 'row-critical' : (yellow ? 'row-warning' : '')
                  const amtClass = red ? 'amount-critical' : (yellow ? 'amount-warning' : 'amount-normal')
                  return (
                    <tr key={i.id} className={`fund-row ${rowClass}`}>
                      <td className="td-id">{i.id}</td>
                      <td className="td-project"><a className="proj-link" href={`/projects/${i.project_id}`}>{i.project_name || i.project_id}</a></td>
                      <td className="td-official">{i.official_name || i.official_id}</td>
                      <td className={`td-amount ${amtClass}`}>₹{amt.toLocaleString()}</td>
                      <td className="td-purpose">{i.purpose}</td>
                      <td className="td-date">{i.transaction_date}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
