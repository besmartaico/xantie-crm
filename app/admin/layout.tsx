// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

function XLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,0 14,0 44,44 30,44" fill="#8DC63F"/>
      <polygon points="30,0 44,0 14,44 0,44" fill="#666666"/>
      <polygon points="30,0 44,0 29,19 15,19" fill="#8DC63F"/>
      <polygon points="0,44 14,44 29,25 15,25" fill="#8DC63F"/>
    </svg>
  )
}

export default function AdminLayout({ children }) {
  const router = useRouter()
  const path = usePathname()
  const [auth, setAuth] = useState(false)
  const [user, setUser] = useState({ name:'', role:'', email:'' })
  const [menuOpen, setMenuOpen] = useState(false)
  const [impersonating, setImpersonating] = useState(false)
  const [realAdmin, setRealAdmin] = useState(null)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    const backup = sessionStorage.getItem('xantie_admin_backup')
    if (!u.role) { router.push('/login'); return }
    setAuth(true); setUser(u)
    if (backup) { setImpersonating(true); setRealAdmin(JSON.parse(backup)) }
    else { setImpersonating(false); setRealAdmin(null) }
  }, [path])

  function signOut() {
    sessionStorage.removeItem('xantie_auth')
    sessionStorage.removeItem('xantie_user')
    sessionStorage.removeItem('xantie_admin_backup')
    sessionStorage.removeItem('xantie_admin_auth_backup')
    router.push('/login')
  }

  function stopImpersonating() {
    const backup = sessionStorage.getItem('xantie_admin_backup')
    const authBackup = sessionStorage.getItem('xantie_admin_auth_backup')
    if (backup) {
      sessionStorage.setItem('xantie_user', backup)
      sessionStorage.setItem('xantie_auth', authBackup || 'admin')
      sessionStorage.removeItem('xantie_admin_backup')
      sessionStorage.removeItem('xantie_admin_auth_backup')
    }
    router.push('/admin/users')
  }

  const isActive = (href) => href === '/admin' ? path === '/admin' : path.startsWith(href)

  // All users see these
  const publicLinks = [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Time Entries', href: '/admin' },
    { label: 'Time Off', href: '/admin/time-off' },
    { label: 'Feedback', href: '/admin/feedback' },
  ]

  // Admin-only links (shown with a divider)
  const adminLinks = user.role === 'admin' ? [
    { label: 'Projects', href: '/admin/projects' },
    { label: 'Users', href: '/admin/users' },
    { label: 'Import', href: '/admin/import' },
  ] : []

  const navLinkStyle = (href) => ({
    display: 'block',
    padding: '9px 16px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: isActive(href) ? 700 : 400,
    background: isActive(href) ? 'rgba(141,198,63,0.1)' : 'transparent',
    color: isActive(href) ? '#8DC63F' : '#9ca3af',
    marginBottom: '2px',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    transition: 'all 0.15s',
  })

  const sidebar = (
    <div style={{display:'flex',flexDirection:'column',height:'100%',padding:'20px 12px'}}>
      {/* Logo */}
      <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'4px 6px',marginBottom:'28px'}}>
        <XLogo size={32}/>
        <div>
          <div style={{fontSize:'18px',fontWeight:800,color:'#fff',lineHeight:1}}>Xantie</div>
          <div style={{fontSize:'9px',color:'#8DC63F',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}>CRM</div>
        </div>
      </div>

      {/* Public nav links */}
      <nav style={{flex:1}}>
        {publicLinks.map(link => (
          <button key={link.href} onClick={()=>router.push(link.href)} style={navLinkStyle(link.href)}>
            {link.label}
          </button>
        ))}

        {/* Admin divider + admin links */}
        {adminLinks.length > 0 && (
          <>
            <div style={{display:'flex',alignItems:'center',gap:'8px',margin:'16px 6px 10px'}}>
              <div style={{flex:1,height:'1px',background:'#252525'}}/>
              <span style={{fontSize:'10px',color:'#3a3a3a',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',whiteSpace:'nowrap'}}>Admin</span>
              <div style={{flex:1,height:'1px',background:'#252525'}}/>
            </div>
            {adminLinks.map(link => (
              <button key={link.href} onClick={()=>router.push(link.href)} style={navLinkStyle(link.href)}>
                {link.label}
              </button>
            ))}
          </>
        )}
      </nav>

      {/* User info + sign out */}
      <div style={{borderTop:'1px solid #1e1e1e',paddingTop:'14px',marginTop:'8px'}}>
        <div style={{fontSize:'13px',color:'#fff',fontWeight:500,marginBottom:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.name}</div>
        <div style={{fontSize:'11px',color:'#4b5563',marginBottom:'10px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.email}</div>
        <button onClick={signOut} style={{background:'none',border:'none',color:'#6b7280',fontSize:'12px',cursor:'pointer',padding:0}}>Sign out</button>
      </div>
    </div>
  )

  if (!auth) return null

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#0a0a0a'}}>
      <div className="desktop-only" style={{width:'220px',minHeight:'100vh',background:'#111111',borderRight:'1px solid #1e1e1e',position:'fixed',top:0,left:0}}>{sidebar}</div>
      <div className="mobile-only" style={{position:'fixed',top:0,left:0,right:0,zIndex:100,background:'#111111',borderBottom:'1px solid #1e1e1e',padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <XLogo size={24}/>
          <span style={{fontSize:'16px',fontWeight:800,color:'#fff'}}>Xantie <span style={{color:'#8DC63F',fontSize:'12px'}}>CRM</span></span>
        </div>
        <button onClick={()=>setMenuOpen(!menuOpen)} style={{background:'none',border:'none',color:'#8DC63F',fontSize:'22px',cursor:'pointer'}}>☰</button>
      </div>
      {menuOpen && (
        <div style={{position:'fixed',inset:0,zIndex:200}} onClick={()=>setMenuOpen(false)}>
          <div style={{position:'absolute',top:0,left:0,width:'240px',height:'100%',background:'#111111',borderRight:'1px solid #1e1e1e'}} onClick={e=>e.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      )}

      <div className="desktop-only" style={{marginLeft:'220px',flex:1,display:'flex',flexDirection:'column'}}>
        {impersonating && (
          <div style={{background:'rgba(251,191,36,0.1)',borderBottom:'1px solid rgba(251,191,36,0.3)',padding:'10px 32px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:'13px',color:'#fbbf24'}}>
              👁 Viewing as <strong>{user.name}</strong> ({user.email}) — {user.role} view
            </span>
            <button onClick={stopImpersonating}
              style={{background:'#fbbf24',color:'#0a0a0a',border:'none',borderRadius:'6px',padding:'5px 12px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>
              Exit — Back to Admin
            </button>
          </div>
        )}
        <div style={{flex:1,padding:'32px'}}>{children}</div>
      </div>

      <div className="mobile-only" style={{flex:1,display:'flex',flexDirection:'column'}}>
        {impersonating && (
          <div style={{background:'rgba(251,191,36,0.1)',borderBottom:'1px solid rgba(251,191,36,0.3)',padding:'8px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'56px'}}>
            <span style={{fontSize:'12px',color:'#fbbf24'}}>Viewing as <strong>{user.name}</strong></span>
            <button onClick={stopImpersonating}
              style={{background:'#fbbf24',color:'#0a0a0a',border:'none',borderRadius:'6px',padding:'4px 10px',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>
              Exit
            </button>
          </div>
        )}
        <div style={{flex:1,padding: impersonating ? '12px 16px 24px' : '72px 16px 24px'}}>{children}</div>
      </div>
    </div>
  )
}