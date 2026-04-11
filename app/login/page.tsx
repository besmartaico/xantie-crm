// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const inp = { width:'100%', background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'8px', padding:'12px 14px', color:'#fff', fontSize:'16px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }

function XLogo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,0 14,0 44,44 30,44" fill="#8DC63F"/>
      <polygon points="30,0 44,0 14,44 0,44" fill="#666666"/>
      <polygon points="30,0 44,0 29,19 15,19" fill="#8DC63F"/>
      <polygon points="0,44 14,44 29,25 15,25" fill="#8DC63F"/>
    </svg>
  )
}

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })
    const data = await res.json()
    if (data.success) {
      sessionStorage.setItem('xantie_auth', data.role)
      sessionStorage.setItem('xantie_user', JSON.stringify({ name: data.name, email: data.email, role: data.role }))
      router.push('/admin')
    } else {
      setError('Invalid email or password.')
    }
    setLoading(false)
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    if (password !== confirmPassword) { setError('Passwords do not match.'); setLoading(false); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); setLoading(false); return }
    const res = await fetch('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, email, password }) })
    const data = await res.json()
    if (data.success) {
      sessionStorage.setItem('xantie_auth', data.role)
      sessionStorage.setItem('xantie_user', JSON.stringify({ name: data.name, email: data.email, role: data.role }))
      router.push('/admin')
    } else {
      setError(data.error || 'Registration failed.')
    }
    setLoading(false)
  }

  function switchMode(m) { setMode(m); setError(''); setSuccess(''); setEmail(''); setPassword(''); setConfirmPassword(''); setName('') }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a',padding:'20px'}}>
      <div style={{width:'100%',maxWidth:'390px'}}>

        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:'36px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'14px',marginBottom:'4px'}}>
            <XLogo size={52} />
            <div style={{textAlign:'left'}}>
              <div style={{fontSize:'28px',fontWeight:800,color:'#fff',letterSpacing:'-0.5px',lineHeight:1}}>Xantie</div>
              <div style={{fontSize:'11px',color:'#8DC63F',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}>Management System</div>
            </div>
          </div>
        </div>

        <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px'}}>

          {/* Tabs */}
          <div style={{display:'flex',marginBottom:'28px',background:'#0a0a0a',borderRadius:'8px',padding:'4px'}}>
            <button onClick={() => switchMode('login')} style={{flex:1,padding:'9px',border:'none',borderRadius:'6px',background: mode==='login' ? '#8DC63F' : 'transparent',color: mode==='login' ? '#0a0a0a' : '#6b7280',fontSize:'13px',fontWeight:700,cursor:'pointer',transition:'all 0.15s'}}>
              Sign In
            </button>
            <button onClick={() => switchMode('register')} style={{flex:1,padding:'9px',border:'none',borderRadius:'6px',background: mode==='register' ? '#8DC63F' : 'transparent',color: mode==='register' ? '#0a0a0a' : '#6b7280',fontSize:'13px',fontWeight:700,cursor:'pointer',transition:'all 0.15s'}}>
              Register
            </button>
          </div>

          {/* Sign In Form */}
          {mode === 'login' && (
            <>
              <div style={{marginBottom:'16px'}}>
                <label style={lbl}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@xantie.com" style={inp} autoComplete="email" />
              </div>
              <div style={{marginBottom:'24px'}}>
                <label style={lbl}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp} autoComplete="current-password" />
              </div>
            </>
          )}

          {/* Register Form */}
          {mode === 'register' && (
            <>
              <div style={{background:'rgba(141,198,63,0.08)',border:'1px solid rgba(141,198,63,0.2)',borderRadius:'8px',padding:'10px 14px',marginBottom:'20px'}}>
                <p style={{margin:0,fontSize:'12px',color:'#8DC63F'}}>🔒 Registration is open to <strong>@xantie.com</strong> email addresses only.</p>
              </div>
              <div style={{marginBottom:'16px'}}>
                <label style={lbl}>Full Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" style={inp} autoComplete="name" />
              </div>
              <div style={{marginBottom:'16px'}}>
                <label style={lbl}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@xantie.com" style={inp} autoComplete="email" />
              </div>
              <div style={{marginBottom:'16px'}}>
                <label style={lbl}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" style={inp} autoComplete="new-password" />
              </div>
              <div style={{marginBottom:'24px'}}>
                <label style={lbl}>Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" style={inp} autoComplete="new-password" />
              </div>
            </>
          )}

          {/* Error / Success */}
          {error && (
            <div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>
              {error}
            </div>
          )}
          {success && (
            <div style={{background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.3)',color:'#34d399',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>
              {success}
            </div>
          )}

          <button
            onClick={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
            style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'13px',fontSize:'15px',fontWeight:800,cursor:'pointer',letterSpacing:'-0.2px',opacity: loading ? 0.7 : 1}}>
            {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>

        </div>
      </div>
    </div>
  )
}