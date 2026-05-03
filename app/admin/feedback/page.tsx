// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const inp = { width:'100%', background:'#111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'14px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }

const PRIORITIES = [
  { value:'low', label:'Low', color:'#6b7280' },
  { value:'medium', label:'Medium', color:'#f59e0b' },
  { value:'high', label:'High', color:'#f87171' },
]
const STATUSES = [
  { value:'open', label:'Open', color:'#60a5fa', bg:'rgba(96,165,250,0.12)' },
  { value:'in-progress', label:'In Progress', color:'#f59e0b', bg:'rgba(245,158,11,0.12)' },
  { value:'done', label:'Done', color:'#34d399', bg:'rgba(52,211,153,0.12)' },
  { value:'closed', label:'Closed', color:'#6b7280', bg:'rgba(107,114,128,0.12)' },
]

function StatusBadge({ status }) {
  const s = STATUSES.find(x=>x.value===status) || STATUSES[0]
  return <span style={{background:s.bg, color:s.color, fontSize:'11px', fontWeight:700, padding:'3px 8px', borderRadius:'5px'}}>{s.label}</span>
}
function PriorityBadge({ priority }) {
  const p = PRIORITIES.find(x=>x.value===priority) || PRIORITIES[1]
  return <span style={{color:p.color, fontSize:'11px', fontWeight:700}}>{p.label}</span>
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' · ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})
}

export default function FeedbackPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('submit')
  const [currentUser, setCurrentUser] = useState({})

  // Submit form
  const [type, setType] = useState('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [submitting, setSubmitting] = useState(false)

  // Detail modal
  const [activeItem, setActiveItem] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u)
    if (u.role === 'viewer') setTab('list')
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

  async function submit() {
    if (!title.trim() || !description.trim()) return
    setSubmitting(true)
    const u = currentUser
    await fetch('/api/feedback', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({type, title:title.trim(), description, priority, name:u.name||'', email:u.email||''})})
    setTitle(''); setDescription(''); setPriority('medium'); setType('bug'); setSubmitting(false)
    load()
    setTab('list')
  }

  async function updateStatus(id, status) {
    await fetch('/api/feedback', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'update_status', id, status})})
    load()
    if (activeItem && activeItem.id === id) setActiveItem({...activeItem, status})
  }

  async function openDetail(item) {
    setActiveItem(item)
    setEditMode(false)
    setEditForm({title:item.title, description:item.description, priority:item.priority, type:item.type})
    setComments([])
    loadComments(item.id)
  }

  async function saveEdit() {
    setSavingEdit(true)
    await fetch('/api/feedback', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'update', id:activeItem.id, ...editForm})})
    setActiveItem({...activeItem, ...editForm})
    setEditMode(false)
    setSavingEdit(false)
    load()
  }

  async function postComment() {
    if (!newComment.trim()) return
    setPostingComment(true)
    const u = currentUser
    await fetch('/api/feedback/' + activeItem.id + '/comments', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({comment:newComment.trim(), name:u.name||'', email:u.email||''})})
    setNewComment('')
    setPostingComment(false)
    loadComments(activeItem.id)
  }

  const isAdmin = currentUser.role === 'admin'
  const isViewer = currentUser.role === 'viewer'
  const canEdit = (item) => isAdmin || item.email === currentUser.email

  return (
    <div className="page-content-mobile">
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Bugs & Feature Requests</h1>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Report issues or suggest improvements to the system</p>
      </div>

      {/* Tab switcher */}
      <div style={{display:'flex',gap:0,marginBottom:'20px',background:'#0a0a0a',borderRadius:'10px',padding:'4px',border:'1px solid #1e1e1e',width:'fit-content',maxWidth:'100%',overflowX:'auto'}}>
        {!isViewer && (
          <button onClick={()=>setTab('submit')}
            style={{background:tab==='submit'?'#1e1e1e':'transparent',color:tab==='submit'?'#fff':'#6b7280',border:'none',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
            Submit
          </button>
        )}
        <button onClick={()=>setTab('list')}
          style={{background:tab==='list'?'#1e1e1e':'transparent',color:tab==='list'?'#fff':'#6b7280',border:'none',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
          {isViewer ? 'All Submissions' : 'All Items'}
        </button>
      </div>

      {/* SUBMIT TAB */}
      {tab === 'submit' && !isViewer && (
        <div style={{maxWidth:'640px',background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'24px'}}>
          <div style={{marginBottom:'16px'}}>
            <label style={lbl}>TYPE</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'8px'}}>
              {[{v:'bug',l:'🐛 Bug'},{v:'feature',l:'💡 Feature Request'}].map(t=>(
                <button key={t.v} onClick={()=>setType(t.v)} type="button"
                  style={{background:type===t.v?'rgba(141,198,63,0.1)':'#0f0f0f',border:'1px solid '+(type===t.v?'#8DC63F':'#252525'),color:type===t.v?'#8DC63F':'#9ca3af',borderRadius:'8px',padding:'12px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:'16px'}}>
            <label style={lbl}>TITLE *</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Short summary" style={inp}/>
          </div>
          <div style={{marginBottom:'16px'}}>
            <label style={lbl}>DESCRIPTION *</label>
            <textarea rows={5} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the issue or feature in detail..." style={{...inp,resize:'vertical',fontSize:'14px'}}/>
          </div>
          <div style={{marginBottom:'20px'}}>
            <label style={lbl}>PRIORITY</label>
            <select value={priority} onChange={e=>setPriority(e.target.value)} style={{...inp,cursor:'pointer'}}>
              {PRIORITIES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <button onClick={submit} disabled={submitting||!title.trim()||!description.trim()}
            style={{background:title.trim()&&description.trim()?'#8DC63F':'#2a2a2a',color:title.trim()&&description.trim()?'#0a0a0a':'#4b5563',border:'none',borderRadius:'8px',padding:'12px 24px',fontSize:'14px',fontWeight:700,cursor:title.trim()&&description.trim()?'pointer':'not-allowed',width:'100%'}}>
            {submitting?'Submitting...':'Submit'}
          </button>
        </div>
      )}

      {/* LIST TAB - Card layout (works on mobile and desktop) */}
      {tab === 'list' && (
        <div>
          {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>}
          {!loading && items.length === 0 && (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'48px',textAlign:'center'}}>
              <p style={{color:'#6b7280',margin:0}}>No items yet</p>
            </div>
          )}
          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            {items.map(item => (
              <div key={item.id} onClick={()=>openDetail(item)}
                style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'14px 16px',cursor:'pointer',transition:'all 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#8DC63F'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='#1e1e1e'}>
                <div style={{display:'flex',alignItems:'flex-start',gap:'10px',marginBottom:'8px',flexWrap:'wrap'}}>
                  <span style={{fontSize:'16px',flexShrink:0}}>{item.type==='bug'?'🐛':'💡'}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'14px',fontWeight:600,color:'#fff',marginBottom:'2px',wordBreak:'break-word'}}>{item.title}</div>
                    <div style={{fontSize:'12px',color:'#6b7280'}}>{item.name} · {fmtDate(item.submittedAt)}</div>
                  </div>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',flexShrink:0}}>
                    <PriorityBadge priority={item.priority}/>
                    <StatusBadge status={item.status}/>
                  </div>
                </div>
                {item.description && (
                  <div style={{fontSize:'12px',color:'#9ca3af',marginLeft:'26px',overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
                    {item.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {activeItem && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}}
          onClick={()=>{setActiveItem(null);setEditMode(false)}}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'20px',width:'600px',maxWidth:'100%',maxHeight:'92vh',overflowY:'auto'}}
            onClick={e=>e.stopPropagation()}>
            
            {/* Header */}
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'10px',marginBottom:'16px'}}>
              <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'}}>
                <span style={{fontSize:'20px'}}>{activeItem.type==='bug'?'🐛':'💡'}</span>
                <PriorityBadge priority={activeItem.priority}/>
                <StatusBadge status={activeItem.status}/>
              </div>
              <button onClick={()=>{setActiveItem(null);setEditMode(false)}}
                style={{background:'none',border:'none',color:'#6b7280',fontSize:'22px',cursor:'pointer',lineHeight:1,padding:'0 4px'}}>✕</button>
            </div>

            {/* Title - editable */}
            {editMode ? (
              <input value={editForm.title||''} onChange={e=>setEditForm({...editForm,title:e.target.value})}
                style={{...inp,fontSize:'18px',fontWeight:700,marginBottom:'12px'}}/>
            ) : (
              <h2 style={{fontSize:'18px',fontWeight:700,margin:'0 0 8px',color:'#fff',wordBreak:'break-word'}}>{activeItem.title}</h2>
            )}

            <div style={{fontSize:'12px',color:'#6b7280',marginBottom:'16px'}}>
              Submitted by <strong style={{color:'#9ca3af'}}>{activeItem.name||'Unknown'}</strong> on {fmtDate(activeItem.submittedAt)}
            </div>

            {/* Description - editable */}
            <div style={{marginBottom:'16px'}}>
              <label style={lbl}>Description</label>
              {editMode ? (
                <textarea rows={5} value={editForm.description||''} onChange={e=>setEditForm({...editForm,description:e.target.value})}
                  style={{...inp,resize:'vertical'}}/>
              ) : (
                <div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'8px',padding:'12px',color:'#d1d5db',fontSize:'13px',lineHeight:1.6,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
                  {activeItem.description || <em style={{color:'#4b5563'}}>No description</em>}
                </div>
              )}
            </div>

            {/* Edit controls: priority + type when editing */}
            {editMode && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'16px'}}>
                <div>
                  <label style={lbl}>Type</label>
                  <select value={editForm.type||'bug'} onChange={e=>setEditForm({...editForm,type:e.target.value})} style={{...inp,cursor:'pointer'}}>
                    <option value="bug">🐛 Bug</option>
                    <option value="feature">💡 Feature</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Priority</label>
                  <select value={editForm.priority||'medium'} onChange={e=>setEditForm({...editForm,priority:e.target.value})} style={{...inp,cursor:'pointer'}}>
                    {PRIORITIES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Status — admin can change anytime, others see read-only */}
            <div style={{marginBottom:'16px'}}>
              <label style={lbl}>Status</label>
              {isAdmin ? (
                <select value={activeItem.status} onChange={e=>updateStatus(activeItem.id, e.target.value)} style={{...inp,cursor:'pointer'}}>
                  {STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              ) : (
                <StatusBadge status={activeItem.status}/>
              )}
            </div>

            {/* Edit/Save buttons */}
            {canEdit(activeItem) && !isViewer && (
              <div style={{display:'flex',gap:'8px',marginBottom:'24px',flexWrap:'wrap'}}>
                {editMode ? (
                  <>
                    <button onClick={saveEdit} disabled={savingEdit}
                      style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
                      {savingEdit?'Saving...':'Save Changes'}
                    </button>
                    <button onClick={()=>setEditMode(false)}
                      style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',cursor:'pointer'}}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button onClick={()=>setEditMode(true)}
                    style={{background:'#1e1e1e',border:'1px solid #252525',color:'#9ca3af',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
                    ✎ Edit
                  </button>
                )}
              </div>
            )}

            {/* COMMENTS SECTION */}
            <div style={{borderTop:'1px solid #1e1e1e',paddingTop:'18px'}}>
              <div style={{fontSize:'13px',fontWeight:700,color:'#9ca3af',marginBottom:'12px',textTransform:'uppercase',letterSpacing:'0.07em'}}>
                Comments {comments.length > 0 && <span style={{color:'#4b5563',fontWeight:500}}>({comments.length})</span>}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'16px'}}>
                {comments.length === 0 && (
                  <div style={{color:'#4b5563',fontSize:'13px',fontStyle:'italic',padding:'8px 0'}}>No comments yet. Be the first to add one.</div>
                )}
                {comments.map(c=>(
                  <div key={c.id} style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'10px',padding:'10px 14px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px',gap:'8px',flexWrap:'wrap'}}>
                      <strong style={{fontSize:'12px',color:'#8DC63F'}}>{c.name||c.email}</strong>
                      <span style={{fontSize:'11px',color:'#4b5563'}}>{fmtDate(c.createdAt)}</span>
                    </div>
                    <div style={{fontSize:'13px',color:'#d1d5db',lineHeight:1.5,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{c.comment}</div>
                  </div>
                ))}
              </div>
              {!isViewer && (
                <div>
                  <textarea rows={3} value={newComment} onChange={e=>setNewComment(e.target.value)}
                    placeholder="Add a comment..." style={{...inp,resize:'vertical',marginBottom:'8px'}}/>
                  <button onClick={postComment} disabled={postingComment||!newComment.trim()}
                    style={{background:newComment.trim()?'#8DC63F':'#2a2a2a',color:newComment.trim()?'#0a0a0a':'#4b5563',border:'none',borderRadius:'8px',padding:'8px 18px',fontSize:'13px',fontWeight:700,cursor:newComment.trim()?'pointer':'not-allowed'}}>
                    {postingComment?'Posting...':'Post Comment'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}