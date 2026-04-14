// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const ROLES = ['admin', 'editor', 'viewer']
const ROLE_COLORS = { admin: '#8DC63F', editor: '#60a5fa', viewer: '#9ca3af' }
const td = { padding:'12px 16px', fontSize:'13px', color:'#d1d5db', borderBottom:'1px solid #1a1a1a', verticalAlign:'middle' }
const th = { textAlign:'left', padding:'11px 16px', fontSize:'11px', fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.08em', background:'#111111', borderBottom:'1px solid #1e1e1e' }

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const [currentUser, setCurrentUser] = useState({})

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
      await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'update_role', id: user.id, role }) })
      setUsers(prev => prev.map(u => u.id === user.id ? {...u, role} : u))
    } catch(e) {}
    setSaving(null)
  }

  async function deactivate(user) {
    setSaving(user.id)
    try {
      const res = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'deactivate', id: user.id }) })
      const data = await res.json()
      if (data.success) setUsers(prev => prev.map(u => u.id === user.id ? {...u, status:'inactive'} : u))
    } catch(e) {}
    setSaving(null); setConfirmRemove(null)
  }

  async function reactivate(user) {
    setSaving(user.id)
    try {
      const res = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'reactivate', id: user.id }) })
      const data = await res.json()
      if (data.success) setUsers(prev => prev.map(u => u.id === user.id ? {...u, status:'active'} : u))
    } catch(e) {}
    setSaving(null)
  }

  function impersonate(user) {
    sessionStorage.setItem('xantie_admin_backup', sessionStorage.getItem('xantie_user'))
    sessionStorage.setItem('xantie_admin_auth_backup', sessionStorage.getItem('xantie_auth'))
    sessionStorage.setItem('xantie_user', JSON.stringify({ name: user.name, email: user.email, role: user.role }))
    sessionStorage.setItem('xantie_auth', user.role)
    router.push('/admin/dashboard')
  }

  const activeUsers = users.filter(u => u.status !== 'inactive')
  const inactiveUsers = users.filter(u => u.status === 'inactive')
  const visibleUsers = showInactive ? users : activeUsers

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>User Management</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>
            {activeUsers.length} active{inactiveUsers.length > 0 ? ` · ${inactiveUsers.length} inactive` : ''}
          </p>
        </div>
        {inactiveUsers.length > 0 && (
          <button onClick={() => setShowInactive(!showInactive)}
            style={{background:'#1e1e1e',border:'1px solid #2a2a2a',color:'#9ca3af',borderRadius:'8px',padding:'8px 14px',fontSize:'13px',cursor:'pointer'}}>
            {showInactive ? 'Hide inactive' : `Show inactive (${inactiveUsers.length})`}
          </button>
        )}
      </div>

      <div style={{background:'rgba(141,198,63,0.06)',border:'1px solid rgba(141,198,63,0.15)',borderRadius:'10px',padding:'12px 16px',marginBottom:'20px'}}>
        <p style={{margin:0,fontSize:'13px',color:'#9ca3af'}}>
          <span style={{color:'#8DC63F',fontWeight:600}}>Admin</span> — full access.{'  '}
          <span style={{color:'#60a5fa',fontWeight:600}}>Editor</span> — can add/edit entries.{'  '}
          <span style={{color:'#9ca3af',fontWeight:600}}>Viewer</span> — read-only.{'  '}
          Removing a user blocks their login but <strong style={{color:'#fff'}}>keeps all their time entry data</strong>.
        </p>
      </div>

      <div className="tbl-wrap" style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:'560px'}}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Role</th>
              <th style={th}>Change Role</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{...td,textAlign:'center',color:'#6b7280'}}>Loading...</td></tr>}
            {visibleUsers.map(u => {
              const isInactive = u.status === 'inactive'
              const isMe = u.email === currentUser.email
              const isConfirming = confirmRemove?.id === u.id
              return (
                <tr key={u.id}
                  style={{opacity: isInactive ? 0.55 : 1}}
                  onMouseEnter={ev=>ev.currentTarget.style.background='#181818'}
                  onMouseLeave={ev=>ev.currentTarget.style.background=''}>
                  <td style={td}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      <div style={{fontWeight:500,color: isInactive?'#6b7280':'#fff'}}>{u.name}</div>
                      {isInactive && <span style={{background:'rgba(156,163,175,0.12)',color:'#6b7280',fontSize:'10px',fontWeight:700,padding:'2px 6px',borderRadius:'4px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Inactive</span>}
                    </div>
                    {isMe && <div style={{fontSize:'10px',color:'#8DC63F',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>You</div>}
                  </td>
                  <td style={td}><span style={{color:'#9ca3af'}}>{u.email}</span></td>
                  <td style={td}>
                    <span style={{
                      background: u.role==='admin'?'rgba(141,198,63,0.12)':u.role==='editor'?'rgba(96,165,250,0.12)':'rgba(156,163,175,0.12)',
                      color: ROLE_COLORS[u.role]||'#9ca3af',
                      padding:'3px 10px',borderRadius:'6px',fontSize:'12px',fontWeight:600,textTransform:'capitalize'
                    }}>{u.role||'viewer'}</span>
                  </td>
                  <td style={td}>
                    {!isMe && !isInactive ? (
                      <div style={{display:'flex',gap:'6px'}}>
                        {ROLES.map(r => (
                          <button key={r} onClick={()=>updateRole(u,r)} disabled={saving===u.id||u.role===r}
                            style={{background:u.role===r?'rgba(141,198,63,0.15)':'#1e1e1e',border:u.role===r?'1px solid rgba(141,198,63,0.3)':'1px solid #2a2a2a',color:u.role===r?'#8DC63F':'#6b7280',borderRadius:'6px',padding:'4px 10px',fontSize:'11px',fontWeight:600,cursor:u.role===r?'default':'pointer',textTransform:'capitalize',opacity:saving===u.id?0.5:1}}>
                            {r}
                          </button>
                        ))}
                      </div>
                    ) : <span style={{fontSize:'12px',color:'#4b5563'}}>—</span>}
                  </td>
                  <td style={td}>
                    {isMe && <span style={{fontSize:'12px',color:'#4b5563'}}>—</span>}
                    {!isMe && isInactive && (
                      <button onClick={()=>reactivate(u)} disabled={saving===u.id}
                        style={{background:'rgba(141,198,63,0.1)',border:'1px solid rgba(141,198,63,0.25)',color:'#8DC63F',borderRadius:'6px',padding:'5px 10px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
                        Reactivate
                      </button>
                    )}
                    {!isMe && !isInactive && !isConfirming && (
                      <div style={{display:'flex',gap:'8px'}}>
                        <button onClick={()=>impersonate(u)}
                          style={{background:'rgba(96,165,250,0.1)',border:'1px solid rgba(96,165,250,0.25)',color:'#60a5fa',borderRadius:'6px',padding:'5px 10px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
                          View As
                        </button>
                        <button onClick={()=>setConfirmRemove(u)}
                          style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.2)',color:'#f87171',borderRadius:'6px',padding:'5px 10px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
                          Remove
                        </button>
                      </div>
                    )}
                    {!isMe && isConfirming && (
                      <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                        <span style={{fontSize:'12px',color:'#f87171',whiteSpace:'nowrap'}}>Remove {u.name}?</span>
                        <button onClick={()=>deactivate(u)} disabled={saving===u.id}
                          style={{background:'#f87171',color:'#fff',border:'none',borderRadius:'6px',padding:'5px 10px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>
                          Yes, Remove
                        </button>
                        <button onClick={()=>setConfirmRemove(null)}
                          style={{background:'#252525',color:'#9ca3af',border:'none',borderRadius:'6px',padding:'5px 10px',fontSize:'12px',cursor:'pointer'}}>
                          Cancel
                        </button>
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
  )
}