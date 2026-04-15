// @ts-nocheck
'use client'
import { useEffect, useState, useRef } from 'react'

const inp = { width:'100%', background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'16px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.07em' }

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

function BillableFilter({ value, onChange }) {
  return (
    <div style={{display:'flex',borderRadius:'8px',overflow:'hidden',border:'1px solid #252525'}}>
      {[{v:'',label:'All'},{v:'yes',label:'Billable'},{v:'no',label:'Non-Billable'}].map(o => (
        <button key={o.v} onClick={()=>onChange(o.v)}
          style={{padding:'8px 12px',border:'none',fontSize:'13px',fontWeight:600,cursor:'pointer',
            background:value===o.v?'#8DC63F':'#111111',color:value===o.v?'#0a0a0a':'#6b7280'}}>
          {o.label}
        </button>
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
      {s.dir==='asc'?'↑':'↓'}
      {sorts.length > 1 && <span style={{fontSize:'9px',background:'rgba(141,198,63,0.2)',borderRadius:'3px',padding:'0 3px'}}>{idx+1}</span>}
    </span>
  )
}

const COLS = [
  {key:'name',label:'Name'},
  {key:'project',label:'Project'},
  {key:'date',label:'Date'},
  {key:'hours',label:'Hours'},
  {key:'billable',label:'Billable'},
  {key:'description',label:'Description'},
]

export default function TimeEntries() {
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [form, setForm] = useState({ date:new Date().toISOString().split('T')[0], hours:'', description:'', project:'', billable:'yes' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const dateRef = useRef(null)
  const [currentUser, setCurrentUser] = useState({})
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [savingProject, setSavingProject] = useState(false)
  const [projectError, setProjectError] = useState('')
  const [search, setSearch] = useState('')
  const [billableFilter, setBillableFilter] = useState('')
  const [colFilters, setColFilters] = useState({})
  const [showColFilter, setShowColFilter] = useState(null)
  const [sorts, setSorts] = useState([{col:'date',dir:'desc'}])

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u); load(); loadProjects()
  }, [])

  async function load() {
    setLoading(true)
    try { setEntries(await (await fetch('/api/time')).json()) } catch(e) {}
    setLoading(false)
  }

  async function loadProjects() {
    try { setProjects(await (await fetch('/api/projects')).json()) } catch(e) {}
  }

  function getLastProject(user) {
    const myEntries = entries
      .filter(e => e.email === user.email && e.project)
      .sort((a,b) => (b.date||'').localeCompare(a.date||''))
    return myEntries[0]?.project || ''
  }

  async function saveNewProject() {
    if (!newProjectName.trim()) return
    setSavingProject(true); setProjectError('')
    try {
      const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
      const res = await fetch('/api/projects', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add',name:newProjectName.trim(),description:'',createdBy:u.name||u.email||''})})
      const data = await res.json()
      if (data.success) { await loadProjects(); setForm(f=>({...f,project:newProjectName.trim()})); setNewProjectName(''); setShowNewProject(false) }
      else setProjectError(data.error||'Failed.')
    } catch(e) { setProjectError('Network error.') }
    setSavingProject(false)
  }

  function handleProjectChange(e) {
    const val = e.target.value
    if (val==='__new__') { setShowNewProject(true); setNewProjectName(''); setProjectError('') }
    else { setForm(f=>({...f,project:val})); setShowNewProject(false) }
  }

  async function save() {
    if (!form.project) { setSaveError('Please select a project.'); return }
    setSaving(true); setSaveError('')
    try {
      const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
      const res = await fetch('/api/time', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(editEntry
          ? {action:'update',id:editEntry.id,name:u.name||'',email:u.email||'',...form,importedFrom:editEntry.importedFrom}
          : {action:'add',name:u.name||'',email:u.email||'',...form}
        )
      })
      const data = await res.json()
      if (data.success) { closeModal(); load() }
      else setSaveError(data.error||'Failed to save.')
    } catch(e) { setSaveError('Network error.') }
    setSaving(false)
  }

  async function del(id) {
    await fetch('/api/time',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id})})
    load()
  }

  function openEdit(e) {
    setEditEntry(e); setSaveError('')
    setForm({date:e.date,hours:e.hours,description:e.description,project:e.project||'',billable:e.billable||'yes'})
    setShowAdd(true); setShowNewProject(false)
  }

  function openAdd() {
    setEditEntry(null); setSaveError('')
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    const lastProject = entries.filter(e=>e.email===u.email&&e.project).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]?.project || ''
    setForm({date:new Date().toISOString().split('T')[0],hours:'',description:'',project:lastProject,billable:'yes'})
    setShowAdd(true); setShowNewProject(false)
  }

  function closeModal() { setShowAdd(false); setEditEntry(null); setSaveError(''); setShowNewProject(false); setNewProjectName('') }
  function openDatePicker() { if (dateRef.current) { try { dateRef.current.showPicker() } catch { dateRef.current.click() } } }

  function handleSort(col, e) {
    if (e.shiftKey) { setSorts(prev=>prev.filter(s=>s.col!==col)); return }
    setSorts(prev => {
      const existing = prev.find(s=>s.col===col)
      if (!existing) return [...prev,{col,dir:'asc'}]
      if (existing.dir==='asc') return prev.map(s=>s.col===col?{...s,dir:'desc'}:s)
      return prev.filter(s=>s.col!==col)
    })
  }

  function applySort(data) {
    if (!sorts.length) return data
    return [...data].sort((a,b) => {
      for (const s of sorts) {
        let av=a[s.col]||'', bv=b[s.col]||''
        if (s.col==='hours'){av=parseFloat(av)||0;bv=parseFloat(bv)||0}
        let cmp = typeof av==='number' ? av-bv : String(av).localeCompare(String(bv))
        if (cmp!==0) return s.dir==='asc'?cmp:-cmp
      }
      return 0
    })
  }

  function getColValues(col) {
    const isAdmin = currentUser.role==='admin'
    const base = isAdmin?entries:entries.filter(e=>e.email===currentUser.email)
    return [...new Set(base.map(e=>e[col]).filter(Boolean))].sort()
  }

  const isAdmin = currentUser.role==='admin'
  const visibleEntries = isAdmin?entries:entries.filter(e=>e.email===currentUser.email)

  const filtered = applySort(visibleEntries.filter(e => {
    if (billableFilter && e.billable!==billableFilter) return false
    if (search) {
      const s=search.toLowerCase()
      if (!e.name?.toLowerCase().includes(s)&&!e.description?.toLowerCase().includes(s)&&!e.date?.includes(s)&&!e.project?.toLowerCase().includes(s)&&!e.email?.toLowerCase().includes(s)) return false
    }
    for (const [col,val] of Object.entries(colFilters)) {
      if (!val) continue
      const ev=e[col]||''
      if (col==='billable'){if(ev!==val)return false}
      else if(!String(ev).toLowerCase().includes(val.toLowerCase()))return false
    }
    return true
  }))

  const totalHours = filtered.reduce((s,e)=>s+(parseFloat(e.hours)||0),0)
  const billableHours = filtered.filter(e=>e.billable!=='no').reduce((s,e)=>s+(parseFloat(e.hours)||0),0)
  const canSave = !!form.project && !saving
  const hasFilters = search||billableFilter||Object.values(colFilters).some(Boolean)

  const thStyle = {
    textAlign:'left',padding:'10px 14px',fontSize:'11px',fontWeight:700,color:'#4b5563',
    textTransform:'uppercase',letterSpacing:'0.08em',background:'#111111',
    borderBottom:'1px solid #1e1e1e',userSelect:'none',whiteSpace:'nowrap',cursor:'pointer',
  }
  const td = {padding:'11px 14px',fontSize:'13px',color:'#d1d5db',borderBottom:'1px solid #1a1a1a',verticalAlign:'middle'}

  return (
    <div onClick={()=>showColFilter&&setShowColFilter(null)}>
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

      <div style={{display:'flex',flexWrap:'wrap',gap:'10px',marginBottom:'10px',alignItems:'center'}}>
        <input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{...inp,maxWidth:'220px',fontSize:'13px',padding:'8px 12px'}}/>
        <BillableFilter value={billableFilter} onChange={setBillableFilter}/>
        {hasFilters && (
          <button onClick={()=>{setSearch('');setBillableFilter('');setColFilters({})}}
            style={{background:'#252525',color:'#9ca3af',border:'none',borderRadius:'8px',padding:'8px 12px',fontSize:'13px',cursor:'pointer'}}>
            Clear filters
          </button>
        )}
      </div>

      {/* Sort pills */}
      <div style={{minHeight:'28px',marginBottom:'10px',display:'flex',gap:'6px',alignItems:'center',flexWrap:'wrap'}}>
        {sorts.length > 0 ? (
          <>
            <span style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>Sort:</span>
            {sorts.map((s,i)=>(
              <div key={s.col+i} style={{display:'flex',alignItems:'center',gap:'4px',background:'rgba(141,198,63,0.1)',border:'1px solid rgba(141,198,63,0.25)',borderRadius:'6px',padding:'3px 8px',fontSize:'12px',color:'#8DC63F',fontWeight:600}}>
                {sorts.length>1&&<span style={{fontSize:'9px',color:'#6b7280'}}>#{i+1}</span>}
                {COLS.find(c=>c.key===s.col)?.label} {s.dir==='asc'?'↑':'↓'}
                <button onClick={()=>setSorts(prev=>prev.filter((_,j)=>j!==i))}
                  style={{background:'none',border:'none',color:'#6b7280',cursor:'pointer',padding:'0 0 0 4px',fontSize:'13px',lineHeight:1}}>×</button>
              </div>
            ))}
            <button onClick={()=>setSorts([])} style={{background:'none',border:'none',color:'#4b5563',fontSize:'12px',cursor:'pointer'}}>Clear sort</button>
          </>
        ) : (
          <span style={{fontSize:'11px',color:'#3a3a3a'}}>Click headers to sort · Stack multiple sorts · Shift+click to remove one</span>
        )}
      </div>

      <div className="tbl-wrap" style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',minWidth:'700px'}}>
            <thead>
              <tr>
                {COLS.map(col=>(
                  <th key={col.key} style={thStyle} onClick={e=>handleSort(col.key,e)}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'6px'}}>
                      <span style={{display:'flex',alignItems:'center'}}>
                        {col.label}<SortIcon col={col.key} sorts={sorts}/>
                      </span>
                      {col.key!=='description' && (
                        <button
                          onClick={e=>{e.stopPropagation();setShowColFilter(showColFilter===col.key?null:col.key)}}
                          title={'Filter '+col.label}
                          style={{
                            background:colFilters[col.key]?'rgba(141,198,63,0.2)':'none',
                            border:'none',color:colFilters[col.key]?'#8DC63F':'#3a3a3a',
                            cursor:'pointer',padding:'2px 5px',borderRadius:'4px',fontSize:'10px',flexShrink:0,
                          }}>▼</button>
                      )}
                    </div>
                    {showColFilter===col.key && (
                      <div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'100%',left:0,background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'10px',padding:'8px',zIndex:200,minWidth:'170px',boxShadow:'0 8px 32px rgba(0,0,0,0.6)'}}>
                        {col.key==='billable' ? (
                          <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                            {[{v:'',l:'All'},{v:'yes',l:'Billable'},{v:'no',l:'Non-Billable'}].map(o=>(
                              <button key={o.v} onClick={()=>{setColFilters(f=>({...f,[col.key]:o.v}));setShowColFilter(null)}}
                                style={{textAlign:'left',background:colFilters[col.key]===o.v?'rgba(141,198,63,0.1)':'none',border:'none',color:colFilters[col.key]===o.v?'#8DC63F':'#d1d5db',padding:'7px 10px',borderRadius:'6px',cursor:'pointer',fontSize:'13px'}}>
                                {o.l}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <>
                            <input autoFocus placeholder={'Filter '+col.label+'...'} value={colFilters[col.key]||''}
                              onChange={e=>setColFilters(f=>({...f,[col.key]:e.target.value}))}
                              style={{...inp,fontSize:'13px',padding:'6px 10px',marginBottom:'6px'}}/>
                            <div style={{maxHeight:'150px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'2px'}}>
                              <button onClick={()=>{setColFilters(f=>({...f,[col.key]:''}));setShowColFilter(null)}}
                                style={{textAlign:'left',background:'none',border:'none',color:'#6b7280',padding:'5px 8px',borderRadius:'5px',cursor:'pointer',fontSize:'12px'}}>
                                Show all
                              </button>
                              {getColValues(col.key).map(v=>(
                                <button key={v} onClick={()=>{setColFilters(f=>({...f,[col.key]:v}));setShowColFilter(null)}}
                                  style={{textAlign:'left',background:colFilters[col.key]===v?'rgba(141,198,63,0.1)':'none',border:'none',color:colFilters[col.key]===v?'#8DC63F':'#d1d5db',padding:'5px 8px',borderRadius:'5px',cursor:'pointer',fontSize:'12px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                                  {v}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </th>
                ))}
                <th style={{...thStyle,width:'80px',cursor:'default'}}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{...td,textAlign:'center',color:'#6b7280'}}>Loading...</td></tr>}
              {!loading&&filtered.length===0&&<tr><td colSpan={7} style={{...td,textAlign:'center',color:'#6b7280'}}>No entries found.</td></tr>}
              {filtered.map(e=>(
                <tr key={e.id} onMouseEnter={ev=>ev.currentTarget.style.background='#181818'} onMouseLeave={ev=>ev.currentTarget.style.background=''}>
                  <td style={td}><div style={{fontWeight:500,color:'#fff'}}>{e.name}</div><div style={{fontSize:'11px',color:'#6b7280'}}>{e.email}</div></td>
                  <td style={td}>{e.project?<span style={{background:'rgba(141,198,63,0.1)',color:'#8DC63F',padding:'2px 8px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>{e.project}</span>:<span style={{color:'#4b5563',fontSize:'12px'}}>—</span>}</td>
                  <td style={td}>{e.date}</td>
                  <td style={td}><span style={{background:'rgba(141,198,63,0.12)',color:'#8DC63F',padding:'3px 8px',borderRadius:'6px',fontWeight:700,fontSize:'12px'}}>{e.hours}</span></td>
                  <td style={td}><span style={{background:e.billable==='no'?'rgba(156,163,175,0.1)':'rgba(96,165,250,0.1)',color:e.billable==='no'?'#9ca3af':'#60a5fa',padding:'2px 8px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>{e.billable==='no'?'Non-Billable':'Billable'}</span></td>
                  <td style={{...td,maxWidth:'200px'}}><span style={{color:'#9ca3af',display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.description}</span></td>
                  <td style={td}>
                    <button onClick={()=>openEdit(e)} style={{background:'none',border:'none',color:'#8DC63F',cursor:'pointer',fontSize:'12px',marginRight:'8px',fontWeight:600}}>Edit</button>
                    <button onClick={()=>del(e.id)} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:'12px'}}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:'20px'}}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px',width:'100%',maxWidth:'460px',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
              <h2 style={{margin:0,fontSize:'18px'}}>{editEntry?'Edit Entry':'Add Time Entry'}</h2>
              <CloseBtn onClick={closeModal}/>
            </div>

            <div style={{marginBottom:'12px'}}>
              <label style={lbl}>Project <span style={{color:'#f87171'}}>*</span></label>
              <select value={showNewProject?'__new__':form.project} onChange={handleProjectChange}
                style={{...inp,cursor:'pointer',borderColor:!form.project&&!showNewProject?'#5a3030':'#252525'}}>
                <option value="">— Select a project —</option>
                <option disabled>────────────────────</option>
                {projects.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
                <option disabled>────────────────────</option>
                <option value="__new__">+ Add New Project</option>
              </select>
              {!form.project&&!showNewProject&&<p style={{margin:'4px 0 0',fontSize:'11px',color:'#f87171'}}>A project is required</p>}
            </div>

            {showNewProject && (
              <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'10px',padding:'14px',marginBottom:'16px'}}>
                <label style={{...lbl,marginBottom:'8px'}}>New Project Name</label>
                <div style={{display:'flex',gap:'8px'}}>
                  <input type="text" autoFocus value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveNewProject()} placeholder="e.g. Website Redesign" style={{...inp,flex:1,fontSize:'14px'}}/>
                  <button onClick={saveNewProject} disabled={savingProject||!newProjectName.trim()}
                    style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',fontWeight:700,cursor:!newProjectName.trim()?'not-allowed':'pointer',opacity:!newProjectName.trim()?0.5:1,whiteSpace:'nowrap'}}>
                    {savingProject?'Adding…':'Add'}
                  </button>
                  <button onClick={()=>{setShowNewProject(false);setNewProjectName('');setProjectError('')}}
                    style={{background:'#252525',color:'#9ca3af',border:'none',borderRadius:'8px',padding:'10px 12px',fontSize:'13px',cursor:'pointer'}}>✕</button>
                </div>
                {projectError&&<p style={{margin:'6px 0 0',fontSize:'12px',color:'#f87171'}}>{projectError}</p>}
              </div>
            )}

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

            <div style={{marginBottom:'16px'}}>
              <label style={lbl}>Billing</label>
              <BillableToggle value={form.billable} onChange={v=>setForm({...form,billable:v})}/>
            </div>

            <div style={{marginBottom:'24px'}}>
              <label style={lbl}>Description</label>
              <textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={{...inp,resize:'vertical'}}/>
            </div>

            {saveError&&<div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>{saveError}</div>}

            <div style={{display:'flex',gap:'12px'}}>
              <button onClick={save} disabled={!canSave}
                style={{flex:1,background:canSave?'#8DC63F':'#2a2a2a',color:canSave?'#0a0a0a':'#4b5563',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:700,cursor:canSave?'pointer':'not-allowed',transition:'all 0.15s'}}>
                {saving?'Saving…':editEntry?'Save Changes':'Add Entry'}
              </button>
              <button onClick={closeModal} style={{flex:1,background:'#252525',color:'#fff',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}