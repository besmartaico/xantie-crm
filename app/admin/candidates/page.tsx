// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const inp = { width:'100%', background:'#111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'14px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }

const HIRE_OPTIONS = [
  { value:'', label:'—', color:'#6b7280', bg:'rgba(107,114,128,0.12)' },
  { value:'No', label:'No', color:'#f87171', bg:'rgba(248,113,113,0.12)' },
  { value:'Potential', label:'Potential', color:'#fbbf24', bg:'rgba(251,191,36,0.12)' },
  { value:'Yes', label:'Yes', color:'#34d399', bg:'rgba(52,211,153,0.12)' },
  { value:'Hired', label:'Hired', color:'#8DC63F', bg:'rgba(141,198,63,0.18)' },
]

function HireBadge({ value }) {
  const o = HIRE_OPTIONS.find(x=>x.value===value) || HIRE_OPTIONS[0]
  return <span style={{background:o.bg,color:o.color,fontSize:'11px',fontWeight:700,padding:'3px 9px',borderRadius:'5px'}}>{o.label}</span>
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

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterHire, setFilterHire] = useState('')
  const [activeCard, setActiveCard] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [importPreview, setImportPreview] = useState([])
  const [importFileName, setImportFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')

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
      const data = await (await fetch('/api/candidates')).json()
      setCandidates(data || [])
    } catch(e) {}
    setLoading(false)
  }

  function openAdd() {
    setEditId(null)
    setForm({wouldHire:''})
    setShowModal(true)
  }

  function openEdit(c) {
    setEditId(c.id)
    setForm({...c})
    setActiveCard(null)
    setShowModal(true)
  }

  async function save() {
    if (!form.name) return
    setSaving(true)
    const body = { action: editId ? 'update' : 'add', ...form }
    if (editId) body.id = editId
    await fetch('/api/candidates', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)})
    setShowModal(false)
    setSaving(false)
    load()
  }

  async function doDelete(id) {
    await fetch('/api/candidates', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'delete', id})})
    setConfirmDelete(null)
    setActiveCard(null)
    load()
  }

  const filtered = candidates.filter(c => {
    if (filterHire && c.wouldHire !== filterHire) return false
    if (search) {
      const s = search.toLowerCase()
      const match = ['name','email','location','skillset','source','notes','certifications'].some(k => (c[k]||'').toLowerCase().includes(s))
      if (!match) return false
    }
    return true
  })

  // ── IMPORT HELPERS ──
  function loadSheetJS() {
    return new Promise((resolve, reject) => {
      if (typeof window.XLSX !== 'undefined') return resolve(window.XLSX)
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      script.onload = () => resolve(window.XLSX)
      script.onerror = () => reject(new Error('Failed to load Excel parser'))
      document.head.appendChild(script)
    })
  }

  function normalizeKey(k) {
    return String(k||'').toLowerCase().replace(/[^a-z0-9]/g,'')
  }

  // Map header text variants → our internal field names
  const HEADER_MAP = {
    name: 'name',
    fullname: 'name',
    email: 'email',
    emailaddress: 'email',
    contactlocation: 'location',
    location: 'location',
    skillset: 'skillset',
    skills: 'skillset',
    link: 'linkedin',
    linkedin: 'linkedin',
    linkedinurl: 'linkedin',
    resume: 'resume',
    resumeurl: 'resume',
    contactsource: 'source',
    source: 'source',
    firstcontactdate: 'firstContactDate',
    firstcontactmethod: 'firstContactMethod',
    dateinterviewed: 'dateInterviewed',
    interviewdate: 'dateInterviewed',
    dateavailable: 'dateAvailable',
    datehired: 'dateHired',
    wouldhire: 'wouldHire',
    salaryrequirement: 'salaryRequirement',
    salary: 'salaryRequirement',
    notes: 'notes',
    experienceyears: 'experienceYears',
    experience: 'experienceYears',
    yearsofexperience: 'experienceYears',
    yearsexperience: 'experienceYears',
    certifications: 'certifications',
    certs: 'certifications',
  }

  function excelDateToISO(val) {
    if (val === null || val === undefined || val === '') return ''
    if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString().split('T')[0]
    if (typeof val === 'number') {
      // Excel serial date
      const d = new Date(Math.round((val - 25569) * 86400 * 1000))
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    }
    if (typeof val === 'string') {
      const d = new Date(val)
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
      return val
    }
    return String(val)
  }

  async function handleFileUpload(file) {
    setImportError('')
    setImportPreview([])
    setImportFileName(file.name)
    try {
      const XLSX = await loadSheetJS()
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { cellDates: true })
      // Prefer the "Candidates" sheet, otherwise the first one
      const sheetName = wb.SheetNames.find(n => n.toLowerCase() === 'candidates') || wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' })
      if (!json.length) {
        setImportError('No rows found in the file')
        return
      }
      // Map columns
      const mapped = json.map(row => {
        const c = {}
        for (const [k, v] of Object.entries(row)) {
          const internal = HEADER_MAP[normalizeKey(k)]
          if (!internal) continue
          if (['firstContactDate','dateInterviewed','dateAvailable','dateHired'].includes(internal)) {
            c[internal] = excelDateToISO(v)
          } else {
            c[internal] = v === null || v === undefined ? '' : String(v).trim()
          }
        }
        return c
      }).filter(c => c.name)  // require name
      setImportPreview(mapped)
    } catch(e) {
      setImportError('Failed to parse file: ' + e.message)
    }
  }

  async function runImport() {
    if (!importPreview.length) return
    setImporting(true)
    try {
      const res = await fetch('/api/candidates', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'bulk_add', candidates: importPreview })})
      const data = await res.json()
      if (data.success) {
        setShowImport(false)
        setImportPreview([])
        setImportFileName('')
        load()
      } else {
        setImportError(data.error || 'Import failed')
      }
    } catch(e) {
      setImportError(e.message)
    }
    setImporting(false)
  }

  // Group counts
  const counts = HIRE_OPTIONS.slice(1).map(o => ({...o, count: candidates.filter(c => c.wouldHire === o.value).length }))

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Candidates</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Recruiting pipeline · {candidates.length} total</p>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <a href="/admin/candidates/dashboard" style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'10px 16px',fontSize:'13px',fontWeight:600,cursor:'pointer',textDecoration:'none',display:'inline-flex',alignItems:'center'}}>
            📊 Dashboard
          </a>
          <button onClick={()=>setShowImport(true)} style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'10px 16px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
            📥 Import
          </button>
          <button onClick={openAdd} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
            + New Candidate
          </button>
        </div>
      </div>

      {/* Pipeline counts */}
      <div style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
        {counts.map(o => (
          <button key={o.value} onClick={()=>setFilterHire(filterHire===o.value?'':o.value)}
            style={{background:filterHire===o.value?o.bg:'#141414',border:'1px solid '+(filterHire===o.value?o.color:'#1e1e1e'),color:filterHire===o.value?o.color:'#9ca3af',borderRadius:'10px',padding:'10px 14px',fontSize:'12px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:'8px'}}>
            <span>{o.label}</span>
            <span style={{background:'rgba(0,0,0,0.4)',padding:'2px 8px',borderRadius:'10px',fontSize:'11px'}}>{o.count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'20px',alignItems:'center'}}>
        <input placeholder="Search name, email, skills, notes..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{...inp, width:'auto', flex:'1 1 280px'}}/>
        {(search||filterHire) && (
          <button onClick={()=>{setSearch('');setFilterHire('')}}
            style={{background:'#1e1e1e',border:'1px solid #252525',color:'#9ca3af',borderRadius:'8px',padding:'9px 14px',fontSize:'12px',cursor:'pointer'}}>Clear</button>
        )}
        <span style={{color:'#6b7280',fontSize:'12px'}}>{filtered.length} shown</span>
      </div>

      {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>}

      {!loading && candidates.length === 0 && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'48px',textAlign:'center'}}>
          <p style={{color:'#6b7280',margin:'0 0 16px'}}>No candidates yet. Add the first one to start tracking.</p>
          <button onClick={openAdd} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 20px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>+ Add First Candidate</button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {filtered.map(c => (
            <div key={c.id} onClick={()=>setActiveCard(c)}
              style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'10px',padding:'14px 16px',cursor:'pointer',transition:'border-color 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor='#8DC63F'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='#1e1e1e'}>
              <div style={{display:'flex',alignItems:'flex-start',gap:'12px',flexWrap:'wrap'}}>
                <div style={{flex:'1 1 220px', minWidth:0}}>
                  <div style={{fontSize:'14px',fontWeight:600,color:'#fff'}}>{c.name}</div>
                  <div style={{fontSize:'12px',color:'#6b7280',marginTop:'2px'}}>{c.email||'—'} {c.location?'· '+c.location:''}</div>
                  {c.skillset && <div style={{fontSize:'12px',color:'#9ca3af',marginTop:'4px',overflow:'hidden',display:'-webkit-box',WebkitLineClamp:1,WebkitBoxOrient:'vertical'}}>{c.skillset}</div>}
                </div>
                <div style={{display:'flex',gap:'10px',alignItems:'center',flexShrink:0}}>
                  {c.experienceYears && <span style={{fontSize:'11px',color:'#6b7280'}}>{c.experienceYears} yrs</span>}
                  <HireBadge value={c.wouldHire}/>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Card */}
      {activeCard && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}}
          onClick={()=>setActiveCard(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'24px',width:'600px',maxWidth:'100%',maxHeight:'92vh',overflowY:'auto'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'14px',gap:'10px'}}>
              <div>
                <h2 style={{fontSize:'20px',fontWeight:700,margin:'0 0 4px',color:'#fff'}}>{activeCard.name}</h2>
                <div style={{fontSize:'12px',color:'#6b7280'}}>{activeCard.email||'No email'} {activeCard.location?'· '+activeCard.location:''}</div>
              </div>
              <button onClick={()=>setActiveCard(null)} style={{background:'none',border:'none',color:'#6b7280',fontSize:'22px',cursor:'pointer',lineHeight:1,padding:'0 4px'}}>✕</button>
            </div>

            <div style={{display:'flex',gap:'10px',alignItems:'center',marginBottom:'16px',flexWrap:'wrap'}}>
              <HireBadge value={activeCard.wouldHire}/>
              {activeCard.experienceYears && <span style={{color:'#9ca3af',fontSize:'12px'}}>📅 {activeCard.experienceYears} years experience</span>}
              {activeCard.salaryRequirement && <span style={{color:'#9ca3af',fontSize:'12px'}}>💰 ${activeCard.salaryRequirement}</span>}
            </div>

            {activeCard.skillset && (
              <div style={{marginBottom:'14px'}}>
                <label style={lbl}>Skills</label>
                <div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'8px',padding:'10px 14px',color:'#d1d5db',fontSize:'13px',whiteSpace:'pre-wrap'}}>{activeCard.skillset}</div>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'10px',marginBottom:'14px'}}>
              {activeCard.source && <div><label style={lbl}>Source</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{activeCard.source}</div></div>}
              {activeCard.firstContactDate && <div><label style={lbl}>First Contact</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{fmtDate(activeCard.firstContactDate)} {activeCard.firstContactMethod?'· '+activeCard.firstContactMethod:''}</div></div>}
              {activeCard.dateInterviewed && <div><label style={lbl}>Interviewed</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{fmtDate(activeCard.dateInterviewed)}</div></div>}
              {activeCard.dateAvailable && <div><label style={lbl}>Available</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{fmtDate(activeCard.dateAvailable)}</div></div>}
              {activeCard.dateHired && <div><label style={lbl}>Hired</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{fmtDate(activeCard.dateHired)}</div></div>}
              {activeCard.certifications && <div><label style={lbl}>Certifications</label><div style={{color:'#d1d5db',fontSize:'13px'}}>{activeCard.certifications}</div></div>}
            </div>

            {(activeCard.linkedin || activeCard.resume) && (
              <div style={{display:'flex',gap:'8px',marginBottom:'14px',flexWrap:'wrap'}}>
                {activeCard.linkedin && <a href={activeCard.linkedin} target="_blank" rel="noopener" style={{background:'#1e1e1e',border:'1px solid #252525',color:'#60a5fa',borderRadius:'8px',padding:'8px 14px',fontSize:'12px',textDecoration:'none'}}>🔗 LinkedIn</a>}
                {activeCard.resume && <a href={activeCard.resume} target="_blank" rel="noopener" style={{background:'#1e1e1e',border:'1px solid #252525',color:'#60a5fa',borderRadius:'8px',padding:'8px 14px',fontSize:'12px',textDecoration:'none'}}>📄 Resume</a>}
              </div>
            )}

            {activeCard.notes && (
              <div style={{marginBottom:'14px'}}>
                <label style={lbl}>Notes</label>
                <div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'8px',padding:'10px 14px',color:'#d1d5db',fontSize:'13px',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{activeCard.notes}</div>
              </div>
            )}

            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'18px',flexWrap:'wrap'}}>
              <button onClick={()=>setConfirmDelete(activeCard.id)} style={{background:'#1e1e1e',border:'1px solid #252525',color:'#f87171',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',cursor:'pointer'}}>Delete</button>
              <button onClick={()=>openEdit(activeCard)} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>✎ Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}}
          onClick={()=>setShowModal(false)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'24px',width:'640px',maxWidth:'100%',maxHeight:'92vh',overflowY:'auto'}}
            onClick={e=>e.stopPropagation()}>
            <h2 style={{fontSize:'18px',fontWeight:700,margin:'0 0 18px'}}>{editId?'Edit Candidate':'New Candidate'}</h2>

            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'12px',marginBottom:'12px'}}>
              <div><label style={lbl}>Name *</label><input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} style={inp}/></div>
              <div><label style={lbl}>Email</label><input value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})} style={inp}/></div>
              <div><label style={lbl}>Location</label><input value={form.location||''} onChange={e=>setForm({...form,location:e.target.value})} style={inp}/></div>
              <div><label style={lbl}>Source</label><input placeholder="LinkedIn, Indeed, Referral..." value={form.source||''} onChange={e=>setForm({...form,source:e.target.value})} style={inp}/></div>
            </div>

            <div style={{marginBottom:'12px'}}>
              <label style={lbl}>Skills</label>
              <textarea rows={2} value={form.skillset||''} onChange={e=>setForm({...form,skillset:e.target.value})} placeholder="SQL, Python, Tableau, Power BI..." style={{...inp,resize:'vertical'}}/>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'12px',marginBottom:'12px'}}>
              <div><label style={lbl}>LinkedIn URL</label><input value={form.linkedin||''} onChange={e=>setForm({...form,linkedin:e.target.value})} style={inp}/></div>
              <div><label style={lbl}>Resume URL</label><input value={form.resume||''} onChange={e=>setForm({...form,resume:e.target.value})} style={inp}/></div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'12px',marginBottom:'12px'}}>
              <div><label style={lbl}>First Contact Date</label><input type="date" value={dateInputVal(form.firstContactDate)} onChange={e=>setForm({...form,firstContactDate:e.target.value})} style={inp}/></div>
              <div><label style={lbl}>First Contact Method</label><input placeholder="LinkedIn, Email, Phone..." value={form.firstContactMethod||''} onChange={e=>setForm({...form,firstContactMethod:e.target.value})} style={inp}/></div>
              <div><label style={lbl}>Date Interviewed</label><input type="date" value={dateInputVal(form.dateInterviewed)} onChange={e=>setForm({...form,dateInterviewed:e.target.value})} style={inp}/></div>
              <div><label style={lbl}>Date Available</label><input type="date" value={dateInputVal(form.dateAvailable)} onChange={e=>setForm({...form,dateAvailable:e.target.value})} style={inp}/></div>
              <div><label style={lbl}>Date Hired</label><input type="date" value={dateInputVal(form.dateHired)} onChange={e=>setForm({...form,dateHired:e.target.value})} style={inp}/></div>
              <div>
                <label style={lbl}>Would Hire?</label>
                <select value={form.wouldHire||''} onChange={e=>setForm({...form,wouldHire:e.target.value})} style={{...inp,cursor:'pointer'}}>
                  {HIRE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'12px',marginBottom:'12px'}}>
              <div><label style={lbl}>Experience (Years)</label><input type="number" value={form.experienceYears||''} onChange={e=>setForm({...form,experienceYears:e.target.value})} style={inp}/></div>
              <div><label style={lbl}>Salary Requirement</label><input value={form.salaryRequirement||''} onChange={e=>setForm({...form,salaryRequirement:e.target.value})} placeholder="120000 or 120k-140k" style={inp}/></div>
            </div>

            <div style={{marginBottom:'12px'}}>
              <label style={lbl}>Certifications</label>
              <input value={form.certifications||''} onChange={e=>setForm({...form,certifications:e.target.value})} style={inp}/>
            </div>

            <div style={{marginBottom:'18px'}}>
              <label style={lbl}>Notes</label>
              <textarea rows={4} value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} style={{...inp,resize:'vertical'}}/>
            </div>

            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',flexWrap:'wrap'}}>
              <button onClick={()=>setShowModal(false)} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'10px 16px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button onClick={save} disabled={saving||!form.name}
                style={{background:form.name?'#8DC63F':'#2a2a2a',color:form.name?'#0a0a0a':'#4b5563',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:700,cursor:form.name?'pointer':'not-allowed'}}>
                {saving?'Saving...':(editId?'Save Changes':'Add Candidate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}}
          onClick={()=>setShowImport(false)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'24px',width:'720px',maxWidth:'100%',maxHeight:'92vh',overflowY:'auto'}}
            onClick={e=>e.stopPropagation()}>
            <h2 style={{fontSize:'18px',fontWeight:700,margin:'0 0 6px'}}>Import Candidates</h2>
            <p style={{fontSize:'13px',color:'#6b7280',margin:'0 0 16px'}}>Upload an Excel (.xlsx) or CSV file. The columns will be auto-matched to candidate fields.</p>

            <div style={{background:'#0f0f0f',border:'1px dashed #2a2a2a',borderRadius:'10px',padding:'24px',textAlign:'center',marginBottom:'14px'}}>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e=>e.target.files[0] && handleFileUpload(e.target.files[0])}
                style={{display:'none'}} id="cand-file-input"/>
              <label htmlFor="cand-file-input" style={{cursor:'pointer',display:'inline-block',background:'#1e1e1e',border:'1px solid #2a2a2a',borderRadius:'8px',padding:'10px 18px',color:'#9ca3af',fontSize:'13px',fontWeight:600}}>
                {importFileName ? '📎 ' + importFileName : '📂 Choose file...'}
              </label>
              <div style={{fontSize:'11px',color:'#6b7280',marginTop:'8px'}}>
                Recognized columns: Name, Email, Location, Skillset, LinkedIn (Link), Resume, Source, Date fields, Would Hire, Salary, Notes, Experience, Certifications
              </div>
            </div>

            {importError && (
              <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'10px 14px',marginBottom:'14px',fontSize:'13px'}}>
                {importError}
              </div>
            )}

            {importPreview.length > 0 && (
              <div style={{marginBottom:'16px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                  <strong style={{color:'#8DC63F',fontSize:'13px'}}>{importPreview.length} candidate{importPreview.length===1?'':'s'} ready to import</strong>
                  <span style={{fontSize:'11px',color:'#6b7280'}}>showing first 5</span>
                </div>
                <div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'10px',overflow:'hidden'}}>
                  <div style={{maxHeight:'280px',overflowY:'auto'}}>
                    {importPreview.slice(0,5).map((c, i) => (
                      <div key={i} style={{padding:'10px 14px',borderBottom: i < 4 ? '1px solid #1e1e1e' : 'none'}}>
                        <div style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>{c.name}</div>
                        <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>
                          {c.email||'no email'} {c.location?'· '+c.location:''} {c.wouldHire?'· '+c.wouldHire:''}
                        </div>
                        {c.skillset && <div style={{fontSize:'11px',color:'#9ca3af',marginTop:'3px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.skillset}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',flexWrap:'wrap'}}>
              <button onClick={()=>{setShowImport(false);setImportPreview([]);setImportFileName('');setImportError('')}}
                style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'10px 16px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button onClick={runImport} disabled={importing || importPreview.length === 0}
                style={{background:importPreview.length>0?'#8DC63F':'#2a2a2a',color:importPreview.length>0?'#0a0a0a':'#4b5563',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:700,cursor:importPreview.length>0?'pointer':'not-allowed'}}>
                {importing?'Importing...':`Import ${importPreview.length} Candidate${importPreview.length===1?'':'s'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1200,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}}
          onClick={()=>setConfirmDelete(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'14px',padding:'20px',width:'380px',maxWidth:'100%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:'0 0 12px',fontSize:'16px'}}>Delete this candidate?</h3>
            <p style={{color:'#9ca3af',fontSize:'13px',margin:'0 0 18px'}}>This cannot be undone.</p>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setConfirmDelete(null)} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button onClick={()=>doDelete(confirmDelete)} style={{background:'#dc2626',border:'none',color:'#fff',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}