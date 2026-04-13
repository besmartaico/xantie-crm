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
  const [user, setUser] = useState({name:'',role:''})
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const a = sessionStorage.getItem('xantie_auth')
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    if (!a) { router.push('/login'); return }
    if (path==='/admin/import' && u.role!=='admin') { router.push('/admin'); return }
    setAuth(true); setUser(u)
  }, [path])

  function signOut() {
    sessionStorage.removeItem('xantie_auth')
    sessionStorage.removeItem('xantie_user')
    router.push('/login')
  }

  if (!auth) return null
  const isAdmin = user.role === 'admin'

  const NAV = [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Time Entries', href: '/admin' },
    { label: 'Projects', href: '/admin/projects' },
    ...(isAdmin ? [{ label: 'Import', href: '/admin/import' }] : []),
  ]

  const isActive = (href) => href === '/admin' ? path === '/admin' : path.startsWith(href)

  const sidebar = (
    <div style={{display:'flex',flexDirection:'column',height:'100%',padding:'24px 0'}}>
      <div style={{padding:'0 20px 24px',borderBottom:'1px solid #252525'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <XLogo size={32}/>
          <div>
            <div style={{fontSize:'17px',fontWeight:800,color:'#fff',letterSpacing:'-0.3px'}}>Xantie</div>
            <div style={{fontSize:'10px',color:'#8DC63F',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase'}}>CRM</div>
          </div>
        </div>
      </div>
      <nav style={{flex:1,padding:'16px 12px'}}>
        {NAV.map(n=>(
          <a key={n.href} href={n.href} style={{
            display:'block',padding:'10px 12px',borderRadius:'8px',marginBottom:'4px',
            fontSize:'14px',fontWeight:500,cursor:'pointer',
            background: isActive(n.href)?'rgba(141,198,63,0.1)':'transparent',
            color: isActive(n.href)?'#8DC63F':'#9ca3af',
            borderLeft: isActive(n.href)?'2px solid #8DC63F':'2px solid transparent',
          }}>{n.label}</a>
        ))}
      </nav>
      <div style={{padding:'16px 20px',borderTop:'1px solid #252525'}}>
        {user.name && <div style={{fontSize:'12px',color:'#6b7280',marginBottom:'4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.name}</div>}
        {isAdmin && <div style={{fontSize:'10px',color:'#8DC63F',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'8px'}}>Admin</div>}
        <button onClick={signOut} style={{background:'none',border:'none',color:'#6b7280',fontSize:'13px',cursor:'pointer',padding:0}}>Sign Out</button>
      </div>
    </div>
  )

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
      <div className="desktop-only" style={{marginLeft:'220px',flex:1,padding:'32px'}}>{children}</div>
      <div className="mobile-only" style={{flex:1,padding:'72px 16px 24px'}}>{children}</div>
    </div>
  )
}