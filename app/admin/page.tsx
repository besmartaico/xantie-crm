// @ts-nocheck
'use client'
import { useEffect, useState, useRef } from 'react'

const inp = { width:'100%', background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'16px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.07em' }
const sel = { background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'8px 12px', color:'#fff', fontSize:'13px', cursor:'pointer', outline:'none' }

const DATE_OPTIONS = [
  { value:'', label:'All Time' },
  { value:'this_month', label:'This Month' },
  { value:'last_month', label:'Last Month' },
  { value:'this_quarter', label:'This Quarter' },
  { value:'this_year', label:'This Year' },
  { value:'custom', label:'Custom Range' },
]

function getDateRange(filter, start, end) {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth()
  if (filter==='this_month') return [new Date(y,m,1), new Date(y,m+1,0)]
  if (filter==='last_month') return [new Date(y,m-1,1), new Date(y,m,0)]
  if (filter==='this_quarter') { const q=Math.floor(m/3); return [new Date(y,q*3,1), new Date(y,q*3+3,0)] }
  if (filter==='this_year') return [new Date(y,0,1), new Date(y,11,31)]
  if (filter==='custom'&&start&&end) return [new Date(start), new Date(end)]
  return null
}

function CloseBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{background:'none',border:'none',color:'#6b7280',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center'}}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  )
}

function BillableToggle({ value, onChange }) {
  return (
    <div style={{display:'flex',gap:'16px'}}>
      {[{v:'yes',label:'Billable'},{v:'no',label:'Non-Billable'}].map(o => (
        <label key={o.v} style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',userSelect:'none'}} onClick={() => onChange(o.v)}>
          <div style={{width:'18px',height:'18px',borderRadius:'50%',flexShrink:0,border:value===o.v?'2px solid #8DC63F':'2px solid #3a3a3a',background:value===o.v?'#8DC63F':'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}>
            {value===o.v && <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#0a0a0a'}}/>}
          </div>
          <span style={{fontSize:'14px',color:value===o.v?'#fff':'#9ca3af',fontWeight:value===o.v?600:400}}>{o.label}</span>
        </label>
      ))}
    </div>
  )
}

function SortIcon({ col, sorts }) {
  const idx = sorts.findIndex(s => s.col === col)
  if (idx === -1) return <span style={{color:'#3a3a3a',marginLeft:'4px',fontSize:'10px'}}>↕</span>
  const s = sorts[idx]
  return (
    <span style={{marginLeft:'4px',color:'#8DC63F',fontSize:'10px',display:'inline-flex',alignItems:'center',gap:'2px'}}>
      {s.dir === 'asc' ? '↑' : '↓'}
      {sorts.length > 1 && <span style={{fontSize:'9px',background:'rgba(141,198,63,0.2)',borderRadius:'3px',padding:'0 3px'}}>{idx+1}</span>}
    </span>
  )
}

function SortPill({ sort, index, onRemove, onDragStart, onDragOver, onDrop, isDragging }) {
  const LABELS = { name:'Name', project:'Project', date:'Date', hours:'Hours', billable:'Billable', description:'Description' }
  return (
    <div draggable onDragStart={()=>onDragStart(index)} onDragOver={e=>{e.preventDefault();onDragOver(index)}} onDrop={()=>onDrop(index)}
      style={{display:'flex',alignItems:'center',gap:'4px',background:isDragging?'rgba(141,198,63,0.2)':'rgba(141,198,63,0.1)',border:'1px solid rgba(141,198,63,0.3)',borderRadius:'6px',padding:'4px 8px',fontSize:'12px',color:'#8DC63F',fontWeight:600,cursor:'grab',userSelect:'none',opacity:isDragging?0.5:1}}>
      <span style={{fontSize:'9px',color:'#6b7280',marginRight:'2px'}}>⠿</span>
      <span style={{fontSize:'10px',color:'#6b7280',marginRight:'1px'}}>#{index+1}</span>
      {LABELS[sort.col]} {sort.dir==='asc'?'↑':'↓'}
      <button onClick={()=>onRemove(index)} style={{background:'none',border:'none',color:'#6b7280',cursor:'pointer',padding:'0 0 0 4px',fontSize:'13px',lineHeight:1}}>×</button>
    </div>
  )
}

const COLS = [
  { key:'name', label:'Name' }, { key:'project', label:'Project' }, { key:'date', label:'Date' },
  { key:'hours', label:'Hours' }, { key:'billable', label:'Billable' }, { key:'description', label:'Description' },
]

function newDay() {
  return { date: new Date().toISOString().split('T')[0], hours: '', billable: 'yes', id: Math.random() }
}

export default function TimeEntries() {
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editEntry, setEditEntry] = useState(null)

  // Shared fields for multi-entry
  const [project, setProject] = useState('')
  const [description, setDescription] = useState('')
  const [days, setDays] = useState([newDay()])

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [currentUser, setCurrentUser] = useState({})
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [savingProject, setSavingProject] = useState(false)
  const [projectError, setProjectError] = useState('')

  // Filters
  const [nameFilter, setNameFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [billableFilter, setBillableFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Sort - persisted per user
  const [sorts, setSorts] = useState(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
      const saved = localStorage.getItem('xantie_sorts_' + (u.email||'default'))
      return saved ? JSON.parse(saved) : [{ col:'date', dir:'desc' }]
    } catch { return [{ col:'date', dir:'desc' }] }
  })
  const [dragIdx, setDragIdx] = useState(null)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u); load(); loadProjects()
  }, [])

  useEffect(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
      if (u.email) localStorage.setItem('xantie_sorts_' + u.email, JSON.stringify(sorts))
    } catch {}
  }, [sorts])

  async function load() {
    setLoading(true)
    try { setEntries(await (await fetch('/api/time')).json()) } catch(e) {}
    setLoading(false)
  }

  async function loadProjects() {
    try { setProjects(await (await fetch('/api/projects')).json()) } catch(e) {}
  }

  function getLastProject(user) {
    const mine = entries.filter(e=>e.email===user.email&&e.project).sort((a,b)=>(b.date||'').localeCompare(a.date||''))
    return mine[0]?.project || ''
  }

  async function saveNewProject() {
    if (!newProjectName.trim()) return
    setSavingProject(true); setProjectError('')
    try {
      const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
      const res = await fetch('/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'add', name: newProjectName.trim(), description:'', createdBy: u.name||u.email||'' }) })
      const data = await res.json()
      if (data.success) { await loadProjects(); setProject(newProjectName.trim()); setNewProjectName(''); setShowNewProject(false) }
      else setProjectError(data.error||'Failed.')
    } catch(e) { setProjectError('Network error.') }
    setSavingProject(false)
  }

  function handleProjectChange(e) {
    const val = e.target.value
    if (val==='__new__') { setShowNewProject(true); setNewProjectName(''); setProjectError('') }
    else { setProject(val); setShowNewProject(false) }
  }

  function updateDay(id, field, value) {
    setDays(prev => prev.map(d => d.id===id ? {...d,[field]:value} : d))
  }

  function addDay() {
    const last = days[days.length-1]
    // Default next day to day after last
    let nextDate = new Date().toISOString().split('T')[0]
    if (last?.date) {
      const d = new Date(last.date); d.setDate(d.getDate()+1)
      nextDate = d.toISOString().split('T')[0]
    }
    setDays(prev => [...prev, { ...newDay(), date: nextDate, billable: last?.billable||'yes' }])
  }

  function removeDay(id) {
    setDays(prev => prev.filter(d => d.id!==id))
  }

  async function save() {
    if (!project) { setSaveError('Please select a project.'); return }
    const validDays = days.filter(d => d.date && d.hours)
    if (!validDays.length) { setSaveError('Please add at least one day with a date and hours.'); return }
    setSaving(true); setSaveError('')
    try {
      const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
      if (editEntry) {
        // Single entry edit
        const day = days[0]
        const res = await fetch('/api/time', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'update', id:editEntry.id, name:u.name||'', email:u.email||'', date:day.date, hours:day.hours, billable:day.billable, description, project, importedFrom:editEntry.importedFrom })
        })
        const data = await res.json()
        if (!data.success) { setSaveError(data.error||'Failed.'); setSaving(false); return }
      } else {
        // Multi-entry save - one API call per day
        for (const day of validDays) {
          const res = await fetch('/api/time', { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ action:'add', name:u.name||'', email:u.email||'', date:day.date, hours:day.hours, billable:day.billable, description, project })
          })
          const data = await res.json()
          if (!data.success) { setSaveError(data.error||'Failed to save entry for ' + day.date); setSaving(false); return }
        }
      }
      closeModal(); load()
    } catch(e) { setSaveError('Network error.') }
    setSaving(false)
  }

  async function del(id) {
    await fetch('/api/time', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'delete', id }) })
    load()
  }

  function openEdit(e) {
    setEditEntry(e); setSaveError('')
    setProject(e.project||''); setDescription(e.description||'')
    setDays([{ date:e.date, hours:e.hours, billable:e.billable||'yes', id:Math.random() }])
    setShowAdd(true); setShowNewProject(false)
  }

  function openAdd() {
    setEditEntry(null); setSaveError('')
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setProject(getLastProject(u)); setDescription('')
    setDays([newDay()])
    setShowAdd(true); setShowNewProject(false)
  }

  function closeModal() { setShowAdd(false); setEditEntry(null); setSaveError(''); setShowNewProject(false); setNewProjectName('') }

  function handleSort(col, e) {
    if (e.shiftKey) { setSorts(prev=>prev.filter(s=>s.col!==col)); return }
    setSorts(prev => {
      const ex = prev.find(s=>s.col===col)
      if (!ex) return [...prev, {col, dir:'asc'}]
      if (ex.dir==='asc') return prev.map(s=>s.col===col?{...s,dir:'desc'}:s)
      return prev.filter(s=>s.col!==col)
    })
  }

  function handleDrop(i) {
    if (dragIdx===null||dragIdx===i) { setDragIdx(null); return }
    setSorts(prev => { const n=[...prev]; const [m]=n.splice(dragIdx,1); n.splice(i,0,m); return n })
    setDragIdx(null)
  }

  function applySort(data) {
    if (!sorts.length) return data
    return [...data].sort((a,b) => {
      for (const s of sorts) {
        let av=a[s.col]||'', bv=b[s.col]||''
        if (s.col==='hours') { av=parseFloat(av)||0; bv=parseFloat(bv)||0 }
        let cmp = typeof av==='number'?av-bv:String(av).localeCompare(String(bv))
        if (cmp!==0) return s.dir==='asc'?cmp:-cmp
      }
      return 0
    })
  }

  const isAdmin = currentUser.role==='admin'
  const visibleEntries = isAdmin ? entries : entries.filter(e=>e.email===currentUser.email)
  const allNames = [...new Set(visibleEntries.map(e=>e.name).filter(Boolean))].sort()
  const allProjects = [...new Set(visibleEntries.map(e=>e.project).filter(Boolean))].sort()

  const filtered = applySort(visibleEntries.filter(e => {
    if (nameFilter && e.name!==nameFilter) return false
    if (projectFilter && e.project!==projectFilter) return false
    if (billableFilter && e.billable!==billableFilter) return false
    const range = getDateRange(dateFilter, customStart, customEnd)
    if (range) { const d=new Date(e.date); if(d<range[0]||d>range[1]) return false }
    return true
  }))

  const totalHours = filtered.reduce((s,e)=>s+(parseFloat(e.hours)||0),0)
  const billableHours = filtered.filter(e=>e.billable!=='no').reduce((s,e)=>s+(parseFloat(e.hours)||0),0)
  const hasFilters = nameFilter||projectFilter||billableFilter||dateFilter
  const canSave = !!project && !saving
  const totalDayHours = days.reduce((s,d)=>s+(parseFloat(d.hours)||0),0)

  const thStyle = { textAlign:'left', padding:'10px 14px', fontSize:'11px', fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.08em', background:'#111111', borderBottom:'1px solid #1e1e1e', userSelect:'none', whiteSpace:'nowrap', cursor:'pointer' }
  const tdStyle = { padding:'11px 14px', fontSize:'13px', color:'#d1d5db', borderBottom:'1px solid #1a1a1a', verticalAlign:'middle' }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Time Entries</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>
            {filtered.length} entries · <span style={{color:'#8DC63F',fontWeight:600}}>{totalHours.toFixed(2)} hrs</span>
            {!billableFilter && <span> · <span style={{color:'#60a5fa'}}>{billableHours.toFixed(2)} billable</span></span>}
          </p>
        </div>
        <button onClick={openAdd} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>+ Add Entry</button>
      </div>

      {/* Filter bar */}
      <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'16px',marginBottom:'14px'}}>
        <div style={{display:'flex',flexWrap:'wrap',gap:'12px',alignItems:'flex-end'}}>
          <div>
            <label style={{...lbl,marginBottom:'4px'}}>Date</label>
            <select value={dateFilter} onChange={e=>setDateFilter(e.target.value)} style={sel}>
              {DATE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {dateFilter==='custom' && (
            <>
              <div><label style={{...lbl,marginBottom:'4px'}}>From</label><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{...sel,colorScheme:'dark'}}/></div>
              <div><label style={{...lbl,marginBottom:'4px'}}>To</label><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{...sel,colorScheme:'dark'}}/></div>
            </>
          )}
          {isAdmin && (
            <div>
              <label style={{...lbl,marginBottom:'4px'}}>Employee</label>
              <select value={nameFilter} onChange={e=>setNameFilter(e.target.value)} style={sel}>
                <option value="">All Employees</option>
                {allNames.map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{...lbl,marginBottom:'4px'}}>Project</label>
            <select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)} style={sel}>
              <option value="">All Projects</option>
              {allProjects.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{...lbl,marginBottom:'4px'}}>Billing</label>
            <div style={{display:'flex',borderRadius:'8px',overflow:'hidden',border:'1px solid #252525'}}>
              {[{v:'',label:'All'},{v:'yes',label:'Billable'},{v:'no',label:'Non-Billable'}].map(o=>(
                <button key={o.v} onClick={()=>setBillableFilter(o.v)}
                  style={{padding:'8px 12px',border:'none',fontSize:'13px',fontWeight:600,cursor:'pointer',background:billableFilter===o.v?'#8DC63F':'#111111',color:billableFilter===o.v?'#0a0a0a':'#6b7280',whiteSpace:'nowrap'}}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <div style={{alignSelf:'flex-end'}}>
              <button onClick={()=>{setNameFilter('');setProjectFilter('');setBillableFilter('');setDateFilter('');setCustomStart('');setCustomEnd('')}}
                style={{background:'#252525',color:'#9ca3af',border:'none',borderRadius:'8px',padding:'8px 14px',fontSize:'13px',cursor:'pointer'}}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sort pills */}
      <div style={{display:'flex',gap:'6px',marginBottom:'10px',alignItems:'center',flexWrap:'wrap',minHeight:'24px'}}>
        {sorts.length>0 && <span style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>Sort:</span>}
        {sorts.map((s,i)=>(
          <SortPill key={s.col} sort={s} index={i} total={sorts.length}
            onRemove={i=>setSorts(prev=>prev.filter((_,j)=>j!==i))}
            onDragStart={setDragIdx} onDragOver={()=>{}} onDrop={handleDrop} isDragging={dragIdx===i}/>
        ))}
        {sorts.length>0 && <button onClick={()=>setSorts([])} style={{background:'none',border:'none',color:'#4b5563',fontSize:'12px',cursor:'pointer',padding:'3px 6px'}}>Clear sort</button>}
        {sorts.length===0 && <span style={{fontSize:'11px',color:'#3a3a3a'}}>Click column headers to sort · Drag pills to reorder</span>}
      </div>

      <div className="tbl-wrap" style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',minWidth:'700px'}}>
            <thead>
              <tr>{COLS.map(col=><th key={col.key} style={thStyle} onClick={e=>handleSort(col.key,e)}>{col.label}<SortIcon col={col.key} sorts={sorts}/></th>)}
                <th style={{...thStyle,cursor:'default',width:'80px'}}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{...tdStyle,textAlign:'center',color:'#6b7280'}}>Loading...</td></tr>}
              {!loading&&filtered.length===0 && <tr><td colSpan={7} style={{...tdStyle,textAlign:'center',color:'#6b7280'}}>No entries match these filters.</td></tr>}
              {filtered.map(e=>(
                <tr key={e.id} onMouseEnter={ev=>ev.currentTarget.style.background='#181818'} onMouseLeave={ev=>ev.currentTarget.style.background=''}>
                  <td style={tdStyle}><div style={{fontWeight:500,color:'#fff'}}>{e.name}</div><div style={{fontSize:'11px',color:'#6b7280'}}>{e.email}</div></td>
                  <td style={tdStyle}>{e.project?<span style={{background:'rgba(141,198,63,0.1)',color:'#8DC63F',padding:'2px 8px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>{e.project}</span>:<span style={{color:'#4b5563',fontSize:'12px'}}>—</span>}</td>
                  <td style={tdStyle}>{e.date}</td>
                  <td style={tdStyle}><span style={{background:'rgba(141,198,63,0.12)',color:'#8DC63F',padding:'3px 8px',borderRadius:'6px',fontWeight:700,fontSize:'12px'}}>{e.hours}</span></td>
                  <td style={tdStyle}><span style={{background:e.billable==='no'?'rgba(156,163,175,0.1)':'rgba(96,165,250,0.1)',color:e.billable==='no'?'#9ca3af':'#60a5fa',padding:'2px 8px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>{e.billable==='no'?'Non-Billable':'Billable'}</span></td>
                  <td style={{...tdStyle,maxWidth:'220px'}}><span style={{color:'#9ca3af',display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.description}</span></td>
                  <td style={tdStyle}>
                    <button onClick={()=>openEdit(e)} style={{background:'none',border:'none',color:'#8DC63F',cursor:'pointer',fontSize:'12px',marginRight:'8px',fontWeight:600}}>Edit</button>
                    <button onClick={()=>del(e.id)} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:'12px'}}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit modal */}
      {showAdd && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:'20px'}}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px',width:'100%',maxWidth:'560px',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
              <div>
                <h2 style={{margin:0,fontSize:'18px'}}>{editEntry?'Edit Entry':'Add Time Entries'}</h2>
                {!editEntry && <p style={{margin:'3px 0 0',fontSize:'12px',color:'#6b7280'}}>Add hours across multiple days at once</p>}
              </div>
              <CloseBtn onClick={closeModal}/>
            </div>

            {/* Project - shared across all days */}
            <div style={{marginBottom:'12px'}}>
              <label style={lbl}>Project <span style={{color:'#f87171'}}>*</span></label>
              <select value={showNewProject?'__new__':project} onChange={handleProjectChange}
                style={{...inp,cursor:'pointer',borderColor:!project&&!showNewProject?'#5a3030':'#252525'}}>
                <option value="">— Select a project —</option>
                <option disabled>────────────────────</option>
                {projects.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
                <option disabled>────────────────────</option>
                <option value="__new__">+ Add New Project</option>
              </select>
              {!project&&!showNewProject&&<p style={{margin:'4px 0 0',fontSize:'11px',color:'#f87171'}}>A project is required</p>}
            </div>

            {showNewProject && (
              <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'10px',padding:'14px',marginBottom:'16px'}}>
                <label style={{...lbl,marginBottom:'8px'}}>New Project Name</label>
                <div style={{display:'flex',gap:'8px'}}>
                  <input autoFocus value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveNewProject()} placeholder="e.g. Website Redesign" style={{...inp,flex:1,fontSize:'14px'}}/>
                  <button onClick={saveNewProject} disabled={!newProjectName.trim()}
                    style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',fontWeight:700,cursor:'pointer',opacity:!newProjectName.trim()?0.5:1,whiteSpace:'nowrap'}}>
                    {savingProject?'Adding…':'Add'}
                  </button>
                  <button onClick={()=>{setShowNewProject(false);setNewProjectName('');setProjectError('')}}
                    style={{background:'#252525',color:'#9ca3af',border:'none',borderRadius:'8px',padding:'10px 12px',fontSize:'13px',cursor:'pointer'}}>✕</button>
                </div>
                {projectError&&<p style={{margin:'6px 0 0',fontSize:'12px',color:'#f87171'}}>{projectError}</p>}
              </div>
            )}

            {/* Description - shared */}
            <div style={{marginBottom:'20px'}}>
              <label style={lbl}>Description</label>
              <textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)} placeholder="What was worked on?" style={{...inp,resize:'vertical'}}/>
            </div>

            {/* Day rows */}
            <div style={{marginBottom:'8px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
                <label style={{...lbl,margin:0}}>Days & Hours</label>
                {!editEntry && (
                  <span style={{fontSize:'12px',color:'#6b7280'}}>
                    Total: <span style={{color:'#8DC63F',fontWeight:700}}>{totalDayHours.toFixed(2)} hrs</span>
                  </span>
                )}
              </div>

              {/* Header row */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 100px 1fr 32px',gap:'8px',marginBottom:'6px',padding:'0 2px'}}>
                <span style={{fontSize:'10px',color:'#4b5563',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em'}}>Date</span>
                <span style={{fontSize:'10px',color:'#4b5563',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em'}}>Hours</span>
                <span style={{fontSize:'10px',color:'#4b5563',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em'}}>Billing</span>
                <span></span>
              </div>

              {days.map((day, i) => (
                <div key={day.id} style={{display:'grid',gridTemplateColumns:'1fr 100px 1fr 32px',gap:'8px',marginBottom:'8px',alignItems:'center'}}>
                  <input type="date" value={day.date} onChange={e=>updateDay(day.id,'date',e.target.value)}
                    style={{...inp,fontSize:'14px',padding:'8px 10px',colorScheme:'dark'}}/>
                  <input type="number" step="0.25" placeholder="0.00" value={day.hours} onChange={e=>updateDay(day.id,'hours',e.target.value)}
                    style={{...inp,fontSize:'14px',padding:'8px 10px'}}/>
                  <div style={{display:'flex',borderRadius:'8px',overflow:'hidden',border:'1px solid #252525',height:'38px'}}>
                    {[{v:'yes',label:'Bill.'},{v:'no',label:'Non-Bill.'}].map(o=>(
                      <button key={o.v} onClick={()=>updateDay(day.id,'billable',o.v)}
                        style={{flex:1,border:'none',fontSize:'11px',fontWeight:600,cursor:'pointer',background:day.billable===o.v?'#8DC63F':'#111111',color:day.billable===o.v?'#0a0a0a':'#6b7280',padding:'0 4px'}}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {days.length > 1 ? (
                    <button onClick={()=>removeDay(day.id)} style={{background:'none',border:'none',color:'#4b5563',cursor:'pointer',fontSize:'16px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',height:'38px'}}>×</button>
                  ) : <div/>}
                </div>
              ))}

              {!editEntry && (
                <button onClick={addDay}
                  style={{width:'100%',background:'#1a1a1a',border:'1px dashed #2a2a2a',borderRadius:'8px',color:'#6b7280',padding:'8px',fontSize:'13px',cursor:'pointer',marginTop:'4px'}}>
                  + Add another day
                </button>
              )}
            </div>

            {saveError&&<div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px',marginTop:'12px'}}>{saveError}</div>}

            <div style={{display:'flex',gap:'12px',marginTop:'20px'}}>
              <button onClick={save} disabled={!canSave}
                style={{flex:1,background:canSave?'#8DC63F':'#2a2a2a',color:canSave?'#0a0a0a':'#4b5563',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:700,cursor:canSave?'pointer':'not-allowed',transition:'all 0.15s'}}>
                {saving?'Saving…':editEntry?'Save Changes':`Save ${days.filter(d=>d.date&&d.hours).length} ${days.filter(d=>d.date&&d.hours).length===1?'Entry':'Entries'}`}
              </button>
              <button onClick={closeModal} style={{flex:1,background:'#252525',color:'#fff',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}