// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function InactiveUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const all = await (await fetch('/api/users')).json()
      setUsers(all.filter(u => u.status === 'inactive'))
    } catch(e) {}
    setLoading(false)
  }

  async function reactivate(user) {
    setSaving(user.id)
    try {
      const res = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'reactivate', id: user.id, email: user.email }) })
      const data = await res.json()
      if (data.success) setUsers(prev => prev.filter(u => u.id !== user.id))
    } catch(e) {}
    setSaving(null)
  }

  const thS = { textAlign:'left', padding:'10px 16px', fontSize:'11px', fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.07em', background:'#111111', borderBottom:'1px solid #1e1e1e', whiteSpace:'nowrap' }
  const tdS = { padding:'12px 16px', fontSize:'13px', color:'#d1d5db', borderBottom:'1px solid #1a1a1a', verticalAlign:'middle' }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Inactive Users</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>{users.length} inactive user{users.length!==1?'s':''} — time data is preserved</p>
        </div>
        <Link href="/admin/users"
          style={{background:'#1e1e1e',border:'1px solid #2a2a2a',color:'#9ca3af',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>
          ← Active Users
        </Link>
      </div>

      {loading && <div style={{color:'#6b7280',padding:'32px',textAlign:'center'}}>Loading...</div>}

      {!loading && users.length === 0 && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'56px',textAlign:'center'}}>
          <div style={{fontSize:'36px',marginBottom:'12px'}}>✅</div>
          <p style={{color:'#6b7280',margin:0,fontSize:'15px'}}>No inactive users.</p>
        </div>
      )}

      {!loading && users.length > 0 && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:'500px'}}>
              <thead>
                <tr>
                  <th style={thS}>Name / Email</th>
                  <th style={thS}>Role</th>
                  <th style={thS}>Status</th>
                  <th style={thS}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{opacity:0.75}} onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.75'}>
                    <td style={tdS}>
                      <div style={{fontWeight:500,color:'#9ca3af'}}>{u.name}</div>
                      <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>{u.email}</div>
                    </td>
                    <td style={tdS}><span style={{color:'#4b5563',fontSize:'13px'}}>{u.role||'viewer'}</span></td>
                    <td style={tdS}><span style={{background:'rgba(156,163,175,0.1)',color:'#9ca3af',padding:'2px 8px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>Inactive</span></td>
                    <td style={tdS}>
                      <button onClick={()=>reactivate(u)} disabled={saving===u.id}
                        style={{background:'rgba(141,198,63,0.1)',border:'1px solid rgba(141,198,63,0.25)',color:'#8DC63F',borderRadius:'6px',padding:'5px 16px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
                        {saving===u.id?'Reactivating…':'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}