// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [currentUser, setCurrentUser] = useState({})
  const [confirmAction, setConfirmAction] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name:'', email:'', role:'viewer' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState(null)

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
    setSaving(user.id); setConfirmAction(null)
    try {
      const res = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'deactivate', id: user.id, email: user.email }) })
      const data = await res.json()
      if (data.success) setUsers(prev => prev.map(u => u.id===user.id ? {...u, status:'inactive'} : u))
    } catch(e) {}
    setSaving(null)
  }

  async function createUser(e) {
    e.preventDefault()
    setAddSaving(true); setAddError(null)
    try {
      const res = await fetch('/api/users/create', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name: addForm.name.trim(), email: addForm.email.trim(), role: addForm.role }) })
      const data = await res.json()
      if (data.success) {
        setShowAdd(false)
        setAddForm({ name:'', email:'', role:'viewer' })
        await load()
      } else {
        setAddError(data.error || 'Failed to add user')
      }
    } catch(e) {
      setAddError('Failed to add user')
    }
    setAddSaving(false)
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

  const isSelf = (u) => u.email?.toLowerCase() === currentUser.email?.toLowerCase()
  const activeUsers = users.filter(u => u.status !== 'inactive')
  const inactiveCount = users.filter(u => u.status === 'inactive').length

  const thS = { textAlign:'left', padding:'10px 16px', fontSize:'11px', fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.07em', background:'#111111', borderBottom:'1px solid #1e1e1e', whiteSpace:'nowrap' }
  const tdS = { padding:'12px 16px', fontSize:'13px', color:'#d1d5db', borderBottom:'1px solid #1a1a1a', verticalAlign:'middle' }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>User Management</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>{activeUsers.length} active users</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
          {inactiveCount > 0 && (
            <Link href="/admin/users/inactive"
              style={{background:'#1e1e1e',border:'1px solid #2a2a2a',color:'#9ca3af',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:600,textDecoration:'none',display:'flex',alignItems:'center',gap:'6px'}}>
              View Inactive Users
              <span style={{background:'rgba(156,163,175,0.2)',color:'#9ca3af',fontSize:'11px',fontWeight:700,padding:'1px 7px',borderRadius:'10px'}}>{inactiveCount}</span>
            </Link>
          )}
          <button onClick={()=>{setAddError(null);setShowAdd(true)}}
            style={{background:'#8DC63F',border:'none',color:'#0a0a0a',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
            <span style={{fontSize:'16px',lineHeight:1}}>+</span> Add User
          </button>
        </div>
      </div>

      {loading && <div style={{color:'#6b7280',padding:'32px',textAlign:'center'}}>Loading...</div>}

      {!loading && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',overflow:'hidden'}}>
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
                {activeUsers.map(u => {
                  const self = isSelf(u)
                  const pending = saving === u.id
                  const confirming = confirmAction?.id === u.id
                  return (
                    <tr key={u.id} onMouseEnter={e=>e.currentTarget.style.background='#181818'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={tdS}>
                        <div style={{fontWeight:500,color:'#fff'}}>{u.name}{self&&<span style={{fontSize:'10px',background:'rgba(141,198,63,0.15)',color:'#8DC63F',padding:'1px 6px',borderRadius:'4px',marginLeft:'6px'}}>You</span>}</div>
                        <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>{u.email}</div>
                      </td>
                      <td style={tdS}>
                        <select value={u.role||'viewer'} onChange={e=>updateRole(u,e.target.value)} disabled={self||pending}
                          style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'6px',padding:'5px 10px',color:'#d1d5db',fontSize:'13px',cursor:self?'not-allowed':'pointer',outline:'none',opacity:self?0.5:1}}>
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td style={tdS}>
                        <span style={{background:'rgba(141,198,63,0.1)',color:'#8DC63F',padding:'2px 8px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>Active</span>
                      </td>
                      <td style={{...tdS,minWidth:'280px'}}>
                        {confirming ? (
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <span style={{fontSize:'12px',color:'#f59e0b',fontWeight:600}}>Inactivate {u.name}?</span>
                            <button onClick={e=>{e.preventDefault();inactivate(u)}} disabled={pending}
                              style={{background:'#f59e0b',color:'#000',border:'none',borderRadius:'5px',padding:'4px 12px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>
                              {pending?'Saving…':'Yes'}
                            </button>
                            <button onClick={e=>{e.preventDefault();setConfirmAction(null)}}
                              style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'5px',padding:'4px 10px',fontSize:'12px',cursor:'pointer'}}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{display:'flex',gap:'6px'}}>
                            {!self && <button onClick={e=>{e.preventDefault();viewAs(u)}}
                              style={{background:'rgba(96,165,250,0.1)',border:'1px solid rgba(96,165,250,0.2)',color:'#60a5fa',borderRadius:'6px',padding:'5px 12px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
                              View As
                            </button>}
                            {!self && <button onClick={e=>{e.preventDefault();setConfirmAction({id:u.id})}} disabled={pending}
                              style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.25)',color:'#f59e0b',borderRadius:'6px',padding:'5px 12px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
                              Inactivate
                            </button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <div onClick={()=>!addSaving&&setShowAdd(false)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',zIndex:50}}>
          <form onClick={e=>e.stopPropagation()} onSubmit={createUser}
            style={{background:'#141414',border:'1px solid #252525',borderRadius:'12px',padding:'24px',width:'100%',maxWidth:'420px'}}>
            <h2 style={{fontSize:'18px',fontWeight:700,margin:'0 0 4px'}}>Add User</h2>
            <p style={{color:'#6b7280',fontSize:'12px',margin:'0 0 20px'}}>They can set a password later by registering with this email.</p>

            <label style={{display:'block',fontSize:'12px',color:'#9ca3af',fontWeight:600,marginBottom:'6px'}}>Name</label>
            <input value={addForm.name} onChange={e=>setAddForm({...addForm,name:e.target.value})} autoFocus required
              style={{width:'100%',background:'#0f0f0f',border:'1px solid #252525',borderRadius:'8px',padding:'9px 12px',color:'#fff',fontSize:'13px',outline:'none',marginBottom:'16px',boxSizing:'border-box'}} />

            <label style={{display:'block',fontSize:'12px',color:'#9ca3af',fontWeight:600,marginBottom:'6px'}}>Email</label>
            <input type="email" value={addForm.email} onChange={e=>setAddForm({...addForm,email:e.target.value})} required
              style={{width:'100%',background:'#0f0f0f',border:'1px solid #252525',borderRadius:'8px',padding:'9px 12px',color:'#fff',fontSize:'13px',outline:'none',marginBottom:'16px',boxSizing:'border-box'}} />

            <label style={{display:'block',fontSize:'12px',color:'#9ca3af',fontWeight:600,marginBottom:'6px'}}>Role</label>
            <select value={addForm.role} onChange={e=>setAddForm({...addForm,role:e.target.value})}
              style={{width:'100%',background:'#0f0f0f',border:'1px solid #252525',borderRadius:'8px',padding:'9px 12px',color:'#d1d5db',fontSize:'13px',outline:'none',marginBottom:'20px',boxSizing:'border-box',cursor:'pointer'}}>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>

            {addError && <div style={{color:'#f87171',fontSize:'12px',marginBottom:'16px'}}>{addError}</div>}

            <div style={{display:'flex',gap:'10px',justifyContent:'flex-end'}}>
              <button type="button" onClick={()=>setShowAdd(false)} disabled={addSaving}
                style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
                Cancel
              </button>
              <button type="submit" disabled={addSaving||!addForm.name.trim()||!addForm.email.trim()}
                style={{background:'#8DC63F',border:'none',color:'#0a0a0a',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontWeight:700,cursor:addSaving?'default':'pointer',opacity:(addSaving||!addForm.name.trim()||!addForm.email.trim())?0.5:1}}>
                {addSaving?'Adding…':'Add User'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}