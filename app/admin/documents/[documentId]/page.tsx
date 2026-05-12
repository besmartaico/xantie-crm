// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

export default function DocumentDetailPage({ params }) {
  const [resolvedParams, setResolvedParams] = useState(null)
  const [doc, setDoc] = useState(null)
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSend, setShowSend] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    if (u.role !== 'admin') {
      window.location.href = '/admin/dashboard'
      return
    }
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
      setDoc({ id: data.id, name: data.name })
      setFields(data.fields || [])
    } catch(e) {}
    setLoading(false)
  }

  async function sendLink() {
    if (!signerName.trim() || !signerEmail.trim()) {
      setSendError('Name and email are required.')
      return
    }
    setSending(true); setSendError(''); setSendResult(null)
    try {
      const res = await fetch('/api/documents/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: resolvedParams.documentId,
          name: signerName.trim(),
          email: signerEmail.trim(),
          fields,
          documentName: doc && doc.name,
          appUrl: window.location.origin,
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setSendError(data.error || 'Failed to send')
      } else {
        setSendResult(data.url)
      }
    } catch(e) {
      setSendError(e.message || 'Network error')
    }
    setSending(false)
  }

  if (!resolvedParams) return null

  return (
    <div>
      <div style={{marginBottom:'18px'}}>
        <a href="/admin/documents" style={{color:'#9ca3af',fontSize:'13px',textDecoration:'none'}}>← All documents</a>
      </div>

      {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>}

      {!loading && doc && (
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:'0 0 6px'}}>{doc.name}</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 20px'}}>{fields.length} field{fields.length===1?'':'s'} placed</p>

          {fields.length === 0 && (
            <div style={{background:'rgba(251,191,36,0.06)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:'10px',padding:'14px 18px',marginBottom:'18px'}}>
              <p style={{color:'#fbbf24',margin:'0 0 8px',fontSize:'13px',fontWeight:600}}>⚠ No fields placed yet</p>
              <p style={{color:'#9ca3af',fontSize:'12px',margin:0}}>You need to add signature, initials, text, or date fields before sending this document for signing.</p>
            </div>
          )}

          <div style={{display:'flex',gap:'10px',flexWrap:'wrap',marginBottom:'24px'}}>
            <a href={'/admin/documents/' + resolvedParams.documentId + '/place-fields'}
              style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>📍 Place / Edit Fields</a>
            <button onClick={()=>setShowSend(true)} disabled={fields.length === 0}
              style={{background:fields.length===0?'#2a2a2a':'#8DC63F',color:fields.length===0?'#4b5563':'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:700,cursor:fields.length===0?'not-allowed':'pointer'}}>📧 Send signing link</button>
          </div>

          {fields.length > 0 && (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'16px'}}>
              <h3 style={{fontSize:'13px',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 10px'}}>Field Summary</h3>
              <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                {fields.map(f => (
                  <div key={f.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:'#0f0f0f',borderRadius:'6px',fontSize:'12px',color:'#d1d5db'}}>
                    <span><strong style={{color:'#8DC63F'}}>{f.type}</strong> — {f.label || '(no label)'}</span>
                    <span style={{color:'#6b7280'}}>Page {f.page}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showSend && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}} onClick={()=>!sending&&setShowSend(false)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'14px',padding:'22px',width:'440px',maxWidth:'100%',maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:'0 0 16px',fontSize:'16px',fontWeight:700,color:'#fff'}}>Send signing link</h3>
            {!sendResult && (
              <>
                <div style={{marginBottom:'12px'}}>
                  <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Signer Name</label>
                  <input value={signerName} onChange={e=>setSignerName(e.target.value)} disabled={sending}
                    style={{width:'100%',background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'10px 13px',color:'#fff',fontSize:'14px',outline:'none',boxSizing:'border-box'}}/>
                </div>
                <div style={{marginBottom:'12px'}}>
                  <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Signer Email</label>
                  <input type="email" value={signerEmail} onChange={e=>setSignerEmail(e.target.value)} disabled={sending}
                    style={{width:'100%',background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'10px 13px',color:'#fff',fontSize:'14px',outline:'none',boxSizing:'border-box'}}/>
                </div>
                {sendError && <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'8px 12px',marginBottom:'12px',fontSize:'12px'}}>{sendError}</div>}
              </>
            )}
            {sendResult && (
              <div style={{marginBottom:'14px'}}>
                <p style={{color:'#8DC63F',fontSize:'13px',margin:'0 0 10px',fontWeight:600}}>✓ Email sent to {signerEmail}</p>
                <p style={{color:'#9ca3af',fontSize:'12px',margin:'0 0 8px'}}>Direct link (in case email is filtered):</p>
                <div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'6px',padding:'8px 10px',fontSize:'11px',color:'#60a5fa',wordBreak:'break-all',fontFamily:'monospace',maxHeight:'140px',overflowY:'auto'}}>{sendResult}</div>
                <button onClick={()=>{navigator.clipboard.writeText(sendResult);}} style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'6px',padding:'5px 10px',fontSize:'11px',cursor:'pointer',marginTop:'6px',fontWeight:600}}>📋 Copy link</button>
              </div>
            )}
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              {!sendResult ? (
                <>
                  <button onClick={()=>setShowSend(false)} disabled={sending} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',cursor:sending?'not-allowed':'pointer'}}>Cancel</button>
                  <button onClick={sendLink} disabled={sending||!signerName||!signerEmail} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:700,cursor:sending?'wait':'pointer',opacity:(sending||!signerName||!signerEmail)?0.6:1}}>{sending?'Sending…':'Send Email'}</button>
                </>
              ) : (
                <button onClick={()=>{setShowSend(false);setSendResult(null);setSignerName('');setSignerEmail('')}} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Done</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
