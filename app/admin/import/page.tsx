// @ts-nocheck
'use client'
import { useState, useRef } from 'react'

const inp = { width:'100%', background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'16px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.07em' }

const SYSTEM_FIELDS = ['name','email','date','hours','description']

export default function ImportPage() {
  const [step, setStep] = useState(1)
  const [rawData, setRawData] = useState([])
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [preview, setPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const fileRef = useRef()

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const XLSX = await import('xlsx')
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(ws, { header: 1 })
    const hdrs = json[0] || []
    const rows = json.slice(1).filter(r => r.some(c => c !== undefined && c !== ''))
    setHeaders(hdrs)
    setRawData(rows)
    // Auto-map obvious fields
    const auto = {}
    hdrs.forEach((h, i) => {
      const hl = String(h).toLowerCase()
      if (hl.includes('name') && !hl.includes('email')) auto['name'] = i
      else if (hl.includes('email')) auto['email'] = i
      else if (hl.includes('date')) auto['date'] = i
      else if (hl.includes('hour') || hl === 'hrs' || hl === 'time') auto['hours'] = i
      else if (hl.includes('desc') || hl.includes('note') || hl.includes('task')) auto['description'] = i
    })
    setMapping(auto)
    setStep(2)
  }

  function buildPreview() {
    return rawData.slice(0, 5).map(row => ({
      name: row[mapping.name] || '',
      email: row[mapping.email] || '',
      date: normalizeDate(row[mapping.date]) || '',
      hours: row[mapping.hours] || '',
      description: row[mapping.description] || '',
    }))
  }

  function goPreview() {
    setPreview(buildPreview())
    setStep(3)
  }

  async function doImport() {
    setImporting(true)
    const entries = rawData.map(row => ({
      name: String(row[mapping.name] || ''),
      email: String(row[mapping.email] || ''),
      date: normalizeDate(row[mapping.date]),
      hours: String(row[mapping.hours] || ''),
      description: String(row[mapping.description] || ''),
      importedFrom: 'excel-import',
    }))
    const res = await fetch('/api/time', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'import', entries })
    })
    const data = await res.json()
    setResult(data)
    setImporting(false)
    setStep(4)
  }

  return (
    <div>
      <h1 style={{fontSize:'22px',fontWeight:700,marginBottom:'8px'}}>Import Time Entries</h1>
      <p style={{color:'#6b7280',fontSize:'13px',marginBottom:'28px'}}>Upload an Excel or CSV export and map the columns to import time entries.</p>

      {/* Step indicator */}
      <div style={{display:'flex',gap:'8px',marginBottom:'32px'}}>
        {['Upload','Map Fields','Preview','Done'].map((s,i) => (
          <div key={i} style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <div style={{width:'24px',height:'24px',borderRadius:'50%',background: step > i+1 ? '#34d399' : step === i+1 ? '#6366f1' : '#2a2a2a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,color:'#fff',flexShrink:0}}>{step > i+1 ? '✓' : i+1}</div>
            <span style={{fontSize:'13px',color: step === i+1 ? '#fff' : '#6b7280'}}>{s}</span>
            {i < 3 && <span style={{color:'#2a2a2a',margin:'0 4px'}}>›</span>}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={{background:'#1a1a1a',border:'2px dashed #2a2a2a',borderRadius:'16px',padding:'48px',textAlign:'center'}}>
          <div style={{fontSize:'48px',marginBottom:'16px'}}>📊</div>
          <p style={{color:'#d1d5db',marginBottom:'20px'}}>Upload your Excel (.xlsx, .xls) or CSV file</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{display:'none'}} />
          <button onClick={() => fileRef.current.click()} style={{background:'#6366f1',color:'#fff',border:'none',borderRadius:'8px',padding:'12px 24px',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>
            Choose File
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'16px',padding:'28px'}}>
          <h2 style={{fontSize:'16px',fontWeight:600,marginBottom:'20px'}}>Map Columns → Fields</h2>
          <p style={{color:'#6b7280',fontSize:'13px',marginBottom:'24px'}}>{rawData.length} rows found. Match your file's columns to the system fields.</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
            {SYSTEM_FIELDS.map(field => (
              <div key={field}>
                <label style={lbl}>{field}</label>
                <select value={mapping[field] ?? ''} onChange={e => setMapping({...mapping,[field]: e.target.value === '' ? undefined : parseInt(e.target.value)})}
                  style={{...inp}}>
                  <option value="">— skip —</option>
                  {headers.map((h,i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:'12px',marginTop:'28px'}}>
            <button onClick={goPreview} style={{background:'#6366f1',color:'#fff',border:'none',borderRadius:'8px',padding:'12px 24px',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>Preview Import →</button>
            <button onClick={() => setStep(1)} style={{background:'#2a2a2a',color:'#fff',border:'none',borderRadius:'8px',padding:'12px 20px',fontSize:'14px',cursor:'pointer'}}>Back</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'16px',padding:'28px',marginBottom:'20px'}}>
            <h2 style={{fontSize:'16px',fontWeight:600,marginBottom:'16px'}}>Preview (first 5 rows)</h2>
            <div className="tbl-wrap">
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:'500px'}}>
                <thead>
                  <tr>
                    {SYSTEM_FIELDS.map(f => <th key={f} style={{textAlign:'left',padding:'8px 12px',fontSize:'11px',fontWeight:700,color:'#4b5563',textTransform:'uppercase',borderBottom:'1px solid #1f1f1f'}}>{f}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row,i) => (
                    <tr key={i}>
                      {SYSTEM_FIELDS.map(f => <td key={f} style={{padding:'8px 12px',fontSize:'13px',color:'#d1d5db',borderBottom:'1px solid #1f1f1f'}}>{row[f]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{color:'#6b7280',fontSize:'12px',marginTop:'12px'}}>Will import all {rawData.length} rows.</p>
          </div>
          <div style={{display:'flex',gap:'12px'}}>
            <button onClick={doImport} disabled={importing} style={{background:'#34d399',color:'#0f0f0f',border:'none',borderRadius:'8px',padding:'12px 24px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
              {importing ? 'Importing...' : `Import All ${rawData.length} Rows`}
            </button>
            <button onClick={() => setStep(2)} style={{background:'#2a2a2a',color:'#fff',border:'none',borderRadius:'8px',padding:'12px 20px',fontSize:'14px',cursor:'pointer'}}>Back</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'16px',padding:'48px',textAlign:'center'}}>
          <div style={{fontSize:'48px',marginBottom:'16px'}}>✅</div>
          <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'8px'}}>Import Complete!</h2>
          <p style={{color:'#6b7280',marginBottom:'24px'}}>{result?.count} entries imported successfully.</p>
          <div style={{display:'flex',gap:'12px',justifyContent:'center'}}>
            <a href="/admin" style={{background:'#6366f1',color:'#fff',border:'none',borderRadius:'8px',padding:'12px 24px',fontSize:'14px',fontWeight:600,cursor:'pointer',display:'inline-block'}}>View Time Entries</a>
            <button onClick={() => { setStep(1); setRawData([]); setHeaders([]); setMapping({}); setResult(null) }}
              style={{background:'#2a2a2a',color:'#fff',border:'none',borderRadius:'8px',padding:'12px 20px',fontSize:'14px',cursor:'pointer'}}>Import Another</button>
          </div>
        </div>
      )}
    </div>
  )
}