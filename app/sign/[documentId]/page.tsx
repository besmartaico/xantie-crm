// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const CONSENT_DISCLOSURE_VERSION = 'esign-disclosure-v1'

const SignPdfViewer = dynamic(() => import('@/components/SignPdfViewer'), { ssr: false })

export default function PublicSignPage({ params }) {
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
  const [consentChecked, setConsentChecked] = useState(false)
  const [showDisclosure, setShowDisclosure] = useState(false)
  const [token, setToken] = useState(null)

  useEffect(() => {
    Promise.resolve(params).then(p => setResolvedParams(p))
    try { const sp = new URLSearchParams(window.location.search); setToken(sp.get('r') || sp.get('token')) } catch(e) {}
  }, [])

  // A field belongs to this signer? (scoped by recipient token, or legacy 'user'/unassigned)
  function isMine(f) {
    const rt = request && request.restrictTo
    return rt ? (f.assignee === rt) : (!f.assignee || f.assignee === 'user')
  }
  function currentToken() {
    if (token) return token
    try { return new URLSearchParams(window.location.search).get('r') || new URLSearchParams(window.location.search).get('token') } catch(e) { return null }
  }

  useEffect(() => {
    if (!resolvedParams) return
    load()
  }, [resolvedParams])

  async function load() {
    setLoading(true); setLoadError('')
    try {
      // requestId is in route param documentId (keeping path '/sign/[documentId]' for now)
      const id = resolvedParams.documentId
      const tok = currentToken()
      const res = await fetch('/api/sign-requests/' + id + (tok ? '?token=' + encodeURIComponent(tok) : ''))
      const data = await res.json()
      if (!res.ok || data.error) { setLoadError(data.error || 'Unable to load signing request'); setLoading(false); return }
      setRequest(data)
      // Pre-populate the values map with any admin pre-filled values
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
          if (f.id !== field.id && f.type === field.type && f.group && f.group === field.group && isMine(f)) {
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
      request.fields.filter(f => f.type === field.type && isMine(f)).forEach(f => { next[f.id] = val })
      return next
    })
  }

  async function submit() {
    if (!request) return
    if (!consentChecked) { setSubmitError('Please consent to the use of electronic signatures before submitting.'); return }
    const userFields = request.fields.filter(isMine)
    const requiredFields = userFields.filter(f => !f.optional)
    const unfilled = requiredFields.filter(f => !values[f.id])
    if (unfilled.length > 0) {
      setSubmitError('Please fill in all ' + requiredFields.length + ' required field' + (requiredFields.length===1?'':'s') + ' before submitting. ' + unfilled.length + ' remaining.')
      return
    }
    const diff = {}
    userFields.forEach(f => { if (values[f.id]) diff[f.id] = values[f.id] })
    setSubmitting(true); setSubmitError('')
    try {
      const tok = currentToken()
      const consent = {
        agreed: true,
        agreedAt: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        disclosure: CONSENT_DISCLOSURE_VERSION,
      }
      // Recipient links carry a token → scoped submit; legacy links use source:'user'.
      const body = tok ? { values: diff, consent } : { values: diff, source: 'user', consent }
      const res = await fetch('/api/sign-requests/' + resolvedParams.documentId + (tok ? '?token=' + encodeURIComponent(tok) : ''), {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setSubmitError(data.error || 'Submission failed'); setSubmitting(false); return }
      setSubmitResult(data)
    } catch(e) {
      setSubmitError(e.message || 'Network error')
      setSubmitting(false)
    }
  }

  if (!resolvedParams) return null

  if (loadError) {
    return (<div style={{minHeight:'100vh',background:'#0a0a0a',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',color:'#fff'}}><div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'16px',padding:'32px',maxWidth:'500px',width:'100%',textAlign:'center'}}><div style={{fontSize:'48px',marginBottom:'12px'}}>⚠</div><h1 style={{fontSize:'18px',fontWeight:700,margin:'0 0 8px'}}>Unable to load</h1><p style={{color:'#9ca3af',fontSize:'14px',margin:0}}>{loadError}</p></div></div>)
  }

  if (request && request.alreadySigned && !submitResult) {
    return (
      <div style={{minHeight:'100vh',background:'#0a0a0a',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',color:'#fff'}}>
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'16px',padding:'32px',maxWidth:'500px',width:'100%',textAlign:'center'}}>
          <div style={{fontSize:'48px',marginBottom:'12px'}}>✓</div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:'0 0 8px',color:'#8DC63F'}}>Already submitted</h1>
          <p style={{color:'#9ca3af',fontSize:'14px',margin:0}}>You've already completed your part of this document. You'll receive the finished copy by email once everyone has signed and it's finalized.</p>
        </div>
      </div>
    )
  }

  if (submitResult) {
    const wasFinalized = submitResult.status === 'complete'
    const downloadUrl = submitResult.signedPdfUrl || submitResult.partialPdfUrl
    return (
      <div style={{minHeight:'100vh',background:'#0a0a0a',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',color:'#fff'}}>
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'16px',padding:'32px',maxWidth:'500px',width:'100%',textAlign:'center'}}>
          <div style={{fontSize:'48px',marginBottom:'12px'}}>✓</div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:'0 0 8px',color:'#8DC63F'}}>Thank you!</h1>
          <p style={{color:'#9ca3af',fontSize:'14px',margin:'0 0 14px'}}>
            {wasFinalized
              ? 'Your signed document has been finalized. A copy has been emailed to you.'
              : 'Your part has been submitted. You\'ll receive the completed document by email once everyone has signed and it\'s finalized.'}
          </p>
          {!wasFinalized && (
            <p style={{color:'#6b7280',fontSize:'12px',margin:'0 0 14px'}}>You can download a copy of what you signed now.</p>
          )}
          {downloadUrl && (
            <a href={downloadUrl} target="_blank" rel="noopener" style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 20px',fontSize:'13px',fontWeight:700,textDecoration:'none',display:'inline-block'}}>
              {wasFinalized ? 'Download signed PDF' : 'Download your signed copy'}
            </a>
          )}
        </div>
      </div>
    )
  }

  const userFields = request ? request.fields.filter(isMine) : []
  const requiredFields = userFields.filter(f => !f.optional)
  const userFilled = requiredFields.filter(f => values[f.id]).length
  // Fields not mine that already carry a value (admin-prefilled, or other recipients when shared) → read-only.
  const adminPrefilledIds = request ? request.fields.filter(f => !isMine(f) && values[f.id]).map(f => f.id) : []

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',color:'#fff'}}>
      <div style={{maxWidth:'1100px',margin:'0 auto',padding:'24px 16px'}}>
        <div style={{marginBottom:'18px'}}>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>{request && request.documentName ? request.documentName : 'Sign Document'}</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Hi {request ? (request.recipientName || request.signerName) : ''}, click each highlighted field to fill it. Greyed-out fields belong to other signers or the administrator.</p>
        </div>

        {/* E-signature consent panel */}
        <div style={{background:'#141414',border:'1px solid '+(consentChecked?'#8DC63F66':'#1e1e1e'),borderRadius:'12px',padding:'14px 16px',marginBottom:'14px'}}>
          <label style={{display:'flex',gap:'12px',cursor:'pointer',alignItems:'flex-start'}}>
            <input type="checkbox" checked={consentChecked} onChange={e=>setConsentChecked(e.target.checked)}
              style={{marginTop:'3px',width:'18px',height:'18px',accentColor:'#8DC63F',cursor:'pointer',flexShrink:0}}/>
            <div style={{flex:1,fontSize:'13px',color:'#d1d5db',lineHeight:1.5}}>
              I agree that my electronic signature is the legal equivalent of my manual/handwritten signature on this document and that I am legally bound by it. I have read the <button type="button" onClick={(ev)=>{ev.preventDefault();setShowDisclosure(true)}} style={{background:'none',border:'none',color:'#8DC63F',padding:0,fontSize:'13px',cursor:'pointer',textDecoration:'underline'}}>Electronic Records and Signatures Disclosure</button>.
            </div>
          </label>
        </div>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px',flexWrap:'wrap',gap:'10px'}}>
          <div style={{fontSize:'12px',color:'#9ca3af'}}>
            <span>Your progress: </span>
            <strong style={{color:'#8DC63F'}}>{userFilled} of {requiredFields.length} required filled</strong>
            {userFields.length > requiredFields.length && <span style={{color:'#6b7280'}}> · {userFields.length - requiredFields.length} optional</span>}
          </div>
          <button onClick={submit} disabled={submitting || !consentChecked} title={!consentChecked ? 'Please check the consent box first' : ''}
            style={{background:(submitting||!consentChecked)?'#2a2a2a':'#8DC63F',color:(submitting||!consentChecked)?'#4b5563':'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px 22px',fontSize:'14px',fontWeight:700,cursor:(submitting||!consentChecked)?'not-allowed':'pointer'}}>{submitting?'Submitting…':'Submit signed document'}</button>
        </div>

        {submitError && <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'10px 14px',marginBottom:'14px',fontSize:'13px'}}>{submitError}</div>}

        {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading document...</div>}
        {!loading && pdfBlobUrl && request && (
          <div style={{maxHeight:'calc(100vh - 280px)',display:'flex'}}>
            <SignPdfViewer fileUrl={pdfBlobUrl} fields={request.fields} values={values}
              onClickField={(f) => { if (isMine(f)) setActiveField(f) }}
              restrictedAssignee={request.restrictTo || 'user'} readOnlyFieldIds={adminPrefilledIds}/>
          </div>
        )}
      </div>

      {showDisclosure && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:1500,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}} onClick={()=>setShowDisclosure(false)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'24px',width:'620px',maxWidth:'100%',maxHeight:'85vh',overflowY:'auto',color:'#d1d5db'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'14px',gap:'12px'}}>
              <h3 style={{fontSize:'18px',fontWeight:700,margin:0,color:'#fff'}}>Electronic Records and Signatures Disclosure</h3>
              <button onClick={()=>setShowDisclosure(false)} style={{background:'none',border:'none',color:'#6b7280',fontSize:'22px',cursor:'pointer',lineHeight:1,padding:'0 4px'}}>✕</button>
            </div>
            <div style={{fontSize:'13px',lineHeight:1.6}}>
              <p>Please read this disclosure carefully. By checking the consent box and submitting your signature, you agree to the terms below.</p>
              <h4 style={{color:'#fff',fontSize:'14px',marginTop:'18px',marginBottom:'6px'}}>1. Consent to use electronic records and signatures</h4>
              <p>You agree to receive the document referenced in this signing request electronically and to sign it using an electronic signature. Your electronic signature has the same legal effect as a handwritten signature under the U.S. ESIGN Act (15 U.S.C. § 7001 et seq.) and applicable state versions of the Uniform Electronic Transactions Act (UETA).</p>
              <h4 style={{color:'#fff',fontSize:'14px',marginTop:'18px',marginBottom:'6px'}}>2. Right to a paper copy</h4>
              <p>You may request a paper copy of any document signed electronically by contacting the sender of this signing request. We may charge reasonable copying costs.</p>
              <h4 style={{color:'#fff',fontSize:'14px',marginTop:'18px',marginBottom:'6px'}}>3. Withdrawing consent</h4>
              <p>You may withdraw your consent to receive electronic records by notifying the sender in writing before you sign. Withdrawing consent after signing does not invalidate the signed document.</p>
              <h4 style={{color:'#fff',fontSize:'14px',marginTop:'18px',marginBottom:'6px'}}>4. Required hardware and software</h4>
              <p>To view and sign documents you need: a current version of a major web browser (Chrome, Firefox, Safari, or Edge), an active internet connection, and the ability to view PDF files.</p>
              <h4 style={{color:'#fff',fontSize:'14px',marginTop:'18px',marginBottom:'6px'}}>5. Updating contact information</h4>
              <p>You are responsible for keeping your email address current with the sender so we can deliver electronic records.</p>
              <h4 style={{color:'#fff',fontSize:'14px',marginTop:'18px',marginBottom:'6px'}}>6. Audit trail</h4>
              <p>An audit trail is recorded for each signing request, including the IP address, browser, timestamps for each action, and a copy of the consent text you agreed to. This audit trail can be produced as evidence of your signature.</p>
              <h4 style={{color:'#fff',fontSize:'14px',marginTop:'18px',marginBottom:'6px'}}>7. Acknowledgement</h4>
              <p>By checking the consent box, you acknowledge that you have read this disclosure, that you can access and read this disclosure on the device you are using, and that you consent to conducting business electronically.</p>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:'20px'}}>
              <button onClick={()=>setShowDisclosure(false)} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Close</button>
            </div>
          </div>
        </div>
      )}

      {activeField && <FieldModal field={activeField} fields={request ? request.fields : []} restrictedAssignee={request?.restrictTo || 'user'} currentValue={values[activeField.id]} onClose={()=>setActiveField(null)} onSave={(val, applyAll)=>{
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
