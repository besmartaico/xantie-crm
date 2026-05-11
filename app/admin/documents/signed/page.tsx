// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
}

function fmtSize(bytes) {
  const b = parseInt(bytes, 10) || 0
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b/1024).toFixed(1) + ' KB'
  return (b/1024/1024).toFixed(1) + ' MB'
}

function prettyName(pathname) {
  // Blob pathnames look like "name with spaces-randomhash.pdf"
  const file = pathname.split('/').pop() || pathname
  return file.replace(/-[a-zA-Z0-9]{8,}\.pdf$/i, '.pdf')
}

export default function SignedPdfsPage() {
  const [blobs, setBlobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')

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
      const data = await (await fetch('/api/documents/signed')).json()
      setBlobs(Array.isArray(data) ? data : [])
    } catch(e) {}
    setLoading(false)
  }

  async function doDelete(url) {
    setDeleting(true)
    try {
      await fetch('/api/documents/signed', {
        method:'DELETE', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ url })
      })
      setConfirmDelete(null)
      await load()
    } catch(e) {}
    setDeleting(false)
  }

  const filtered = blobs.filter(b => {
    if (!search) return true
    return prettyName(b.pathname).toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'18px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Signed PDFs</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>{blobs.length} signed document{blobs.length===1?'':'s'}</p>
        </div>
        <a href="/admin/documents" style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'10px 16px',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>← Templates</a>
      </div>

      <div style={{marginBottom:'18px'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by filename..."
          style={{width:'100%',maxWidth:'420px',background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'10px 13px',color:'#fff',fontSize:'14px',outline:'none',boxSizing:'border-box'}}/>
      </div>

      {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>}
      {!loading && filtered.length === 0 && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'48px',textAlign:'center'}}>
          <p style={{color:'#6b7280',margin:0}}>{search ? 'No matches.' : 'No signed PDFs yet.'}</p>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
        {filtered.map(b => (
          <div key={b.url} style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'14px',flexWrap:'wrap'}}>
            <div style={{flex:'1 1 240px',minWidth:0}}>
              <a href={b.url} target="_blank" rel="noopener" style={{color:'#fff',fontSize:'14px',fontWeight:600,textDecoration:'none'}}>{prettyName(b.pathname)}</a>
              <div style={{fontSize:'12px',color:'#6b7280',marginTop:'2px'}}>{fmtDate(b.uploadedAt)} · {fmtSize(b.size)}</div>
            </div>
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
              <a href={b.url} target="_blank" rel="noopener" style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'7px 12px',fontSize:'12px',fontWeight:600,textDecoration:'none'}}>👁 View</a>
              <a href={b.url} download style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'7px 12px',fontSize:'12px',fontWeight:700,textDecoration:'none'}}>⬇ Download</a>
              <button onClick={()=>setConfirmDelete(b)} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:'12px',fontWeight:600}}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {confirmDelete && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}} onClick={()=>!deleting&&setConfirmDelete(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'14px',padding:'22px',width:'420px',maxWidth:'100%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:'0 0 10px',fontSize:'16px',fontWeight:700,color:'#fff'}}>Delete signed PDF?</h3>
            <div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'13px',color:'#d1d5db',wordBreak:'break-all'}}>{prettyName(confirmDelete.pathname)}</div>
            <p style={{color:'#9ca3af',fontSize:'12px',margin:'0 0 14px'}}>This permanently removes the signed PDF from Blob storage. Cannot be undone.</p>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setConfirmDelete(null)} disabled={deleting} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',cursor:deleting?'not-allowed':'pointer'}}>Cancel</button>
              <button onClick={()=>doDelete(confirmDelete.url)} disabled={deleting} style={{background:'#dc2626',border:'none',color:'#fff',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:700,cursor:deleting?'wait':'pointer'}}>{deleting?'Deleting…':'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
