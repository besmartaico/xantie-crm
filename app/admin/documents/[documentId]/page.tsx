// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

export default function DocumentDetailPage({ params }) {
  const [resolvedParams, setResolvedParams] = useState(null)
  const [doc, setDoc] = useState(null)
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState('')
  // Send workflow now lives at /admin/documents/[id]/start (multi-step process)

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

  async function saveName() {
    const v = nameValue.trim()
    if (!v) { setNameError('Please enter a name'); return }
    setSavingName(true); setNameError('')
    try {
      const res = await fetch('/api/documents/' + resolvedParams.documentId + '/fields', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: v })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) { setNameError(data.error || ('HTTP ' + res.status)); setSavingName(false); return }
      setDoc(prev => ({ ...prev, name: data.name }))
      setEditingName(false)
    } catch(e) { setNameError(e.message || 'Network error') }
    setSavingName(false)
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
          {editingName ? (
            <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px',flexWrap:'wrap'}}>
              <input autoFocus value={nameValue} onChange={e=>setNameValue(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter')saveName(); if(e.key==='Escape')setEditingName(false) }}
                style={{background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'8px 12px',color:'#fff',fontSize:'18px',fontWeight:700,outline:'none',minWidth:'240px'}}/>
              <span style={{color:'#6b7280',fontSize:'14px'}}>.pdf</span>
              <button onClick={saveName} disabled={savingName||!nameValue.trim()} style={{background:'#8DC63F',border:'none',color:'#0a0a0a',borderRadius:'8px',padding:'8px 14px',fontSize:'13px',fontWeight:700,cursor:(savingName||!nameValue.trim())?'not-allowed':'pointer',opacity:(savingName||!nameValue.trim())?0.6:1}}>{savingName?'Saving…':'Save'}</button>
              <button onClick={()=>setEditingName(false)} disabled={savingName} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'8px 12px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
            </div>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'6px',flexWrap:'wrap'}}>
              <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>{doc.name}</h1>
              <button onClick={()=>{setEditingName(true);setNameValue((doc.name||'').replace(/\.pdf$/i,''));setNameError('')}} style={{background:'none',border:'1px solid #252525',color:'#9ca3af',borderRadius:'6px',padding:'4px 10px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>✎ Rename</button>
            </div>
          )}
          {nameError && <div style={{color:'#f87171',fontSize:'12px',margin:'0 0 6px'}}>{nameError}</div>}
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
            {fields.length > 0 ? (
              <a href={'/admin/documents/' + resolvedParams.documentId + '/start'}
                style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:700,textDecoration:'none'}}>🚀 Start signing process</a>
            ) : (
              <span style={{background:'#2a2a2a',color:'#4b5563',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:700}}>🚀 Start signing process</span>
            )}
            <a href="/admin/sign-requests" style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>📋 All sign requests</a>
          </div>

          {fields.length > 0 && (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'16px'}}>
              <h3 style={{fontSize:'13px',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 10px'}}>Field Summary</h3>
              <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                {fields.map(f => (
                  <div key={f.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:'#0f0f0f',borderRadius:'6px',fontSize:'12px',color:'#d1d5db',gap:'8px'}}>
                    <span><strong style={{color:'#8DC63F'}}>{f.type}</strong> — {f.label || '(no label)'} {f.assignee === 'admin' && <span style={{color:'#f97316',fontSize:'10px',fontWeight:700,marginLeft:'4px',background:'rgba(249,115,22,0.12)',padding:'1px 6px',borderRadius:'4px'}}>ADMIN</span>}</span>
                    <span style={{color:'#6b7280'}}>Page {f.page}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
