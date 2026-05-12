// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { ssr: false })

function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6) }

const DEFAULTS = {
  signature: { width: 180, height: 50, label: 'Signature' },
  initials:  { width: 80,  height: 40, label: 'Initials' },
  text:      { width: 160, height: 30, label: 'Text' },
  date:      { width: 120, height: 30, label: 'Date' },
}

function btnStyle(color) {
  return {
    background: color + '22',
    border: '1px solid ' + color + '66',
    color: color,
    borderRadius: '8px',
    padding: '7px 12px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  }
}

// Tracks the page most-visible in the viewer container; used so "Add field"
// drops onto the page the admin is currently looking at.
function useVisiblePage(deps) {
  const [page, setPage] = useState(1)
  useEffect(() => {
    let raf = null
    function check() {
      const pages = document.querySelectorAll('[data-page]')
      if (!pages.length) return
      const vh = window.innerHeight
      let bestPage = 1, bestVisible = 0
      pages.forEach(p => {
        const r = p.getBoundingClientRect()
        const top = Math.max(r.top, 0)
        const bottom = Math.min(r.bottom, vh)
        const visible = Math.max(0, bottom - top)
        if (visible > bestVisible) {
          bestVisible = visible
          bestPage = parseInt(p.getAttribute('data-page'), 10) || 1
        }
      })
      setPage(bestPage)
    }
    function onScroll() {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(check)
    }
    // Listen on capture phase so we catch scrolls in nested containers
    document.addEventListener('scroll', onScroll, true)
    const interval = setInterval(check, 500)
    check()
    return () => {
      document.removeEventListener('scroll', onScroll, true)
      if (raf) cancelAnimationFrame(raf)
      clearInterval(interval)
    }
  }, deps)
  return page
}

export default function PlaceFieldsPage({ params }) {
  const [resolvedParams, setResolvedParams] = useState(null)
  const [doc, setDoc] = useState(null)
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [pdfBlobUrl, setPdfBlobUrl] = useState('')

  const visiblePage = useVisiblePage([pdfBlobUrl])

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
      const pdfRes = await fetch('/api/documents/raw/' + resolvedParams.documentId)
      const buf = await pdfRes.arrayBuffer()
      const blob = new Blob([buf], { type: 'application/pdf' })
      setPdfBlobUrl(URL.createObjectURL(blob))
    } catch(e) {}
    setLoading(false)
  }

  function addField(type) {
    const base = DEFAULTS[type] || DEFAULTS.text
    setFields(prev => [...prev, {
      id: uid(),
      type,
      page: visiblePage,
      x: 60,
      y: 60 + prev.filter(f=>f.page===visiblePage).length * 20,
      width: base.width,
      height: base.height,
      label: base.label,
      assignee: 'user',
    }])
  }

  function setFieldAssignee(id, assignee) {
    setFields(prev => prev.map(f => f.id === id ? {...f, assignee} : f))
  }

  function updateField(id, patch) {
    setFields(prev => prev.map(f => f.id === id ? {...f, ...patch} : f))
  }

  function removeField(id) {
    setFields(prev => prev.filter(f => f.id !== id))
  }

  function duplicateField(id) {
    setFields(prev => {
      const orig = prev.find(f => f.id === id)
      if (!orig) return prev
      // Drop the copy on the currently visible page, slightly offset so it doesn't sit on top.
      // {...orig} preserves assignee, group, label, etc.
      return [...prev, {
        ...orig,
        id: uid(),
        page: visiblePage,
        x: orig.x + 20,
        y: orig.y + 20,
      }]
    })
  }

  function setFieldLabel(id, label) {
    setFields(prev => prev.map(f => f.id === id ? {...f, label} : f))
  }

  function setFieldGroup(id, group) {
    setFields(prev => prev.map(f => f.id === id ? {...f, group} : f))
  }

  function setFieldPage(id, page) {
    const p = Math.max(1, parseInt(page, 10) || 1)
    setFields(prev => prev.map(f => f.id === id ? {...f, page: p} : f))
  }

  async function save() {
    setSaving(true); setSaveStatus('')
    try {
      const res = await fetch('/api/documents/' + resolvedParams.documentId + '/fields', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ fields })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setSaveStatus('✓ Saved')
        setTimeout(()=>setSaveStatus(''), 2500)
      } else {
        setSaveStatus('✗ ' + (data.error || ('HTTP ' + res.status)))
        // Leave the error visible until next save attempt
      }
    } catch(e) {
      setSaveStatus('✗ ' + (e.message || 'Network error'))
    }
    setSaving(false)
  }

  if (!resolvedParams) return null

  return (
    <div style={{display:'flex',flexDirection:'column',minHeight:'calc(100vh - 110px)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px',flexWrap:'wrap',gap:'10px'}}>
        <div>
          <a href={'/admin/documents/' + resolvedParams.documentId} style={{color:'#9ca3af',fontSize:'12px',textDecoration:'none'}}>← Back</a>
          <h1 style={{fontSize:'18px',fontWeight:700,margin:'4px 0 0'}}>{doc ? doc.name : 'Loading…'}</h1>
        </div>
        <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
          {saveStatus && <span style={{fontSize:'12px',color:saveStatus.startsWith('✓')?'#8DC63F':'#f87171',maxWidth:'420px',wordBreak:'break-word'}}>{saveStatus}</span>}
          <button onClick={save} disabled={saving}
            style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontWeight:700,cursor:saving?'wait':'pointer',opacity:saving?0.7:1}}>{saving?'Saving…':'💾 Save'}</button>
        </div>
      </div>

      <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontSize:'12px',color:'#6b7280'}}>Add to page <strong style={{color:'#8DC63F'}}>{visiblePage}</strong>:</span>
        <button onClick={()=>addField('signature')} style={btnStyle('#60a5fa')}>+ Signature</button>
        <button onClick={()=>addField('initials')} style={btnStyle('#a78bfa')}>+ Initials</button>
        <button onClick={()=>addField('text')} style={btnStyle('#34d399')}>+ Text</button>
        <button onClick={()=>addField('date')} style={btnStyle('#fbbf24')}>+ Date</button>
        <span style={{fontSize:'12px',color:'#6b7280',marginLeft:'12px'}}>{fields.length} field{fields.length===1?'':'s'} total</span>
      </div>

      <div style={{display:'flex',gap:'12px',flex:1,minHeight:0}}>
        {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px',width:'100%'}}>Loading PDF...</div>}
        {!loading && pdfBlobUrl && (
          <>
            <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,maxHeight:'calc(100vh - 220px)'}}>
              <PdfViewer fileUrl={pdfBlobUrl} fields={fields} onUpdateField={updateField} onRemoveField={removeField}/>
            </div>
            <div style={{width:'260px',background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'14px',overflow:'auto',maxHeight:'calc(100vh - 220px)'}}>
              <h3 style={{fontSize:'12px',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 4px'}}>Fields</h3>
              <p style={{fontSize:'11px',color:'#6b7280',margin:'0 0 6px',lineHeight:1.4}}>Tip: give matching fields the same <strong style={{color:'#8DC63F'}}>Group</strong> (e.g., "name") to share one value at signing.</p>
              <p style={{fontSize:'11px',color:'#6b7280',margin:'0 0 10px',lineHeight:1.4}}>Mark a field <strong style={{color:'#f97316'}}>Admin</strong> if you'll fill it before/after the signer (the signer can't fill admin fields).</p>
              {fields.length === 0 && <p style={{color:'#6b7280',fontSize:'12px',margin:0}}>None yet. Use the buttons above to add fields to the current page.</p>}
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {fields.map(f => {
                  const groupCount = f.group ? fields.filter(x => x.group === f.group && x.type === f.type).length : 0
                  return (
                  <div key={f.id} style={{background:'#0f0f0f',border:'1px solid '+(f.group?'#8DC63F44':'#1e1e1e'),borderRadius:'8px',padding:'8px 10px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                      <span style={{fontSize:'11px',color:'#8DC63F',fontWeight:700,textTransform:'uppercase'}}>{f.type}{groupCount > 1 ? ' · 🔗 '+groupCount : ''}</span>
                      <label style={{fontSize:'11px',color:'#6b7280',display:'inline-flex',alignItems:'center',gap:'4px'}}>Page
                        <input type="number" min="1" value={f.page} onChange={e=>setFieldPage(f.id, e.target.value)}
                          style={{width:'46px',background:'#0f0f0f',border:'1px solid #252525',borderRadius:'4px',padding:'2px 4px',color:'#fff',fontSize:'11px',outline:'none',textAlign:'center'}}/>
                      </label>
                    </div>
                    <input value={f.label||''} onChange={e=>setFieldLabel(f.id, e.target.value)} placeholder="Label"
                      style={{width:'100%',background:'#111',border:'1px solid #252525',borderRadius:'6px',padding:'6px 8px',color:'#fff',fontSize:'12px',outline:'none',boxSizing:'border-box',marginBottom:'4px'}}/>
                    <input value={f.group||''} onChange={e=>setFieldGroup(f.id, e.target.value)} placeholder="Group (optional)" title="Fields with the same group share one value at signing"
                      style={{width:'100%',background:'#111',border:'1px solid '+(f.group?'#8DC63F66':'#252525'),borderRadius:'6px',padding:'6px 8px',color:f.group?'#8DC63F':'#fff',fontSize:'12px',outline:'none',boxSizing:'border-box',marginBottom:'4px'}}/>
                    <div style={{display:'flex',gap:'4px',marginBottom:'6px'}}>
                      <button type="button" onClick={()=>setFieldAssignee(f.id, 'user')}
                        style={{flex:1,background:(!f.assignee||f.assignee==='user')?'#8DC63F':'#1e1e1e',color:(!f.assignee||f.assignee==='user')?'#0a0a0a':'#9ca3af',border:'none',borderRadius:'6px',padding:'5px 8px',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>User</button>
                      <button type="button" onClick={()=>setFieldAssignee(f.id, 'admin')}
                        style={{flex:1,background:f.assignee==='admin'?'#f97316':'#1e1e1e',color:f.assignee==='admin'?'#0a0a0a':'#9ca3af',border:'none',borderRadius:'6px',padding:'5px 8px',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>Admin</button>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px'}}>
                      <button onClick={()=>duplicateField(f.id)} title={'Copy this field to page '+visiblePage+' (keeps type, label, group)'} style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:'11px',padding:0,fontWeight:600}}>+ Duplicate</button>
                      <button onClick={()=>removeField(f.id)} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:'11px',padding:0}}>Remove</button>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
