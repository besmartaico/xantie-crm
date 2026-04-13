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
  const [currentUser, setCurrentUser] = useState({})
  const [impersonating, setImpersonating] = useState(false)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u)
    // Check if currently impersonating
    setImpersonating(!!sessionStorage.getItem('xantie_admin_backup'))
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

  async function deleteUser(user) {
    if (!confirm(`Remove ${user.name} (${user.email})? This cannot be undone.`)) return
    setSaving(user.id)
    try {
      await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'delete', id: user.id }) })
      setUsers(prev => prev.filter(u => u.id !== user.id))
    } catch(e) {}
    setSaving(null)
  }

  function impersonate(user) {
    // Save real admin session
    sessionStorage.setItem('xantie_admin_backup', sessionStorage.getItem('xantie_user'))
    sessionStorage.setItem('xantie_admin_auth_backup', sessionStorage.getItem('xantie_auth'))
    // Switch to impersonated user
    sessionStorage.setItem('xantie_user', JSON.stringify({ name: user.name, email: user.email, role: user.role }))
    sessionStorage.setItem('xantie_auth', user.role)
    router.push('/admin/dashboard')
  }

  function stopImpersonating() {
    // Restore admin session
    const backup = sessionStorage.getItem('xantie_admin_backup')
    const authBackup = sessionStorage.getItem('xantie_admin_auth_backup')
    if (backup) sessionStorage.setItem('xantie_user', backup)
    if (authBackup) sessionStorage.setItem('xantie_auth', authBackup)
    sessionStorage.removeItem('xantie_admin_backup')
    sessionStorage.removeItem('xantie_admin_auth_backup')
    router.push('/admin/users')
  }

  return (
    <div>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>User Management</h1>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>{users.length} registered user{users.length!==1?'s':''}</p>
      </div>

      <div style={{background:'rgba(141,198,63,0.06)',border:'1px solid rgba(141,198,63,0.15)',borderRadius:'10px',padding:'12px 16px',marginBottom:'20px'}}>
        <p style={{margin:0,fontSize:'13px',color:'#9ca3af'}}>
          <span style={{color:'#8DC63F',fontWeight:600}}>Admin</span> — full access.{'  '}
          <span style={{color:'#60a5fa',fontWeight:600}}>Editor</span> — can add/edit entries.{'  '}
          <span style={{color:'#9ca3af',fontWeight:600}}>Viewer</span> — read-only, own data only.{'  '}
          Click <strong style={{color:'#fff'}}>View As</strong> to impersonate any user and see exactly what they see.
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
            {users.map(u => (
              <tr key={u.id} onMouseEnter={ev=>ev.currentTarget.style.background='#181818'} onMouseLeave={ev=>ev.currentTarget.style.background=''}>
                <td style={td}>
                  <div style={{fontWeight:500,color:'#fff'}}>{u.name}</div>
                  {u.email === currentUser.email && <div style={{fontSize:'10px',color:'#8DC63F',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>You</div>}
                </td>
                <td style={td}><span style={{color:'#9ca3af'}}>{u.email}</span></td>
                <td style={td}>
                  <span style={{
                    background: u.role==='admin'?'rgba(141,198,63,0.12)':u.role==='editor'?'rgba(96,165,250,0.12)':'rgba(156,163,175,0.12)',
                    color: ROLE_COLORS[u.role]||'#9ca3af',
                    padding:'3px 10px', borderRadius:'6px', fontSize:'12px', fontWeight:600, textTransform:'capitalize'
                  }}>{u.role||'viewer'}</span>
                </td>
                <td style={td}>
                  {u.email !== currentUser.email ? (
                    <div style={{display:'flex',gap:'6px'}}>
                      {ROLES.map(r => (
                        <button key={r} onClick={() => updateRole(u, r)}
                          disabled={saving===u.id || u.role===r}
                          style={{
                            background: u.role===r?'rgba(141,198,63,0.15)':'#1e1e1e',
                            border: u.role===r?'1px solid rgba(141,198,63,0.3)':'1px solid #2a2a2a',
                            color: u.role===r?'#8DC63F':'#6b7280',
                            borderRadius:'6px', padding:'4px 10px', fontSize:'11px', fontWeight:600,
                            cursor: u.role===r?'default':'pointer', textTransform:'capitalize',
                            opacity: saving===u.id?0.5:1
                          }}>
                          {r}
                        </button>
                      ))}
                    </div>
                  ) : <span style={{fontSize:'12px',color:'#4b5563'}}>—</span>}
                </td>
                <td style={td}>
                  <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                    {u.email !== currentUser.email && (
                      <button onClick={() => impersonate(u)}
                        style={{background:'rgba(96,165,250,0.1)',border:'1px solid rgba(96,165,250,0.25)',color:'#60a5fa',borderRadius:'6px',padding:'5px 10px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
                        View As
                      </button>
                    )}
                    {u.email !== currentUser.email && (
                      <button onClick={() => deleteUser(u)} disabled={saving===u.id}
                        style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:'12px',padding:'4px',opacity:saving===u.id?0.5:1}}>
                        Remove
                      </button>
                    )}
                    {u.email === currentUser.email && <span style={{fontSize:'12px',color:'#4b5563'}}>—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}