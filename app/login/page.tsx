// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const inp = { width:'100%', background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'8px', padding:'12px 14px', color:'#fff', fontSize:'16px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [mode, setMode] = useState('user')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (mode === 'admin') {
      const res = await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ pin }) })
      const data = await res.json()
      if (data.success) {
        sessionStorage.setItem('xantie_auth', 'admin')
        sessionStorage.setItem('xantie_user', JSON.stringify({ name:'Admin', email:'', role:'admin' }))
        router.push('/admin')
      } else { setError('Invalid PIN') }
    } else {
      const res = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (data.success) {
        sessionStorage.setItem('xantie_auth', 'user')
        sessionStorage.setItem('xantie_user', JSON.stringify({ name: data.name, email: data.email, role: data.role }))
        router.push('/admin')
      } else { setError('Invalid email or password') }
    }
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#131313',padding:'20px'}}>
      <div style={{width:'100%',maxWidth:'380px'}}>
        <div style={{textAlign:'center',marginBottom:'36px'}}>
          <div style={{fontSize:'32px',fontWeight:800,color:'#6366f1',marginBottom:'6px'}}>Xantie CRM</div>
          <div style={{color:'#6b7280',fontSize:'14px'}}>Management System</div>
        </div>

        <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'16px',padding:'28px'}}>
          <div style={{display:'flex',marginBottom:'24px',background:'#0f0f0f',borderRadius:'8px',padding:'4px'}}>
            <button onClick={() => setMode('user')} style={{flex:1,padding:'8px',border:'none',borderRadius:'6px',background: mode==='user' ? '#6366f1' : 'transparent',color: mode==='user' ? '#fff' : '#6b7280',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>User Login</button>
            <button onClick={() => setMode('admin')} style={{flex:1,padding:'8px',border:'none',borderRadius:'6px',background: mode==='admin' ? '#6366f1' : 'transparent',color: mode==='admin' ? '#fff' : '#6b7280',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Admin PIN</button>
          </div>

          {mode === 'user' ? (
            <>
              <div style={{marginBottom:'16px'}}>
                <label style={lbl}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@xantie.com" style={inp} />
              </div>
              <div style={{marginBottom:'24px'}}>
                <label style={lbl}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp} />
              </div>
            </>
          ) : (
            <div style={{marginBottom:'24px'}}>
              <label style={lbl}>Admin PIN</label>
              <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" style={inp} />
            </div>
          )}

          {error && <div style={{background:'#2d1515',border:'1px solid #7f1d1d',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}

          <button onClick={submit} disabled={loading} style={{width:'100%',background:'#6366f1',color:'#fff',border:'none',borderRadius:'8px',padding:'13px',fontSize:'15px',fontWeight:700,cursor:'pointer'}}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}