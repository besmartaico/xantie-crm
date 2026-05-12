// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const SignPdfViewer = dynamic(() => import('@/components/SignPdfViewer'), { ssr: false })

export default function StartSigningPage({ params }) {
  const [resolvedParams, setResolvedParams] = useState(null)
  const [docName, setDocName] = useState('')
  const [fields, setFields] = useState([])
  const [pdfBlobUrl, setPdfBlobUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState({})
  const [activeField, setActiveField] = useState(null)
  const [signerName, setSignerName] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    if (u.role !== 'admin') { window.location.href = '/admin/dashboard'; return }
    Promise.resolve(params).then(p => setResolvedParams(p))
  }, [])

  useEffect(() => {
    if (!resolvedParams) return
    load()
  }, [resolvedParams])

  async function load() {
    setLoading(true)
    try {
      const data = await (await fetch('/api/documents/' + resolvedParams.documentId + '/fields')).json()
      setDocName(data.name || '')
      setFields(data.fields || [])
      const pdfRes = await fetch('/api/documents/raw/' + resolvedParams.documentId)
      const buf = await pdfRes.arrayBuffer()
      setPdfBlobUrl(URL.createObjectURL(new Blob([buf], { type: 'application/pdf' })))
    } catch(e) {}
    setLoading(false)
  }

  function setFieldValueAndGroup(field, val) {
    setValues(prev => {
      const next = {...prev, [field.id]: val}
      if (field.group) {
        fields.forEach(f => {
          if (f.id !== field.id && f.type === field.type && f.group && f.group === field.group && f.assignee === 'admin') {
            next[f.id] = val
          }
        })
      }
      return next
    })
  }

  function applyToAll(field, val) {
    setValues(prev => {
      const next = {...prev}
      fields.filter(f => f.type === field.type && f.assignee === 'admin').forEach(f => { next[f.id] = val })
      return next
    })
  }

  async function submit() {
    if (!signerName.trim() || !signerEmail.trim()) {
      setSubmitError('Please enter the signer name and email.')
      return
    }
    setSubmitting(true); setSubmitError('')
    try {
      const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
      const res = await fetch('/api/sign-requests', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          documentId: resolvedParams.documentId,
          documentName: docName,
          fields,
          adminPreValues: values,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim(),
          createdBy: u.email || '',
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'Failed to create signing request')
        setSubmitting(false)
        return
      }
      window.location.href = '/admin/sign-requests'
    } catch(e) {
      setSubmitError(e.message || 'Network error')
      setSubmitting(false)
    }
  }

  if (!resolvedParams) return null

  const adminFields = fields.filter(f => f.assignee === 'admin')
  const userFields = fields.filter(f => !f.assignee || f.assignee === 'user')
  const adminFilledCount = adminFields.filter(f => values[f.id]).length

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',color:'#fff'}}>
      <div style={{maxWidth:'1100px',margin:'0 auto',padding:'24px 16px'}}>
        <div style={{marginBottom:'18px'}}>
          <a href={'/admin/documents/' + resolvedParams.documentId} style={{color:'#9ca3af',fontSize:'13px',textDecoration:'none'}}>← Back to document</a>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:'4px 0 0'}}>{docName || 'Start signing'}</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Fill any admin fields, enter the signer's info, then send. Admin fields are <span style={{color:'#f97316'}}>highlighted orange</span>; user fields are not editable here.</p>
        </div>

        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'14px 16px',marginBottom:'16px'}}>
          <h3 style={{fontSize:'12px',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 10px'}}>Send to</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'10px'}}>
            <div>
              <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Signer Name</label>
              <input value={signerName} onChange={e=>setSignerName(e.target.value)} style={{width:'100%',background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'10px 13px',color:'#fff',fontSize:'14px',outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div>
              <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Signer Email</label>
              <input type="email" value={signerEmail} onChange={e=>setSignerEmail(e.target.value)} style={{width:'100%',background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'10px 13px',color:'#fff',fontSize:'14px',outline:'none',boxSizing:'border-box'}}/>
            </div>
          </div>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'14px',fontSize:'12px',color:'#9ca3af',flexWrap:'wrap'}}>
          <span>Admin fields filled:</span>
          <strong style={{color:'#f97316'}}>{adminFilledCount} of {adminFields.length}</strong>
          <span style={{marginLeft:'12px'}}>User fields (filled later by signer):</span>
          <strong style={{color:'#8DC63F'}}>{userFields.length}</strong>
        </div>

        {submitError && (
          <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'10px 14px',marginBottom:'14px',fontSize:'13px'}}>{submitError}</div>
        )}

        <div style={{display:'flex',gap:'10px',marginBottom:'18px'}}>
          <button onClick={submit} disabled={submitting} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px 22px',fontSize:'14px',fontWeight:700,cursor:submitting?'wait':'pointer',opacity:submitting?0.7:1}}>{submitting?'Sending…':'📧 Send to signer'}</button>
          {adminFields.length === 0 && <p style={{color:'#6b7280',fontSize:'12px',alignSelf:'center'}}>No admin fields on this template; just enter signer info and send.</p>}
        </div>

        {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading document...</div>}
        {!loading && pdfBlobUrl && (
          <div style={{maxHeight:'calc(100vh - 380px)',display:'flex'}}>
            <SignPdfViewer fileUrl={pdfBlobUrl} fields={fields} values={values} onClickField={(f)=>{ if (f.assignee === 'admin') setActiveField(f) }} restrictedAssignee="admin"/>
          </div>
        )}
      </div>

      {activeField && <FieldModal field={activeField} fields={fields} restrictedAssignee="admin" currentValue={values[activeField.id]} onClose={()=>setActiveField(null)} onSave={(val, applyAll)=>{
        if (applyAll) applyToAll(activeField, val)
        else setFieldValueAndGroup(activeField, val)
        setActiveField(null)
      }}/>}
    </div>
  )
}

function FieldModal({ field, fields, restrictedAssignee, currentValue, onClose, onSave }) {
  const [val, setVal] = useState(currentValue || '')
  const [mode, setMode] = useState('draw')
  // If restrictedAssignee is set, only count fields belonging to that assignee for "apply to all" and linked-group hints.
  function fieldMatchesScope(f) {
    if (!restrictedAssignee) return true
    const a = f.assignee || 'user'
    return a === restrictedAssignee
  }
  const sameTypeCount = fields.filter(f => f.type === field.type && fieldMatchesScope(f)).length
  const showApplyAll = sameTypeCount > 1 && (field.type === 'signature' || field.type === 'initials' || field.type === 'date')

  function save(applyAll = false) {
    if (!val) return
    onSave(val, applyAll)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:1400,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px',overflow:'auto'}} onClick={onClose}>
      <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'22px',width:'640px',maxWidth:'100%'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'14px',gap:'12px'}}>
          <div>
            <h3 style={{fontSize:'16px',fontWeight:700,margin:0,color:'#fff',textTransform:'capitalize'}}>{field.label || field.type}</h3>
            {(() => {
              if (!field.group) return null
              const linkedCount = fields.filter(f => f.id !== field.id && f.type === field.type && f.group === field.group && fieldMatchesScope(f)).length
              if (linkedCount === 0) return null
              return <p style={{fontSize:'11px',color:'#8DC63F',margin:'4px 0 0'}}>🔗 Will also fill {linkedCount} linked field{linkedCount===1?'':'s'} in group "{field.group}"</p>
            })()}
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#6b7280',fontSize:'22px',cursor:'pointer',lineHeight:1,padding:'0 4px'}}>✕</button>
        </div>

        {(field.type === 'signature' || field.type === 'initials') && (
          <SignatureInput value={val} onChange={setVal} mode={mode} setMode={setMode}/>
        )}
        {field.type === 'text' && (
          <div>
            <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.07em'}}>{field.label || 'Text'}</label>
            <input autoFocus value={val} onChange={e=>setVal(e.target.value)}
              style={{width:'100%',background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'10px 13px',color:'#fff',fontSize:'14px',outline:'none',boxSizing:'border-box'}}/>
          </div>
        )}
        {field.type === 'date' && (
          <div>
            <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Date</label>
            <input type="date" value={val} onChange={e=>setVal(e.target.value)}
              style={{width:'100%',background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'10px 13px',color:'#fff',fontSize:'14px',outline:'none',boxSizing:'border-box'}}/>
            <button onClick={()=>setVal(new Date().toISOString().split('T')[0])} style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'6px',padding:'6px 12px',fontSize:'12px',cursor:'pointer',marginTop:'8px'}}>Today</button>
          </div>
        )}

        <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'18px',flexWrap:'wrap'}}>
          {showApplyAll && (
            <button onClick={()=>save(true)} disabled={!val} style={{background:'#1e1e1e',color:'#8DC63F',border:'1px solid rgba(141,198,63,0.4)',borderRadius:'8px',padding:'10px 16px',fontSize:'13px',fontWeight:600,cursor:val?'pointer':'not-allowed',opacity:val?1:0.5}}>Apply to all {sameTypeCount}</button>
          )}
          <button onClick={onClose} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'10px 16px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button onClick={()=>save(false)} disabled={!val} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:700,cursor:val?'pointer':'not-allowed',opacity:val?1:0.5}}>Apply</button>
        </div>
      </div>
    </div>
  )
}

function SignatureInput({ value, onChange, mode, setMode }) {
  // Lazy-import to avoid bundling issues; SignatureCanvas is exported from SignPdfViewer
  const [SignatureCanvas, setSC] = useState(null)
  useEffect(() => {
    import('@/components/SignPdfViewer').then(m => setSC(() => m.SignatureCanvas))
  }, [])
  const [typed, setTyped] = useState('')

  function applyTyped() {
    if (!typed.trim()) return
    // Render typed text to a canvas → data URL
    const canvas = document.createElement('canvas')
    canvas.width = 600; canvas.height = 150
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#0a0a0a'
    ctx.font = 'italic 60px "Brush Script MT", "Lucida Handwriting", cursive'
    ctx.textBaseline = 'middle'
    ctx.fillText(typed, 20, canvas.height / 2)
    onChange(canvas.toDataURL('image/png'))
  }

  return (
    <div>
      <div style={{display:'flex',gap:'6px',marginBottom:'10px'}}>
        <button onClick={()=>setMode('draw')} style={tabStyle(mode==='draw')}>✎ Draw</button>
        <button onClick={()=>setMode('type')} style={tabStyle(mode==='type')}>⌨ Type</button>
      </div>
      {mode === 'draw' && SignatureCanvas && <SignatureCanvas value={value} onChange={onChange} height={150}/>}
      {mode === 'draw' && !SignatureCanvas && <div style={{height:150,background:'#0f0f0f',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',color:'#6b7280'}}>Loading…</div>}
      {mode === 'type' && (
        <div>
          <input autoFocus value={typed} onChange={e=>setTyped(e.target.value)} placeholder="Type your name..."
            style={{width:'100%',background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'10px 13px',color:'#fff',fontSize:'18px',outline:'none',boxSizing:'border-box',fontFamily:'"Brush Script MT","Lucida Handwriting",cursive',fontStyle:'italic'}}/>
          <button onClick={applyTyped} disabled={!typed.trim()} style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'6px',padding:'6px 12px',fontSize:'12px',cursor:typed?'pointer':'not-allowed',marginTop:'8px',opacity:typed?1:0.5}}>Use this signature</button>
          {value && <div style={{marginTop:'10px'}}><img src={value} alt="" style={{maxWidth:'100%',height:'80px',background:'#fff',borderRadius:'6px',padding:'4px'}}/></div>}
        </div>
      )}
    </div>
  )
}

function tabStyle(active) {
  return {
    background: active ? '#8DC63F' : '#1e1e1e',
    color: active ? '#0a0a0a' : '#9ca3af',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  }
}
