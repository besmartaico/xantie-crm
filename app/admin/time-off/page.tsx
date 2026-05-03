// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const inp = { width:'100%', background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'16px', outline:'none', boxSizing:'border-box', colorScheme:'dark' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }

function formatDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}

function dayCount(start, end) {
  if (!start || !end) return 0
  return Math.round((new Date(end) - new Date(start)) / 86400000) + 1
}

function StatusBadge({ status }) {
  const map = {
    pending: { bg:'rgba(245,158,11,0.1)', color:'#f59e0b', label:'Pending' },
    approved: { bg:'rgba(141,198,63,0.1)', color:'#8DC63F', label:'Approved' },
    denied: { bg:'rgba(248,113,113,0.1)', color:'#f87171', label:'Denied' },
  }
  const s = map[status] || map.pending
  return <span style={{background:s.bg,color:s.color,padding:'2px 10px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>{s.label}</span>
}

export default function TimeOffPage() {
  const [currentUser, setCurrentUser] = useState({})
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(currentUser.role==='viewer' ? 'all' : 'request') // 'request' | 'history' | 'all' (admin)

  // Form
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Admin status update
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u)
    load()
  }, [])

  async function load() {
    setLoading(true)
    try { setRequests(await (await fetch('/api/time-off')).json()) } catch(e) {}
    setLoading(false)
  }

  async function submit() {
    if (!startDate || !endDate) { setError('Please select both start and end dates.'); return }
    if (endDate < startDate) { setError('End date must be on or after start date.'); return }
    setSubmitting(true); setError('')
    try {
      const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
      const res = await fetch('/api/time-off', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name: u.name, email: u.email, startDate, endDate, notes })
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true); setStartDate(''); setEndDate(''); setNotes('')
        load()
      } else setError(data.error || 'Failed to submit.')
    } catch(e) { setError('Network error.') }
    setSubmitting(false)
  }

  async function updateStatus(req, status) {
    setUpdating(req.id)
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    try {
      await fetch('/api/time-off', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'update_status', id: req.id, status, reviewedBy: u.name||u.email })
      })
      setRequests(prev => prev.map(r => r.id===req.id ? {...r, status, reviewedBy: u.name||u.email} : r))
    } catch(e) {}
    setUpdating(null)
  }

  const isAdmin = currentUser.role === 'admin'
  const isViewer = currentUser.role === 'viewer'
  const myRequests = requests.filter(r => r.email === currentUser.email)
  const allRequests = [...requests].sort((a,b) => b.submittedAt.localeCompare(a.submittedAt))
  const days = dayCount(startDate, endDate)

  const thS = { textAlign:'left', padding:'10px 16px', fontSize:'11px', fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.07em', background:'#111111', borderBottom:'1px solid #1e1e1e', whiteSpace:'nowrap' }
  const tdS = { padding:'12px 16px', fontSize:'13px', color:'#d1d5db', borderBottom:'1px solid #1a1a1a', verticalAlign:'middle' }

  return (
    <div>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Time Off</h1>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Submit and track time off requests</p>
      </div>

      {/* Tab switcher */}
      <div style={{display:'flex',gap:'0',marginBottom:'24px',background:'#0a0a0a',borderRadius:'10px',padding:'4px',width:'fit-content',border:'1px solid #1e1e1e'}}>
        <button onClick={()=>setTab('request')} style={{padding:'9px 18px',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:600,cursor:'pointer',background:tab==='request'?'#8DC63F':'transparent',color:tab==='request'?'#0a0a0a':'#6b7280'}}>
          {!isViewer && 'Request Time Off'}{isViewer && 'Time Off Requests'}
        </button>
        <button onClick={()=>{setTab('history');setSubmitted(false)}} style={{padding:'9px 18px',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:600,cursor:'pointer',background:tab==='history'?'#8DC63F':'transparent',color:tab==='history'?'#0a0a0a':'#6b7280'}}>
          My Requests {myRequests.length>0&&<span style={{marginLeft:'4px',background:'rgba(0,0,0,0.2)',borderRadius:'8px',padding:'1px 6px',fontSize:'11px'}}>{myRequests.length}</span>}
        </button>
        {(isAdmin || isViewer) && (
          <button onClick={()=>setTab('all')} style={{padding:'9px 18px',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:600,cursor:'pointer',background:tab==='all'?'#8DC63F':'transparent',color:tab==='all'?'#0a0a0a':'#6b7280'}}>
            All Requests {allRequests.filter(r=>r.status==='pending').length>0&&<span style={{marginLeft:'4px',background:'rgba(245,158,11,0.25)',color:'#f59e0b',borderRadius:'8px',padding:'1px 6px',fontSize:'11px'}}>{allRequests.filter(r=>r.status==='pending').length}</span>}
          </button>
        )}
      </div>

      {/* ===== REQUEST FORM ===== */}
      {tab === 'request' && !isViewer && (
        <div style={{maxWidth:'520px'}}>
          {submitted ? (
            <div style={{background:'#141414',border:'1px solid rgba(141,198,63,0.3)',borderRadius:'16px',padding:'40px',textAlign:'center'}}>
              <div style={{fontSize:'44px',marginBottom:'14px'}}>✅</div>
              <h2 style={{margin:'0 0 10px',fontSize:'20px'}}>Request Submitted</h2>
              <p style={{color:'#9ca3af',fontSize:'14px',margin:'0 0 24px'}}>Jeff and Jared have been notified. You'll hear back soon.</p>
              <button onClick={()=>setSubmitted(false)} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'11px 24px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
                Submit Another Request
              </button>
            </div>
          ) : (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'16px',padding:'28px'}}>
              <h2 style={{margin:'0 0 24px',fontSize:'17px',fontWeight:700}}>New Time Off Request</h2>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
                <div>
                  <label style={lbl}>Start Date <span style={{color:'#f87171'}}>*</span></label>
                  <input type="date" value={startDate} onChange={e=>{ setStartDate(e.target.value); if(endDate&&e.target.value>endDate) setEndDate(e.target.value) }} style={inp}/>
                </div>
                <div>
                  <label style={lbl}>End Date <span style={{color:'#f87171'}}>*</span></label>
                  <input type="date" value={endDate} min={startDate} onChange={e=>setEndDate(e.target.value)} style={inp}/>
                </div>
              </div>

              {startDate && endDate && (
                <div style={{background:'rgba(141,198,63,0.08)',border:'1px solid rgba(141,198,63,0.2)',borderRadius:'8px',padding:'10px 16px',marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px'}}>
                  <span style={{fontSize:'20px'}}>📅</span>
                  <span style={{fontSize:'14px',color:'#8DC63F',fontWeight:600}}>
                    {days} day{days!==1?'s':''} — {formatDate(startDate)}{startDate!==endDate?' to '+formatDate(endDate):''}
                  </span>
                </div>
              )}

              <div style={{marginBottom:'24px'}}>
                <label style={lbl}>Notes <span style={{color:'#4b5563'}}>(optional)</span></label>
                <textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Vacation, personal day, medical appointment..." style={{...inp,resize:'vertical',fontSize:'14px'}}/>
              </div>

              {error && <div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}

              <button onClick={submit} disabled={submitting||!startDate||!endDate}
                style={{width:'100%',background:(!startDate||!endDate)?'#2a2a2a':'#8DC63F',color:(!startDate||!endDate)?'#4b5563':'#0a0a0a',border:'none',borderRadius:'8px',padding:'13px',fontSize:'15px',fontWeight:800,cursor:(!startDate||!endDate)?'not-allowed':'pointer',transition:'all 0.15s'}}>
                {submitting?'Submitting...':'Submit Request'}
              </button>
              <p style={{margin:'10px 0 0',fontSize:'12px',color:'#4b5563',textAlign:'center'}}>
                An email will be sent to Jeff and Jared for review.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===== MY REQUESTS ===== */}
      {tab === 'history' && (
        <div>
          {loading && <div style={{color:'#6b7280',padding:'32px',textAlign:'center'}}>Loading...</div>}
          {!loading && myRequests.length===0 && (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'56px',textAlign:'center'}}>
              <div style={{fontSize:'36px',marginBottom:'12px'}}>📭</div>
              <p style={{color:'#6b7280',margin:0}}>You haven't submitted any time off requests yet.</p>
            </div>
          )}
          {!loading && myRequests.length>0 && (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>
                  {['Dates','Duration','Notes','Status','Submitted'].map(h=><th key={h} style={thS}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {myRequests.map(r=>(
                    <tr key={r.id} onMouseEnter={e=>e.currentTarget.style.background='#181818'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={tdS}>
                        <div style={{fontWeight:600,color:'#fff'}}>{formatDate(r.startDate)}</div>
                        {r.startDate!==r.endDate&&<div style={{fontSize:'12px',color:'#6b7280'}}>to {formatDate(r.endDate)}</div>}
                      </td>
                      <td style={tdS}><span style={{color:'#8DC63F',fontWeight:600}}>{dayCount(r.startDate,r.endDate)}d</span></td>
                      <td style={{...tdS,color:'#9ca3af',maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.notes||'—'}</td>
                      <td style={tdS}><StatusBadge status={r.status}/></td>
                      <td style={{...tdS,fontSize:'12px',color:'#6b7280'}}>{r.submittedAt?new Date(r.submittedAt).toLocaleDateString():'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== ALL REQUESTS (admin) ===== */}
      {tab === 'all' && isAdmin && (
        <div>
          {loading && <div style={{color:'#6b7280',padding:'32px',textAlign:'center'}}>Loading...</div>}
          {!loading && allRequests.length===0 && (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'56px',textAlign:'center'}}>
              <div style={{fontSize:'36px',marginBottom:'12px'}}>📭</div>
              <p style={{color:'#6b7280',margin:0}}>No time off requests yet.</p>
            </div>
          )}
          {!loading && allRequests.length>0 && (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:'700px'}}>
                <thead><tr>
                  {['Employee','Dates','Duration','Notes','Status','Actions'].map(h=><th key={h} style={thS}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {allRequests.map(r=>(
                    <tr key={r.id} onMouseEnter={e=>e.currentTarget.style.background='#181818'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={tdS}>
                        <div style={{fontWeight:500,color:'#fff'}}>{r.name}</div>
                        <div style={{fontSize:'11px',color:'#6b7280'}}>{r.email}</div>
                      </td>
                      <td style={tdS}>
                        <div style={{fontWeight:600,color:'#fff'}}>{formatDate(r.startDate)}</div>
                        {r.startDate!==r.endDate&&<div style={{fontSize:'12px',color:'#6b7280'}}>to {formatDate(r.endDate)}</div>}
                      </td>
                      <td style={tdS}><span style={{color:'#8DC63F',fontWeight:600}}>{dayCount(r.startDate,r.endDate)}d</span></td>
                      <td style={{...tdS,color:'#9ca3af',maxWidth:'180px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.notes||'—'}</td>
                      <td style={tdS}><StatusBadge status={r.status}/></td>
                      <td style={{...tdS,minWidth:'160px'}}>
                        {r.status==='pending' ? (
                          <div style={{display:'flex',gap:'6px'}}>
                            <button onClick={()=>updateStatus(r,'approved')} disabled={updating===r.id}
                              style={{background:'rgba(141,198,63,0.1)',border:'1px solid rgba(141,198,63,0.3)',color:'#8DC63F',borderRadius:'6px',padding:'5px 12px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
                              {updating===r.id?'…':'Approve'}
                            </button>
                            <button onClick={()=>updateStatus(r,'denied')} disabled={updating===r.id}
                              style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.2)',color:'#f87171',borderRadius:'6px',padding:'5px 12px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
                              Deny
                            </button>
                          </div>
                        ) : (
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <StatusBadge status={r.status}/>
                            <button onClick={()=>updateStatus(r,'pending')} style={{background:'none',border:'none',color:'#4b5563',fontSize:'11px',cursor:'pointer',padding:0}}>Reset</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}