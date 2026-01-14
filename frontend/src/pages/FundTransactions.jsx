import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { getToken } from '../utils/auth'

export default function FundTransactions(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ project_id: '', official_id: '' })
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
    <div>
      <h2>Fund Transactions</h2>
      <div style={{ marginBottom: 8 }}>
        <label style={{ marginRight: 8 }}>Project ID: <input value={filters.project_id} onChange={(e)=>setFilters(f=>({...f, project_id: e.target.value}))} /></label>
        <label style={{ marginRight: 8 }}>Official ID: <input value={filters.official_id} onChange={(e)=>setFilters(f=>({...f, official_id: e.target.value}))} /></label>
        <button onClick={load}>Filter</button>
      </div>
      {err && <div style={{ color: 'red' }}>{err}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>Total Transactions<br/><strong>{totalTransactions}</strong></div>
        <div style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>Total Amount<br/><strong>₹{totalAmount}</strong></div>
        <div style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>Largest Transaction<br/><strong>₹{largest}</strong></div>
      </div>

      {loading ? <div>Loading...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th>ID</th><th>Project</th><th>Official</th><th>Amount</th><th>Purpose</th><th>Date</th></tr>
          </thead>
          <tbody>
            {items.map(i => {
              const amt = Number(i.amount) || 0
              const red = amt > 200000
              const yellow = amt > 50000 && amt <= 200000
              const bg = red ? '#ffe6e6' : (yellow ? '#fff6e6' : 'transparent')
              return (
                <tr key={i.id} style={{ borderTop: '1px solid #eee', background: bg }}>
                  <td style={{ padding: 8 }}>{i.id}</td>
                  <td style={{ padding: 8 }}><a href={`/projects/${i.project_id}`}>{i.project_name || i.project_id}</a></td>
                  <td style={{ padding: 8 }}>{i.official_name || i.official_id}</td>
                  <td style={{ padding: 8 }}>{amt} {red ? '🟥' : (yellow ? '🟨' : '')}</td>
                  <td style={{ padding: 8 }}>{i.purpose}</td>
                  <td style={{ padding: 8 }}>{i.transaction_date}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
