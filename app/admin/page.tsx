// @ts-nocheck
'use client'
import { useEffect, useState, useRef } from 'react'

const inp = { width:'100%', background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'16px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.07em' }
const th = { textAlign:'left', padding:'11px 16px', fontSize:'11px', fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.08em', background:'#111111', borderBottom:'1px solid #1e1e1e' }
const td = { padding:'11px 16px', fontSize:'13px', color:'#d1d5db', borderBottom:'1px solid #1a1a1a', verticalAlign:'middle' }

function CloseBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{background:'none',border:'none',color:'#6b7280',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center'}} aria-label="Close">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  )
}

export default function TimeEntries() {
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], hours: '', description: '', project: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [filter, setFilter] = useState('')
  const dateRef = useRef(null)
  const [currentUser, setCurrentUser] = useState({})

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u)
    load(); loadProjects()
  }, [])

  async function load() {
    setLoading(true)
    try { setEntries(await (await fetch('/api/time')).json()) } catch(e) {}
    setLoading(false)
  }

  async function loadProjects() {
    try { setProjects(await (await fetch('/api/projects')).json()) } catch(e) {}
  }

  async function save() {
    setSaving(true); setSaveError('')
    try {
      const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
      const res = await fetch('/api/time', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(editEntry
          ? { action:'update', id: editEntry.id, name: u.name||'', email: u.email||'', ...form, importedFrom: editEntry.importedFrom }
          : { action:'add', name: u.name||'', email: u.email||'', ...form }
        )
      })
      const data = await res.json()
      if (data.success) {
        closeModal(); load()
      } else setSaveError(data.error || 'Failed to save entry.')
    } catch(e) { setSaveError('Network error. Please try again.') }
    setSaving(false)
  }

  async function del(id) {
    if (!confirm('Delete this entry?')) return
    await fetch('/api/time', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'delete', id }) })
    load()
  }

  function openEdit(e) { setEditEntry(e); setSaveError(''); setForm({ date: e.date, hours: e.hours, description: e.description, project: e.project||'' }); setShowAdd(true) }
  function openAdd() { setEditEntry(null); setSaveError(''); setForm({ date: new Date().toISOString().split('T')[0], hours:'', description:'', project:'' }); setShowAdd(true) }
  function closeModal() { setShowAdd(false); setEditEntry(null); setSaveError('') }
  function openDatePicker() { if (dateRef.current) { try { dateRef.current.showPicker() } catch { dateRef.current.click() } } }

  // Filter: non-admins only see their own entries
  const isAdmin = currentUser.role === 'admin'
  const visibleEntries = isAdmin ? entries : entries.filter(e => e.email === currentUser.email)

  const filtered = visibleEntries.filter(e =>
    !filter || e.name?.toLowerCase().includes(filter.toLowerCase()) ||
    e.description?.toLowerCase().includes(filter.toLowerCase()) ||
    e.date?.includes(filter) || e.project?.toLowerCase().includes(filter.toLowerCase())
  )
  const totalHours = filtered.reduce((s,e) => s+(parseFloat(e.hours)||0), 0)

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Time Entries</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>{filtered.length} entries · <span style={{color:'#8DC63F',fontWeight:600}}>{totalHours.toFixed(2)} hrs</span></p>
        </div>
        <button onClick={openAdd} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>+ Add Entry</button>
      </div>

      <div style={{marginBottom:'16px'}}>
        <input placeholder="Search by name, project, date, or description..." value={filter} onChange={e=>setFilter(e.target.value)} style={{...inp,maxWidth:'400px'}}/>
      </div>

      <div className="tbl-wrap" style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:'640px'}}>
          <thead>
            <tr>
              <th style={th}>Name</th><th style={th}>Project</th><th style={th}>Date</th>
              <th style={th}>Hours</th><th style={th}>Description</th><th style={th}>Source</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{...td,textAlign:'center',color:'#6b7280'}}>Loading...</td></tr>}
            {!loading && filtered.length===0 && <tr><td colSpan={7} style={{...td,textAlign:'center',color:'#6b7280'}}>No entries yet.</td></tr>}
            {filtered.map(e=>(
              <tr key={e.id} onMouseEnter={ev=>ev.currentTarget.style.background='#181818'} onMouseLeave={ev=>ev.currentTarget.style.background=''}>
                <td style={td}><div style={{fontWeight:500,color:'#fff'}}>{e.name}</div><div style={{fontSize:'11px',color:'#6b7280'}}>{e.email}</div></td>
                <td style={td}>{e.project?<span style={{background:'rgba(141,198,63,0.1)',color:'#8DC63F',padding:'2px 8px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>{e.project}</span>:<span style={{color:'#4b5563',fontSize:'12px'}}>—</span>}</td>
                <td style={td}>{e.date}</td>
                <td style={td}><span style={{background:'rgba(141,198,63,0.12)',color:'#8DC63F',padding:'3px 8px',borderRadius:'6px',fontWeight:700,fontSize:'12px'}}>{e.hours}</span></td>
                <td style={td}><span style={{color:'#9ca3af'}}>{e.description}</span></td>
                <td style={td}><span style={{fontSize:'11px',color:'#6b7280'}}>{e.importedFrom||'manual'}</span></td>
                <td style={td}>
                  <button onClick={()=>openEdit(e)} style={{background:'none',border:'none',color:'#8DC63F',cursor:'pointer',fontSize:'12px',marginRight:'8px',fontWeight:600}}>Edit</button>
                  <button onClick={()=>del(e.id)} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:'12px'}}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:'20px'}}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px',width:'100%',maxWidth:'460px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
              <h2 style={{margin:0,fontSize:'18px'}}>{editEntry?'Edit Entry':'Add Time Entry'}</h2>
              <CloseBtn onClick={closeModal}/>
            </div>

            <div style={{marginBottom:'16px'}}>
              <label style={lbl}>Project</label>
              <select value={form.project} onChange={e=>setForm({...form,project:e.target.value})} style={{...inp,cursor:'pointer'}}>
                <option value="">— No project —</option>
                {projects.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>

            <div style={{marginBottom:'16px'}}>
              <label style={lbl}>Date</label>
              <div style={{position:'relative'}}>
                <input ref={dateRef} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} onClick={openDatePicker} style={{...inp,colorScheme:'dark',paddingRight:'40px',cursor:'pointer'}}/>
                <div onClick={openDatePicker} style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',cursor:'pointer',pointerEvents:'none'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8DC63F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
              </div>
            </div>

            <div style={{marginBottom:'16px'}}>
              <label style={lbl}>Hours (decimal)</label>
              <input type="number" step="0.25" placeholder="e.g. 2.5" value={form.hours} onChange={e=>setForm({...form,hours:e.target.value})} style={inp}/>
            </div>
            <div style={{marginBottom:'24px'}}>
              <label style={lbl}>Description</label>
              <textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={{...inp,resize:'vertical'}}/>
            </div>

            {saveError && <div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>{saveError}</div>}

            <div style={{display:'flex',gap:'12px'}}>
              <button onClick={save} disabled={saving} style={{flex:1,background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:700,cursor:saving?'not-allowed':'pointer',opacity:saving?0.7:1}}>
                {saving?'Saving...':editEntry?'Save Changes':'Add Entry'}
              </button>
              <button onClick={closeModal} style={{flex:1,background:'#252525',color:'#fff',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}