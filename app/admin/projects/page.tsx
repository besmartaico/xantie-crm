// @ts-nocheck
'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

const inp = { width:'100%', background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'16px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.07em' }
const sel = { width:'100%', background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'14px', outline:'none', cursor:'pointer' }

function CloseBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{background:'none',border:'none',color:'#6b7280',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}} aria-label="Close">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [leadModal, setLeadModal] = useState(null) // project being assigned
  const [selectedLead, setSelectedLead] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingLead, setSavingLead] = useState(false)
  const [checking, setChecking] = useState(false)
  const [similarWarning, setSimilarWarning] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [apiError, setApiError] = useState('')
  const checkTimeout = useRef(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setIsAdmin(u.role === 'admin')
    load()
    fetch('/api/users').then(r=>r.json()).then(setUsers).catch(()=>{})
  }, [])

  async function load() {
    setLoading(true)
    try { const p = await (await fetch('/api/projects')).json(); setProjects((p||[]).sort((a,b)=>a.name.localeCompare(b.name))) } catch(e) {}
    setLoading(false)
  }

  useEffect(() => {
    setSimilarWarning(null); setConfirmed(false)
    if (!name.trim() || projects.length === 0) { setChecking(false); return }
    clearTimeout(checkTimeout.current)
    setChecking(true)
    checkTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/projects/check', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ newName: name, existingProjects: projects }) })
        const data = await res.json()
        if (data.similar) setSimilarWarning(data.message)
      } catch(e) {}
      setChecking(false)
    }, 600)
    return () => clearTimeout(checkTimeout.current)
  }, [name])

  async function handleSave() {
    setSaving(true); setApiError('')
    try {
      const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
      const res = await fetch('/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'add', name: name.trim(), description, createdBy: u.name||u.email||'' }) })
      const data = await res.json()
      if (data.success) { setShowAdd(false); setName(''); setDescription(''); setSimilarWarning(null); setConfirmed(false); load() }
      else setApiError(data.error || 'Failed to create project.')
    } catch(e) { setApiError('Network error.') }
    setSaving(false)
  }

  async function saveLead() {
    setSavingLead(true)
    await fetch('/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'update_lead', id: leadModal.id, teamLead: selectedLead }) })
    setSavingLead(false); setLeadModal(null); load()
  }

  function handleClick() {
    if (!name.trim() || saving) return
    if (similarWarning && !confirmed) { setConfirmed(true); return }
    handleSave()
  }

  async function del(e, id) {
    e.stopPropagation()
    if (!confirm('Delete this project?')) return
    await fetch('/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'delete', id }) })
    load()
  }

  const btnBg = similarWarning && !confirmed ? '#f59e0b' : '#8DC63F'
  const btnLabel = saving ? 'Creating...' : (similarWarning && !confirmed) ? 'Create Anyway →' : 'Create Project'

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Projects</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>{projects.length} project{projects.length!==1?'s':''}</p>
        </div>
        <button onClick={() => { setShowAdd(true); setName(''); setDescription(''); setSimilarWarning(null); setConfirmed(false); setApiError('') }}
          style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
          + New Project
        </button>
      </div>

      {loading && <div style={{color:'#6b7280'}}>Loading...</div>}
      {!loading && projects.length === 0 && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'48px',textAlign:'center'}}>
          <div style={{fontSize:'36px',marginBottom:'12px'}}>📁</div>
          <p style={{color:'#6b7280',margin:0}}>No projects yet. Create your first one!</p>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'16px'}}>
        {projects.map(p => (
          <div key={p.id} style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'20px',cursor:'pointer',transition:'border-color 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#8DC63F'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='#1e1e1e'}
            onClick={() => router.push('/admin/projects/'+encodeURIComponent(p.name))}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'8px'}}>
              <div style={{fontSize:'15px',fontWeight:600,color:'#fff'}}>{p.name}</div>
              <button onClick={e=>del(e,p.id)} style={{background:'none',border:'none',color:'#4b5563',cursor:'pointer',fontSize:'18px',padding:'0',lineHeight:1,flexShrink:0}}>×</button>
            </div>
            {p.description && <div style={{fontSize:'13px',color:'#6b7280',marginTop:'8px'}}>{p.description}</div>}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'14px'}}>
              <span style={{fontSize:'12px',color:'#8DC63F',fontWeight:600}}>View hours →</span>
              {isAdmin && (
                <button onClick={e=>{e.stopPropagation();setLeadModal(p);setSelectedLead(p.teamLead||'')}}
                  style={{background:'none',border:'1px solid #252525',borderRadius:'6px',color: p.teamLead?'#60a5fa':'#4b5563',fontSize:'11px',padding:'3px 8px',cursor:'pointer',fontWeight:600}}>
                  {p.teamLead ? 'Lead: '+users.find(u=>u.email===p.teamLead)?.name || p.teamLead.split('@')[0] : 'Assign Lead'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* New Project modal */}
      {showAdd && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:'20px'}}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px',width:'100%',maxWidth:'460px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
              <h2 style={{margin:0,fontSize:'18px'}}>New Project</h2>
              <CloseBtn onClick={()=>{setShowAdd(false);setSimilarWarning(null);setConfirmed(false);setApiError('')}}/>
            </div>
            <div style={{marginBottom:'16px'}}>
              <label style={lbl}>Project Name</label>
              <input type="text" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleClick()} placeholder="e.g. Q2 Data Migration" style={inp} autoFocus/>
              {checking && <div style={{fontSize:'11px',color:'#6b7280',marginTop:'5px'}}>Checking for similar names...</div>}
            </div>
            {similarWarning && !confirmed && (
              <div style={{background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:'8px',padding:'12px 14px',marginBottom:'16px'}}>
                <p style={{margin:0,fontSize:'13px',color:'#fbbf24'}}>⚠️ {similarWarning}</p>
              </div>
            )}
            {confirmed && <div style={{background:'rgba(141,198,63,0.08)',border:'1px solid rgba(141,198,63,0.2)',borderRadius:'8px',padding:'10px 14px',marginBottom:'16px'}}><p style={{margin:0,fontSize:'13px',color:'#8DC63F'}}>✓ Got it — will create as a new project.</p></div>}
            <div style={{marginBottom:'24px'}}>
              <label style={lbl}>Description <span style={{color:'#4b5563',fontWeight:400,textTransform:'none'}}>(optional)</span></label>
              <textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Brief description" style={{...inp,resize:'vertical'}}/>
            </div>
            {apiError && <div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>{apiError}</div>}
            <div style={{display:'flex',gap:'12px'}}>
              <button onClick={handleClick} disabled={saving||!name.trim()} style={{flex:1,background:btnBg,color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:700,cursor:saving||!name.trim()?'not-allowed':'pointer',opacity:saving||!name.trim()?0.6:1}}>{btnLabel}</button>
              <button onClick={()=>{setShowAdd(false);setSimilarWarning(null);setConfirmed(false)}} style={{flex:1,background:'#252525',color:'#fff',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Team Lead modal */}
      {leadModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:'20px'}}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px',width:'100%',maxWidth:'400px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
              <h2 style={{margin:0,fontSize:'18px'}}>Assign Team Lead</h2>
              <CloseBtn onClick={()=>setLeadModal(null)}/>
            </div>
            <p style={{color:'#6b7280',fontSize:'13px',marginBottom:'20px',marginTop:0}}>Project: <span style={{color:'#fff',fontWeight:600}}>{leadModal.name}</span></p>
            <div style={{marginBottom:'24px'}}>
              <label style={lbl}>Team Lead</label>
              <select value={selectedLead} onChange={e=>setSelectedLead(e.target.value)} style={sel}>
                <option value="">— No team lead —</option>
                {users.map(u=><option key={u.id} value={u.email}>{u.name} ({u.email})</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:'12px'}}>
              <button onClick={saveLead} disabled={savingLead} style={{flex:1,background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
                {savingLead?'Saving...':'Save'}
              </button>
              <button onClick={()=>setLeadModal(null)} style={{flex:1,background:'#252525',color:'#fff',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}