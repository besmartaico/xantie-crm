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

const inp = { width:'100%', background:'#111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'14px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }
const ghostBtn = { background:'#1e1e1e', color:'#9ca3af', border:'1px solid #252525', borderRadius:'8px', padding:'7px 12px', fontSize:'12px', fontWeight:600, textDecoration:'none', cursor:'pointer' }

function VisBadge({ d }) {
  let bg, color, label
  if (d.legacy) { bg='rgba(251,191,36,0.12)'; color='#fbbf24'; label='Unassigned' }
  else if (d.shareAll) { bg='rgba(141,198,63,0.14)'; color='#8DC63F'; label='🌐 Everyone' }
  else if (d.sharedWith && d.sharedWith.length) { bg='rgba(96,165,250,0.14)'; color='#60a5fa'; label='👥 Shared · ' + d.sharedWith.length }
  else { bg='rgba(107,114,128,0.16)'; color='#9ca3af'; label='🔒 Private' }
  return <span style={{background:bg,color,fontSize:'11px',fontWeight:700,padding:'3px 9px',borderRadius:'999px',whiteSpace:'nowrap'}}>{label}</span>
}

export default function DocumentsPage() {
  const [me, setMe] = useState({ name:'', email:'' })
  const [docs, setDocs] = useState([])
  const [folders, setFolders] = useState([])
  const [users, setUsers] = useState([])
  const [isMaster, setIsMaster] = useState(false)
  const [view, setView] = useState('mine')           // 'mine' | 'everyone' (master only)
  const [chip, setChip] = useState('all')            // 'all' | folderId | 'unfiled' | 'shared' | 'legacy'
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [banner, setBanner] = useState('')

  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [renameDoc, setRenameDoc] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState('')
  const [duplicatingId, setDuplicatingId] = useState(null)

  const [newFolder, setNewFolder] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderBusy, setFolderBusy] = useState(false)
  const [folderErr, setFolderErr] = useState('')
  const [editFolder, setEditFolder] = useState(null)     // {id,name}
  const [delFolder, setDelFolder] = useState(null)       // {id,name,count}

  const [shareDoc, setShareDoc] = useState(null)         // {doc, shareAll, sharedWith:[], search}
  const [shareBusy, setShareBusy] = useState(false)
  const [shareErr, setShareErr] = useState('')
  const [moveDoc, setMoveDoc] = useState(null)           // {doc, folderId}
  const [moveBusy, setMoveBusy] = useState(false)

  const fileInputRef = useRef(null)
  const effEmail = (me.email || '').toLowerCase()

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    if (u.role !== 'admin') { window.location.href = '/admin/dashboard'; return }
    setMe(u)
    load(u.email)
    fetch('/api/users').then(r=>r.json()).then(list => {
      setUsers(Array.isArray(list) ? list.filter(x => x.status !== 'inactive' && x.email) : [])
    }).catch(()=>{})
  }, [])

  async function load(email) {
    setLoading(true)
    try {
      const e = encodeURIComponent((email || me.email || '').toLowerCase())
      const [dRes, fRes] = await Promise.all([
        fetch('/api/documents?email=' + e).then(r=>r.json()),
        fetch('/api/documents/folders?email=' + e).then(r=>r.json()),
      ])
      setDocs(Array.isArray(dRes.docs) ? dRes.docs : [])
      setIsMaster(!!dRes.isMaster)
      setFolders(Array.isArray(fRes.folders) ? fRes.folders : [])
    } catch(e) {}
    setLoading(false)
  }

  function nameFor(email) {
    if (!email) return ''
    if (email === effEmail) return 'You'
    const u = users.find(x => (x.email||'').toLowerCase() === email)
    return (u && u.name) ? u.name : email
  }
  function folderNameFor(id) { const f = folders.find(x => x.id === id); return f ? f.name : '' }

  async function handleUpload(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) { setUploadError('Only PDF files are supported.'); return }
    setUploading(true); setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('ownerEmail', effEmail)
      // Upload straight into the folder you're viewing, if it's one of yours.
      const targetFolder = (chip !== 'all' && chip !== 'unfiled' && chip !== 'shared' && chip !== 'legacy') ? chip : ''
      fd.append('folderId', targetFolder)
      const res = await fetch('/api/documents', { method:'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.success) setUploadError(data.error || 'Upload failed')
      else await load()
    } catch(e) { setUploadError(e.message || 'Network error') }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function doDuplicate(d) {
    setDuplicatingId(d.id); setUploadError('')
    try {
      const res = await fetch('/api/documents/' + d.id + '/duplicate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerEmail: effEmail, folderId: d.isOwner ? (d.folderId||'') : '' })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) setUploadError(data.error || 'Duplicate failed')
      else { setBanner('Duplicated as a private copy owned by you.'); await load() }
    } catch(e) { setUploadError(e.message || 'Network error') }
    setDuplicatingId(null)
  }

  async function doRename() {
    if (!renameDoc) return
    const v = renameValue.trim()
    if (!v) { setRenameError('Please enter a name'); return }
    setRenaming(true); setRenameError('')
    try {
      const res = await fetch('/api/documents/' + renameDoc.id + '/fields', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: v })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) { setRenameError(data.error || ('HTTP ' + res.status)); setRenaming(false); return }
      setRenameDoc(null); await load()
    } catch(e) { setRenameError(e.message || 'Network error') }
    setRenaming(false)
  }

  async function doDelete(id) {
    setDeleting(true); setDeleteError('')
    try {
      const res = await fetch('/api/documents/' + id + '/fields', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) { setDeleteError(data.error || ('HTTP ' + res.status)); setDeleting(false); return }
      setConfirmDelete(null); await load()
    } catch(e) { setDeleteError(e.message || 'Network error') }
    setDeleting(false)
  }

  async function createFolder() {
    const name = folderName.trim()
    if (!name) { setFolderErr('Enter a name'); return }
    setFolderBusy(true); setFolderErr('')
    try {
      const res = await fetch('/api/documents/folders', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: effEmail, name })
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok || !data.success) { setFolderErr(data.error || 'Failed'); setFolderBusy(false); return }
      setNewFolder(false); setFolderName(''); await load()
    } catch(e) { setFolderErr(e.message || 'Network error') }
    setFolderBusy(false)
  }

  async function saveRenameFolder() {
    const name = (editFolder.name||'').trim()
    if (!name) { setFolderErr('Enter a name'); return }
    setFolderBusy(true); setFolderErr('')
    try {
      const res = await fetch('/api/documents/folders', {
        method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: effEmail, id: editFolder.id, name })
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok || !data.success) { setFolderErr(data.error || 'Failed'); setFolderBusy(false); return }
      setEditFolder(null); await load()
    } catch(e) { setFolderErr(e.message || 'Network error') }
    setFolderBusy(false)
  }

  async function doDeleteFolder() {
    setFolderBusy(true)
    try {
      await fetch('/api/documents/folders?id=' + encodeURIComponent(delFolder.id) + '&email=' + encodeURIComponent(effEmail), { method:'DELETE' })
      if (chip === delFolder.id) setChip('all')
      setDelFolder(null); await load()
    } catch(e) {}
    setFolderBusy(false)
  }

  function openShare(d) {
    setShareErr('')
    setShareDoc({ doc: d, shareAll: !!d.shareAll, sharedWith: [...(d.sharedWith||[])], search:'' })
  }
  async function saveShare() {
    setShareBusy(true); setShareErr('')
    try {
      const res = await fetch('/api/documents/' + shareDoc.doc.id + '/meta', {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email: effEmail, shareAll: shareDoc.shareAll, sharedWith: shareDoc.sharedWith })
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok || !data.success) { setShareErr(data.error || 'Failed'); setShareBusy(false); return }
      setShareDoc(null); await load()
    } catch(e) { setShareErr(e.message || 'Network error') }
    setShareBusy(false)
  }

  function openMove(d) { setMoveDoc({ doc: d, folderId: d.isOwner ? (d.folderId||'') : '' }) }
  async function saveMove() {
    setMoveBusy(true)
    try {
      const res = await fetch('/api/documents/' + moveDoc.doc.id + '/meta', {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email: effEmail, folderId: moveDoc.folderId })
      })
      const data = await res.json().catch(()=>({}))
      if (res.ok && data.success) { setMoveDoc(null); await load() }
    } catch(e) {}
    setMoveBusy(false)
  }

  // ---- derived groupings ----
  const myDocs = docs.filter(d => d.isOwner)
  const legacyDocs = docs.filter(d => d.legacy)
  const sharedWithMe = docs.filter(d => !d.isOwner && !d.legacy && (d.shareAll || (d.sharedWith||[]).includes(effEmail)))

  const folderCount = (id) => myDocs.filter(d => d.folderId === id).length
  const unfiledCount = myDocs.filter(d => !d.folderId).length

  let shown = myDocs
  if (chip === 'unfiled') shown = myDocs.filter(d => !d.folderId)
  else if (chip === 'shared') shown = sharedWithMe
  else if (chip === 'legacy') shown = legacyDocs
  else if (chip !== 'all') shown = myDocs.filter(d => d.folderId === chip)

  const everyoneGroups = (() => {
    const byOwner = {}
    docs.filter(d => !d.legacy).forEach(d => { (byOwner[d.ownerEmail] = byOwner[d.ownerEmail] || []).push(d) })
    return byOwner
  })()

  function DocRow({ d }) {
    return (
      <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'14px',flexWrap:'wrap'}}>
        <div style={{flex:'1 1 240px',minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
            <a href={'/admin/documents/' + d.id} style={{color:'#fff',fontSize:'14px',fontWeight:600,textDecoration:'none'}}>{d.name}</a>
            <VisBadge d={d}/>
            {d.folderId && d.isOwner && folderNameFor(d.folderId) && <span style={{fontSize:'11px',color:'#6b7280'}}>📁 {folderNameFor(d.folderId)}</span>}
          </div>
          <div style={{fontSize:'12px',color:'#6b7280',marginTop:'3px'}}>
            {(!d.isOwner || view==='everyone') && d.ownerEmail && <span style={{color:'#9ca3af'}}>{nameFor(d.ownerEmail)} · </span>}
            {fmtDate(d.modifiedTime)} · {fmtSize(d.size)} {d.hasFields ? ' · ✓ fields placed' : ' · no fields yet'}
          </div>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <a href={'/api/documents/raw/' + d.id} target="_blank" rel="noopener" style={ghostBtn}>Preview</a>
          {d.canManage && <a href={'/admin/documents/' + d.id + '/place-fields'} style={ghostBtn}>Place fields</a>}
          <a href={'/admin/documents/' + d.id} style={{...ghostBtn, background:'#8DC63F', color:'#0a0a0a', border:'none', fontWeight:700}}>Send to sign →</a>
          {d.canManage && <button onClick={()=>openShare(d)} style={{...ghostBtn, color:'#60a5fa', borderColor:'#1e3a5f'}}>Share</button>}
          {d.canManage && <button onClick={()=>openMove(d)} style={ghostBtn}>Move</button>}
          <button onClick={()=>doDuplicate(d)} disabled={duplicatingId===d.id} style={{...ghostBtn, border:'1px solid #252525', background:'none'}}>{duplicatingId===d.id?'Duplicating…':'Duplicate'}</button>
          {d.canManage && <button onClick={()=>{setRenameDoc(d);setRenameValue((d.name||'').replace(/\.pdf$/i,''));setRenameError('')}} style={{...ghostBtn, background:'none'}}>Rename</button>}
          {d.canManage && <button onClick={()=>{setConfirmDelete(d);setDeleteError('')}} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:'12px',fontWeight:600}}>Delete</button>}
        </div>
      </div>
    )
  }

  const chipStyle = (active) => ({
    background: active ? 'rgba(141,198,63,0.14)' : '#1a1a1a',
    color: active ? '#8DC63F' : '#9ca3af',
    border: '1px solid ' + (active ? 'rgba(141,198,63,0.4)' : '#252525'),
    borderRadius: '999px', padding: '6px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  })

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'18px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Documents</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>
            PDF templates for signing · private to you until shared{isMaster ? ' · master admin (you see all)' : ''}
          </p>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
          {isMaster && (
            <div style={{display:'flex',background:'#1a1a1a',border:'1px solid #252525',borderRadius:'8px',overflow:'hidden'}}>
              {['mine','everyone'].map(v => (
                <button key={v} onClick={()=>setView(v)} style={{background: view===v?'#8DC63F':'transparent', color: view===v?'#0a0a0a':'#9ca3af', border:'none', padding:'8px 14px', fontSize:'12px', fontWeight:700, cursor:'pointer'}}>
                  {v==='mine'?'My view':'Everyone'}
                </button>
              ))}
            </div>
          )}
          <a href="/admin/documents/signed" style={{...ghostBtn, padding:'10px 16px', fontSize:'13px'}}>Signed PDFs</a>
          <button onClick={()=>{setNewFolder(true);setFolderName('');setFolderErr('')}} style={{...ghostBtn, padding:'10px 16px', fontSize:'13px'}}>+ New folder</button>
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" style={{display:'none'}}
            onChange={e=>{ const f = e.target.files && e.target.files[0]; if (f) handleUpload(f) }}/>
          <button onClick={()=>fileInputRef.current && fileInputRef.current.click()} disabled={uploading}
            style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:700,cursor:uploading?'wait':'pointer',opacity:uploading?0.7:1}}>
            {uploading ? 'Uploading…' : '+ Upload PDF'}
          </button>
        </div>
      </div>

      {uploadError && <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'10px 14px',marginBottom:'14px',fontSize:'13px'}}>{uploadError}</div>}
      {banner && <div style={{background:'rgba(141,198,63,0.08)',border:'1px solid rgba(141,198,63,0.3)',color:'#8DC63F',borderRadius:'8px',padding:'10px 14px',marginBottom:'14px',fontSize:'13px',display:'flex',justifyContent:'space-between'}}><span>{banner}</span><button onClick={()=>setBanner('')} style={{background:'none',border:'none',color:'#8DC63F',cursor:'pointer'}}>✕</button></div>}

      {/* Folder chips (My view only) */}
      {view === 'mine' && (
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center',marginBottom:'16px'}}>
          <button onClick={()=>setChip('all')} style={chipStyle(chip==='all')}>All · {myDocs.length}</button>
          {folders.map(f => (
            <span key={f.id} style={{display:'inline-flex',alignItems:'center'}}>
              <button onClick={()=>setChip(f.id)} style={chipStyle(chip===f.id)}>📁 {f.name} · {folderCount(f.id)}</button>
              {chip===f.id && (
                <>
                  <button title="Rename folder" onClick={()=>{setEditFolder({id:f.id,name:f.name});setFolderErr('')}} style={{background:'none',border:'none',color:'#6b7280',cursor:'pointer',fontSize:'12px',marginLeft:'4px'}}>✎</button>
                  <button title="Delete folder" onClick={()=>setDelFolder({id:f.id,name:f.name,count:folderCount(f.id)})} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:'12px'}}>🗑</button>
                </>
              )}
            </span>
          ))}
          {unfiledCount>0 && <button onClick={()=>setChip('unfiled')} style={chipStyle(chip==='unfiled')}>Unfiled · {unfiledCount}</button>}
          {sharedWithMe.length>0 && <button onClick={()=>setChip('shared')} style={chipStyle(chip==='shared')}>👥 Shared with me · {sharedWithMe.length}</button>}
          {legacyDocs.length>0 && <button onClick={()=>setChip('legacy')} style={chipStyle(chip==='legacy')}>🏷 Unassigned · {legacyDocs.length}</button>}
        </div>
      )}

      {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>}

      {/* MY VIEW list */}
      {!loading && view === 'mine' && (
        <>
          {chip==='legacy' && (
            <div style={{background:'rgba(251,191,36,0.06)',border:'1px solid rgba(251,191,36,0.25)',color:'#fbbf24',borderRadius:'8px',padding:'10px 14px',marginBottom:'12px',fontSize:'12px'}}>
              These older templates have no owner yet, so every admin can see them. Moving one into a folder or sharing it will make it <strong>yours</strong> (private) — other admins then lose access unless you share it back.
            </div>
          )}
          {shown.length === 0 ? (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'48px',textAlign:'center'}}>
              <p style={{color:'#6b7280',margin:'0 0 8px'}}>{chip==='shared' ? 'Nothing shared with you yet.' : chip==='all' ? 'No documents yet.' : 'Nothing here.'}</p>
              {chip!=='shared' && <p style={{color:'#4b5563',fontSize:'12px',margin:0}}>Upload a PDF to start placing signature fields.</p>}
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>{shown.map(d => <DocRow key={d.id} d={d}/>)}</div>
          )}
        </>
      )}

      {/* EVERYONE VIEW (master) */}
      {!loading && view === 'everyone' && (
        <div style={{display:'flex',flexDirection:'column',gap:'22px'}}>
          {Object.keys(everyoneGroups).sort((a,b)=> a===effEmail?-1:b===effEmail?1:nameFor(a).localeCompare(nameFor(b))).map(owner => (
            <div key={owner}>
              <div style={{fontSize:'13px',fontWeight:700,color:'#9ca3af',marginBottom:'8px'}}>{nameFor(owner)} <span style={{color:'#4b5563',fontWeight:400}}>· {everyoneGroups[owner].length}</span></div>
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>{everyoneGroups[owner].map(d => <DocRow key={d.id} d={d}/>)}</div>
            </div>
          ))}
          {legacyDocs.length>0 && (
            <div>
              <div style={{fontSize:'13px',fontWeight:700,color:'#fbbf24',marginBottom:'8px'}}>Unassigned (legacy) <span style={{color:'#4b5563',fontWeight:400}}>· {legacyDocs.length}</span></div>
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>{legacyDocs.map(d => <DocRow key={d.id} d={d}/>)}</div>
            </div>
          )}
          {Object.keys(everyoneGroups).length===0 && legacyDocs.length===0 && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>No documents yet.</div>}
        </div>
      )}

      {/* NEW / RENAME FOLDER */}
      {(newFolder || editFolder) && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}} onClick={()=>!folderBusy&&(setNewFolder(false),setEditFolder(null))}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'14px',padding:'22px',width:'420px',maxWidth:'100%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:'0 0 12px',fontSize:'16px',fontWeight:700,color:'#fff'}}>{editFolder ? 'Rename folder' : 'New folder'}</h3>
            <input autoFocus value={editFolder ? editFolder.name : folderName}
              onChange={e=> editFolder ? setEditFolder({...editFolder,name:e.target.value}) : setFolderName(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') (editFolder?saveRenameFolder():createFolder()) }}
              placeholder="Folder name" style={inp}/>
            {folderErr && <div style={{color:'#f87171',fontSize:'12px',marginTop:'8px'}}>{folderErr}</div>}
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'16px'}}>
              <button onClick={()=>{setNewFolder(false);setEditFolder(null)}} disabled={folderBusy} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button onClick={()=>editFolder?saveRenameFolder():createFolder()} disabled={folderBusy} style={{background:'#8DC63F',border:'none',color:'#0a0a0a',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:700,cursor:'pointer',opacity:folderBusy?0.6:1}}>{folderBusy?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE FOLDER */}
      {delFolder && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}} onClick={()=>!folderBusy&&setDelFolder(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'14px',padding:'22px',width:'420px',maxWidth:'100%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:'0 0 10px',fontSize:'16px',fontWeight:700,color:'#fff'}}>Delete folder “{delFolder.name}”?</h3>
            <p style={{color:'#9ca3af',fontSize:'13px',margin:'0 0 16px'}}>{delFolder.count>0 ? `The ${delFolder.count} document${delFolder.count===1?'':'s'} inside will move to Unfiled — nothing is deleted.` : 'This folder is empty.'}</p>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setDelFolder(null)} disabled={folderBusy} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button onClick={doDeleteFolder} disabled={folderBusy} style={{background:'#dc2626',border:'none',color:'#fff',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>{folderBusy?'Deleting…':'Delete folder'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SHARE */}
      {shareDoc && (() => {
        const q = (shareDoc.search||'').toLowerCase()
        const candidates = users.filter(u => (u.email||'').toLowerCase() !== effEmail)
          .filter(u => !q || (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q))
        const toggle = (email) => {
          const e = (email||'').toLowerCase()
          setShareDoc(s => ({ ...s, sharedWith: s.sharedWith.includes(e) ? s.sharedWith.filter(x=>x!==e) : [...s.sharedWith, e] }))
        }
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}} onClick={()=>!shareBusy&&setShareDoc(null)}>
            <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'22px',width:'520px',maxWidth:'100%',maxHeight:'88vh',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
              <h3 style={{margin:'0 0 4px',fontSize:'16px',fontWeight:700,color:'#fff'}}>Share “{(shareDoc.doc.name||'').replace(/\.pdf$/i,'')}”</h3>
              <p style={{color:'#6b7280',fontSize:'12px',margin:'0 0 14px'}}>Choose who can see this document. {shareDoc.doc.legacy && <span style={{color:'#fbbf24'}}>Sharing will make this document yours.</span>}</p>

              <label style={{display:'flex',alignItems:'center',gap:'10px',background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'10px',padding:'12px 14px',marginBottom:'12px',cursor:'pointer'}}>
                <input type="checkbox" checked={shareDoc.shareAll} onChange={e=>setShareDoc(s=>({...s,shareAll:e.target.checked}))}/>
                <div>
                  <div style={{fontSize:'13px',color:'#fff',fontWeight:600}}>🌐 Everyone</div>
                  <div style={{fontSize:'11px',color:'#6b7280'}}>Visible to all admins</div>
                </div>
              </label>

              <div style={{opacity: shareDoc.shareAll?0.45:1, pointerEvents: shareDoc.shareAll?'none':'auto', display:'flex', flexDirection:'column', minHeight:0, flex:1}}>
                <label style={lbl}>Or share with specific people</label>
                <input placeholder="Search users…" value={shareDoc.search} onChange={e=>setShareDoc(s=>({...s,search:e.target.value}))} style={{...inp, marginBottom:'8px'}}/>
                <div style={{overflowY:'auto',border:'1px solid #1e1e1e',borderRadius:'10px'}}>
                  {candidates.length===0 && <div style={{padding:'14px',color:'#6b7280',fontSize:'13px'}}>No other users found.</div>}
                  {candidates.map(u => {
                    const e = (u.email||'').toLowerCase()
                    const on = shareDoc.sharedWith.includes(e)
                    return (
                      <label key={e} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',cursor:'pointer',borderBottom:'1px solid #161616'}}>
                        <input type="checkbox" checked={on} onChange={()=>toggle(e)}/>
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:'13px',color:'#fff',fontWeight:500}}>{u.name||u.email}</div>
                          <div style={{fontSize:'11px',color:'#6b7280',overflow:'hidden',textOverflow:'ellipsis'}}>{u.email} · {u.role}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {shareErr && <div style={{color:'#f87171',fontSize:'12px',marginTop:'10px'}}>{shareErr}</div>}
              <div style={{display:'flex',gap:'8px',justifyContent:'space-between',alignItems:'center',marginTop:'14px'}}>
                <span style={{fontSize:'12px',color:'#6b7280'}}>{shareDoc.shareAll ? 'Shared with everyone' : (shareDoc.sharedWith.length ? `${shareDoc.sharedWith.length} selected` : 'Private')}</span>
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={()=>setShareDoc(null)} disabled={shareBusy} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
                  <button onClick={saveShare} disabled={shareBusy} style={{background:'#8DC63F',border:'none',color:'#0a0a0a',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer',opacity:shareBusy?0.6:1}}>{shareBusy?'Saving…':'Save sharing'}</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MOVE */}
      {moveDoc && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}} onClick={()=>!moveBusy&&setMoveDoc(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'14px',padding:'22px',width:'440px',maxWidth:'100%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:'0 0 4px',fontSize:'16px',fontWeight:700,color:'#fff'}}>Move “{(moveDoc.doc.name||'').replace(/\.pdf$/i,'')}”</h3>
            <p style={{color:'#6b7280',fontSize:'12px',margin:'0 0 14px'}}>Into one of your folders. {moveDoc.doc.legacy && <span style={{color:'#fbbf24'}}>This will make the document yours.</span>}</p>
            <div style={{display:'flex',flexDirection:'column',gap:'6px',maxHeight:'300px',overflowY:'auto'}}>
              <label style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'8px',cursor:'pointer'}}>
                <input type="radio" name="movefolder" checked={!moveDoc.folderId} onChange={()=>setMoveDoc(m=>({...m,folderId:''}))}/>
                <span style={{fontSize:'13px',color:'#fff'}}>Unfiled</span>
              </label>
              {folders.map(f => (
                <label key={f.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'8px',cursor:'pointer'}}>
                  <input type="radio" name="movefolder" checked={moveDoc.folderId===f.id} onChange={()=>setMoveDoc(m=>({...m,folderId:f.id}))}/>
                  <span style={{fontSize:'13px',color:'#fff'}}>📁 {f.name}</span>
                </label>
              ))}
              {folders.length===0 && <p style={{color:'#6b7280',fontSize:'12px',margin:'4px 0 0'}}>You have no folders yet — create one with “+ New folder”.</p>}
            </div>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'16px'}}>
              <button onClick={()=>setMoveDoc(null)} disabled={moveBusy} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button onClick={saveMove} disabled={moveBusy} style={{background:'#8DC63F',border:'none',color:'#0a0a0a',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer',opacity:moveBusy?0.6:1}}>{moveBusy?'Moving…':'Move here'}</button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME DOC */}
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
            {renameError && <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'8px 12px',marginBottom:'12px',fontSize:'12px',wordBreak:'break-word'}}>{renameError}</div>}
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setRenameDoc(null)} disabled={renaming} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',cursor:renaming?'not-allowed':'pointer'}}>Cancel</button>
              <button onClick={doRename} disabled={renaming||!renameValue.trim()} style={{background:'#8DC63F',border:'none',color:'#0a0a0a',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:700,cursor:(renaming||!renameValue.trim())?'not-allowed':'pointer',opacity:(renaming||!renameValue.trim())?0.6:1}}>{renaming?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE DOC */}
      {confirmDelete && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}} onClick={()=>!deleting&&setConfirmDelete(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'14px',padding:'22px',width:'420px',maxWidth:'100%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:'0 0 10px',fontSize:'16px',fontWeight:700,color:'#fff'}}>Delete template?</h3>
            <div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'13px',color:'#d1d5db'}}>{confirmDelete.name}</div>
            <p style={{color:'#9ca3af',fontSize:'12px',margin:'0 0 14px'}}>This removes the PDF from Google Drive (moved to trash if the service account lacks permanent-delete permission). Previously signed PDFs in Blob storage are not affected.</p>
            {deleteError && <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'8px 12px',marginBottom:'12px',fontSize:'12px',wordBreak:'break-word'}}>{deleteError}</div>}
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
