// @ts-nocheck
'use client'
import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'

const SignPdfViewerMod = dynamic(() => import('@/components/SignPdfViewer'), { ssr: false })

export default function PublicSignPage({ params }) {
  const [resolvedParams, setResolvedParams] = useState(null)
  const [docName, setDocName] = useState('')
  const [fields, setFields] = useState([])
  const [pdfBlobUrl, setPdfBlobUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [signerName, setSignerName] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [values, setValues] = useState({})
  const [activeField, setActiveField] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    Promise.resolve(params).then(p => setResolvedParams(p))
  }, [])

  useEffect(() => {
    if (!resolvedParams) return
    // Read name/email/fields from query string
    const qs = new URLSearchParams(window.location.search)
    if (qs.get('name')) setSignerName(qs.get('name'))
    if (qs.get('email')) setSignerEmail(qs.get('email'))
    const fb64 = qs.get('fields')
    if (fb64) {
      try {
        const json = atob(fb64.replace(/-/g, '+').replace(/_/g, '/'))
        const parsed = JSON.parse(decodeURIComponent(escape(json)))
        if (Array.isArray(parsed)) setFields(parsed)
      } catch(e) {}
    }
    load()
  }, [resolvedParams])

  async function load() {
    setLoading(true)
    try {
      const data = await (await fetch('/api/documents/' + resolvedParams.documentId + '/fields')).json()
      setDocName(data.name || '')
      // Prefer server-side fields if local ones are empty (URL fields override otherwise as set above)
      setFields(prev => prev.length > 0 ? prev : (data.fields || []))
      const pdfRes = await fetch('/api/documents/raw/' + resolvedParams.documentId)
      const buf = await pdfRes.arrayBuffer()
      const blob = new Blob([buf], { type: 'application/pdf' })
      setPdfBlobUrl(URL.createObjectURL(blob))
    } catch(e) {}
    setLoading(false)
  }

  function setFieldValue(id, val) {
    setValues(prev => ({...prev, [id]: val}))
  }

  // Cascade a value to all fields in the same group + same type
  function setFieldValueAndGroup(field, val) {
    setValues(prev => {
      const next = {...prev, [field.id]: val}
      if (field.group) {
        fields.forEach(f => {
          if (f.id !== field.id && f.type === field.type && f.group && f.group === field.group) {
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
      fields.filter(f => f.type === field.type).forEach(f => { next[f.id] = val })
      return next
    })
  }

  async function submit() {
    if (!signerName.trim() || !signerEmail.trim()) {
      setSubmitError('Please enter your name and email at the top.')
      return
    }
    const required = fields.filter(f => !values[f.id])
    if (required.length > 0) {
      setSubmitError('Please fill in all ' + fields.length + ' field' + (fields.length===1?'':'s') + ' before submitting.')
      return
    }
    setSubmitting(true); setSubmitError('')
    try {
      const res = await fetch('/api/documents/sign-requests', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          documentId: resolvedParams.documentId,
          fields,
          values,
          signer: { name: signerName.trim(), email: signerEmail.trim() },
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'Submission failed')
      } else {
        setSubmitResult(data)
      }
    } catch(e) {
      setSubmitError(e.message || 'Network error')
    }
    setSubmitting(false)
  }

  if (!resolvedParams) return null

  if (submitResult) {
    return (
      <div style={{minHeight:'100vh',background:'#0a0a0a',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',color:'#fff'}}>
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'16px',padding:'32px',maxWidth:'500px',width:'100%',textAlign:'center'}}>
          <div style={{fontSize:'48px',marginBottom:'12px'}}>✓</div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:'0 0 8px',color:'#8DC63F'}}>Thank you!</h1>
          <p style={{color:'#9ca3af',fontSize:'14px',margin:'0 0 18px'}}>Your signed document has been submitted successfully.</p>
          <a href={submitResult.url} target="_blank" rel="noopener" style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 20px',fontSize:'13px',fontWeight:700,textDecoration:'none',display:'inline-block'}}>Download signed PDF</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',color:'#fff'}}>
      <div style={{maxWidth:'1100px',margin:'0 auto',padding:'24px 16px'}}>
        <div style={{marginBottom:'18px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'12px'}}>
          <div>
            <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>{docName || 'Sign Document'}</h1>
            <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Click any highlighted field to fill it in, then submit.</p>
          </div>
          <button onClick={submit} disabled={submitting}
            style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px 22px',fontSize:'14px',fontWeight:700,cursor:submitting?'wait':'pointer',opacity:submitting?0.7:1}}>{submitting?'Submitting…':'Submit signed document'}</button>
        </div>

        {/* Signer info */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'10px',marginBottom:'16px'}}>
          <div>
            <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Your Name</label>
            <input value={signerName} onChange={e=>setSignerName(e.target.value)}
              style={{width:'100%',background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'10px 13px',color:'#fff',fontSize:'14px',outline:'none',boxSizing:'border-box'}}/>
          </div>
          <div>
            <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Your Email</label>
            <input type="email" value={signerEmail} onChange={e=>setSignerEmail(e.target.value)}
              style={{width:'100%',background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'10px 13px',color:'#fff',fontSize:'14px',outline:'none',boxSizing:'border-box'}}/>
          </div>
        </div>

        {submitError && (
          <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'10px 14px',marginBottom:'14px',fontSize:'13px'}}>{submitError}</div>
        )}

        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'14px',fontSize:'12px',color:'#9ca3af',flexWrap:'wrap'}}>
          <span>Progress:</span>
          <strong style={{color:'#8DC63F'}}>{Object.keys(values).filter(k=>values[k]).length} of {fields.length} filled</strong>
        </div>

        {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading document...</div>}
        {!loading && pdfBlobUrl && (
          <div style={{maxHeight:'calc(100vh - 280px)',display:'flex'}}>
            <SignPdfViewerMod fileUrl={pdfBlobUrl} fields={fields} values={values} onClickField={setActiveField}/>
          </div>
        )}
      </div>

      {activeField && <FieldModal field={activeField} fields={fields} currentValue={values[activeField.id]} onClose={()=>setActiveField(null)} onSave={(val, applyAll)=>{
        if (applyAll) applyToAll(activeField, val)
        else setFieldValueAndGroup(activeField, val)
        setActiveField(null)
      }}/>}
    </div>
  )
}

function FieldModal({ field, fields, currentValue, onClose, onSave }) {
  const [val, setVal] = useState(currentValue || '')
  const [mode, setMode] = useState('draw')
  const sameTypeCount = fields.filter(f => f.type === field.type).length
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
              const linkedCount = fields.filter(f => f.id !== field.id && f.type === field.type && f.group === field.group).length
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
