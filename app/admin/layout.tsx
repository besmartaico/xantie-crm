// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const NAV = [
  { label: 'Time Entries', href: '/admin' },
  { label: 'Import', href: '/admin/import' },
]

export default function AdminLayout({ children }) {
  const router = useRouter()
  const path = usePathname()
  const [auth, setAuth] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const a = sessionStorage.getItem('xantie_auth')
    if (!a) router.push('/login')
    else setAuth(true)
  }, [])

  function signOut() {
    sessionStorage.removeItem('xantie_auth')
    sessionStorage.removeItem('xantie_user')
    router.push('/login')
  }

  if (!auth) return null

  const sidebar = (
    <div style={{display:'flex',flexDirection:'column',height:'100%',padding:'24px 0'}}>
      <div style={{padding:'0 20px 24px',borderBottom:'1px solid #2a2a2a'}}>
        <div style={{fontSize:'18px',fontWeight:700,color:'#6366f1'}}>Xantie CRM</div>
        <div style={{fontSize:'12px',color:'#6b7280',marginTop:'2px'}}>Management System</div>
      </div>
      <nav style={{flex:1,padding:'16px 12px'}}>
        {NAV.map(n => (
          <a key={n.href} href={n.href} style={{
            display:'block',padding:'10px 12px',borderRadius:'8px',marginBottom:'4px',
            fontSize:'14px',fontWeight:500,
            background: path === n.href ? '#1e1e3a' : 'transparent',
            color: path === n.href ? '#6366f1' : '#d1d5db',
          }}>{n.label}</a>
        ))}
      </nav>
      <div style={{padding:'16px 20px',borderTop:'1px solid #2a2a2a'}}>
        <button onClick={signOut} style={{background:'none',border:'none',color:'#6b7280',fontSize:'13px',cursor:'pointer',padding:0}}>Sign Out</button>
      </div>
    </div>
  )

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#131313'}}>
      {/* Desktop sidebar */}
      <div className="desktop-only" style={{width:'220px',minHeight:'100vh',background:'#0f0f0f',borderRight:'1px solid #1f1f1f',position:'fixed',top:0,left:0}}>
        {sidebar}
      </div>

      {/* Mobile header */}
      <div className="mobile-only" style={{position:'fixed',top:0,left:0,right:0,zIndex:100,background:'#0f0f0f',borderBottom:'1px solid #1f1f1f',padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:'16px',fontWeight:700,color:'#6366f1'}}>Xantie CRM</span>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{background:'none',border:'none',color:'#fff',fontSize:'22px',cursor:'pointer'}}>☰</button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div style={{position:'fixed',inset:0,zIndex:200}} onClick={() => setMenuOpen(false)}>
          <div style={{position:'absolute',top:0,left:0,width:'240px',height:'100%',background:'#0f0f0f',borderRight:'1px solid #1f1f1f'}} onClick={e => e.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="desktop-only" style={{marginLeft:'220px',flex:1,padding:'32px'}}>
        {children}
      </div>
      <div className="mobile-only" style={{flex:1,padding:'72px 16px 24px'}}>
        {children}
      </div>
    </div>
  )
}