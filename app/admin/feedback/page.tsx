// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const inp = { width:'100%', background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'14px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }
const selSty = { background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'14px', cursor:'pointer', outline:'none', width:'100%' }

function TypeBadge({ type }) {
  return type === 'bug'
    ? <span style={{background:'rgba(248,113,113,0.1)',color:'#f87171',padding:'2px 9px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>🐛 Bug</span>
    : <span style={{background:'rgba(141,198,63,0.1)',color:'#8DC63F',padding:'2px 9px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>✨ Feature</span>
}

function PriorityBadge({ priority }) {
  const map = {
    low: { color:'#6b7280', bg:'rgba(107,114,128,0.1)', label:'Low' },
    medium: { color:'#f59e0b', bg:'rgba(245,158,11,0.1)', label:'Medium' },
    high: { color:'#f87171', bg:'rgba(248,113,113,0.1)', label:'High' },
  }
  const s = map[priority] || map.medium
  return <span style={{background:s.bg,color:s.color,padding:'2px 9px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>{s.label}</span>
}

function StatusBadge({ status }) {
  const map = {
    open: { color:'#f59e0b', bg:'rgba(245,158,11,0.1)', label:'Open' },
    'in-progress': { color:'#60a5fa', bg:'rgba(96,165,250,0.1)', label:'In Progress' },
    done: { color:'#8DC63F', bg:'rgba(141,198,63,0.1)', label:'Done' },
    closed: { color:'#6b7280', bg:'rgba(107,114,128,0.1)', label:'Closed' },
  }
  const s = map[status] || map.open
  return <span style={{background:s.bg,color:s.color,padding:'2px 9px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>{s.label}</span>
}

export default function FeedbackPage() {
  const [currentUser, setCurrentUser] = useState({})
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(currentUser.role==='viewer' ? 'list' : 'submit')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Form
  const [type, setType] = useState('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u)
    load()
  }, [])

  async function load() {
    setLoading(true)
    try { setItems(await (await fetch('/api/feedback')).json()) } catch(e) {}
    setLoading(false)
  }

  async function submit() {
    if (!title.trim()) { setError('Please enter a title.'); return }
    setSubmitting(true); setError('')
    try {
      const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
      const res = await fetch('/api/feedback', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ type, title: title.trim(), description, priority, name: u.name||'', email: u.email||'' })
      })
      const data = await res.json()
      if (data.success) { setSubmitted(true); setTitle(''); setDescription(''); setType('bug'); setPriority('medium'); load() }
      else setError(data.error || 'Failed to submit.')
    } catch(e) { setError('Network error.') }
    setSubmitting(false)
  }

  async function updateStatus(item, status) {
    setUpdating(item.id)
    try {
      await fetch('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'update_status', id: item.id, status }) })
      setItems(prev => prev.map(i => i.id===item.id ? {...i, status} : i))
    } catch(e) {}
    setUpdating(null)
  }

  const isAdmin = currentUser.role === 'admin'
  const isViewer = currentUser.role === 'viewer'
  const filtered = items.filter(i => {
    if (typeFilter && i.type !== typeFilter) return false
    if (statusFilter && i.status !== statusFilter) return false
    return true
  }).sort((a,b) => b.submittedAt.localeCompare(a.submittedAt))

  const thS = { textAlign:'left', padding:'10px 16px', fontSize:'11px', fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.07em', background:'#111111', borderBottom:'1px solid #1e1e1e', whiteSpace:'nowrap' }
  const tdS = { padding:'12px 16px', fontSize:'13px', color:'#d1d5db', borderBottom:'1px solid #1a1a1a', verticalAlign:'middle' }

  return (
    <div>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Bugs & Feature Requests</h1>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Report issues or suggest improvements to the system</p>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'0',marginBottom:'24px',background:'#0a0a0a',borderRadius:'10px',padding:'4px',width:'fit-content',border:'1px solid #1e1e1e'}}>
        <button onClick={()=>{setTab('submit');setSubmitted(false)}} style={{padding:'9px 18px',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:600,cursor:'pointer',background:tab==='submit'?'#8DC63F':'transparent',color:tab==='submit'?'#0a0a0a':'#6b7280'}}>
          Submit
        </button>}{ !isViewer && <span/>
        <button onClick={()=>setTab('list')} style={{padding:'9px 18px',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:600,cursor:'pointer',background:tab==='list'?'#8DC63F':'transparent',color:tab==='list'?'#0a0a0a':'#6b7280'}}>
          {isViewer ? 'All Submissions' : 'All Items'}
          {items.filter(i=>i.status==='open').length>0&&<span style={{marginLeft:'6px',background:'rgba(245,158,11,0.25)',color:'#f59e0b',borderRadius:'8px',padding:'1px 6px',fontSize:'11px'}}>{items.filter(i=>i.status==='open').length}</span>}
        </button>
      </div>

      {/* Submit tab */}
      {tab === 'submit' && !isViewer && (
        <div style={{maxWidth:'520px'}}>
          {submitted ? (
            <div style={{background:'#141414',border:'1px solid rgba(141,198,63,0.3)',borderRadius:'16px',padding:'40px',textAlign:'center'}}>
              <div style={{fontSize:'44px',marginBottom:'14px'}}>✅</div>
              <h2 style={{margin:'0 0 10px',fontSize:'20px'}}>Thanks for your feedback!</h2>
              <p style={{color:'#9ca3af',fontSize:'14px',margin:'0 0 24px'}}>Your submission has been logged and will be reviewed.</p>
              <button onClick={()=>setSubmitted(false)} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'11px 24px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
                Submit Another
              </button>
            </div>
          ) : (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'16px',padding:'28px'}}>
              <h2 style={{margin:'0 0 24px',fontSize:'17px',fontWeight:700}}>New Submission</h2>

              {/* Type selector — big toggle */}
              <div style={{marginBottom:'20px'}}>
                <label style={lbl}>Type</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  {[{v:'bug',icon:'🐛',label:'Bug Report',desc:'Something is broken or not working'},{v:'feature',icon:'✨',label:'Feature Request',desc:'Suggest a new feature or improvement'}].map(o=>(
                    <div key={o.v} onClick={()=>setType(o.v)}
                      style={{padding:'14px',borderRadius:'10px',border:'2px solid '+(type===o.v?'#8DC63F':'#252525'),background:type===o.v?'rgba(141,198,63,0.06)':'#111111',cursor:'pointer',transition:'all 0.15s'}}>
                      <div style={{fontSize:'22px',marginBottom:'6px'}}>{o.icon}</div>
                      <div style={{fontSize:'14px',fontWeight:600,color:type===o.v?'#fff':'#9ca3af',marginBottom:'3px'}}>{o.label}</div>
                      <div style={{fontSize:'11px',color:'#4b5563'}}>{o.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{marginBottom:'16px'}}>
                <label style={lbl}>Title <span style={{color:'#f87171'}}>*</span></label>
                <input value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()}
                  placeholder={type==='bug'?'e.g. Import fails with Excel files over 1MB':'e.g. Add CSV export to dashboard'}
                  style={inp}/>
              </div>

              <div style={{marginBottom:'16px'}}>
                <label style={lbl}>Description <span style={{color:'#4b5563'}}>(optional)</span></label>
                <textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)}
                  placeholder={type==='bug'?'Steps to reproduce, what you expected vs what happened...':'Describe the feature and why it would be useful...'}
                  style={{...inp,resize:'vertical'}}/>
              </div>

              <div style={{marginBottom:'24px'}}>
                <label style={lbl}>Priority</label>
                <div style={{display:'flex',borderRadius:'8px',overflow:'hidden',border:'1px solid #252525'}}>
                  {[{v:'low',label:'Low'},{v:'medium',label:'Medium'},{v:'high',label:'High'}].map(o=>(
                    <button key={o.v} onClick={()=>setPriority(o.v)}
                      style={{flex:1,padding:'9px',border:'none',fontSize:'13px',fontWeight:600,cursor:'pointer',
                        background:priority===o.v?(o.v==='high'?'#f87171':o.v==='medium'?'#f59e0b':'#6b7280'):'#111111',
                        color:priority===o.v?'#fff':'#6b7280'}}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && <div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}

              <button onClick={submit} disabled={submitting||!title.trim()}
                style={{width:'100%',background:title.trim()?'#8DC63F':'#2a2a2a',color:title.trim()?'#0a0a0a':'#4b5563',border:'none',borderRadius:'8px',padding:'13px',fontSize:'15px',fontWeight:800,cursor:title.trim()?'pointer':'not-allowed',transition:'all 0.15s'}}>
                {submitting?'Submitting...':'Submit ' + (type==='bug'?'Bug Report':'Feature Request')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* List tab */}
      {tab === 'list' && (
        <div>
          {/* Filters */}
          <div style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap'}}>
            <div style={{display:'flex',borderRadius:'8px',overflow:'hidden',border:'1px solid #252525'}}>
              {[{v:'',l:'All'},{v:'bug',l:'🐛 Bugs'},{v:'feature',l:'✨ Features'}].map(o=>(
                <button key={o.v} onClick={()=>setTypeFilter(o.v)}
                  style={{padding:'7px 14px',border:'none',fontSize:'13px',fontWeight:600,cursor:'pointer',background:typeFilter===o.v?'#8DC63F':'#111111',color:typeFilter===o.v?'#0a0a0a':'#6b7280'}}>
                  {o.l}
                </button>
              ))}
            </div>
            <div style={{display:'flex',borderRadius:'8px',overflow:'hidden',border:'1px solid #252525'}}>
              {[{v:'',l:'All Status'},{v:'open',l:'Open'},{v:'in-progress',l:'In Progress'},{v:'done',l:'Done'}].map(o=>(
                <button key={o.v} onClick={()=>setStatusFilter(o.v)}
                  style={{padding:'7px 14px',border:'none',fontSize:'13px',fontWeight:600,cursor:'pointer',background:statusFilter===o.v?'#8DC63F':'#111111',color:statusFilter===o.v?'#0a0a0a':'#6b7280',whiteSpace:'nowrap'}}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {loading && <div style={{color:'#6b7280',padding:'32px',textAlign:'center'}}>Loading...</div>}
          {!loading && filtered.length===0 && (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'56px',textAlign:'center'}}>
              <div style={{fontSize:'36px',marginBottom:'12px'}}>📭</div>
              <p style={{color:'#6b7280',margin:0}}>No items yet.</p>
            </div>
          )}
          {!loading && filtered.length>0 && (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',minWidth:'600px'}}>
                  <thead><tr>
                    <th style={thS}>Type</th>
                    <th style={thS}>Title</th>
                    <th style={thS}>Priority</th>
                    <th style={thS}>Submitted By</th>
                    <th style={thS}>Status</th>
                    {isAdmin&&<th style={thS}>Actions</th>}
                  </tr></thead>
                  <tbody>
                    {filtered.map(item=>(
                      <tr key={item.id} onMouseEnter={e=>e.currentTarget.style.background='#181818'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                        <td style={tdS}><TypeBadge type={item.type}/></td>
                        <td style={{...tdS,maxWidth:'280px'}}>
                          <div style={{fontWeight:500,color:'#fff'}}>{item.title}</div>
                          {item.description&&<div style={{fontSize:'12px',color:'#6b7280',marginTop:'3px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.description}</div>}
                        </td>
                        <td style={tdS}><PriorityBadge priority={item.priority}/></td>
                        <td style={tdS}>
                          <div style={{fontSize:'13px',color:'#d1d5db'}}>{item.name||'—'}</div>
                          <div style={{fontSize:'11px',color:'#6b7280'}}>{item.submittedAt?new Date(item.submittedAt).toLocaleDateString():'—'}</div>
                        </td>
                        <td style={tdS}><StatusBadge status={item.status}/></td>
                        {isAdmin&&(
                          <td style={{...tdS,minWidth:'160px'}}>
                            <select value={item.status} onChange={e=>updateStatus(item,e.target.value)} disabled={updating===item.id}
                              style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'6px',padding:'5px 10px',color:'#d1d5db',fontSize:'12px',cursor:'pointer',outline:'none'}}>
                              <option value="open">Open</option>
                              <option value="in-progress">In Progress</option>
                              <option value="done">Done</option>
                              <option value="closed">Closed</option>
                            </select>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}