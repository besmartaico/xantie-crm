// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const inp = { width:'100%', background:'#111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'14px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }

const STAGES = [
  { value:'Lead',        prob: 0.05, color:'#94a3b8' },
  { value:'Qualified',   prob: 0.10, color:'#60a5fa' },
  { value:'Potential',   prob: 0.25, color:'#a78bfa' },
  { value:'Probable',    prob: 0.60, color:'#fbbf24' },
  { value:'In Contract', prob: 0.75, color:'#34d399' },
  { value:'Won',         prob: 1.00, color:'#8DC63F' },
  { value:'Lost',        prob: 0.00, color:'#f87171' },
  { value:'Fridge',      prob: 0.00, color:'#6b7280' },
]

function fmtMoney(n) {
  const v = parseFloat(n) || 0
  if (v === 0) return '$0'
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}

function dateInputVal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
}

function StageBadge({ stage }) {
  const s = STAGES.find(x=>x.value===stage)
  if (!s) return <span style={{color:'#6b7280',fontSize:'11px'}}>—</span>
  return <span style={{background:s.color+'22',color:s.color,fontSize:'11px',fontWeight:700,padding:'3px 9px',borderRadius:'5px'}}>{s.value}</span>
}

export default function SalesCrmPage() {
  const [tab, setTab] = useState('funnel')
  const [funnel, setFunnel] = useState([])
  const [projects, setProjects] = useState([])
  const [bench, setBench] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('funnel')
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [activeCard, setActiveCard] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    if (u.role !== 'admin') {
      window.location.href = '/admin/dashboard'
      return
    }
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [f, p, b] = await Promise.all([
        fetch('/api/sales?type=funnel').then(r=>r.json()),
        fetch('/api/sales?type=projects').then(r=>r.json()),
        fetch('/api/sales?type=bench').then(r=>r.json()),
      ])
      setFunnel(f||[]); setProjects(p||[]); setBench(b||[])
    } catch(e) {}
    setLoading(false)
  }

  function openAdd(type) {
    setModalType(type)
    setEditId(null)
    setForm(type==='funnel' ? {stage:'Lead', probability:0.05} : {})
    setShowModal(true)
    setActiveCard(null)
  }

  function openEdit(type, item) {
    setModalType(type)
    setEditId(item.id)
    setForm({...item})
    setShowModal(true)
    setActiveCard(null)
  }

  async function save() {
    if (!form.companyName && modalType==='funnel') return
    if (!form.customerName && modalType==='projects') return
    if (!form.name && modalType==='bench') return
    setSaving(true)
    let body = { action: editId ? 'update' : 'add', type: modalType, ...form }
    if (editId) body.id = editId
    // Auto-set probability for funnel based on stage
    if (modalType === 'funnel' && body.stage) {
      const s = STAGES.find(x=>x.value===body.stage)
      if (s) body.probability = s.prob
      // Recalc expected revenue
      const rate = parseFloat(body.anticipatedRate)||0
      const months = parseFloat(body.duration)||0
      const hours = 168 * months
      body.expectedRevenue = (rate * hours * (s?.prob||0)).toFixed(0)
    }
    await fetch('/api/sales', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)})
    setShowModal(false)
    setSaving(false)
    load()
  }

  async function doDelete(type, id) {
    await fetch('/api/sales', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'delete', type, id})})
    setConfirmDelete(null)
    setActiveCard(null)
    load()
  }

  // Insights for funnel
  const won = funnel.filter(f => f.stage === 'Won')
  const wonRevenue = won.reduce((s,f) => s + (parseFloat(f.expectedRevenue)||0), 0)
  const expectedRevenue = funnel.filter(f => !['Won','Lost','Fridge'].includes(f.stage)).reduce((s,f) => s + (parseFloat(f.expectedRevenue)||0), 0)
  const totalOpps = funnel.length
  const wonCount = won.length
  const lostCount = funnel.filter(f => f.stage === 'Lost').length
  const closedCount = wonCount + lostCount
  const closingPct = closedCount > 0 ? (wonCount / closedCount * 100) : 0
  const avgWonValue = wonCount > 0 ? wonRevenue / wonCount : 0

  // Filter funnel
  const filteredFunnel = funnel.filter(f => {
    if (stageFilter && f.stage !== stageFilter) return false
    if (search) {
      const s = search.toLowerCase()
      if (!['companyName','contactName','contactEmail','resource','notes'].some(k => (f[k]||'').toLowerCase().includes(s))) return false
    }
    return true
  })

  return (
    <div>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Sales CRM</h1>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Sales funnel, current projects, and bench</p>
      </div>

      {/* Tab switcher */}
      <div style={{display:'flex',gap:0,marginBottom:'20px',background:'#0a0a0a',borderRadius:'10px',padding:'4px',border:'1px solid #1e1e1e',width:'fit-content',maxWidth:'100%',overflowX:'auto'}}>
        {[
          {v:'funnel',l:'Sales Funnel'},
          {v:'projects',l:'Current Projects'},
          {v:'bench',l:'Bench'},
          {v:'insights',l:'Insights'},
        ].map(t => (
          <button key={t.v} onClick={()=>setTab(t.v)}
            style={{background:tab===t.v?'#1e1e1e':'transparent',color:tab===t.v?'#fff':'#6b7280',border:'none',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
            {t.l}
          </button>
        ))}
      </div>

      {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>}

      {/* SALES FUNNEL */}
      {!loading && tab === 'funnel' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px',gap:'10px',flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
              <input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} style={{...inp,width:'auto',minWidth:'200px'}}/>
              <select value={stageFilter} onChange={e=>setStageFilter(e.target.value)} style={{...inp,width:'auto',cursor:'pointer'}}>
                <option value="">All stages</option>
                {STAGES.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
              </select>
            </div>
            <button onClick={()=>openAdd('funnel')} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 16px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>+ New Lead</button>
          </div>

          {filteredFunnel.length === 0 && (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'48px',textAlign:'center',color:'#6b7280'}}>No leads {search||stageFilter?'matching filters':'yet'}.</div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {filteredFunnel.map(f => (
              <div key={f.id} onClick={()=>setActiveCard({type:'funnel',data:f})}
                style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'10px',padding:'14px 16px',cursor:'pointer'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#8DC63F'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='#1e1e1e'}>
                <div style={{display:'flex',gap:'12px',alignItems:'center',flexWrap:'wrap'}}>
                  <div style={{flex:'1 1 220px',minWidth:0}}>
                    <div style={{fontSize:'14px',fontWeight:600,color:'#fff'}}>{f.companyName}</div>
                    <div style={{fontSize:'12px',color:'#6b7280'}}>{f.contactName||'—'} {f.resource?'· '+f.resource:''}</div>
                  </div>
                  <div style={{textAlign:'right',minWidth:'120px'}}>
                    <div style={{fontSize:'14px',fontWeight:700,color:'#8DC63F'}}>{fmtMoney(f.expectedRevenue)}</div>
                    <div style={{fontSize:'10px',color:'#6b7280'}}>{f.duration?f.duration+' mo':'—'} · {f.anticipatedRate?'$'+f.anticipatedRate+'/hr':''}</div>
                  </div>
                  <StageBadge stage={f.stage}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CURRENT PROJECTS */}
      {!loading && tab === 'projects' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'14px'}}>
            <button onClick={()=>openAdd('projects')} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 16px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>+ New Project</button>
          </div>
          {projects.length === 0 && <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'48px',textAlign:'center',color:'#6b7280'}}>No active projects yet.</div>}
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {projects.map(p => (
              <div key={p.id} onClick={()=>setActiveCard({type:'projects',data:p})}
                style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'10px',padding:'14px 16px',cursor:'pointer'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#8DC63F'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='#1e1e1e'}>
                <div style={{display:'flex',gap:'12px',alignItems:'center',flexWrap:'wrap'}}>
                  <div style={{flex:'1 1 220px',minWidth:0}}>
                    <div style={{fontSize:'14px',fontWeight:600,color:'#fff'}}>{p.customerName}</div>
                    <div style={{fontSize:'12px',color:'#6b7280'}}>{p.billingCustomer && p.billingCustomer !== p.customerName ? 'via '+p.billingCustomer+' · ' : ''}{p.resource||'—'}</div>
                  </div>
                  <div style={{minWidth:'120px',textAlign:'right'}}>
                    <div style={{fontSize:'13px',color:'#d1d5db'}}>{p.rate||'—'}</div>
                    <div style={{fontSize:'11px',color:'#6b7280'}}>{p.customerType||''}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BENCH */}
      {!loading && tab === 'bench' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'14px'}}>
            <button onClick={()=>openAdd('bench')} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 16px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>+ Add to Bench</button>
          </div>
          {bench.length === 0 && <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'48px',textAlign:'center',color:'#6b7280'}}>No one on the bench right now.</div>}
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {bench.map(b => (
              <div key={b.id} onClick={()=>setActiveCard({type:'bench',data:b})}
                style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'10px',padding:'14px 16px',cursor:'pointer'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#8DC63F'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='#1e1e1e'}>
                <div style={{display:'flex',gap:'12px',alignItems:'center',flexWrap:'wrap'}}>
                  <div style={{flex:'1 1 220px',minWidth:0}}>
                    <div style={{fontSize:'14px',fontWeight:600,color:'#fff'}}>{b.name}</div>
                    <div style={{fontSize:'12px',color:'#6b7280'}}>{b.status||'—'}</div>
                  </div>
                  <div style={{minWidth:'120px',textAlign:'right'}}>
                    <div style={{fontSize:'13px',color:'#d1d5db'}}>{b.rate||'—'}</div>
                    <div style={{fontSize:'11px',color:'#6b7280'}}>{b.availabilityStart?fmtDate(b.availabilityStart):''}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INSIGHTS */}
      {!loading && tab === 'insights' && (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'12px',marginBottom:'24px'}}>
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'16px'}}>
              <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>Won Revenue</div>
              <div style={{fontSize:'22px',fontWeight:700,color:'#8DC63F'}}>{fmtMoney(wonRevenue)}</div>
            </div>
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'16px'}}>
              <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>Expected Revenue</div>
              <div style={{fontSize:'22px',fontWeight:700,color:'#fbbf24'}}>{fmtMoney(expectedRevenue)}</div>
            </div>
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'16px'}}>
              <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>Avg Won Value</div>
              <div style={{fontSize:'22px',fontWeight:700,color:'#fff'}}>{fmtMoney(avgWonValue)}</div>
            </div>
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'16px'}}>
              <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}># Won</div>
              <div style={{fontSize:'22px',fontWeight:700,color:'#fff'}}>{wonCount}</div>
            </div>
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'16px'}}>
              <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>Closing %</div>
              <div style={{fontSize:'22px',fontWeight:700,color:'#fff'}}>{closingPct.toFixed(0)}%</div>
            </div>
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'16px'}}>
              <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>Total Opportunities</div>
              <div style={{fontSize:'22px',fontWeight:700,color:'#fff'}}>{totalOpps}</div>
            </div>
          </div>

          <h3 style={{fontSize:'14px',fontWeight:700,margin:'0 0 12px',color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em'}}>By Stage</h3>
          <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
            {STAGES.map(s => {
              const items = funnel.filter(f => f.stage === s.value)
              const rev = items.reduce((sum,f) => sum + (parseFloat(f.expectedRevenue)||0), 0)
              return (
                <div key={s.value} style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'10px',padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
                  <div style={{flex:'1 1 200px'}}>
                    <StageBadge stage={s.value}/>
                    <span style={{color:'#6b7280',fontSize:'12px',marginLeft:'10px'}}>{(s.prob*100).toFixed(0)}% prob</span>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'14px',fontWeight:700,color:'#fff'}}>{items.length} {items.length===1?'opp':'opps'}</div>
                    <div style={{fontSize:'12px',color:'#8DC63F'}}>{fmtMoney(rev)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* DETAIL CARD */}
      {activeCard && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}}
          onClick={()=>setActiveCard(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'24px',width:'600px',maxWidth:'100%',maxHeight:'92vh',overflowY:'auto'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'14px'}}>
              <h2 style={{fontSize:'18px',fontWeight:700,margin:0}}>
                {activeCard.type==='funnel' && activeCard.data.companyName}
                {activeCard.type==='projects' && activeCard.data.customerName}
                {activeCard.type==='bench' && activeCard.data.name}
              </h2>
              <button onClick={()=>setActiveCard(null)} style={{background:'none',border:'none',color:'#6b7280',fontSize:'22px',cursor:'pointer',lineHeight:1}}>✕</button>
            </div>

            {activeCard.type==='funnel' && (
              <div>
                <div style={{display:'flex',gap:'10px',marginBottom:'12px',flexWrap:'wrap'}}>
                  <StageBadge stage={activeCard.data.stage}/>
                  <span style={{color:'#8DC63F',fontWeight:700,fontSize:'14px'}}>{fmtMoney(activeCard.data.expectedRevenue)} expected</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'10px',marginBottom:'14px'}}>
                  {activeCard.data.contactName && <div><label style={lbl}>Contact</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{activeCard.data.contactName}</div></div>}
                  {activeCard.data.contactEmail && <div><label style={lbl}>Email</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{activeCard.data.contactEmail}</div></div>}
                  {activeCard.data.anticipatedRate && <div><label style={lbl}>Rate</label><div style={{color:'#d1d5db',fontSize:'13px'}}>${activeCard.data.anticipatedRate}/hr</div></div>}
                  {activeCard.data.duration && <div><label style={lbl}>Duration</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{activeCard.data.duration} months</div></div>}
                  {activeCard.data.resource && <div><label style={lbl}>Resource</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{activeCard.data.resource}</div></div>}
                </div>
                {activeCard.data.projectDetails && <div style={{marginBottom:'12px'}}><label style={lbl}>Project Details</label><div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'8px',padding:'10px 14px',color:'#d1d5db',fontSize:'13px',whiteSpace:'pre-wrap'}}>{activeCard.data.projectDetails}</div></div>}
                {activeCard.data.notes && <div style={{marginBottom:'12px'}}><label style={lbl}>Notes</label><div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'8px',padding:'10px 14px',color:'#d1d5db',fontSize:'13px',whiteSpace:'pre-wrap'}}>{activeCard.data.notes}</div></div>}
                {activeCard.data.nextStep && <div style={{marginBottom:'12px'}}><label style={lbl}>Next Step</label><div style={{background:'rgba(141,198,63,0.06)',border:'1px solid rgba(141,198,63,0.2)',borderRadius:'8px',padding:'10px 14px',color:'#d1d5db',fontSize:'13px'}}>{activeCard.data.nextStep}</div></div>}
              </div>
            )}

            {activeCard.type==='projects' && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'10px',marginBottom:'12px'}}>
                {activeCard.data.billingCustomer && <div><label style={lbl}>Billing Customer</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{activeCard.data.billingCustomer}</div></div>}
                {activeCard.data.customerType && <div><label style={lbl}>Type</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{activeCard.data.customerType}</div></div>}
                {activeCard.data.salesContact && <div><label style={lbl}>Sales Contact</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{activeCard.data.salesContact}</div></div>}
                {activeCard.data.salesEmail && <div><label style={lbl}>Sales Email</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{activeCard.data.salesEmail}</div></div>}
                {activeCard.data.startDate && <div><label style={lbl}>Start Date</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{fmtDate(activeCard.data.startDate)}</div></div>}
                {activeCard.data.endDate && <div><label style={lbl}>End Date</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{fmtDate(activeCard.data.endDate)}</div></div>}
                {activeCard.data.rate && <div><label style={lbl}>Rate</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{activeCard.data.rate}</div></div>}
                {activeCard.data.resource && <div><label style={lbl}>Resource</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{activeCard.data.resource}</div></div>}
                {activeCard.data.notes && <div style={{gridColumn:'1 / -1'}}><label style={lbl}>Notes</label><div style={{color:'#d1d5db',fontSize:'13px',whiteSpace:'pre-wrap'}}>{activeCard.data.notes}</div></div>}
              </div>
            )}

            {activeCard.type==='bench' && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'10px',marginBottom:'12px'}}>
                {activeCard.data.status && <div><label style={lbl}>Status</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{activeCard.data.status}</div></div>}
                {activeCard.data.rate && <div><label style={lbl}>Rate / Salary</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{activeCard.data.rate}</div></div>}
                {activeCard.data.availabilityStart && <div><label style={lbl}>Available From</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{fmtDate(activeCard.data.availabilityStart)}</div></div>}
                {activeCard.data.notes && <div style={{gridColumn:'1 / -1'}}><label style={lbl}>Notes</label><div style={{color:'#d1d5db',fontSize:'13px',whiteSpace:'pre-wrap'}}>{activeCard.data.notes}</div></div>}
              </div>
            )}

            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'18px',flexWrap:'wrap'}}>
              <button onClick={()=>setConfirmDelete({type:activeCard.type, id:activeCard.data.id})} style={{background:'#1e1e1e',border:'1px solid #252525',color:'#f87171',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',cursor:'pointer'}}>Delete</button>
              <button onClick={()=>openEdit(activeCard.type, activeCard.data)} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>✎ Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}}
          onClick={()=>setShowModal(false)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'24px',width:'640px',maxWidth:'100%',maxHeight:'92vh',overflowY:'auto'}}
            onClick={e=>e.stopPropagation()}>
            <h2 style={{fontSize:'18px',fontWeight:700,margin:'0 0 18px'}}>
              {editId?'Edit ':'New '}{modalType==='funnel'?'Lead':modalType==='projects'?'Project':'Bench Item'}
            </h2>

            {modalType==='funnel' && (
              <>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'12px',marginBottom:'12px'}}>
                  <div><label style={lbl}>Company *</label><input value={form.companyName||''} onChange={e=>setForm({...form,companyName:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Stage</label>
                    <select value={form.stage||'Lead'} onChange={e=>setForm({...form,stage:e.target.value})} style={{...inp,cursor:'pointer'}}>
                      {STAGES.map(s => <option key={s.value} value={s.value}>{s.value} ({(s.prob*100).toFixed(0)}%)</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Contact Name</label><input value={form.contactName||''} onChange={e=>setForm({...form,contactName:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Contact Email</label><input value={form.contactEmail||''} onChange={e=>setForm({...form,contactEmail:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Billing Contact</label><input value={form.billingContact||''} onChange={e=>setForm({...form,billingContact:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Resource</label><input value={form.resource||''} onChange={e=>setForm({...form,resource:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Anticipated Rate ($/hr)</label><input type="number" value={form.anticipatedRate||''} onChange={e=>setForm({...form,anticipatedRate:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Duration (months)</label><input type="number" value={form.duration||''} onChange={e=>setForm({...form,duration:e.target.value})} style={inp}/></div>
                </div>
                <div style={{marginBottom:'12px'}}><label style={lbl}>Project Details</label><textarea rows={3} value={form.projectDetails||''} onChange={e=>setForm({...form,projectDetails:e.target.value})} style={{...inp,resize:'vertical'}}/></div>
                <div style={{marginBottom:'12px'}}><label style={lbl}>Notes</label><textarea rows={3} value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} style={{...inp,resize:'vertical'}}/></div>
                <div style={{marginBottom:'18px'}}><label style={lbl}>Next Step</label><input value={form.nextStep||''} onChange={e=>setForm({...form,nextStep:e.target.value})} style={inp}/></div>
                <p style={{fontSize:'11px',color:'#6b7280',marginTop:'-12px',marginBottom:'14px'}}>Expected revenue is auto-calculated: rate × 168 hrs × duration × stage probability.</p>
              </>
            )}

            {modalType==='projects' && (
              <>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'12px',marginBottom:'12px'}}>
                  <div><label style={lbl}>Customer Name *</label><input value={form.customerName||''} onChange={e=>setForm({...form,customerName:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Billing Customer</label><input value={form.billingCustomer||''} onChange={e=>setForm({...form,billingCustomer:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Type</label>
                    <select value={form.customerType||''} onChange={e=>setForm({...form,customerType:e.target.value})} style={{...inp,cursor:'pointer'}}>
                      <option value="">—</option>
                      <option value="Billing">Billing</option>
                      <option value="Recurring">Recurring</option>
                      <option value="Billing/Recurring">Billing/Recurring</option>
                    </select>
                  </div>
                  <div><label style={lbl}>Resource</label><input value={form.resource||''} onChange={e=>setForm({...form,resource:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Sales Contact</label><input value={form.salesContact||''} onChange={e=>setForm({...form,salesContact:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Sales Email</label><input value={form.salesEmail||''} onChange={e=>setForm({...form,salesEmail:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Invoicing Email</label><input value={form.invoicingEmail||''} onChange={e=>setForm({...form,invoicingEmail:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Rate</label><input value={form.rate||''} onChange={e=>setForm({...form,rate:e.target.value})} placeholder="$125/hr or $2000/Mo" style={inp}/></div>
                  <div><label style={lbl}>Start Date</label><input type="date" value={dateInputVal(form.startDate)} onChange={e=>setForm({...form,startDate:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>End Date</label><input type="date" value={dateInputVal(form.endDate)} onChange={e=>setForm({...form,endDate:e.target.value})} style={inp}/></div>
                </div>
                <div style={{marginBottom:'18px'}}><label style={lbl}>Notes</label><textarea rows={3} value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} style={{...inp,resize:'vertical'}}/></div>
              </>
            )}

            {modalType==='bench' && (
              <>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'12px',marginBottom:'12px'}}>
                  <div><label style={lbl}>Name *</label><input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Status</label><input value={form.status||''} onChange={e=>setForm({...form,status:e.target.value})} placeholder="Available, Rolling off..." style={inp}/></div>
                  <div><label style={lbl}>Rate / Salary</label><input value={form.rate||''} onChange={e=>setForm({...form,rate:e.target.value})} style={inp}/></div>
                  <div><label style={lbl}>Available From</label><input type="date" value={dateInputVal(form.availabilityStart)} onChange={e=>setForm({...form,availabilityStart:e.target.value})} style={inp}/></div>
                </div>
                <div style={{marginBottom:'18px'}}><label style={lbl}>Notes</label><textarea rows={3} value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} style={{...inp,resize:'vertical'}}/></div>
              </>
            )}

            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',flexWrap:'wrap'}}>
              <button onClick={()=>setShowModal(false)} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'10px 16px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button onClick={save} disabled={saving} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>{saving?'Saving...':(editId?'Save Changes':'Add')}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1200,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}}
          onClick={()=>setConfirmDelete(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'14px',padding:'20px',width:'380px',maxWidth:'100%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:'0 0 12px',fontSize:'16px'}}>Delete this item?</h3>
            <p style={{color:'#9ca3af',fontSize:'13px',margin:'0 0 18px'}}>This cannot be undone.</p>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setConfirmDelete(null)} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button onClick={()=>doDelete(confirmDelete.type, confirmDelete.id)} style={{background:'#dc2626',border:'none',color:'#fff',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}