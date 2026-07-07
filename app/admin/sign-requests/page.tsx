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

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function SignRequestsListPage() {
  const [reqs, setReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    if (u.role !== 'admin') { window.location.href = '/admin/dashboard'; return }
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await (await fetch('/api/sign-requests')).json()
      setReqs(Array.isArray(data) ? data : [])
    } catch(e) {}
    setLoading(false)
  }

  async function doDelete(id) {
    setDeleting(true)
    try {
      await fetch('/api/sign-requests/' + id, { method:'DELETE' })
      setConfirmDelete(null)
      await load()
    } catch(e) {}
    setDeleting(false)
  }

  const filtered = reqs.filter(r => {
    if (filter === 'all') return true
    if (filter === 'waiting') return r.status === 'pending_recipients' || r.status === 'pending_user'
    if (filter === 'finalize') return r.status === 'ready_to_finalize' || r.status === 'pending_admin_post'
    return r.status === filter
  })
  const awaitingAction = reqs.filter(r => r.status === 'ready_to_finalize' || r.status === 'pending_admin_post').length

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'18px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Sign Requests</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>{reqs.length} total · {awaitingAction} awaiting your action</p>
        </div>
        <a href="/admin/documents" style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'10px 16px',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>← Templates</a>
      </div>

      <div style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
        {[['all','All'],['waiting','Waiting on signers'],['finalize','Ready to finalize'],['complete','Complete']].map(([k,label])=>(
          <button key={k} onClick={()=>setFilter(k)} style={{background:filter===k?'#8DC63F':'#1e1e1e',color:filter===k?'#0a0a0a':'#9ca3af',border:'1px solid '+(filter===k?'#8DC63F':'#252525'),borderRadius:'8px',padding:'7px 14px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>{label}</button>
        ))}
      </div>

      {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>}
      {!loading && filtered.length === 0 && <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'48px',textAlign:'center'}}><p style={{color:'#6b7280',margin:0}}>No sign requests in this view.</p></div>}

      <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
        {filtered.map(r => {
          const meta = STATUS_META[r.status] || { label: r.status, color: '#9ca3af', bg: 'rgba(156,163,175,0.10)' }
          return (
            <div key={r.id} style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'14px',flexWrap:'wrap'}}>
              <div style={{flex:'1 1 220px',minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                  <span style={{color:'#fff',fontSize:'14px',fontWeight:600}}>{r.documentName || 'Untitled'}</span>
                  <span style={{background:meta.bg,color:meta.color,padding:'2px 8px',borderRadius:'5px',fontSize:'11px',fontWeight:700}}>{meta.label}</span>
                </div>
                <div style={{fontSize:'12px',color:'#6b7280',marginTop:'2px'}}>
                  {r.recipients && r.recipients.length
                    ? <>For <strong style={{color:'#9ca3af'}}>{r.recipients.length} recipient{r.recipients.length===1?'':'s'}</strong> · <strong style={{color: r.signedCount===r.recipientCount ? '#8DC63F' : '#fbbf24'}}>{r.signedCount} of {r.recipientCount} signed</strong> · Created {fmtDate(r.createdAt)}</>
                    : <>For: <strong style={{color:'#9ca3af'}}>{r.signerName}</strong> ({r.signerEmail}) · Created {fmtDate(r.createdAt)}</>}
                </div>
              </div>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                <a href={'/admin/sign-requests/' + r.id} style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'7px 12px',fontSize:'12px',fontWeight:600,textDecoration:'none'}}>📋 Log</a>
                {(r.status === 'ready_to_finalize' || r.status === 'pending_admin_post') && <a href={'/admin/sign-requests/' + r.id + '/finish'} style={{background:'#f97316',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'7px 12px',fontSize:'12px',fontWeight:700,textDecoration:'none'}}>Consolidate & finalize →</a>}
                {r.status === 'pending_user' && <a href={'/sign/' + r.id} target="_blank" rel="noopener" style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'7px 12px',fontSize:'12px',fontWeight:600,textDecoration:'none'}}>View signer link</a>}
                {r.status === 'complete' && r.signedPdfUrl && <a href={r.signedPdfUrl} target="_blank" rel="noopener" style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'7px 12px',fontSize:'12px',fontWeight:700,textDecoration:'none'}}>⬇ Download</a>}
                <button onClick={()=>setConfirmDelete(r)} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:'12px',fontWeight:600}}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>

      {confirmDelete && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}} onClick={()=>!deleting&&setConfirmDelete(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'14px',padding:'22px',width:'420px',maxWidth:'100%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:'0 0 10px',fontSize:'16px',fontWeight:700,color:'#fff'}}>Delete sign request?</h3>
            <div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'13px',color:'#d1d5db'}}>{confirmDelete.documentName} → {confirmDelete.signerName}</div>
            <p style={{color:'#9ca3af',fontSize:'12px',margin:'0 0 14px'}}>Removes the in-progress signing record. The signer's link will stop working.</p>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setConfirmDelete(null)} disabled={deleting} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',cursor:deleting?'not-allowed':'pointer'}}>Cancel</button>
              <button onClick={()=>doDelete(confirmDelete.id)} disabled={deleting} style={{background:'#dc2626',border:'none',color:'#fff',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:700,cursor:deleting?'wait':'pointer'}}>{deleting?'Deleting…':'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}