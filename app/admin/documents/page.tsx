// @ts-nocheck
'use client'
import { useEffect, useState, useRef } from 'react'

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })
}

function fmtSize(bytes) {
  if (!bytes) return ''
  const b = parseInt(bytes, 10) || 0
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b/1024).toFixed(1) + ' KB'
  return (b/1024/1024).toFixed(1) + ' MB'
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [renameDoc, setRenameDoc] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState('')
  const fileInputRef = useRef(null)

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
      const data = await (await fetch('/api/documents')).json()
      setDocs(Array.isArray(data) ? data : [])
    } catch(e) {}
    setLoading(false)
  }

  async function handleUpload(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF files are supported.')
      return
    }
    setUploading(true); setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/documents', { method:'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setUploadError(data.error || 'Upload failed')
      } else {
        await load()
      }
    } catch(e) {
      setUploadError(e.message || 'Network error')
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function doRename() {
    if (!renameDoc) return
    const v = renameValue.trim()
    if (!v) { setRenameError('Please enter a name'); return }
    setRenaming(true); setRenameError('')
    try {
      const res = await fetch('/api/documents/' + renameDoc.id + '/fields', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: v })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) { setRenameError(data.error || ('HTTP ' + res.status)); setRenaming(false); return }
      setRenameDoc(null)
      await load()
    } catch(e) { setRenameError(e.message || 'Network error') }
    setRenaming(false)
  }

  async function doDelete(id) {
    setDeleting(true); setDeleteError('')
    try {
      const res = await fetch('/api/documents/' + id + '/fields', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setDeleteError(data.error || ('HTTP ' + res.status))
        setDeleting(false)
        return
      }
      setConfirmDelete(null)
      await load()
    } catch(e) {
      setDeleteError(e.message || 'Network error')
    }
    setDeleting(false)
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'18px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Documents</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>PDF templates for signing · {docs.length} total</p>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <a href="/admin/documents/signed" style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'10px 16px',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>📂 Signed PDFs</a>
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" style={{display:'none'}}
            onChange={e=>{ const f = e.target.files && e.target.files[0]; if (f) handleUpload(f) }}/>
          <button onClick={()=>fileInputRef.current && fileInputRef.current.click()} disabled={uploading}
            style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:700,cursor:uploading?'wait':'pointer',opacity:uploading?0.7:1}}>
            {uploading ? 'Uploading…' : '+ Upload PDF'}
          </button>
        </div>
      </div>

      {uploadError && (
        <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'10px 14px',marginBottom:'14px',fontSize:'13px'}}>{uploadError}</div>
      )}

      {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>}

      {!loading && docs.length === 0 && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'48px',textAlign:'center'}}>
          <p style={{color:'#6b7280',margin:'0 0 8px'}}>No documents yet.</p>
          <p style={{color:'#4b5563',fontSize:'12px',margin:0}}>Upload a PDF to start placing signature fields.</p>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
        {docs.map(d => (
          <div key={d.id} style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'14px',flexWrap:'wrap'}}>
            <div style={{flex:'1 1 240px',minWidth:0}}>
              <a href={'/admin/documents/' + d.id} style={{color:'#fff',fontSize:'14px',fontWeight:600,textDecoration:'none',display:'inline-block'}}>{d.name}</a>
              <div style={{fontSize:'12px',color:'#6b7280',marginTop:'2px'}}>
                {fmtDate(d.modifiedTime)} · {fmtSize(d.size)} {d.hasFields ? ' · ✓ fields placed' : ' · no fields yet'}
              </div>
            </div>
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
              <a href={'/api/documents/raw/' + d.id} target="_blank" rel="noopener" style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'7px 12px',fontSize:'12px',fontWeight:600,textDecoration:'none'}}>👁 Preview</a>
              <a href={'/admin/documents/' + d.id + '/place-fields'} style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'7px 12px',fontSize:'12px',fontWeight:600,textDecoration:'none'}}>📍 Place fields</a>
              <a href={'/admin/documents/' + d.id} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'7px 12px',fontSize:'12px',fontWeight:700,textDecoration:'none'}}>Send to sign →</a>
              <button onClick={()=>{setRenameDoc(d);setRenameValue((d.name||'').replace(/\.pdf$/i,''));setRenameError('')}} style={{background:'none',border:'1px solid #252525',color:'#9ca3af',borderRadius:'8px',padding:'7px 12px',cursor:'pointer',fontSize:'12px',fontWeight:600}}>Rename</button>
              <button onClick={()=>{setConfirmDelete(d);setDeleteError('')}} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:'12px',fontWeight:600}}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {renameDoc && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}} onClick={()=>!renaming&&setRenameDoc(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'14px',padding:'22px',width:'440px',maxWidth:'100%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:'0 0 12px',fontSize:'16px',fontWeight:700,color:'#fff'}}>Rename document</h3>
            <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'6px'}}>
              <input autoFocus value={renameValue} onChange={e=>setRenameValue(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter')doRename(); if(e.key==='Escape')setRenameDoc(null) }}
                style={{flex:1,background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'10px 13px',color:'#fff',fontSize:'14px',outline:'none',boxSizing:'border-box'}}/>
              <span style={{color:'#6b7280',fontSize:'13px'}}>.pdf</span>
            </div>
            <p style={{color:'#6b7280',fontSize:'12px',margin:'0 0 14px'}}>Renames the template in Google Drive. Sign requests already sent keep their original name.</p>
            {renameError && (
              <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'8px 12px',marginBottom:'12px',fontSize:'12px',wordBreak:'break-word'}}>{renameError}</div>
            )}
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setRenameDoc(null)} disabled={renaming} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',cursor:renaming?'not-allowed':'pointer'}}>Cancel</button>
              <button onClick={doRename} disabled={renaming||!renameValue.trim()} style={{background:'#8DC63F',border:'none',color:'#0a0a0a',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:700,cursor:(renaming||!renameValue.trim())?'not-allowed':'pointer',opacity:(renaming||!renameValue.trim())?0.6:1}}>{renaming?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}} onClick={()=>!deleting&&setConfirmDelete(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'14px',padding:'22px',width:'420px',maxWidth:'100%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:'0 0 10px',fontSize:'16px',fontWeight:700,color:'#fff'}}>Delete template?</h3>
            <div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'13px',color:'#d1d5db'}}>{confirmDelete.name}</div>
            <p style={{color:'#9ca3af',fontSize:'12px',margin:'0 0 14px'}}>This removes the PDF from Google Drive (moved to trash if the service account lacks permanent-delete permission). Previously signed PDFs in Blob storage are not affected.</p>
            {deleteError && (
              <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'8px 12px',marginBottom:'12px',fontSize:'12px',wordBreak:'break-word'}}>{deleteError}</div>
            )}
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
