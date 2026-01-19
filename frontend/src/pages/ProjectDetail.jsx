import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useParams } from 'react-router-dom'
import { getToken, getUser, setUserScopedItem, getUserScopedItem } from '../utils/auth'
import ProjectMap from '../components/ProjectMap'
// Removed duplicate import of React
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'
import './ProjectDetail.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

function BudgetDonut({ total = 0, used = 0, size = 100 }) {
  const remaining = Math.max(0, total - used)
  const usedPct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const r = 40
  const stroke = 12
  const c = 2 * Math.PI * r
  const usedLength = Math.round((usedPct / 100) * c)
  const remainingLength = c - usedLength

  const fmt = n => n.toLocaleString()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <g transform="translate(50,50)">
          <circle r={r} cx="0" cy="0" fill="none" stroke="#e6f4ea" strokeWidth={stroke} />
          <circle r={r} cx="0" cy="0" fill="none" stroke="#ff8a65" strokeWidth={stroke}
            strokeDasharray={`${usedLength} ${remainingLength}`} strokeLinecap="round" transform="rotate(-90)" />
        </g>
      </svg>
      <div style={{ fontSize: 13 }}>
        <div><strong>Used:</strong> <span style={{ color: '#ff8a65' }}>₹{fmt(used)}</span> ({usedPct}%)</div>
        <div><strong>Remaining:</strong> <span style={{ color: '#4caf50' }}>₹{fmt(remaining)}</span></div>
      </div>
    </div>
  )
}

function BudgetSpendChart({ projectId }) {
  const [points, setPoints] = React.useState([])
  React.useEffect(()=>{
    let cancelled = false
    async function load(){
      try{
        const token = localStorage.getItem('accessToken')
        const res = await fetch(`/api/projects/${projectId}/budget-timeseries`, { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (cancelled) return
        const data = json.data || []
        // map to {x: date, y: cumulative}
        setPoints(data.map(d => ({ x: d.date, y: Number(d.cumulative) })))
      }catch(e){
        console.error('budget timeseries load error', e)
      }
    }
    load()
    return ()=>{ cancelled = true }
  }, [projectId])

  if (!points || points.length === 0) return <div style={{ color: '#666' }}>No budget transactions yet.</div>

  const labels = points.map(p => p.x)
  const data = {
    labels,
    datasets: [
      {
        label: 'Cumulative Spent',
        data: points.map(p => p.y),
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25,118,210,0.15)',
        fill: true,
        tension: 0.2,
        pointRadius: 3
      }
    ]
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true }
    }
  }
  return (
    <div style={{ marginTop: 12, height: 160 }}>
      <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Budget Spend Over Time</strong></div>
      <div style={{ height: 120, border: '1px solid #eee', background: '#fff', padding: 8 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  )
}

function toTitleCase(str){
  if (!str) return ''
  return str.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ')
}

/**
 * Generate a natural language summary of citizen sentiment.
 * Uses existing processed sentiment data (counts, topTokens) without displaying any numbers.
 * Returns a human-readable, professional 1-2 sentence summary suitable for government dashboards.
 * Distinguishes between confusion/continuity feedback and quality/satisfaction feedback.
 */
function generateSentimentSummary(summary) {
  if (!summary || !summary.count || summary.count === 0) {
    return 'No citizen feedback has been processed yet.'
  }

  const counts = summary.counts || { positive: 0, neutral: 0, negative: 0 }
  const total = counts.positive + counts.neutral + counts.negative
  if (total === 0) {
    return 'Citizen feedback is currently being processed.'
  }

  const topTokens = (summary.topTokens || []).map(t => t.toLowerCase())
  const topPhrases = (summary.topPhrases || []).map(p => (typeof p === 'string' ? p : p.phrase || '').toLowerCase())
  const allText = [...topTokens, ...topPhrases].join(' ')

  // Confusion / continuity keywords - about progress, status, delays
  const confusionKeywords = ['why', 'stop', 'stopped', 'happened', 'delay', 'status', 'what happened', 'progress', 'continuity', 'unclear', 'confus', 'waiting', 'stalled', 'halted']
  // Quality / satisfaction keywords - about how good/bad the work is
  const qualityKeywords = ['ok', 'okay', 'decent', 'average', 'not great', 'could be better', 'bad', 'good', 'like', 'nice', 'quality', 'work', 'acceptable', 'mediocre', 'satisfactory', 'poor', 'excellent', 'great', 'fine', 'alright']

  // Count keyword matches
  let confusionScore = 0
  let qualityScore = 0
  
  for (const kw of confusionKeywords) {
    if (allText.includes(kw)) confusionScore++
    if (topTokens.some(t => t.includes(kw))) confusionScore++
  }
  for (const kw of qualityKeywords) {
    if (allText.includes(kw)) qualityScore++
    if (topTokens.some(t => t.includes(kw))) qualityScore++
  }

  const isConfusionFocused = confusionScore > qualityScore
  const isQualityFocused = qualityScore > confusionScore
  const isMixedFocus = confusionScore > 0 && qualityScore > 0 && Math.abs(confusionScore - qualityScore) <= 1

  // Determine sentiment category
  const posCount = counts.positive
  const negCount = counts.negative
  const neutCount = counts.neutral

  const hasBothPosAndNeg = posCount > 0 && negCount > 0
  const stronglyNegative = negCount > posCount && negCount > neutCount
  const stronglyPositive = posCount > negCount && posCount > neutCount
  const mostlyNeutral = neutCount >= posCount && neutCount >= negCount && posCount === 0 && negCount === 0
  const limitedEngagement = total <= 3

  // Build the summary based on rules
  let result = ''

  if (limitedEngagement && mostlyNeutral) {
    // Neutral / limited engagement
    result = 'Citizen feedback is limited and largely neutral, with no strong positive or negative trend observed.'
  } else if (hasBothPosAndNeg && !stronglyNegative && !stronglyPositive) {
    // Mixed reactions - determine if quality-focused or confusion-focused
    if (isQualityFocused) {
      // Case A: Quality-focused mixed
      result = 'Citizens show mixed reactions, with many describing the project as acceptable while noting that improvements are needed. Some positive feedback exists, but several comments suggest the quality could be better.'
    } else if (isConfusionFocused) {
      // Case B: Confusion-focused mixed
      result = 'Citizens show mixed reactions, but many express concern and confusion about recent project developments and question its progress.'
    } else if (isMixedFocus) {
      result = 'Citizens show mixed reactions, with some questioning project progress while others comment on the quality of work delivered.'
    } else {
      result = 'Citizens show mixed reactions regarding the project, with varied opinions expressed across the feedback received.'
    }
  } else if (stronglyNegative) {
    // Mostly/strongly negative
    if (isQualityFocused) {
      // Case D: Quality-focused negative
      result = 'Public feedback reflects dissatisfaction, with many citizens feeling the project does not meet expectations.'
    } else if (isConfusionFocused) {
      result = 'Public feedback reflects widespread concern, with many citizens seeking clarification about delays and project status.'
    } else {
      result = 'Public feedback reflects significant dissatisfaction, with many citizens expressing concern about the project\'s current state.'
    }
  } else if (stronglyPositive) {
    // Case C: Mostly positive
    if (negCount > 0) {
      result = 'Citizens are largely satisfied with the project and appreciate its quality, though a few minor concerns remain.'
    } else {
      result = 'Citizens express strong approval of the project, with most comments reflecting satisfaction with the quality and progress.'
    }
  } else if (mostlyNeutral) {
    // Mostly neutral feedback
    if (isQualityFocused) {
      result = 'Citizen feedback is generally neutral, with most describing the project as acceptable without strong praise or criticism.'
    } else {
      result = 'Citizen feedback is largely neutral, with no strong positive or negative sentiment observed at this time.'
    }
  } else {
    // Default fallback for edge cases
    if (isQualityFocused && negCount > 0) {
      result = 'Citizens have shared feedback on project quality, with room for improvement noted in several comments.'
    } else if (isConfusionFocused) {
      result = 'A number of citizens express concern or seek clarification regarding recent project developments.'
    } else {
      result = 'Citizen feedback has been received and reflects a range of perspectives on the project.'
    }
  }

  return result
}

// Render a compact sentiment badge (Positive / Neutral / Negative)
function renderSentimentBadge(summary) {
  if (!summary || !summary.count) return null
  const counts = summary.counts || { positive: 0, neutral: 0, negative: 0 }
  let label = 'Neutral'
  if (counts.positive > counts.negative) label = 'Positive'
  else if (counts.negative > counts.positive) label = 'Negative'

  const color = label === 'Positive' ? '#2e7d32' : label === 'Negative' ? '#d32f2f' : '#616161'
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ background: color, color: '#fff', padding: '4px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
        {label}
      </span>
    </div>
  )
}

export default function ProjectDetail({ initialOpenTimeline = false, forceCitizenView = false }) {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [comments, setComments] = useState([])
  const [timeline, setTimeline] = useState([])
  const [timelineOpen, setTimelineOpen] = useState(initialOpenTimeline)
  const [summary, setSummary] = useState(null)
  const [text, setText] = useState('')
  const [rating, setRating] = useState(5)
  const [err, setErr] = useState(null)
  const [commentSuccess, setCommentSuccess] = useState(null)
  const [commentSort, setCommentSort] = useState('newest')
  const token = getToken()
  const user = getUser()
  const isCitizen = !!(user && String(user.role).toLowerCase() === 'citizen')
  const renderAsCitizen = isCitizen || Boolean(forceCitizenView)

  useEffect(() => {
    async function load() {
      try {
        const [pRes, cRes, sRes, tRes] = await Promise.all([
          axios.get(`/api/projects/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`/api/projects/${id}/comments`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`/api/projects/${id}/sentiment-summary`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null })),
          axios.get(`/api/projects/${id}/timeline`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
        ])
        setProject(pRes.data && pRes.data.data ? pRes.data.data : pRes.data)
        setComments(cRes.data && cRes.data.data ? cRes.data.data : cRes.data || [])
        setSummary(sRes && sRes.data && sRes.data.data ? sRes.data.data : sRes.data)
        // only include project updates and fund transactions in the timeline
        const rawTimeline = (tRes && tRes.data && tRes.data.data ? tRes.data.data : (Array.isArray(tRes && tRes.data) ? tRes.data : []))
        setTimeline(rawTimeline.filter(i => i && (i.type === 'fund_transaction' || i.type === 'project_update')))
        // add to recently viewed (most recent first, unique, keep 3)
        try {
          const cur = JSON.parse(getUserScopedItem('recent_projects') || '[]')
          const entry = { id: pRes.data.data.id, name: pRes.data.data.name }
          const filtered = cur.filter(x=>x.id !== entry.id)
          filtered.unshift(entry)
          const top = filtered.slice(0,5)
          setUserScopedItem('recent_projects', JSON.stringify(top))
        } catch (e) {}
      } catch (e) {
        setErr(e.response?.data?.message || e.message)
      }
    }
    load()
  }, [id])

  async function submit(e) {
    e.preventDefault()
    setErr(null)
    setCommentSuccess(null)
    try {
      await axios.post(`/api/projects/${id}/comments`, { text, rating }, { headers: { Authorization: `Bearer ${token}` } })
      setText('')
      setRating(5)
      const [cRes, sRes] = await Promise.all([
        axios.get(`/api/projects/${id}/comments`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/api/projects/${id}/sentiment-summary`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null }))
      ])
      setComments(cRes.data && cRes.data.data ? cRes.data.data : cRes.data || [])
      setSummary(sRes && sRes.data && sRes.data.data ? sRes.data.data : sRes.data)
      try {
        const [pRef, tRef] = await Promise.all([
          axios.get(`/api/projects/${id}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null })),
          axios.get(`/api/projects/${id}/timeline`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
        ])
        if (pRef && pRef.data && pRef.data.data) setProject(pRef.data.data)
        const rawT = (tRef && tRef.data && tRef.data.data) ? tRef.data.data : (tRef && Array.isArray(tRef.data) ? tRef.data : [])
        if (rawT) setTimeline(rawT.filter(i => i && (i.type === 'fund_transaction' || i.type === 'project_update')))
      } catch (e) {}
      setCommentSuccess('Comment posted')
    } catch (e) {
      setErr(e.response?.data?.message || e.message)
    }
  }

  return (
    <div>
        {!project && <div>Loading project...</div>}
        {project && (
          renderAsCitizen ? (
            <div className="project-detail citizen">
              <div className="card header-card project-header">
                <div className="header-rows">
                  <div className="header-row1" style={{ width: '100%' }}>
                    <h2 className="project-title">{project.name}</h2>
                  </div>

                  <div className="header-row-actions" style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className={`status-badge ${project.status ? project.status.toLowerCase() : ''}`}>{project.status || 'Unknown'}</div>
                    <div className="rating-block">
                      {project.avg_rating !== null && project.avg_rating !== undefined ? (
                        <div className="stars" title={`${Number(project.avg_rating).toFixed(1)} avg`}>{renderStars(Math.round(project.avg_rating))}</div>
                      ) : (
                        <div className="no-rating">No ratings yet</div>
                      )}
                    </div>
                    {summary && renderSentimentBadge(summary)}
                    <div className="follow-wrapper" style={{ marginLeft: 'auto' }}><FollowButton projectId={project.id} /></div>
                  </div>

                  <div className="header-row2" style={{ marginTop: 12, display: 'flex', gap: 20 }}>
                    <div className="meta-block">
                      <div className="meta-label">Department</div>
                      <div className="meta-value">{project.department || '—'}</div>

                      <div className="project-desc-block" style={{ marginTop: 8 }}>
                        <div className="desc-label">Project description</div>
                        <div className="project-desc-text">{project.description}</div>
                      </div>
                    </div>
                    <div className="meta-block">
                      <div className="meta-label">Location</div>
                      <div className="meta-value">{project.state || ''}{project.city ? `, ${project.city}` : ''}{project.area ? `, ${project.area}` : ''}</div>
                    </div>
                  </div>
                </div>

                
              </div>


              {((project.contractor_name) || (project.contractor_company) || (project.contractor_contact)) && (
                <div className="contractor-info">
                  <div className="card-title">Contractor details</div>
                  <div className="contractor-grid">
                    {project.contractor_name && (
                      <>
                        <div className="contractor-label">Name</div>
                        <div className="contractor-value">{project.contractor_name}</div>
                      </>
                    )}
                    {project.contractor_company && (
                      <>
                        <div className="contractor-label">Company</div>
                        <div className="contractor-value">{project.contractor_company}</div>
                      </>
                    )}
                    {project.contractor_contact && (
                      <>
                        <div className="contractor-label">Contact</div>
                        <div className="contractor-value">{project.contractor_contact}</div>
                      </>
                    )}
                    {project.contractor_registration_id && (
                      <>
                        <div className="contractor-label">Reg ID</div>
                        <div className="contractor-value">{project.contractor_registration_id}</div>
                      </>
                    )}
                    {(project.contract_start_date || project.contract_end_date) && (
                      <>
                        <div className="contractor-label">Contract</div>
                        <div className="contractor-value">{project.contract_start_date || '—'} → {project.contract_end_date || '—'}</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="stats-grid">
                <div className="card budget-card">
                  <div className="card-title">Budget</div>
                  <div className="budget-values">
                    <div className="budget-row"><span className="budget-label">Total</span><span className="budget-value">₹{project.budget_total ?? 0}</span></div>
                    <div className="budget-row"><span className="budget-label">Used</span><span className="budget-value">₹{project.budget_used ?? 0}</span></div>
                    <div className="budget-row"><span className="budget-label">Remaining</span><span className="budget-value">₹{(Number(project.budget_total || 0) - Number(project.budget_used || 0)).toFixed(2)}</span></div>
                  </div>
                  <div className="donut-wrap"><BudgetDonut total={Number(project.budget_total || 0)} used={Number(project.budget_used || 0)} size={120} /></div>
                </div>
                <div className="card chart-card">
                  <div className="card-title">Budget Spend Over Time</div>
                  <BudgetSpendChart projectId={project.id} />
                </div>
              </div>



              {project.latitude && project.longitude && (
                <div className="card map-card">
                  <h3 className="map-title">Project Location</h3>
                  <ProjectMap projects={[project]} single={true} />
                </div>
              )}

              <div className="timeline-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
                  <h3 style={{ margin: 0 }}>Timeline</h3>
                  <div>
                    <button className="btn timeline-toggle" onClick={() => setTimelineOpen(o => !o)}>{timelineOpen ? 'Hide' : 'Show'} timeline</button>
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  {!timeline || timeline.length === 0 ? (
                    <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>No timeline events yet.</div>
                  ) : (
                    <div style={{ padding: 0 }}>
                      {/* If closed, show compact preview with most recent event */}
                      {!timelineOpen && (
                        <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
                          {(() => {
                            const item = timeline[0]
                            const color = item.type === 'fund_transaction' ? '#2e7d32' : item.type === 'project_update' ? '#1976d2' : item.type === 'comment' ? '#ef6c00' : '#9e9e9e'
                            const typeClass = item.type === 'fund_transaction' ? 'fund' : item.type === 'project_update' ? 'update' : 'comment'
                            return (
                              <div className={`timeline-preview ${typeClass}`}>
                                <div className="timeline-preview-dot" style={{ background: color }} />
                                <div style={{ fontSize: 13 }}>
                                  <div style={{ fontWeight: 600 }}>{item.type === 'project_update' ? 'Update' : item.type === 'fund_transaction' ? 'Fund' : 'Comment'}</div>
                                  <div style={{ color: '#444' }}>{item.type === 'fund_transaction' ? `₹${item.amount} — ${item.purpose}` : item.type === 'project_update' ? (item.update_text || item.text) : item.text}</div>
                                  <div style={{ fontSize: 12, color: '#666' }}>{new Date(item.occurred_at || item.created_at).toLocaleString()}</div>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      {/* Expanded timeline */}
                      {timelineOpen && (
                        <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>
                          <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                            {timeline.map(item => {
                              const color = item.type === 'fund_transaction' ? '#2e7d32' : item.type === 'project_update' ? '#1976d2' : item.type === 'comment' ? '#ef6c00' : '#9e9e9e'
                              const typeClass = item.type === 'fund_transaction' ? 'fund' : item.type === 'project_update' ? 'update' : 'comment'
                              return (
                                <li key={`${item.type}-${item.id}`} className={`timeline-row ${typeClass}`} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                  <div style={{ width: 18, display: 'flex', justifyContent: 'center' }}>
                                    <div style={{ width: 12, height: 12, borderRadius: 6, background: color, marginTop: 6 }} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                      <div>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.type === 'project_update' ? 'Official update' : item.type === 'fund_transaction' ? 'Fund transaction' : 'Comment'}</div>
                                        <div style={{ color: '#222' }}>{item.type === 'fund_transaction' ? `₹${item.amount} — ${item.purpose}` : item.type === 'project_update' ? (item.update_text || item.text) : item.text}</div>
                                      </div>
                                      <div style={{ fontSize: 12, color: '#666', minWidth: 150, textAlign: 'right' }}>{new Date(item.occurred_at || item.created_at).toLocaleString()}</div>
                                    </div>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="card comments-card">
                <div className="comments-header"><h3>What citizens say</h3></div>
                <div className="sentiment-block">
                  {(summary && summary.count > 0) ? (
                    <div className="sentiment-summary-natural">
                      <p style={{ margin: 0, lineHeight: 1.6, color: '#333' }}>{generateSentimentSummary(summary)}</p>
                    </div>
                  ) : (
                    <div className="sentiment-summary-natural">
                      <p style={{ margin: 0, lineHeight: 1.6, color: '#666', fontStyle: 'italic' }}>No citizen feedback has been processed yet.</p>
                    </div>
                  )}
                </div>

                {err && <div className="error">{err}</div>}
                {user && String(user.role).toLowerCase() === 'citizen' && (
                  <form onSubmit={submit} className="comment-form">
                    <textarea value={text} onChange={e=>setText(e.target.value)} rows={3} className="comment-input" placeholder="Share your opinion!" />
                    <div className="comment-actions">
                      <label className="rating-label">Rating: <StarInput value={rating} onChange={setRating} /></label>
                      <button type="submit" className="btn" disabled={!text || text.trim().length === 0}>Post comment</button>
                      {commentSuccess && <div className="success">{commentSuccess}</div>}
                    </div>
                  </form>
                )}

                <div className="comments-list">
                  {(comments || []).slice().sort((a,b)=>{
                    if (commentSort === 'rating') return (b.rating||0) - (a.rating||0)
                    return new Date(b.created_at) - new Date(a.created_at)
                  }).map(c => (
                    <div key={c.id} className="comment-row">
                      <div className="comment-left">
                        <div className="comment-author">{(() => {
                          const authorFromComment = (c.user && (c.user.name || c.user.email)) || c.user_name || c.user_email
                          if (authorFromComment) return authorFromComment
                          if (c.user_id && user && String(c.user_id) === String(user.id)) return user.name || user.email
                          return 'Citizen'
                        })()}</div>
                        <div className="comment-text">{c.text}</div>
                      </div>
                      <div className="comment-right">
                        <div className="comment-stars">{renderStars(Math.round(c.rating||0))}</div>
                        <div className="comment-time">{new Date(c.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h2>{project.name}</h2>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {project.avg_rating !== null && project.avg_rating !== undefined ? (
                    <div className="stars" title={`${Number(project.avg_rating).toFixed(1)} avg`}>
                      {renderStars(Math.round(project.avg_rating))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#666' }}>No ratings yet</div>
                  )}
                  <div style={{ marginLeft: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {summary && summary.count ? (
                      renderSentimentBadge(summary)
                    ) : (
                      <div style={{ fontSize: 12, color: '#666', marginLeft: 6 }}>Waiting for processing</div>
                    )}
                  </div>
                </div>
                <div style={{ marginLeft: 12 }}>
                  <FollowButton projectId={project.id} />
                </div>
              </div>

              <div style={{ marginTop: 6 }}>
                <p style={{ margin: 0 }}>
                  <strong>Status:</strong>{' '}
                  <span style={{
                    color: project.status === 'Active' ? 'green' : project.status === 'Halted' ? 'orange' : 'red'
                  }}>{project.status || 'Unknown'}</span>
                </p>
                {user && user.role && user.role.toLowerCase() === 'official' && (
                  <div style={{ marginTop: 8 }}>
                    <label>
                      Change Status:{' '}
                      <select value={project.status || 'Active'} onChange={async (e) => {
                        const newStatus = e.target.value
                        try {
                          const token = getToken()
                          await axios.put(`/api/projects/${project.id}/status`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } })
                          setProject({ ...project, status: newStatus })
                        } catch (err) {
                          console.error('status change failed', err)
                          alert('Failed to update status')
                        }
                      }}>
                        <option value="Active">Active</option>
                        <option value="Halted">Halted</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 8 }}>{project.description}</div>

              <div style={{ marginTop: 8 }}>
                <strong>Department:</strong> {project.department || '—'}
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>Location:</strong> {project.state || ''}{project.city ? `, ${project.city}` : ''}{project.area ? `, ${project.area}` : ''}
              </div>

              {((project.contractor_name) || (project.contractor_company) || (project.contractor_contact)) && (
                <div style={{ marginTop: 8, padding: 12, border: '1px solid #eee', borderRadius: 8, background: '#fafafa' }}>
                  <strong>Contractor</strong>
                  <div style={{ marginTop: 6 }}>
                    {project.contractor_name && <div>Name: {project.contractor_name}</div>}
                    {project.contractor_company && <div>Company: {project.contractor_company}</div>}
                    {project.contractor_contact && <div>Contact: {project.contractor_contact}</div>}
                    {project.contractor_registration_id && <div>Registration ID: {project.contractor_registration_id}</div>}
                    {project.contract_start_date && <div>Contract Start: {project.contract_start_date}</div>}
                    {project.contract_end_date && <div>Contract End: {project.contract_end_date}</div>}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 10, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#fff', minWidth: 260 }}>
                  <div style={{ marginBottom: 8 }}><strong>Budget</strong></div>
                  <div>Total: ₹{project.budget_total ?? 0}</div>
                  <div>Used: ₹{project.budget_used ?? 0}</div>
                  <div>Remaining: ₹{(Number(project.budget_total || 0) - Number(project.budget_used || 0)).toFixed(2)}</div>
                  <div style={{ marginTop: 12 }}>
                    <BudgetDonut total={Number(project.budget_total || 0)} used={Number(project.budget_used || 0)} />
                  </div>
                </div>
                <div style={{ flex: 1, padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
                  <BudgetSpendChart projectId={project.id} />
                </div>
              </div>

              {project.latitude && project.longitude && (
                <div style={{ marginTop: 20, padding: 12, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
                  <h3 style={{ marginTop: 0 }}>Project Location</h3>
                  <ProjectMap projects={[project]} single={true} />
                </div>
              )}

              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
                  <h3 style={{ margin: 0 }}>Timeline</h3>
                  <div>
                    <button onClick={() => setTimelineOpen(o => !o)} style={{ padding: '6px 10px' }}>{timelineOpen ? 'Hide' : 'Show'} timeline</button>
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  {!timeline || timeline.length === 0 ? (
                    <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>No timeline events yet.</div>
                  ) : (
                    <div style={{ padding: 0 }}>
                      {/* If closed, show compact preview with most recent event */}
                      {!timelineOpen && (
                        <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
                          {(() => {
                            const item = timeline[0]
                            const color = item.type === 'fund_transaction' ? '#2e7d32' : item.type === 'project_update' ? '#1976d2' : item.type === 'comment' ? '#ef6c00' : '#9e9e9e'
                            const typeClass = item.type === 'fund_transaction' ? 'fund' : item.type === 'project_update' ? 'update' : 'comment'
                            return (
                              <div className={`timeline-preview ${typeClass}`}>
                                <div className="timeline-preview-dot" style={{ background: color }} />
                                <div style={{ fontSize: 13 }}>
                                  <div style={{ fontWeight: 600 }}>{item.type === 'project_update' ? 'Update' : item.type === 'fund_transaction' ? 'Fund' : 'Comment'}</div>
                                  <div style={{ color: '#444' }}>{item.type === 'fund_transaction' ? `₹${item.amount} — ${item.purpose}` : item.type === 'project_update' ? (item.update_text || item.text) : item.text}</div>
                                  <div style={{ fontSize: 12, color: '#666' }}>{new Date(item.occurred_at || item.created_at).toLocaleString()}</div>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      {/* Expanded timeline */}
                      {timelineOpen && (
                        <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>
                          <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                            {timeline.map(item => {
                              const color = item.type === 'fund_transaction' ? '#2e7d32' : item.type === 'project_update' ? '#1976d2' : item.type === 'comment' ? '#ef6c00' : '#9e9e9e'
                              const typeClass = item.type === 'fund_transaction' ? 'fund' : item.type === 'project_update' ? 'update' : 'comment'
                              return (
                                <li key={`${item.type}-${item.id}`} className={`timeline-row ${typeClass}`} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                  <div style={{ width: 18, display: 'flex', justifyContent: 'center' }}>
                                    <div style={{ width: 12, height: 12, borderRadius: 6, background: color, marginTop: 6 }} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                      <div>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.type === 'project_update' ? 'Official update' : item.type === 'fund_transaction' ? 'Fund transaction' : 'Comment'}</div>
                                        <div style={{ color: '#222' }}>{item.type === 'fund_transaction' ? `₹${item.amount} — ${item.purpose}` : item.type === 'project_update' ? (item.update_text || item.text) : item.text}</div>
                                      </div>
                                      <div style={{ fontSize: 12, color: '#666', minWidth: 150, textAlign: 'right' }}>{new Date(item.occurred_at || item.created_at).toLocaleString()}</div>
                                    </div>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <section style={{ marginTop: 16 }}>
                <h3>Citizen Sentiment Overview</h3>
                {summary && summary.count > 0 ? (
                  <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 6, borderLeft: '4px solid #1976d2' }}>
                    <p style={{ margin: 0, lineHeight: 1.7, color: '#333' }}>{generateSentimentSummary(summary)}</p>
                  </div>
                ) : (
                  <div style={{ color: '#666', fontStyle: 'italic' }}>No citizen feedback has been processed yet.</div>
                )}
              </section>

              <section style={{ marginTop: 16 }}>
                {(!user || (user.role && user.role.toLowerCase() !== 'official' && user.role.toLowerCase() !== 'admin')) && (
                  <h3>Comments</h3>
                )}
                {err && <div style={{ color: 'red' }}>{err}</div>}
                {/* Only citizens can post comments; hide form for officials/admins */}
                {(!user || (user.role && user.role.toLowerCase() !== 'official' && user.role.toLowerCase() !== 'admin')) && (
                  <form onSubmit={submit} style={{ marginBottom: 12 }}>
                    <div>
                      <textarea value={text} onChange={e=>setText(e.target.value)} rows={3} cols={60} placeholder="Share your opinion!" />
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div>
                        <label className="rating-label">Rating: <StarInput value={rating} onChange={setRating} /></label>
                      </div>
                      <div>
                        <button type="submit" disabled={!text || text.trim().length === 0}>Post comment</button>
                      </div>
                      {commentSuccess && <div style={{ color: 'green' }}>{commentSuccess}</div>}
                    </div>
                  </form>
                )}
                <div style={{ marginTop: 8, marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <label>Sort: <select value={commentSort} onChange={e=>setCommentSort(e.target.value)}><option value="newest">Newest</option><option value="rating">Highest rating</option></select></label>
                </div>
                {(!comments || comments.length === 0) ? (
                  <div style={{ color: '#666' }}>Be the first to comment</div>
                ) : (
                  <ul>
                    {(comments || []).slice().sort((a,b)=>{
                      if (commentSort === 'rating') return (b.rating||0) - (a.rating||0)
                      return new Date(b.created_at) - new Date(a.created_at)
                    }).map(c => (
                      <li key={c.id} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {(() => {
                                const authorFromComment = (c.user && (c.user.name || c.user.email)) || c.user_name || c.user_email
                                if (authorFromComment) return authorFromComment
                                if (c.user_id && user && String(c.user_id) === String(user.id)) return user.name || user.email
                                return 'Citizen'
                              })()}
                            </div>
                            <div>{c.text}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div>{renderStars(Math.round(c.rating||0))}</div>
                            <div style={{ fontSize: 12, color: '#666' }}>{new Date(c.created_at).toLocaleString()}</div>
                          </div>
                        </div>
                        {c.sentiment_summary_cached && (()=>{
                          let s = c.sentiment_summary_cached
                          if (typeof s === 'string') { try { s = JSON.parse(s) } catch(e){} }
                          const score = s && typeof s.score === 'number' ? s.score : null
                          const label = score === null ? null : (score > 0 ? 'Positive' : score < 0 ? 'Negative' : 'Neutral')
                          return label ? <div style={{ marginTop: 6 }}><span style={{ padding: '2px 6px', background: '#f0f0f0', borderRadius: 6 }}>{label}</span></div> : null
                        })()}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )
        )}

        
      </div>
    )
}

function renderStars(n) {
  const stars = []
  for (let i=0;i<5;i++) stars.push(<span key={i} style={{ color: i < n ? '#fbc02d' : '#e0e0e0' }}>★</span>)
  return <span>{stars}</span>
}

function StarInput({ value, onChange }){
  const [hover, setHover] = useState(0)
  const stars = []
  for (let i=1;i<=5;i++){
    const active = hover ? i <= hover : i <= (value||0)
    stars.push(
      <button
        key={i}
        type="button"
        className={"star" + (active ? ' on' : '')}
        onClick={() => onChange(i)}
        onMouseEnter={() => setHover(i)}
        onMouseLeave={() => setHover(0)}
        onFocus={() => setHover(i)}
        onBlur={() => setHover(0)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(i); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); setHover(Math.max(1, (hover||value) - 1)); }
          if (e.key === 'ArrowRight') { e.preventDefault(); setHover(Math.min(5, (hover||value) + 1)); }
        }}
        aria-label={i + ' star'}
      >
        ★
      </button>
    )
  }
  return <div className="star-input" role="radiogroup" aria-label="Rating">{stars}</div>
}

function FollowButton({ projectId }){
  const [followed, setFollowed] = useState(false)
  const [saving, setSaving] = useState(false)
  const user = getUser()

  // Hide follow button for Officials and Admins
  if (user && user.role) {
    const r = String(user.role).toLowerCase()
    if (r === 'official' || r === 'admin') return null
  }

  useEffect(()=>{
    try{
      const f = JSON.parse(getUserScopedItem('followed_projects') || '[]')
      setFollowed(f.includes(projectId))
    }catch(e){ setFollowed(false) }
  }, [projectId])

  async function toggle(){
    setSaving(true)
    try{
      const cur = JSON.parse(getUserScopedItem('followed_projects') || '[]')
      const s = new Set(cur)
      if (s.has(projectId)) s.delete(projectId)
      else s.add(projectId)
      const arr = Array.from(s)
      setUserScopedItem('followed_projects', JSON.stringify(arr))
      setFollowed(s.has(projectId))
    }catch(e){ console.error(e) }
    setSaving(false)
  }

  return (
    <button className="follow-btn" onClick={toggle} disabled={saving}>{followed ? '★ Unfollow' : '☆ Follow project'}</button>
  )
}
