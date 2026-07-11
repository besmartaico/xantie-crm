// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const STATUS_META = {
  pending_recipients: { label: 'Waiting on signers', color: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
  pending_user: { label: 'Waiting on signer', color: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
  ready_to_finalize: { label: 'Ready to finalize', color: '#f97316', bg: 'rgba(249,115,22,0.10)' },
  pending_admin_post: { label: 'Awaiting admin', color: '#f97316', bg: 'rgba(249,115,22,0.10)' },
  complete: { label: 'Complete', color: '#8DC63F', bg: 'rgba(141,198,63,0.10)' },
}

const EVENT_ICONS = {
  created: '🆕',
  admin_prefilled: '✏️',
  signer_emailed: '📧',
  recipient_emailed: '📧',
  signer_viewed: '👁',
  signer_signed: '✓',
  all_recipients_signed: '✅',
  partial_pdf_generated: '📄',
  partial_pdf_failed: '⚠️',
  admin_notified: '🔔',
  admin_notify_failed: '⚠️',
  admin_completed: '✓',
  admin_edited: '📝',
  final_pdf_generated: '📑',
  signer_emailed_final: '📧',
  recipient_emailed_final: '📧',
  admin_emailed_final: '📧',
  final_email_failed: '⚠️',
  email_failed: '⚠️',
  consent_given: '🔏',
  status_changed: '🔄',
}

function fmtDateLong(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
}

function fmtRelative(iso) {
  if (!iso) return ''
  const d = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - d)
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return min + 'm ago'
  const hr = Math.floor(min / 60)
  if (hr < 24) return hr + 'h ago'
  const day = Math.floor(hr / 24)
  if (day < 30) return day + 'd ago'
  return new Date(iso).toLocaleDateString('en-US')
}

export default function SignRequestDetailPage({ params }) {
  const [resolvedParams, setResolvedParams] = useState(null)
  const [req, setReq] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/sign-requests/' + resolvedParams.requestId)
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'Unable to load'); setLoading(false); return }
      setReq(data)
    } catch(e) { setError(e.message || 'Network error') }
    setLoading(false)
  }

  if (!resolvedParams) return null

  if (loading) return <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>
  if (error) return <div><a href="/admin/sign-requests" style={{color:'#9ca3af',fontSize:'13px'}}>← Back</a><p style={{color:'#f87171',marginTop:'20px'}}>{error}</p></div>
  if (!req) return null

  const meta = STATUS_META[req.status] || { label: req.status, color: '#9ca3af', bg: 'rgba(156,163,175,0.10)' }
  const events = Array.isArray(req.events) ? [...req.events].sort((a,b)=>new Date(a.at).getTime() - new Date(b.at).getTime()) : []

  return (
    <div>
      <div style={{marginBottom:'18px'}}>
        <a href="/admin/sign-requests" style={{color:'#9ca3af',fontSize:'13px',textDecoration:'none'}}>← All sign requests</a>
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginTop:'8px',flexWrap:'wrap'}}>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>{req.documentName || 'Sign Request'}</h1>
          <span style={{background:meta.bg,color:meta.color,padding:'3px 10px',borderRadius:'6px',fontSize:'12px',fontWeight:700}}>{meta.label}</span>
        </div>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'6px 0 0'}}>
          {Array.isArray(req.recipients) && req.recipients.length
            ? <>For <strong style={{color:'#9ca3af'}}>{req.recipients.length} recipient{req.recipients.length===1?'':'s'}</strong> · Created {fmtDateLong(req.createdAt)} by {req.createdBy || 'admin'}</>
            : <>For <strong style={{color:'#9ca3af'}}>{req.signerName}</strong> ({req.signerEmail}) · Created {fmtDateLong(req.createdAt)} by {req.createdBy || 'admin'}</>}
        </p>
      </div>

      {Array.isArray(req.recipientsStatus) && req.recipientsStatus.length > 0 && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'16px 18px',marginBottom:'16px'}}>
          <h3 style={{fontSize:'13px',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 12px'}}>Recipients ({req.recipientsStatus.filter(r=>r.signed).length} of {req.recipientsStatus.length} signed)</h3>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {req.recipientsStatus.map(r => (
              <div key={r.rid} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px',flexWrap:'wrap',padding:'8px 12px',background:'#0f0f0f',borderRadius:'8px'}}>
                <span style={{fontSize:'13px',color:'#d1d5db'}}>{r.name} <span style={{color:'#6b7280'}}>({r.email})</span></span>
                <span style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  {!r.signed && r.token && <a href={'/sign/' + req.id + '?r=' + encodeURIComponent(r.token)} target="_blank" rel="noopener" style={{fontSize:'11px',color:'#60a5fa',textDecoration:'none'}}>Open link</a>}
                  <span style={{color:r.signed?'#8DC63F':'#fbbf24',fontSize:'12px',fontWeight:600}}>{r.signed ? '✓ Signed' + (r.signedAt ? ' · ' + fmtRelative(r.signedAt) : '') : '○ Pending'}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'18px'}}>
        {(req.status === 'ready_to_finalize' || req.status === 'pending_admin_post') && <a href={'/admin/sign-requests/' + req.id + '/finish'} style={{background:'#f97316',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:700,textDecoration:'none'}}>{Array.isArray(req.recipients) ? 'Consolidate & finalize →' : 'Complete signing →'}</a>}
        {req.status === 'pending_user' && <a href={'/sign/' + req.id} target="_blank" rel="noopener" style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>View signer link</a>}
        {req.partialPdfUrl && <a href={req.partialPdfUrl} target="_blank" rel="noopener" style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>📄 Partial PDF</a>}
        {req.status === 'complete' && <a href={'/admin/sign-requests/' + req.id + '/finish'} style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>✎ Edit fields</a>}
        {req.signedPdfUrl && <a href={req.signedPdfUrl} target="_blank" rel="noopener" style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:700,textDecoration:'none'}}>⬇ Download signed PDF</a>}
      </div>

      <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'18px',marginBottom:'16px'}}>
        <h3 style={{fontSize:'13px',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 14px'}}>Activity log</h3>
        {events.length === 0 && <p style={{color:'#6b7280',fontSize:'13px',margin:0}}>No events recorded yet.</p>}
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {events.map((e, i) => (
            <div key={i} style={{display:'flex',gap:'12px',alignItems:'flex-start',padding:'10px 12px',background:'#0f0f0f',borderRadius:'8px',border:'1px solid #1a1a1a'}}>
              <span style={{fontSize:'16px',lineHeight:1.2,flexShrink:0}}>{EVENT_ICONS[e.type] || '•'}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:'#fff',fontSize:'13px',fontWeight:600}}>{e.message || e.type}</div>
                <div style={{color:'#6b7280',fontSize:'11px',marginTop:'2px'}}>{fmtDateLong(e.at)} · {fmtRelative(e.at)} · <code style={{color:'#4b5563'}}>{e.type}</code></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'18px'}}>
        <h3 style={{fontSize:'13px',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 14px'}}>Fields</h3>
        <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
          {(req.fields || []).map(f => {
            const filled = !!(req.values && req.values[f.id])
            return (
              <div key={f.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:'#0f0f0f',borderRadius:'6px',fontSize:'12px',color:'#d1d5db',gap:'8px'}}>
                <span><strong style={{color:'#8DC63F'}}>{f.type}</strong> — {f.label || '(no label)'}
                  {f.assignee === 'admin'
                    ? <span style={{color:'#f97316',fontSize:'10px',fontWeight:700,marginLeft:'4px',background:'rgba(249,115,22,0.12)',padding:'1px 6px',borderRadius:'4px'}}>ADMIN</span>
                    : /^r\d+$/.test(f.assignee || '') && <span style={{color:'#8DC63F',fontSize:'10px',fontWeight:700,marginLeft:'4px',background:'rgba(141,198,63,0.12)',padding:'1px 6px',borderRadius:'4px'}}>{'RECIPIENT ' + f.assignee.slice(1)}</span>}
                </span>
                <span style={{color:filled?'#8DC63F':'#6b7280',fontSize:'11px',fontWeight:600}}>{filled ? '✓ Filled' : '○ Empty'} · Page {f.page}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}