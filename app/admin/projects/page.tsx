// @ts-nocheck
'use client'
import { useEffect, useState, useRef } from 'react'

const inp = { width:'100%', background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'16px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.07em' }

export default function ProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [similarWarning, setSimilarWarning] = useState(null)
  const [pendingSubmit, setPendingSubmit] = useState(false)
  const checkTimeout = useRef(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/projects')
    setProjects(await res.json())
    setLoading(false)
  }

  // Debounced AI similarity check as user types
  useEffect(() => {
    setSimilarWarning(null)
    if (!name.trim() || projects.length === 0) return
    clearTimeout(checkTimeout.current)
    checkTimeout.current = setTimeout(async () => {
      setChecking(true)
      try {
        const res = await fetch('/api/projects/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName: name, existingProjects: projects })
        })
        const data = await res.json()
        if (data.similar) setSimilarWarning(data.message)
      } catch {}
      setChecking(false)
    }, 600)
  }, [name, projects])

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', name: name.trim(), description, createdBy: u.name || u.email || '' })
    })
    setSaving(false)
    setShowAdd(false)
    setName(''); setDescription(''); setSimilarWarning(null); setPendingSubmit(false)
    load()
  }

  async function handleSubmitCheck() {
    if (!name.trim()) return
    // If there's a warning, show confirmation state
    if (similarWarning && !pendingSubmit) {
      setPendingSubmit(true)
      return
    }
    handleSave()
  }

  async function del(id) {
    if (!confirm('Delete this project?')) return
    await fetch('/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'delete', id }) })
    load()
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0,color:'#fff'}}>Projects</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setShowAdd(true); setName(''); setDescription(''); setSimilarWarning(null); setPendingSubmit(false) }}
          style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
          + New Project
        </button>
      </div>

      {/* Projects grid */}
      {loading && <div style={{color:'#6b7280',fontSize:'14px'}}>Loading...</div>}
      {!loading && projects.length === 0 && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'48px',textAlign:'center'}}>
          <div style={{fontSize:'36px',marginBottom:'12px'}}>📁</div>
          <p style={{color:'#6b7280',margin:0}}>No projects yet. Create your first one!</p>
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'16px'}}>
        {projects.map(p => (
          <div key={p.id} style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'20px',position:'relative'}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'8px'}}>
              <div style={{fontSize:'15px',fontWeight:600,color:'#fff',lineHeight:1.3}}>{p.name}</div>
              <button onClick={() => del(p.id)} style={{background:'none',border:'none',color:'#4b5563',cursor:'pointer',fontSize:'16px',padding:'0',flexShrink:0,lineHeight:1}}>×</button>
            </div>
            {p.description && <div style={{fontSize:'13px',color:'#6b7280',marginTop:'8px'}}>{p.description}</div>}
            <div style={{display:'flex',alignItems:'center',gap:'12px',marginTop:'14px'}}>
              {p.createdBy && <span style={{fontSize:'11px',color:'#4b5563'}}>{p.createdBy}</span>}
              {p.createdAt && <span style={{fontSize:'11px',color:'#4b5563'}}>{p.createdAt}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:'20px'}}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px',width:'100%',maxWidth:'460px'}}>
            <h2 style={{margin:'0 0 24px',fontSize:'18px',color:'#fff'}}>New Project</h2>

            <div style={{marginBottom:'16px'}}>
              <label style={lbl}>Project Name</label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setPendingSubmit(false) }}
                placeholder="e.g. Q2 Data Migration"
                style={inp}
                autoFocus
              />
              {/* AI check status */}
              {checking && <div style={{fontSize:'11px',color:'#6b7280',marginTop:'6px'}}>✦ Checking for similar projects...</div>}
            </div>

            {/* Similarity warning */}
            {similarWarning && !pendingSubmit && (
              <div style={{background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:'8px',padding:'12px 14px',marginBottom:'16px'}}>
                <p style={{margin:0,fontSize:'13px',color:'#fbbf24'}}>⚠️ {similarWarning}</p>
              </div>
            )}

            {/* Confirmed override message */}
            {pendingSubmit && (
              <div style={{background:'rgba(141,198,63,0.08)',border:'1px solid rgba(141,198,63,0.2)',borderRadius:'8px',padding:'12px 14px',marginBottom:'16px'}}>
                <p style={{margin:0,fontSize:'13px',color:'#8DC63F'}}>✓ Got it — creating as a separate project.</p>
              </div>
            )}

            <div style={{marginBottom:'24px'}}>
              <label style={lbl}>Description <span style={{color:'#4b5563',fontWeight:400,textTransform:'none'}}>(optional)</span></label>
              <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of this project"
                style={{...inp, resize:'vertical'}} />
            </div>

            <div style={{display:'flex',gap:'12px'}}>
              <button onClick={handleSubmitCheck} disabled={saving || checking || !name.trim()}
                style={{flex:1,background: similarWarning && !pendingSubmit ? '#f59e0b' : '#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:700,cursor:'pointer',opacity: (!name.trim() || saving) ? 0.6 : 1}}>
                {saving ? 'Creating...' : similarWarning && !pendingSubmit ? 'Create Anyway' : 'Create Project'}
              </button>
              <button onClick={() => { setShowAdd(false); setSimilarWarning(null); setPendingSubmit(false) }}
                style={{flex:1,background:'#252525',color:'#fff',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',cursor:'pointer'}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}