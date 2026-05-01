// @ts-nocheck
'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'

const PRIORITIES = [
  { value:'low', label:'Low', color:'#6b7280', bg:'rgba(107,114,128,0.12)' },
  { value:'medium', label:'Medium', color:'#f59e0b', bg:'rgba(245,158,11,0.12)' },
  { value:'high', label:'High', color:'#f87171', bg:'rgba(248,113,113,0.12)' },
]
function PBadge({ p }) {
  const s = PRIORITIES.find(x=>x.value===p)||PRIORITIES[1]
  return <span style={{background:s.bg,color:s.color,fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'4px',letterSpacing:'0.03em'}}>{s.label}</span>
}

function formatDate(d) {
  if (!d) return null
  const date = new Date(d+'T12:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const diff = date - today
  const overdue = diff < 0
  const soon = diff >= 0 && diff < 86400000*3
  const fmt = date.toLocaleDateString('en-US',{month:'short',day:'numeric'})
  return { fmt, overdue, soon }
}

export default function BoardPage() {
  const router = useRouter()
  const { boardId } = useParams()
  const [board, setBoard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState({})

  // Column editing
  const [addingCol, setAddingCol] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [editingColId, setEditingColId] = useState(null)
  const [editingColName, setEditingColName] = useState('')

  // Card adding
  const [addingCard, setAddingCard] = useState(null) // columnId
  const [newCardTitle, setNewCardTitle] = useState('')

  // Card detail modal
  const [cardModal, setCardModal] = useState(null)
  const [editCard, setEditCard] = useState({})
  const [savingCard, setSavingCard] = useState(false)

  // Share modal
  const [showShare, setShowShare] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharing, setSharing] = useState(false)
  const [allUsers, setAllUsers] = useState([])

  // Drag state
  const dragCardId = useRef(null)
  const dragFromCol = useRef(null)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user')||'{}')
    setCurrentUser(u)
    load()
    fetch('/api/users').then(r=>r.json()).then(u=>setAllUsers(u||[]))
  }, [boardId])

  async function load() {
    setLoading(true)
    try {
      const data = await (await fetch('/api/boards/'+boardId)).json()
      if (data.error) { router.push('/admin/boards'); return }
      setBoard(data)
    } catch(e){}
    setLoading(false)
  }

  const isOwner = board?.ownerEmail === currentUser.email
  const isMember = board?.members?.some(m=>m.email===currentUser.email)

  // ── COLUMNS ──────────────────────────────────────────────────────────
  async function addColumn() {
    if (!newColName.trim()) return
    await fetch('/api/boards/'+boardId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add_column',name:newColName.trim()})})
    setNewColName(''); setAddingCol(false); load()
  }
  async function renameColumn(columnId, name) {
    await fetch('/api/boards/'+boardId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'rename_column',columnId,name})})
    setEditingColId(null); load()
  }
  async function deleteColumn(columnId) {
    if (!confirm('Delete this column and all its cards?')) return
    await fetch('/api/boards/'+boardId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete_column',columnId})})
    load()
  }

  // ── CARDS ─────────────────────────────────────────────────────────────
  async function addCard(columnId) {
    if (!newCardTitle.trim()) return
    await fetch('/api/boards/'+boardId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add_card',columnId,title:newCardTitle.trim(),createdBy:currentUser.name||currentUser.email})})
    setNewCardTitle(''); setAddingCard(null); load()
  }
  async function saveCard() {
    setSavingCard(true)
    await fetch('/api/boards/'+boardId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_card',cardId:cardModal.id,...editCard})})
    setSavingCard(false); setCardModal(null); load()
  }
  async function deleteCard(cardId) {
    await fetch('/api/boards/'+boardId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete_card',cardId})})
    setCardModal(null); load()
  }

  // ── DRAG & DROP ───────────────────────────────────────────────────────
  function onDragStart(cardId, colId) {
    dragCardId.current = cardId
    dragFromCol.current = colId
  }
  async function onDrop(targetColId) {
    if (!dragCardId.current || dragFromCol.current === targetColId) { dragCardId.current=null; return }
    await fetch('/api/boards/'+boardId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_card',cardId:dragCardId.current,columnId:targetColId})})
    dragCardId.current=null; dragFromCol.current=null; load()
  }

  // ── SHARE ─────────────────────────────────────────────────────────────
  async function addMember() {
    if (!shareEmail) return
    setSharing(true)
    await fetch('/api/boards/'+boardId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add_member',email:shareEmail,role:'editor'})})
    setShareEmail(''); setSharing(false); load()
  }
  async function removeMember(email) {
    await fetch('/api/boards/'+boardId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'remove_member',email})})
    load()
  }

  if (loading) return <div style={{color:'#6b7280',padding:'48px',textAlign:'center'}}>Loading board...</div>
  if (!board) return null

  const columns = board.columns || []
  const cards = board.cards || []
  const cardsByCol = {}
  columns.forEach(c=>{ cardsByCol[c.id] = cards.filter(card=>card.columnId===c.id).sort((a,b)=>a.position-b.position) })

  const inp = { background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'8px 12px',color:'#fff',fontSize:'13px',outline:'none',width:'100%',boxSizing:'border-box' }

  return (
    <div style={{height:'calc(100vh - 96px)',display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px',flexShrink:0}}>
        <button onClick={()=>router.push('/admin/boards')} style={{background:'none',border:'none',color:'#6b7280',fontSize:'13px',cursor:'pointer',padding:'4px 0'}}>← Boards</button>
        <div style={{width:'12px',height:'12px',borderRadius:'3px',background:board.color,flexShrink:0}}/>
        <h1 style={{fontSize:'20px',fontWeight:700,margin:0,flex:1}}>{board.name}</h1>
        {(isOwner||isMember)&&(
          <button onClick={()=>setShowShare(true)} style={{background:'#1e1e1e',border:'1px solid #252525',color:'#9ca3af',borderRadius:'8px',padding:'7px 14px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
            Share · {board.members?.length||0}
          </button>
        )}
      </div>

      {/* Kanban board - horizontal scroll */}
      <div style={{display:'flex',gap:'16px',overflowX:'auto',flex:1,paddingBottom:'16px',alignItems:'flex-start'}}>
        {columns.map(col=>{
          const colCards = cardsByCol[col.id]||[]
          return (
            <div key={col.id}
              onDragOver={e=>{e.preventDefault();e.currentTarget.style.outline='2px solid '+board.color}}
              onDragLeave={e=>e.currentTarget.style.outline=''}
              onDrop={e=>{e.currentTarget.style.outline='';onDrop(col.id)}}
              style={{width:'280px',flexShrink:0,background:'#111111',borderRadius:'12px',padding:'12px',border:'1px solid #1e1e1e',display:'flex',flexDirection:'column',maxHeight:'calc(100vh - 180px)',minHeight:'120px'}}>
              {/* Column header */}
              <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'12px',flexShrink:0}}>
                {editingColId===col.id ? (
                  <input autoFocus value={editingColName} onChange={e=>setEditingColName(e.target.value)}
                    onBlur={()=>renameColumn(col.id,editingColName)} onKeyDown={e=>e.key==='Enter'&&renameColumn(col.id,editingColName)}
                    style={{...inp,padding:'4px 8px',fontSize:'13px',flex:1}}/>
                ) : (
                  <>
                    <span onDoubleClick={()=>{setEditingColId(col.id);setEditingColName(col.name)}}
                      style={{fontWeight:700,fontSize:'13px',color:'#fff',flex:1,cursor:'default'}}>{col.name}</span>
                    <span style={{fontSize:'11px',color:'#4b5563',fontWeight:600,background:'#1a1a1a',borderRadius:'4px',padding:'1px 6px'}}>{colCards.length}</span>
                    {isOwner&&<button onClick={()=>deleteColumn(col.id)} style={{background:'none',border:'none',color:'#3a3a3a',fontSize:'14px',cursor:'pointer',padding:'0 2px',lineHeight:1}} title="Delete column">✕</button>}
                  </>
                )}
              </div>

              {/* Cards */}
              <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:'8px'}}>
                {colCards.map(card=>{
                  const due = formatDate(card.dueDate)
                  return (
                    <div key={card.id} draggable
                      onDragStart={()=>onDragStart(card.id,col.id)}
                      onClick={()=>{setCardModal(card);setEditCard({title:card.title,description:card.description,assignedTo:card.assignedTo,dueDate:card.dueDate,priority:card.priority,columnId:card.columnId})}}
                      style={{background:'#1a1a1a',border:'1px solid #252525',borderRadius:'8px',padding:'10px 12px',cursor:'pointer',transition:'all 0.12s'}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=board.color}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='#252525'}>
                      <div style={{fontSize:'13px',color:'#e5e7eb',fontWeight:500,marginBottom:'8px',lineHeight:'1.4'}}>{card.title}</div>
                      {card.description&&<div style={{fontSize:'11px',color:'#6b7280',marginBottom:'8px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{card.description}</div>}
                      <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
                        <PBadge p={card.priority}/>
                        {due&&<span style={{fontSize:'10px',fontWeight:600,color:due.overdue?'#f87171':due.soon?'#f59e0b':'#6b7280',background:due.overdue?'rgba(248,113,113,0.1)':due.soon?'rgba(245,158,11,0.1)':'#1e1e1e',padding:'2px 7px',borderRadius:'4px'}}>📅 {due.fmt}</span>}
                        {card.assignedTo&&<span style={{fontSize:'10px',color:'#9ca3af',background:'#141414',padding:'2px 7px',borderRadius:'4px',border:'1px solid #252525'}}>{card.assignedTo.split(' ')[0]}</span>}
                      </div>
                    </div>
                  )
                })}

                {/* Add card */}
                {addingCard===col.id ? (
                  <div style={{marginTop:'4px'}}>
                    <textarea autoFocus value={newCardTitle} onChange={e=>setNewCardTitle(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();addCard(col.id)} if(e.key==='Escape'){setAddingCard(null);setNewCardTitle('')} }}
                      placeholder="Card title..." rows={2}
                      style={{...inp,resize:'none',fontSize:'13px',marginBottom:'8px'}}/>
                    <div style={{display:'flex',gap:'6px'}}>
                      <button onClick={()=>addCard(col.id)} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'6px',padding:'6px 12px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Add</button>
                      <button onClick={()=>{setAddingCard(null);setNewCardTitle('')}} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'6px',padding:'6px 10px',fontSize:'12px',cursor:'pointer'}}>✕</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={()=>{setAddingCard(col.id);setNewCardTitle('')}}
                    style={{background:'none',border:'1px dashed #252525',borderRadius:'8px',color:'#4b5563',fontSize:'12px',fontWeight:600,padding:'8px',cursor:'pointer',transition:'all 0.15s',marginTop:'4px'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=board.color;e.currentTarget.style.color=board.color}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='#252525';e.currentTarget.style.color='#4b5563'}}>
                    + Add card
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Add column */}
        <div style={{width:'280px',flexShrink:0}}>
          {addingCol ? (
            <div style={{background:'#111111',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'12px'}}>
              <input autoFocus value={newColName} onChange={e=>setNewColName(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter')addColumn();if(e.key==='Escape')setAddingCol(false)}}
                placeholder="Column name..." style={{...inp,marginBottom:'10px'}}/>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={addColumn} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'6px',padding:'7px 14px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Add</button>
                <button onClick={()=>setAddingCol(false)} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'6px',padding:'7px 10px',fontSize:'13px',cursor:'pointer'}}>✕</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setAddingCol(true)}
              style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'2px dashed #252525',borderRadius:'12px',color:'#4b5563',fontSize:'13px',fontWeight:600,padding:'16px',cursor:'pointer',transition:'all 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=board.color;e.currentTarget.style.color=board.color}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='#252525';e.currentTarget.style.color='#4b5563'}}>
              + Add Column
            </button>
          )}
        </div>
      </div>

      {/* Card detail modal */}
      {cardModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setCardModal(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px',width:'520px',maxWidth:'92vw',maxHeight:'85vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'20px'}}>
              <h2 style={{margin:0,fontSize:'17px',fontWeight:700,flex:1,marginRight:'12px'}}>Edit Card</h2>
              <button onClick={()=>setCardModal(null)} style={{background:'none',border:'none',color:'#6b7280',fontSize:'20px',cursor:'pointer',lineHeight:1}}>✕</button>
            </div>

            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Title</label>
              <input value={editCard.title||''} onChange={e=>setEditCard({...editCard,title:e.target.value})} style={{...inp,fontSize:'14px'}}/>
            </div>
            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Description</label>
              <textarea rows={3} value={editCard.description||''} onChange={e=>setEditCard({...editCard,description:e.target.value})} style={{...inp,resize:'vertical',fontSize:'13px'}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
              <div>
                <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Priority</label>
                <select value={editCard.priority||'medium'} onChange={e=>setEditCard({...editCard,priority:e.target.value})} style={{...inp,cursor:'pointer'}}>
                  {PRIORITIES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Due Date</label>
                <input type="date" value={editCard.dueDate||''} onChange={e=>setEditCard({...editCard,dueDate:e.target.value})} style={{...inp,colorScheme:'dark'}}/>
              </div>
            </div>
            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Assigned To</label>
              <select value={editCard.assignedTo||''} onChange={e=>setEditCard({...editCard,assignedTo:e.target.value})} style={{...inp,cursor:'pointer'}}>
                <option value="">Unassigned</option>
                {board.members?.map(m=>{
                  const u = allUsers.find(u=>u.email===m.email)
                  return <option key={m.email} value={u?.name||m.email}>{u?.name||m.email}</option>
                })}
              </select>
            </div>
            <div style={{marginBottom:'24px'}}>
              <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Column</label>
              <select value={editCard.columnId||cardModal.columnId} onChange={e=>setEditCard({...editCard,columnId:e.target.value})} style={{...inp,cursor:'pointer'}}>
                {columns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={saveCard} disabled={savingCard} style={{flex:1,background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'11px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
                {savingCard?'Saving...':'Save Changes'}
              </button>
              <button onClick={()=>deleteCard(cardModal.id)} style={{background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'11px 16px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {showShare&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowShare(false)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px',width:'440px',maxWidth:'92vw'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'20px'}}>
              <h2 style={{margin:0,fontSize:'17px'}}>Share Board</h2>
              <button onClick={()=>setShowShare(false)} style={{background:'none',border:'none',color:'#6b7280',fontSize:'20px',cursor:'pointer'}}>✕</button>
            </div>

            {isOwner&&(
              <div style={{marginBottom:'20px'}}>
                <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Add Member</label>
                <div style={{display:'flex',gap:'8px'}}>
                  <select value={shareEmail} onChange={e=>setShareEmail(e.target.value)} style={{...inp,flex:1,cursor:'pointer'}}>
                    <option value="">Select a user...</option>
                    {allUsers.filter(u=>!board.members?.find(m=>m.email===u.email)).map(u=>(
                      <option key={u.email} value={u.email}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                  <button onClick={addMember} disabled={!shareEmail||sharing}
                    style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:700,cursor:shareEmail?'pointer':'not-allowed',whiteSpace:'nowrap'}}>
                    {sharing?'Adding...':'Add'}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Members ({board.members?.length||0})</label>
              {board.members?.map(m=>(
                <div key={m.email} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 0',borderBottom:'1px solid #1e1e1e'}}>
                  <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'#252525',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#8DC63F',flexShrink:0}}>
                    {m.email.charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'13px',color:'#fff',fontWeight:500}}>{allUsers.find(u=>u.email===m.email)?.name||m.email}</div>
                    <div style={{fontSize:'11px',color:'#4b5563'}}>{m.role}</div>
                  </div>
                  {isOwner&&m.role!=='owner'&&(
                    <button onClick={()=>removeMember(m.email)} style={{background:'none',border:'none',color:'#6b7280',fontSize:'13px',cursor:'pointer',padding:'4px 8px',borderRadius:'6px'}}
                      onMouseEnter={e=>e.currentTarget.style.color='#f87171'} onMouseLeave={e=>e.currentTarget.style.color='#6b7280'}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}