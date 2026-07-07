// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const SignPdfViewer = dynamic(() => import('@/components/SignPdfViewer'), { ssr: false })

export default function FinishSignRequestPage({ params }) {
  const [resolvedParams, setResolvedParams] = useState(null)
  const [request, setRequest] = useState(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [values, setValues] = useState({})
  const [activeField, setActiveField] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)
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
    setLoading(true); setLoadError('')
    try {
      const res = await fetch('/api/sign-requests/' + resolvedParams.requestId)
      const data = await res.json()
      if (!res.ok || data.error) { setLoadError(data.error || 'Unable to load'); setLoading(false); return }
      setRequest(data)
      if (data.values) setValues(data.values)
      const pdfRes = await fetch('/api/documents/raw/' + data.documentId)
      if (pdfRes.ok) {
        const buf = await pdfRes.arrayBuffer()
        setPdfBlobUrl(URL.createObjectURL(new Blob([buf], { type: 'application/pdf' })))
      }
    } catch(e) { setLoadError(e.message || 'Network error') }
    setLoading(false)
  }

  function setFieldValueAndGroup(field, val) {
    setValues(prev => {
      const next = {...prev, [field.id]: val}
      if (field.group && request) {
        request.fields.forEach(f => {
          if (f.id !== field.id && f.type === field.type && f.group && f.group === field.group && f.assignee === 'admin') {
            next[f.id] = val
          }
        })
      }
      return next
    })
  }

  function applyToAll(field, val) {
    if (!request) return
    setValues(prev => {
      const next = {...prev}
      request.fields.filter(f => f.type === field.type && f.assignee === 'admin').forEach(f => { next[f.id] = val })
      return next
    })
  }

  async function submit() {
    if (!request) return
    const adminFields = request.fields.filter(f => f.assignee === 'admin')
    const unfilled = adminFields.filter(f => !values[f.id])
    if (unfilled.length > 0) {
      setSubmitError('Please fill in all ' + adminFields.length + ' admin field' + (adminFields.length===1?'':'s') + '. ' + unfilled.length + ' remaining.')
      return
    }
    const diff = {}
    adminFields.forEach(f => { if (values[f.id]) diff[f.id] = values[f.id] })
    setSubmitting(true); setSubmitError('')
    try {
      const isMulti = Array.isArray(request.recipients)
      const res = await fetch('/api/sign-requests/' + resolvedParams.requestId, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(isMulti ? { values: diff, action: 'finalize' } : { values: diff, source: 'admin_post' })
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setSubmitError(data.error || 'Submission failed'); setSubmitting(false); return }
      setSubmitResult(data)
    } catch(e) { setSubmitError(e.message || 'Network error'); setSubmitting(false) }
  }

  if (!resolvedParams) return null

  if (loadError) {
    return (<div><a href="/admin/sign-requests" style={{color:'#9ca3af',fontSize:'13px'}}>← Back</a><p style={{color:'#f87171',marginTop:'20px'}}>{loadError}</p></div>)
  }

  if (submitResult) {
    return (<div><h1 style={{fontSize:'22px',fontWeight:700,margin:'0 0 12px',color:'#8DC63F'}}>✓ Document finalized</h1><p style={{color:'#9ca3af',fontSize:'14px',margin:'0 0 18px'}}>{Array.isArray(request?.recipients) ? 'The signed PDF was emailed to all recipients.' : ('Sent to ' + (request ? request.signerEmail : '') + '.')} Available in Signed PDFs and on the sign requests list.</p><div style={{display:'flex',gap:'10px'}}><a href={submitResult.signedPdfUrl} target="_blank" rel="noopener" style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:700,textDecoration:'none'}}>Download signed PDF</a><a href="/admin/sign-requests" style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>← All sign requests</a></div></div>)
  }

  const adminFields = request ? request.fields.filter(f => f.assignee === 'admin') : []
  const adminFilled = adminFields.filter(f => values[f.id]).length
  const isMulti = request ? Array.isArray(request.recipients) : false
  // Everything not assigned to admin is filled by recipients → read-only here.
  const userFilledIds = request ? request.fields.filter(f => f.assignee !== 'admin').map(f => f.id) : []
  const recipientsStatus = request && Array.isArray(request.recipientsStatus) ? request.recipientsStatus : []

  return (
    <div>
      <div style={{marginBottom:'18px'}}>
        <a href="/admin/sign-requests" style={{color:'#9ca3af',fontSize:'13px',textDecoration:'none'}}>← All sign requests</a>
        <h1 style={{fontSize:'22px',fontWeight:700,margin:'4px 0 0'}}>Finish signing: {request && request.documentName}</h1>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>
          {isMulti
            ? 'All recipients have signed. Fill any remaining admin fields, then consolidate & finalize.'
            : <>Signed by {request && request.signerName} ({request && request.signerEmail}). Fill any remaining admin fields to finalize.</>}
        </p>
      </div>

      {isMulti && recipientsStatus.length > 0 && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'14px 16px',marginBottom:'14px'}}>
          <h3 style={{fontSize:'12px',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 10px'}}>Recipients</h3>
          <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
            {recipientsStatus.map(r => (
              <div key={r.rid} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px',fontSize:'13px'}}>
                <span style={{color:'#d1d5db'}}>{r.name} <span style={{color:'#6b7280'}}>({r.email})</span></span>
                <span style={{color:r.signed?'#8DC63F':'#fbbf24',fontSize:'12px',fontWeight:600}}>{r.signed ? '✓ Signed' : '○ Pending'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'14px',fontSize:'12px',color:'#9ca3af',flexWrap:'wrap'}}>
        <span>Admin fields:</span>
        <strong style={{color:'#f97316'}}>{adminFilled} of {adminFields.length} filled</strong>
      </div>

      {submitError && <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'10px 14px',marginBottom:'14px',fontSize:'13px'}}>{submitError}</div>}

      <div style={{display:'flex',gap:'10px',marginBottom:'18px'}}>
        <button onClick={submit} disabled={submitting} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px 22px',fontSize:'14px',fontWeight:700,cursor:submitting?'wait':'pointer',opacity:submitting?0.7:1}}>{submitting?'Finalizing…':(isMulti?'✓ Consolidate & finalize':'✓ Finalize & generate PDF')}</button>
      </div>

      {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>}
      {!loading && pdfBlobUrl && request && (
        <div style={{maxHeight:'calc(100vh - 320px)',display:'flex'}}>
          <SignPdfViewer fileUrl={pdfBlobUrl} fields={request.fields} values={values}
            onClickField={(f) => { if (f.assignee === 'admin') setActiveField(f) }}
            restrictedAssignee="admin" readOnlyFieldIds={userFilledIds}/>
        </div>
      )}

      {activeField && <FieldModal field={activeField} fields={request ? request.fields : []} restrictedAssignee="admin" currentValue={values[activeField.id]} onClose={()=>setActiveField(null)} onSave={(val, applyAll)=>{
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
          <SignatureInput value={val} onChange={setVal} mode={mode} setMode={setMode} drawOnly={!!field.requireDraw}/>
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

function SignatureInput({ value, onChange, mode, setMode, drawOnly }) {
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
      {drawOnly
        ? <div style={{fontSize:'12px',color:'#8DC63F',marginBottom:'10px',fontWeight:600}}>✎ Please draw your signature (typing is disabled for this field)</div>
        : <div style={{display:'flex',gap:'6px',marginBottom:'10px'}}>
            <button onClick={()=>setMode('draw')} style={tabStyle(mode==='draw')}>✎ Draw</button>
            <button onClick={()=>setMode('type')} style={tabStyle(mode==='type')}>⌨ Type</button>
          </div>}
      {(drawOnly || mode === 'draw') && SignatureCanvas && <SignatureCanvas value={value} onChange={onChange} height={150}/>}
      {(drawOnly || mode === 'draw') && !SignatureCanvas && <div style={{height:150,background:'#0f0f0f',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',color:'#6b7280'}}>Loading…</div>}
      {!drawOnly && mode === 'type' && (
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
