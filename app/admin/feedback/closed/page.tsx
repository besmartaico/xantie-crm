// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const inp = { width:'100%', background:'#111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'14px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }

const TYPES = [
  { value:'bug', label:'🐛 Bug' },
  { value:'feature', label:'💡 Feature Request' },
]
const PRIORITIES = [
  { value:'low', label:'Low', color:'#9ca3af' },
  { value:'medium', label:'Medium', color:'#fbbf24' },
  { value:'high', label:'High', color:'#f87171' },
]
const STATUSES = [
  { value:'open', label:'Open', color:'#60a5fa', bg:'rgba(96,165,250,0.12)' },
  { value:'in-progress', label:'In Progress', color:'#f59e0b', bg:'rgba(245,158,11,0.12)' },
  { value:'closed', label:'Closed', color:'#6b7280', bg:'rgba(107,114,128,0.12)' },
]

function StatusBadge({ status }) {
  const s = STATUSES.find(x=>x.value===status) || STATUSES[0]
  return <span style={{background:s.bg, color:s.color, fontSize:'11px', fontWeight:700, padding:'3px 9px', borderRadius:'5px'}}>{s.label}</span>
}
function TypeIcon({ type }) {
  const t = TYPES.find(x=>x.value===type) || TYPES[0]
  return <span style={{fontSize:'13px'}}>{t.label.split(' ')[0]}</span>
}
function PriorityBadge({ priority }) {
  const p = PRIORITIES.find(x=>x.value===priority) || PRIORITIES[1]
  return <span style={{color:p.color, fontSize:'11px', fontWeight:600}}>{p.label}</span>
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })
}

export default function ClosedFeedbackPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeItem, setActiveItem] = useState(null)
  const [comments, setComments] = useState([])
  const [currentUser, setCurrentUser] = useState({})
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u)
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await (await fetch('/api/feedback')).json()
      setItems(data || [])
    } catch(e){}
    setLoading(false)
  }

  async function loadComments(id) {
    try {
      const data = await (await fetch('/api/feedback/' + id + '/comments')).json()
      setComments(data || [])
    } catch(e){ setComments([]) }
  }

  async function openDetail(item) {
    setActiveItem(item)
    setEditing(false)
    setEditForm({...item})
    setNewComment('')
    loadComments(item.id)
  }

  async function saveEdit() {
    if (!editForm.title) return
    setSaving(true)
    await fetch('/api/feedback', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'update', ...editForm, id: activeItem.id })})
    setSaving(false)
    setEditing(false)
    await load()
    setActiveItem({...activeItem, ...editForm})
  }

  async function changeStatus(newStatus) {
    await fetch('/api/feedback', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'update', id: activeItem.id, status: newStatus })})
    await load()
    setActiveItem({...activeItem, status: newStatus})
  }

  async function postComment() {
    if (!newComment.trim() || !activeItem) return
    setPosting(true)
    await fetch('/api/feedback/' + activeItem.id + '/comments', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ comment: newComment.trim(), name: currentUser.name||currentUser.email||'Anonymous', email: currentUser.email||'' })})
    setNewComment('')
    await loadComments(activeItem.id)
    setPosting(false)
  }

  const isAdmin = currentUser.role === 'admin'
  const closedItems = items.filter(i => i.status === 'closed' || i.status === 'done')

  return (
    <div className="mobile-modal-mobile">
      <div style={{marginBottom:'24px'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px',flexWrap:'wrap'}}>
          <div>
            <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Closed Items</h1>
            <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Resolved bugs and completed feature requests · {closedItems.length} total</p>
          </div>
          <a href="/admin/feedback" style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'8px 14px',fontSize:'13px',fontWeight:600,textDecoration:'none',whiteSpace:'nowrap'}}>← Back to Active</a>
        </div>
      </div>

      {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>}
      {!loading && closedItems.length === 0 && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'48px',textAlign:'center'}}>
          <p style={{color:'#6b7280',margin:0}}>No closed items yet</p>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
        {closedItems.map(item => (
          <div key={item.id} onClick={()=>openDetail(item)}
            style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'14px 16px',cursor:'pointer',transition:'all 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#8DC63F'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='#1e1e1e'}>
            <div style={{display:'flex',alignItems:'flex-start',gap:'12px',flexWrap:'wrap'}}>
              <div style={{flex:'1 1 240px',minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px',flexWrap:'wrap'}}>
                  <TypeIcon type={item.type}/>
                  <strong style={{fontSize:'14px',color:'#fff'}}>{item.title}</strong>
                </div>
                <div style={{fontSize:'12px',color:'#6b7280'}}>
                  {item.name||'—'} · {fmtDate(item.submittedAt)}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <PriorityBadge priority={item.priority}/>
                <StatusBadge status={item.status}/>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DETAIL MODAL */}
      {activeItem && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}}
          onClick={()=>setActiveItem(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'24px',width:'640px',maxWidth:'100%',maxHeight:'92vh',overflowY:'auto'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px',gap:'10px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                <TypeIcon type={activeItem.type}/>
                <h2 style={{fontSize:'18px',fontWeight:700,margin:0}}>{activeItem.title}</h2>
              </div>
              <button onClick={()=>setActiveItem(null)} style={{background:'none',border:'none',color:'#6b7280',fontSize:'22px',cursor:'pointer',lineHeight:1,padding:'0 4px'}}>✕</button>
            </div>
            <div style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap',alignItems:'center'}}>
              <StatusBadge status={activeItem.status}/>
              <PriorityBadge priority={activeItem.priority}/>
              <span style={{color:'#6b7280',fontSize:'12px'}}>{activeItem.name||'—'} · {fmtDate(activeItem.submittedAt)}</span>
            </div>

            {!editing && (
              <div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'8px',padding:'14px 16px',color:'#d1d5db',fontSize:'13px',lineHeight:1.6,whiteSpace:'pre-wrap',marginBottom:'16px'}}>{activeItem.description}</div>
            )}

            {editing && (
              <div style={{marginBottom:'16px'}}>
                <div style={{marginBottom:'10px'}}>
                  <label style={lbl}>Title</label>
                  <input value={editForm.title||''} onChange={e=>setEditForm({...editForm,title:e.target.value})} style={inp}/>
                </div>
                <div style={{marginBottom:'10px'}}>
                  <label style={lbl}>Description</label>
                  <textarea rows={4} value={editForm.description||''} onChange={e=>setEditForm({...editForm,description:e.target.value})} style={{...inp,resize:'vertical'}}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <div>
                    <label style={lbl}>Type</label>
                    <select value={editForm.type||'bug'} onChange={e=>setEditForm({...editForm,type:e.target.value})} style={{...inp,cursor:'pointer'}}>
                      {TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Priority</label>
                    <select value={editForm.priority||'medium'} onChange={e=>setEditForm({...editForm,priority:e.target.value})} style={{...inp,cursor:'pointer'}}>
                      {PRIORITIES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'18px'}}>
              {isAdmin && !editing && (
                <button onClick={()=>setEditing(true)} style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'8px 14px',fontSize:'12px',cursor:'pointer'}}>✎ Edit</button>
              )}
              {editing && (
                <>
                  <button onClick={saveEdit} disabled={saving} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'8px 16px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>{saving?'Saving…':'Save'}</button>
                  <button onClick={()=>{setEditing(false);setEditForm({...activeItem})}} style={{background:'#252525',color:'#9ca3af',border:'none',borderRadius:'8px',padding:'8px 14px',fontSize:'12px',cursor:'pointer'}}>Cancel</button>
                </>
              )}
              {isAdmin && !editing && (
                <select value={activeItem.status||'open'} onChange={e=>changeStatus(e.target.value)} style={{...inp, cursor:'pointer', width:'auto', fontSize:'12px', padding:'7px 10px'}}>
                  {STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              )}
            </div>

            <div style={{borderTop:'1px solid #1e1e1e',paddingTop:'16px'}}>
              <h3 style={{fontSize:'13px',fontWeight:700,color:'#9ca3af',margin:'0 0 12px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Comments ({comments.length})</h3>
              <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'14px'}}>
                {comments.map(c => (
                  <div key={c.id} style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'8px',padding:'10px 12px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px',gap:'8px'}}>
                      <strong style={{fontSize:'12px',color:'#fff'}}>{c.name||'Anonymous'}</strong>
                      <span style={{fontSize:'11px',color:'#6b7280'}}>{fmtDate(c.createdAt)}</span>
                    </div>
                    <div style={{fontSize:'13px',color:'#d1d5db',whiteSpace:'pre-wrap',lineHeight:1.5}}>{c.comment}</div>
                  </div>
                ))}
                {comments.length === 0 && <div style={{color:'#6b7280',fontSize:'12px',textAlign:'center',padding:'12px'}}>No comments yet.</div>}
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <textarea rows={2} placeholder="Add a comment…" value={newComment} onChange={e=>setNewComment(e.target.value)} style={{...inp, flex:1, resize:'vertical', fontSize:'13px'}}/>
                <button onClick={postComment} disabled={!newComment.trim()||posting}
                  style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 16px',fontSize:'12px',fontWeight:700,cursor:'pointer',opacity:!newComment.trim()?0.5:1,whiteSpace:'nowrap'}}>{posting?'Posting…':'Post'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}