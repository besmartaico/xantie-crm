// @ts-nocheck
'use client'
import { useEffect, useState, useRef } from 'react'

const selSty = { background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'8px 12px', color:'#fff', fontSize:'13px', cursor:'pointer', outline:'none', width:'100%' }
const inpSty = { width:'100%', background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'14px', outline:'none', boxSizing:'border-box' }
const thS = { textAlign:'left', padding:'9px 14px', fontSize:'11px', fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.07em', background:'#111111', borderBottom:'1px solid #1e1e1e', whiteSpace:'nowrap' }
const tdS = { padding:'9px 14px', fontSize:'13px', color:'#d1d5db', borderBottom:'1px solid #1a1a1a', verticalAlign:'middle' }

function excelDateToISO(serial) {
  const num = parseFloat(serial)
  if (isNaN(num) || num < 1) return String(serial)
  const d = new Date(Date.UTC(1899, 11, 30) + num * 86400000)
  return d.toISOString().split('T')[0]
}

function normalizeDate(value) {
  if (!value && value !== 0) return ''
  const str = String(value).trim()
  if (/^\d{4,6}(\.\d+)?$/.test(str)) return excelDateToISO(str)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0]
  return str
}

const FIELDS = ['name','email','date','hours','description','project','billable']
const FIELD_LABELS = {
  name: 'Employee Name', email: 'Email', date: 'Date', hours: 'Hours',
  description: 'Description', project: 'Project', billable: 'Billable (yes/no)'
}
const REQUIRED = ['name','email','date','hours']

function autoMap(hdrs) {
  const m = {}
  const lower = hdrs.map(h => String(h).toLowerCase().trim())
  const matchers = {
    name: ['name','employee','person','full name','staff'],
    email: ['email','e-mail','mail'],
    date: ['date','day','work date'],
    hours: ['hours','hrs','time','duration'],
    description: ['description','desc','notes','note','details','task','work'],
    project: ['project','proj','client','job','matter'],
    billable: ['billable','bill','billed'],
  }
  for (const [field, keywords] of Object.entries(matchers)) {
    const idx = lower.findIndex(h => keywords.some(k => h.includes(k)))
    if (idx >= 0) m[field] = String(idx)
  }
  return m
}

export default function ImportPage() {
  const [tab, setTab] = useState('import')

  // Import
  const [step, setStep] = useState(0)
  const [rawData, setRawData] = useState([])
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [preview, setPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  // Duplicates
  const [allEntries, setAllEntries] = useState([])
  const [loadingDups, setLoadingDups] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const [dupMsg, setDupMsg] = useState('')

  useEffect(() => { if (tab === 'duplicates') loadDups() }, [tab])

  async function loadDups() {
    setLoadingDups(true); setDupMsg(''); setSelected(new Set())
    try {
      const data = await (await fetch('/api/time')).json()
      setAllEntries(Array.isArray(data) ? data : [])
      // Auto-select all duplicates except the first in each group
      const map = {}
      ;(Array.isArray(data) ? data : []).forEach(e => {
        const k = [e.email||'', e.date||'', String(parseFloat(e.hours)||0), e.project||''].join('|')
        if (!map[k]) map[k] = []
        map[k].push(e)
      })
      const autoSelected = new Set()
      Object.values(map).filter(g => g.length > 1).forEach(g => {
        g.slice(1).forEach(e => autoSelected.add(e.id))
      })
      setSelected(autoSelected)
    } catch(e) {}
    setLoadingDups(false)
  }

  const dupGroups = (() => {
    const map = {}
    allEntries.forEach(e => {
      const k = [e.email||'', e.date||'', String(parseFloat(e.hours)||0), e.project||''].join('|')
      if (!map[k]) map[k] = []
      map[k].push(e)
    })
    return Object.values(map).filter(g => g.length > 1)
  })()

  async function deleteSelected() {
    if (!selected.size) return
    setDeleting(true)
    let count = 0
    for (const id of selected) {
      try {
        const r = await fetch('/api/time', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'delete', id }) })
        const d = await r.json()
        if (d.success) count++
      } catch(e) {}
    }
    setDupMsg('Deleted ' + count + ' entr' + (count===1?'y':'ies') + '.')
    setSelected(new Set())
    loadDups()
    setDeleting(false)
  }

  function loadXLSX(cb) {
    if (window.XLSX) { cb(); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload = cb; s.onerror = () => setError('Failed to load Excel parser. Try saving as CSV.')
    document.head.appendChild(s)
  }

  function handleFile(file) {
    setError(''); setResult(null); setStep(0)
    const ext = file.name.split('.').pop().toLowerCase()
    const reader = new FileReader()
    reader.onload = e => {
      try {
        if (ext === 'csv') parseCSV(e.target.result)
        else if (ext === 'xlsx' || ext === 'xls') loadXLSX(() => parseExcel(e.target.result))
        else setError('Please upload a .csv, .xlsx or .xls file.')
      } catch(err) { setError('Parse error: ' + err.message) }
    }
    if (ext === 'csv') reader.readAsText(file)
    else reader.readAsArrayBuffer(file)
  }

  function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim())
    const rows = lines.map(l => {
      const r = []; let cur = ''; let inQ = false
      for (const ch of l) {
        if (ch === '"') inQ = !inQ
        else if (ch === ',' && !inQ) { r.push(cur.trim()); cur = '' }
        else cur += ch
      }
      r.push(cur.trim()); return r
    })
    if (!rows.length) { setError('File appears empty.'); return }
    setHeaders(rows[0]); setRawData(rows.slice(1).filter(r=>r.some(c=>c)))
    setMapping(autoMap(rows[0])); setStep(1)
  }

  function parseExcel(buffer) {
    const wb = window.XLSX.read(buffer, { type:'arraybuffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = window.XLSX.utils.sheet_to_json(ws, { header:1, defval:'' })
    if (!rows.length) { setError('Sheet appears empty.'); return }
    const hdrs = rows[0].map(String)
    setHeaders(hdrs); setRawData(rows.slice(1).filter(r=>r.some(c=>c!=='')))
    setMapping(autoMap(hdrs)); setStep(1)
  }

  function getVal(row, field) {
    const idx = mapping[field]
    if (idx === undefined || idx === '' || idx === '-1') return ''
    return String(row[parseInt(idx)] ?? '').trim()
  }

  function buildRows() {
    return rawData.map(row => {
      const billableRaw = getVal(row, 'billable').toLowerCase()
      const billable = (billableRaw === 'no' || billableRaw === 'false' || billableRaw === '0') ? 'no' : 'yes'
      return {
        name: getVal(row, 'name'),
        email: getVal(row, 'email'),
        date: normalizeDate(getVal(row, 'date')),
        hours: getVal(row, 'hours'),
        description: getVal(row, 'description'),
        project: getVal(row, 'project'),
        billable,
      }
    }).filter(r => r.name && r.email && r.date && r.hours)
  }

  function goPreview() {
    const rows = buildRows()
    if (!rows.length) {
      setError('No valid rows found. Make sure Name, Email, Date and Hours are mapped.')
      return
    }
    setPreview(rows); setStep(2); setError('')
  }

  async function doImport() {
    setImporting(true); setError('')
    try {
      const entries = buildRows()
      if (!entries.length) { setError('No valid rows to import.'); setImporting(false); return }

      // 1. Auto-create missing projects
      const existProj = await (await fetch('/api/projects')).json()
      const existProjNames = new Set((existProj||[]).map(p => p.name.toLowerCase().trim()))
      const newProjNames = [...new Set(entries.map(e=>e.project).filter(Boolean))]
        .filter(p => !existProjNames.has(p.toLowerCase().trim()))
      for (const name of newProjNames) {
        await fetch('/api/projects', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'add', name, description:'', createdBy:'import' })
        })
      }

      // 2. Auto-create missing users (xantie.com emails only get registered accounts)
      const existUsers = await (await fetch('/api/users')).json()
      const existEmails = new Set((existUsers||[]).map(u => u.email.toLowerCase().trim()))
      const newUsers = [...new Map(entries.map(e=>[e.email.toLowerCase(),{name:e.name,email:e.email}])).values()]
        .filter(u => !existEmails.has(u.email.toLowerCase().trim()))
      let newUsersCreated = 0
      for (const u of newUsers) {
        // Add to Users sheet with role 'viewer' and no password (import-only user)
        try {
          await fetch('/api/users/create', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ name: u.name, email: u.email, role: 'viewer', source: 'import' })
          })
          newUsersCreated++
        } catch(e) {}
      }

      // 3. Import time entries one by one
      let imported = 0
      for (const entry of entries) {
        try {
          const res = await fetch('/api/time', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ action:'add', ...entry, importedFrom:'excel-import' })
          })
          const data = await res.json()
          if (data.success) imported++
        } catch(e) {}
      }

      setResult({ count: imported, newProjects: newProjNames.length, newUsers: newUsersCreated })
      setStep(3)
    } catch(e) { setError('Import error: ' + e.message) }
    setImporting(false)
  }

  function reset() { setStep(0); setRawData([]); setHeaders([]); setMapping({}); setPreview([]); setResult(null); setError('') }

  const validRows = step >= 1 ? buildRows() : []
  const projectsInFile = [...new Set(validRows.map(e=>e.project).filter(Boolean))]
  const usersInFile = [...new Map(validRows.map(e=>[e.email,e.name])).entries()].map(([email,name])=>({name,email}))

  return (
    <div>
      {/* Tab switcher */}
      <div style={{display:'flex',gap:'0',marginBottom:'24px',background:'#0a0a0a',borderRadius:'10px',padding:'4px',width:'fit-content',border:'1px solid #1e1e1e'}}>
        {[{k:'import',l:'Import Data'},{k:'duplicates',l:'Duplicate Records'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{padding:'9px 20px',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:600,cursor:'pointer',
              background:tab===t.k?'#8DC63F':'transparent',color:tab===t.k?'#0a0a0a':'#6b7280',transition:'all 0.15s'}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ===== IMPORT TAB ===== */}
      {tab === 'import' && (
        <div>
          <div style={{marginBottom:'24px'}}>
            <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Import Time Entries</h1>
            <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Upload Excel (.xlsx) or CSV. New projects and users are auto-created. Excel dates auto-converted.</p>
          </div>

          {/* Steps */}
          <div style={{display:'flex',alignItems:'center',gap:'0',marginBottom:'28px'}}>
            {['Upload','Map Columns','Preview','Done'].map((s,i)=>(
              <div key={s} style={{display:'flex',alignItems:'center'}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'28px',height:'28px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,flexShrink:0,
                    background:step>i?'#8DC63F':step===i?'rgba(141,198,63,0.15)':'#1e1e1e',
                    color:step>i?'#0a0a0a':step===i?'#8DC63F':'#4b5563',
                    border:step===i?'2px solid #8DC63F':'2px solid transparent'}}>
                    {step>i?'✓':i+1}
                  </div>
                  <span style={{fontSize:'13px',fontWeight:step===i?600:400,color:step===i?'#fff':'#4b5563'}}>{s}</span>
                </div>
                {i<3&&<div style={{width:'28px',height:'2px',background:'#1e1e1e',margin:'0 6px'}}/>}
              </div>
            ))}
          </div>

          {error && <div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'12px 16px',marginBottom:'16px',fontSize:'13px'}}>{error}</div>}

          {/* Step 0: Upload */}
          {step === 0 && (
            <div
              onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)handleFile(f)}}
              onDragOver={e=>{e.preventDefault();setDragOver(true)}}
              onDragLeave={()=>setDragOver(false)}
              onClick={()=>fileRef.current?.click()}
              style={{border:'2px dashed '+(dragOver?'#8DC63F':'#2a2a2a'),borderRadius:'16px',padding:'60px',textAlign:'center',cursor:'pointer',background:dragOver?'rgba(141,198,63,0.05)':'#141414',transition:'all 0.2s'}}>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{display:'none'}} onChange={e=>{const f=e.target.files[0];if(f)handleFile(f)}}/>
              <div style={{fontSize:'40px',marginBottom:'14px'}}>📂</div>
              <p style={{fontSize:'16px',fontWeight:600,color:'#fff',margin:'0 0 6px'}}>Drop your file here or click to browse</p>
              <p style={{fontSize:'13px',color:'#6b7280',margin:0}}>Excel serial dates (e.g. 46128) are automatically converted</p>
            </div>
          )}

          {/* Step 1: Map */}
          {step === 1 && (
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
                <div>
                  <h2 style={{fontSize:'16px',fontWeight:700,margin:0}}>Map Your Columns</h2>
                  <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>{rawData.length} data rows · {headers.length} columns · {validRows.length} valid rows ready</p>
                </div>
                <button onClick={reset} style={{background:'none',border:'none',color:'#6b7280',fontSize:'13px',cursor:'pointer'}}>← Start over</button>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'20px'}}>
                {FIELDS.map(field => (
                  <div key={field} style={{background:'#141414',border:'1px solid '+(REQUIRED.includes(field)&&!mapping[field]?'rgba(248,113,113,0.3)':'#1e1e1e'),borderRadius:'10px',padding:'12px'}}>
                    <label style={{display:'block',fontSize:'11px',color:REQUIRED.includes(field)?'#f87171':'#6b7280',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>
                      {FIELD_LABELS[field]}{REQUIRED.includes(field)?' *':''}
                    </label>
                    <select value={mapping[field]??''} onChange={e=>setMapping(m=>({...m,[field]:e.target.value}))} style={selSty}>
                      <option value="">— Not mapped —</option>
                      {headers.map((h,i)=><option key={i} value={String(i)}>{h} (col {i+1}){rawData[0]?.[i]!==undefined?' → '+String(rawData[0][i]).substring(0,15):''}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {projectsInFile.length > 0 && (
                <div style={{background:'rgba(141,198,63,0.06)',border:'1px solid rgba(141,198,63,0.2)',borderRadius:'10px',padding:'12px 16px',marginBottom:'16px'}}>
                  <p style={{margin:'0 0 4px',fontSize:'12px',color:'#8DC63F',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>Projects in file — will be auto-created if new</p>
                  <p style={{margin:0,fontSize:'13px',color:'#9ca3af'}}>{projectsInFile.join(', ')}</p>
                </div>
              )}
              {usersInFile.length > 0 && (
                <div style={{background:'rgba(96,165,250,0.06)',border:'1px solid rgba(96,165,250,0.15)',borderRadius:'10px',padding:'12px 16px',marginBottom:'20px'}}>
                  <p style={{margin:'0 0 4px',fontSize:'12px',color:'#60a5fa',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>Employees in file — will be added to Users if new</p>
                  <p style={{margin:0,fontSize:'13px',color:'#9ca3af'}}>{usersInFile.map(u=>u.name+' ('+u.email+')').join(' · ')}</p>
                </div>
              )}

              <button onClick={goPreview}
                style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'11px 24px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
                Preview {validRows.length} Rows →
              </button>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
                <div>
                  <h2 style={{fontSize:'16px',fontWeight:700,margin:0}}>Preview</h2>
                  <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>{preview.length} entries · {projectsInFile.length} projects · {usersInFile.length} employees</p>
                </div>
                <button onClick={()=>setStep(1)} style={{background:'none',border:'none',color:'#6b7280',fontSize:'13px',cursor:'pointer'}}>← Back</button>
              </div>

              <div style={{overflowX:'auto',marginBottom:'20px',background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px'}}>
                <table style={{width:'100%',borderCollapse:'collapse',minWidth:'700px'}}>
                  <thead><tr>
                    {['Name','Email','Date','Hours','Project','Billable','Description'].map(h=><th key={h} style={thS}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {preview.slice(0,8).map((r,i)=>(
                      <tr key={i} onMouseEnter={e=>e.currentTarget.style.background='#181818'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                        <td style={tdS}>{r.name}</td>
                        <td style={{...tdS,fontSize:'12px',color:'#9ca3af'}}>{r.email}</td>
                        <td style={tdS}>{r.date}</td>
                        <td style={tdS}><span style={{background:'rgba(141,198,63,0.12)',color:'#8DC63F',padding:'2px 8px',borderRadius:'5px',fontSize:'12px',fontWeight:700}}>{r.hours}</span></td>
                        <td style={tdS}>{r.project||<span style={{color:'#4b5563'}}>—</span>}</td>
                        <td style={tdS}><span style={{background:r.billable==='no'?'rgba(156,163,175,0.1)':'rgba(96,165,250,0.1)',color:r.billable==='no'?'#9ca3af':'#60a5fa',padding:'2px 8px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>{r.billable==='no'?'Non-Billable':'Billable'}</span></td>
                        <td style={{...tdS,maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#9ca3af'}}>{r.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 8 && <p style={{color:'#6b7280',fontSize:'12px',padding:'8px 14px',borderTop:'1px solid #1e1e1e',margin:0}}>...and {preview.length-8} more rows</p>}
              </div>

              <div style={{display:'flex',gap:'12px'}}>
                <button onClick={doImport} disabled={importing}
                  style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px 28px',fontSize:'14px',fontWeight:700,cursor:importing?'not-allowed':'pointer',opacity:importing?0.7:1}}>
                  {importing?'Importing...':'Import '+preview.length+' Entries'}
                </button>
                <button onClick={()=>setStep(1)} style={{background:'#252525',color:'#fff',border:'none',borderRadius:'8px',padding:'12px 20px',fontSize:'14px',cursor:'pointer'}}>Back</button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && result && (
            <div style={{textAlign:'center',padding:'48px 24px',background:'#141414',borderRadius:'16px',border:'1px solid #1e1e1e'}}>
              <div style={{fontSize:'48px',marginBottom:'16px'}}>✅</div>
              <h2 style={{fontSize:'22px',fontWeight:700,margin:'0 0 12px'}}>Import Complete</h2>
              <p style={{color:'#8DC63F',fontSize:'18px',fontWeight:700,margin:'0 0 6px'}}>{result.count} time entries imported</p>
              {result.newProjects > 0 && <p style={{color:'#9ca3af',fontSize:'13px',margin:'4px 0'}}>{result.newProjects} new project{result.newProjects>1?'s':''} created</p>}
              {result.newUsers > 0 && <p style={{color:'#9ca3af',fontSize:'13px',margin:'4px 0'}}>{result.newUsers} new user{result.newUsers>1?'s':''} added</p>}
              <div style={{display:'flex',gap:'12px',justifyContent:'center',marginTop:'28px'}}>
                <button onClick={reset} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'11px 24px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>Import Another File</button>
                <button onClick={()=>setTab('duplicates')} style={{background:'#252525',color:'#fff',border:'none',borderRadius:'8px',padding:'11px 24px',fontSize:'14px',cursor:'pointer'}}>Check for Duplicates →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== DUPLICATES TAB ===== */}
      {tab === 'duplicates' && (
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
            <div>
              <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Duplicate Records</h1>
              <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>
                Entries matching the same employee + date + hours + project.
                {!loadingDups && <span> <span style={{color:dupGroups.length>0?'#f87171':'#8DC63F',fontWeight:600}}>{dupGroups.length} group{dupGroups.length!==1?'s':''}</span> found.</span>}
              </p>
            </div>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={loadDups} style={{background:'#1e1e1e',border:'1px solid #2a2a2a',color:'#9ca3af',borderRadius:'8px',padding:'8px 14px',fontSize:'13px',cursor:'pointer'}}>↻ Refresh</button>
              {selected.size > 0 && (
                <button onClick={deleteSelected} disabled={deleting}
                  style={{background:'#f87171',color:'#fff',border:'none',borderRadius:'8px',padding:'8px 18px',fontSize:'13px',fontWeight:700,cursor:deleting?'not-allowed':'pointer',opacity:deleting?0.7:1}}>
                  {deleting?'Deleting...':'Delete '+selected.size+' Selected'}
                </button>
              )}
            </div>
          </div>

          {dupMsg && <div style={{background:'rgba(141,198,63,0.08)',border:'1px solid rgba(141,198,63,0.2)',color:'#8DC63F',borderRadius:'8px',padding:'10px 16px',marginBottom:'16px',fontSize:'13px'}}>{dupMsg}</div>}

          {loadingDups && <div style={{color:'#6b7280',padding:'48px',textAlign:'center'}}>Loading entries...</div>}

          {!loadingDups && dupGroups.length === 0 && (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'60px',textAlign:'center'}}>
              <div style={{fontSize:'40px',marginBottom:'12px'}}>✅</div>
              <p style={{color:'#6b7280',margin:0,fontSize:'15px'}}>No duplicate records found.</p>
            </div>
          )}

          {!loadingDups && dupGroups.map((group, gi) => (
            <div key={gi} style={{background:'#141414',border:'1px solid rgba(248,113,113,0.25)',borderRadius:'12px',marginBottom:'12px',overflow:'hidden'}}>
              <div style={{background:'rgba(248,113,113,0.06)',borderBottom:'1px solid rgba(248,113,113,0.15)',padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <span style={{background:'rgba(248,113,113,0.15)',color:'#f87171',fontSize:'11px',fontWeight:700,padding:'2px 8px',borderRadius:'5px',textTransform:'uppercase'}}>{group.length} duplicates</span>
                  <span style={{fontSize:'13px',color:'#d1d5db',fontWeight:600}}>{group[0].name}</span>
                  <span style={{fontSize:'12px',color:'#6b7280'}}>{group[0].date} · {group[0].hours}h{group[0].project?' · '+group[0].project:''}</span>
                </div>
                <button onClick={()=>{
                  // Select all but the first (keep oldest)
                  const toSel = new Set(selected)
                  group.slice(1).forEach(e => toSel.add(e.id))
                  setSelected(toSel)
                }} style={{background:'none',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'6px',padding:'4px 10px',fontSize:'12px',cursor:'pointer',fontWeight:600}}>
                  Select duplicates
                </button>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>
                  <th style={{...thS,width:'36px',textAlign:'center'}}></th>
                  {['Employee','Date','Hours','Project','Billable','Description','Source'].map(h=><th key={h} style={thS}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {group.map((e,ei) => (
                    <tr key={e.id} style={{background:selected.has(e.id)?'rgba(248,113,113,0.05)':''}}
                      onMouseEnter={ev=>ev.currentTarget.style.background=selected.has(e.id)?'rgba(248,113,113,0.08)':'#181818'}
                      onMouseLeave={ev=>ev.currentTarget.style.background=selected.has(e.id)?'rgba(248,113,113,0.05)':''}>
                      <td style={{...tdS,textAlign:'center'}}>
                        <input type="checkbox" checked={selected.has(e.id)}
                          onChange={ev=>{const s=new Set(selected);ev.target.checked?s.add(e.id):s.delete(e.id);setSelected(s)}}
                          style={{cursor:'pointer',accentColor:'#f87171'}}/>
                      </td>
                      <td style={tdS}>
                        <div style={{fontWeight:500}}>{e.name}</div>
                        <div style={{fontSize:'11px',color:'#6b7280'}}>{e.email}</div>
                        {ei===0&&<div style={{fontSize:'10px',color:'#8DC63F',fontWeight:600,textTransform:'uppercase',marginTop:'2px'}}>keep</div>}
                      </td>
                      <td style={tdS}>{e.date}</td>
                      <td style={tdS}><span style={{background:'rgba(141,198,63,0.12)',color:'#8DC63F',padding:'2px 8px',borderRadius:'5px',fontSize:'12px',fontWeight:700}}>{e.hours}</span></td>
                      <td style={tdS}>{e.project||<span style={{color:'#4b5563'}}>—</span>}</td>
                      <td style={tdS}><span style={{background:e.billable==='no'?'rgba(156,163,175,0.1)':'rgba(96,165,250,0.1)',color:e.billable==='no'?'#9ca3af':'#60a5fa',padding:'2px 6px',borderRadius:'4px',fontSize:'11px',fontWeight:600}}>{e.billable==='no'?'Non-Bill.':'Bill.'}</span></td>
                      <td style={{...tdS,maxWidth:'180px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#9ca3af'}}>{e.description}</td>
                      <td style={{...tdS,fontSize:'11px',color:'#6b7280'}}>{e.importedFrom||'manual'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}