// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const COLORS = ['#8DC63F','#60a5fa','#f59e0b','#a78bfa','#f87171','#34d399','#f97316','#06b6d4','#ec4899','#6366f1']

function ColorPicker({ value, onChange }) {
  return (
    <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
      {COLORS.map(c=>(
        <div key={c} onClick={()=>onChange(c)} style={{width:'28px',height:'28px',borderRadius:'6px',background:c,cursor:'pointer',border:value===c?'3px solid #fff':'3px solid transparent',boxSizing:'border-box',transition:'border 0.1s'}}/>
      ))}
    </div>
  )
}

export default function BoardsPage() {
  const router = useRouter()
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#8DC63F')
  const [creating, setCreating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [currentUser, setCurrentUser] = useState({})

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user')||'{}')
    setCurrentUser(u)
    if (u.email) load(u.email)
  }, [])

  async function load(email) {
    setLoading(true)
    try { setBoards(await (await fetch('/api/boards?email='+encodeURIComponent(email))).json()) }
    catch(e){}
    setLoading(false)
  }

  async function create() {
    if (!name.trim()) return
    setCreating(true)
    const u = JSON.parse(sessionStorage.getItem('xantie_user')||'{}')
    const res = await fetch('/api/boards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),description,ownerEmail:u.email,color})})
    const data = await res.json()
    if (data.id) {
      setShowCreate(false); setName(''); setDescription(''); setColor('#8DC63F')
      router.push('/admin/boards/'+data.id)
    }
    setCreating(false)
  }

  async function deleteBoard(boardId) {
    await fetch('/api/boards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',boardId})})
    setDeleteConfirm(null)
    load(currentUser.email)
  }

  const myBoards = boards.filter(b=>b.isOwner)
  const sharedBoards = boards.filter(b=>!b.isOwner)

  function BoardCard({ board }) {
    return (
      <div style={{position:'relative',borderRadius:'14px',overflow:'hidden',cursor:'pointer',border:'1px solid #1e1e1e',transition:'transform 0.15s,box-shadow 0.15s'}}
        onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.4)'}}
        onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
        {/* Color header */}
        <div onClick={()=>router.push('/admin/boards/'+board.id)} style={{height:'80px',background:board.color,position:'relative'}}>
          <div style={{position:'absolute',bottom:'12px',left:'16px',fontSize:'18px',fontWeight:800,color:'rgba(0,0,0,0.7)'}}>{board.name.charAt(0).toUpperCase()}</div>
        </div>
        <div onClick={()=>router.push('/admin/boards/'+board.id)} style={{padding:'14px 16px',background:'#141414'}}>
          <div style={{fontWeight:700,fontSize:'15px',color:'#fff',marginBottom:'4px'}}>{board.name}</div>
          {board.description&&<div style={{fontSize:'12px',color:'#6b7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{board.description}</div>}
          {!board.isOwner&&<div style={{fontSize:'11px',color:board.color,marginTop:'4px',fontWeight:600}}>Shared with you</div>}
        </div>
        {board.isOwner&&(
          <button onClick={e=>{e.stopPropagation();setDeleteConfirm(board)}}
            style={{position:'absolute',top:'8px',right:'8px',background:'rgba(0,0,0,0.4)',border:'none',color:'#fff',borderRadius:'6px',padding:'4px 8px',fontSize:'12px',cursor:'pointer',opacity:0}}
            onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}
            className="delete-btn">✕</button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'28px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Boards</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Your project boards and workspaces</p>
        </div>
        <button onClick={()=>setShowCreate(true)}
          style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 20px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
          + New Board
        </button>
      </div>

      {loading&&<div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>}

      {!loading&&boards.length===0&&(
        <div style={{textAlign:'center',padding:'80px 20px',background:'#141414',borderRadius:'16px',border:'1px solid #1e1e1e'}}>
          <div style={{fontSize:'48px',marginBottom:'16px'}}>📋</div>
          <h2 style={{margin:'0 0 8px',fontSize:'20px'}}>No boards yet</h2>
          <p style={{color:'#6b7280',margin:'0 0 24px'}}>Create your first board to get started</p>
          <button onClick={()=>setShowCreate(true)} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px 28px',fontSize:'15px',fontWeight:700,cursor:'pointer'}}>
            Create a Board
          </button>
        </div>
      )}

      {myBoards.length>0&&(
        <div style={{marginBottom:'36px'}}>
          <h2 style={{fontSize:'13px',fontWeight:700,color:'#4b5563',textTransform:'uppercase',letterSpacing:'0.07em',margin:'0 0 16px'}}>Your Boards</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'16px'}}>
            {myBoards.map(b=><BoardCard key={b.id} board={b}/>)}
            <div onClick={()=>setShowCreate(true)} style={{borderRadius:'14px',border:'2px dashed #252525',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'140px',cursor:'pointer',color:'#4b5563',fontSize:'14px',fontWeight:600,transition:'all 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='#8DC63F';e.currentTarget.style.color='#8DC63F'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='#252525';e.currentTarget.style.color='#4b5563'}}>
              + New Board
            </div>
          </div>
        </div>
      )}

      {sharedBoards.length>0&&(
        <div>
          <h2 style={{fontSize:'13px',fontWeight:700,color:'#4b5563',textTransform:'uppercase',letterSpacing:'0.07em',margin:'0 0 16px'}}>Shared With You</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'16px'}}>
            {sharedBoards.map(b=><BoardCard key={b.id} board={b}/>)}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowCreate(false)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px',width:'420px',maxWidth:'90vw'}} onClick={e=>e.stopPropagation()}>
            <h2 style={{margin:'0 0 24px',fontSize:'18px'}}>Create New Board</h2>
            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Board Name *</label>
              <input autoFocus value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&create()}
                placeholder="e.g. Website Redesign" style={{width:'100%',background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'10px 13px',color:'#fff',fontSize:'14px',outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Description</label>
              <input value={description} onChange={e=>setDescription(e.target.value)}
                placeholder="Optional" style={{width:'100%',background:'#111',border:'1px solid #252525',borderRadius:'8px',padding:'10px 13px',color:'#fff',fontSize:'14px',outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div style={{marginBottom:'24px'}}>
              <label style={{display:'block',color:'#6b7280',fontSize:'11px',fontWeight:600,marginBottom:'10px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Color</label>
              <ColorPicker value={color} onChange={setColor}/>
            </div>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={create} disabled={creating||!name.trim()}
                style={{flex:1,background:name.trim()?'#8DC63F':'#2a2a2a',color:name.trim()?'#0a0a0a':'#4b5563',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:700,cursor:name.trim()?'pointer':'not-allowed'}}>
                {creating?'Creating...':'Create Board'}
              </button>
              <button onClick={()=>setShowCreate(false)} style={{padding:'12px 20px',background:'#252525',border:'none',borderRadius:'8px',color:'#9ca3af',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setDeleteConfirm(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px',width:'380px',maxWidth:'90vw'}} onClick={e=>e.stopPropagation()}>
            <h2 style={{margin:'0 0 12px',fontSize:'18px'}}>Delete Board?</h2>
            <p style={{color:'#9ca3af',margin:'0 0 24px',fontSize:'14px'}}>This will permanently delete <strong style={{color:'#fff'}}>{deleteConfirm.name}</strong> and all its columns and cards.</p>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={()=>deleteBoard(deleteConfirm.id)} style={{flex:1,background:'#f87171',color:'#fff',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>Delete</button>
              <button onClick={()=>setDeleteConfirm(null)} style={{padding:'12px 20px',background:'#252525',border:'none',borderRadius:'8px',color:'#9ca3af',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}