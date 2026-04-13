// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const ROLES = ['admin', 'editor', 'viewer']
const ROLE_COLORS = { admin: '#8DC63F', editor: '#60a5fa', viewer: '#9ca3af' }
const td = { padding:'12px 16px', fontSize:'13px', color:'#d1d5db', borderBottom:'1px solid #1a1a1a', verticalAlign:'middle' }
const th = { textAlign:'left', padding:'11px 16px', fontSize:'11px', fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.08em', background:'#111111', borderBottom:'1px solid #1e1e1e' }

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
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
      await fetch('/api/users', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action: 'update_role', id: user.id, role })
      })
      setUsers(prev => prev.map(u => u.id === user.id ? {...u, role} : u))
    } catch(e) {}
    setSaving(null)
  }

  return (
    <div>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>User Management</h1>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>{users.length} registered user{users.length!==1?'s':''}</p>
      </div>

      <div style={{background:'rgba(141,198,63,0.06)',border:'1px solid rgba(141,198,63,0.15)',borderRadius:'10px',padding:'12px 16px',marginBottom:'20px'}}>
        <p style={{margin:0,fontSize:'13px',color:'#9ca3af'}}>
          <span style={{color:'#8DC63F',fontWeight:600}}>Admin</span> — full access, can manage users and import data.{'  '}
          <span style={{color:'#60a5fa',fontWeight:600}}>Editor</span> — can add and edit time entries and projects.{'  '}
          <span style={{color:'#9ca3af',fontWeight:600}}>Viewer</span> — read-only access to their own data.
        </p>
      </div>

      <div className="tbl-wrap" style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:'480px'}}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Role</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} style={{...td,textAlign:'center',color:'#6b7280'}}>Loading...</td></tr>}
            {users.map(u => (
              <tr key={u.id} onMouseEnter={ev=>ev.currentTarget.style.background='#181818'} onMouseLeave={ev=>ev.currentTarget.style.background=''}>
                <td style={td}>
                  <div style={{fontWeight:500,color:'#fff'}}>{u.name}</div>
                  {u.email === currentUser.email && <div style={{fontSize:'10px',color:'#8DC63F',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>You</div>}
                </td>
                <td style={td}><span style={{color:'#9ca3af'}}>{u.email}</span></td>
                <td style={td}>
                  <span style={{background:`rgba(${u.role==='admin'?'141,198,63':u.role==='editor'?'96,165,250':'156,163,175'},0.12)`, color: ROLE_COLORS[u.role]||'#9ca3af', padding:'3px 10px', borderRadius:'6px', fontSize:'12px', fontWeight:600, textTransform:'capitalize'}}>
                    {u.role||'viewer'}
                  </span>
                </td>
                <td style={td}>
                  {u.email !== currentUser.email ? (
                    <div style={{display:'flex',gap:'6px'}}>
                      {ROLES.map(r => (
                        <button key={r} onClick={() => updateRole(u, r)}
                          disabled={saving === u.id || u.role === r}
                          style={{background: u.role===r ? 'rgba(141,198,63,0.15)' : '#1e1e1e', border: u.role===r ? '1px solid rgba(141,198,63,0.3)' : '1px solid #2a2a2a', color: u.role===r ? '#8DC63F' : '#6b7280', borderRadius:'6px', padding:'4px 10px', fontSize:'11px', fontWeight:600, cursor: u.role===r ? 'default' : 'pointer', textTransform:'capitalize', opacity: saving===u.id ? 0.5 : 1}}>
                          {r}
                        </button>
                      ))}
                    </div>
                  ) : <span style={{fontSize:'12px',color:'#4b5563'}}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}