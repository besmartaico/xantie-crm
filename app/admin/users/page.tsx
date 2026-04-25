// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [currentUser, setCurrentUser] = useState({})
  const [confirmAction, setConfirmAction] = useState(null) // {id, type: 'inactivate'|'remove'}

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u)
    load()
  }, [])

  async function load() {
    setLoading(true)
    try { setUsers(await (await fetch('/api/users')).json()) } catch(e) {}
    setLoading(false)
  }

  async function updateRole(user, role) {
    setSaving(user.id)
    try {
      await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'update_role', email: user.email, role }) })
      setUsers(prev => prev.map(u => u.id===user.id ? {...u, role} : u))
    } catch(e) {}
    setSaving(null)
  }

  async function inactivate(user) {
    setSaving(user.id)
    try {
      const res = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'deactivate', email: user.email }) })
      const data = await res.json()
      if (data.success) setUsers(prev => prev.map(u => u.id===user.id ? {...u, status:'inactive'} : u))
    } catch(e) {}
    setSaving(null)
    setConfirmAction(null)
  }

  async function reactivate(user) {
    setSaving(user.id)
    try {
      const res = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'reactivate', email: user.email }) })
      const data = await res.json()
      if (data.success) setUsers(prev => prev.map(u => u.id===user.id ? {...u, status:'active'} : u))
    } catch(e) {}
    setSaving(null)
  }

  async function remove(user) {
    setSaving(user.id)
    try {
      await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'deactivate', email: user.email }) })
      setUsers(prev => prev.filter(u => u.id !== user.id))
    } catch(e) {}
    setSaving(null)
    setConfirmAction(null)
  }

  function viewAs(user) {
    const realSession = sessionStorage.getItem('xantie_user')
    const realAuth = sessionStorage.getItem('xantie_auth')
    sessionStorage.setItem('xantie_admin_backup', realSession)
    sessionStorage.setItem('xantie_admin_auth_backup', realAuth)
    sessionStorage.setItem('xantie_user', JSON.stringify({ name: user.name, email: user.email, role: user.role }))
    sessionStorage.setItem('xantie_auth', user.role)
    window.location.href = '/admin'
  }

  const activeUsers = users.filter(u => u.status !== 'inactive')
  const inactiveUsers = users.filter(u => u.status === 'inactive')
  const isSelf = (u) => u.email?.toLowerCase() === currentUser.email?.toLowerCase()

  const thS = { textAlign:'left', padding:'10px 16px', fontSize:'11px', fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.07em', background:'#111111', borderBottom:'1px solid #1e1e1e', whiteSpace:'nowrap' }
  const tdS = { padding:'12px 16px', fontSize:'13px', color:'#d1d5db', borderBottom:'1px solid #1a1a1a', verticalAlign:'middle' }

  function InlineConfirm({ userId, type, onConfirm }) {
    if (confirmAction?.id !== userId || confirmAction?.type !== type) return null
    const label = type === 'inactivate' ? 'Inactivate this user?' : 'Remove this user?'
    const color = type === 'inactivate' ? '#f59e0b' : '#f87171'
    return (
      <div style={{display:'flex',alignItems:'center',gap:'6px',background:'rgba(0,0,0,0.3)',border:'1px solid '+color+'44',borderRadius:'8px',padding:'5px 10px',marginTop:'6px'}}>
        <span style={{fontSize:'12px',color,fontWeight:600}}>{label}</span>
        <button onClick={onConfirm} disabled={saving===userId}
          style={{background:color,color:'#fff',border:'none',borderRadius:'5px',padding:'3px 10px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>
          Yes
        </button>
        <button onClick={()=>setConfirmAction(null)}
          style={{background:'none',border:'none',color:'#6b7280',fontSize:'12px',cursor:'pointer',padding:'3px 6px'}}>
          Cancel
        </button>
      </div>
    )
  }

  function UserRow({ u }) {
    const self = isSelf(u)
    const pending = saving === u.id
    return (
      <tr onMouseEnter={e=>e.currentTarget.style.background='#181818'} onMouseLeave={e=>e.currentTarget.style.background=''}>
        <td style={tdS}>
          <div style={{fontWeight:500,color:'#fff'}}>{u.name} {self&&<span style={{fontSize:'10px',background:'rgba(141,198,63,0.15)',color:'#8DC63F',padding:'1px 6px',borderRadius:'4px',marginLeft:'4px'}}>You</span>}</div>
          <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>{u.email}</div>
        </td>
        <td style={tdS}>
          <select value={u.role||'viewer'} onChange={e=>updateRole(u, e.target.value)} disabled={self||pending}
            style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'6px',padding:'5px 10px',color:'#d1d5db',fontSize:'13px',cursor:self?'not-allowed':'pointer',outline:'none',opacity:self?0.5:1}}>
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </td>
        <td style={tdS}>
          <span style={{background:'rgba(141,198,63,0.1)',color:'#8DC63F',padding:'2px 8px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>Active</span>
        </td>
        <td style={{...tdS,minWidth:'260px'}}>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px',alignItems:'center'}}>
            {!self && (
              <button onClick={()=>viewAs(u)}
                style={{background:'rgba(96,165,250,0.1)',border:'1px solid rgba(96,165,250,0.2)',color:'#60a5fa',borderRadius:'6px',padding:'5px 12px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
                View As
              </button>
            )}
            {!self && (
              <button onClick={()=>setConfirmAction({id:u.id, type:'inactivate'})} disabled={pending}
                style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.25)',color:'#f59e0b',borderRadius:'6px',padding:'5px 12px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
                Inactivate
              </button>
            )}
            {!self && (
              <button onClick={()=>setConfirmAction({id:u.id, type:'remove'})} disabled={pending}
                style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.2)',color:'#f87171',borderRadius:'6px',padding:'5px 12px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
                Remove
              </button>
            )}
          </div>
          <InlineConfirm userId={u.id} type="inactivate" onConfirm={()=>inactivate(u)}/>
          <InlineConfirm userId={u.id} type="remove" onConfirm={()=>remove(u)}/>
        </td>
      </tr>
    )
  }

  return (
    <div>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>User Management</h1>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>{activeUsers.length} active · {inactiveUsers.length} inactive</p>
      </div>

      {loading && <div style={{color:'#6b7280',padding:'32px',textAlign:'center'}}>Loading...</div>}

      {!loading && (
        <>
          {/* Active users */}
          <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',overflow:'hidden',marginBottom:'24px'}}>
            <div style={{padding:'14px 16px',borderBottom:'1px solid #1e1e1e',display:'flex',alignItems:'center',gap:'8px'}}>
              <h3 style={{margin:0,fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Active Users</h3>
              <span style={{background:'rgba(141,198,63,0.1)',color:'#8DC63F',fontSize:'11px',fontWeight:700,padding:'1px 7px',borderRadius:'5px'}}>{activeUsers.length}</span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:'600px'}}>
                <thead>
                  <tr>
                    <th style={thS}>Name / Email</th>
                    <th style={thS}>Role</th>
                    <th style={thS}>Status</th>
                    <th style={thS}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeUsers.length===0 && <tr><td colSpan={4} style={{...tdS,textAlign:'center',color:'#4b5563'}}>No active users</td></tr>}
                  {activeUsers.map(u => <UserRow key={u.id} u={u}/>)}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inactive users */}
          {inactiveUsers.length > 0 && (
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',overflow:'hidden'}}>
              <div style={{padding:'14px 16px',borderBottom:'1px solid #1e1e1e',display:'flex',alignItems:'center',gap:'8px'}}>
                <h3 style={{margin:0,fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Inactive Users</h3>
                <span style={{background:'rgba(156,163,175,0.1)',color:'#9ca3af',fontSize:'11px',fontWeight:700,padding:'1px 7px',borderRadius:'5px'}}>{inactiveUsers.length}</span>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',minWidth:'600px'}}>
                  <thead>
                    <tr>
                      <th style={thS}>Name / Email</th>
                      <th style={thS}>Role</th>
                      <th style={thS}>Status</th>
                      <th style={thS}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveUsers.map(u => (
                      <tr key={u.id} style={{opacity:0.7}} onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.7'}>
                        <td style={tdS}>
                          <div style={{fontWeight:500,color:'#9ca3af'}}>{u.name}</div>
                          <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>{u.email}</div>
                        </td>
                        <td style={tdS}><span style={{color:'#4b5563',fontSize:'13px'}}>{u.role||'viewer'}</span></td>
                        <td style={tdS}><span style={{background:'rgba(156,163,175,0.1)',color:'#9ca3af',padding:'2px 8px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>Inactive</span></td>
                        <td style={tdS}>
                          <button onClick={()=>reactivate(u)} disabled={saving===u.id}
                            style={{background:'rgba(141,198,63,0.1)',border:'1px solid rgba(141,198,63,0.25)',color:'#8DC63F',borderRadius:'6px',padding:'5px 14px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
                            {saving===u.id ? 'Reactivating…' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}