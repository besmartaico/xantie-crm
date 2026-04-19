// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const inp = { width:'100%', background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'8px', padding:'12px 14px', color:'#fff', fontSize:'16px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }

function XLogo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <polygon points="0,0 14,0 44,44 30,44" fill="#8DC63F"/>
      <polygon points="30,0 44,0 14,44 0,44" fill="#666666"/>
      <polygon points="30,0 44,0 29,19 15,19" fill="#8DC63F"/>
      <polygon points="0,44 14,44 29,25 15,25" fill="#8DC63F"/>
    </svg>
  )
}

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState('login')
  const [screen, setScreen] = useState('form') // 'form' | 'emailExists' | 'checkEmail'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleLogin() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: email.trim().toLowerCase(), password }) })
      const data = await res.json()
      if (data.success) {
        sessionStorage.setItem('xantie_auth', data.role)
        sessionStorage.setItem('xantie_user', JSON.stringify({ name: data.name, email: data.email, role: data.role }))
        router.push('/admin')
      } else setError(data.error || 'Invalid email or password.')
    } catch { setError('Network error.') }
    setLoading(false)
  }

  async function handleRegister() {
    setLoading(true); setError('')
    if (password !== confirmPassword) { setError('Passwords do not match.'); setLoading(false); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); setLoading(false); return }
    try {
      const res = await fetch('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, email: email.trim().toLowerCase(), password }) })
      const data = await res.json()
      if (data.success) {
        // Auto-login (imported user or jeff@xantie.com)
        sessionStorage.setItem('xantie_auth', data.role)
        sessionStorage.setItem('xantie_user', JSON.stringify({ name: data.name, email: data.email, role: data.role }))
        router.push('/admin')
      } else if (data.emailExists) {
        setScreen('emailExists')
      } else if (data.pendingVerification) {
        setScreen('checkEmail')
      } else {
        setError(data.error || 'Registration failed.')
      }
    } catch { setError('Network error.') }
    setLoading(false)
  }

  async function handleForgot() {
    setLoading(true); setError(''); setSuccess('')
    try {
      await fetch('/api/auth/reset-request', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: email.trim().toLowerCase() }) })
      setSuccess('If that email exists in our system, a reset link has been sent. Check your inbox.')
    } catch { setError('Network error.') }
    setLoading(false)
  }

  function handleKeyDown(e) {
    if (e.key !== 'Enter' || loading) return
    if (mode === 'login') handleLogin()
    else if (mode === 'register' && screen === 'form') handleRegister()
    else if (mode === 'forgot') handleForgot()
  }

  function reset() { setScreen('form'); setError(''); setSuccess(''); setEmail(''); setPassword(''); setConfirmPassword(''); setName('') }
  function switchMode(m) { setMode(m); reset() }

  const eyeBtn = { position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:'4px', display:'flex', alignItems:'center' }

  // ---- Special screens ----

  // Email already exists screen
  if (screen === 'emailExists') return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a',padding:'20px'}}>
      <div style={{width:'100%',maxWidth:'390px'}}>
        <div style={{textAlign:'center',marginBottom:'32px',display:'flex',alignItems:'center',justifyContent:'center',gap:'12px'}}>
          <XLogo size={44}/><div style={{textAlign:'left'}}><div style={{fontSize:'26px',fontWeight:800,color:'#fff',lineHeight:1}}>Xantie</div><div style={{fontSize:'10px',color:'#8DC63F',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}>Management System</div></div>
        </div>
        <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'32px',textAlign:'center'}}>
          <div style={{fontSize:'40px',marginBottom:'16px'}}>📧</div>
          <h2 style={{margin:'0 0 10px',fontSize:'19px'}}>Account Already Exists</h2>
          <p style={{color:'#9ca3af',fontSize:'13px',margin:'0 0 8px'}}>An account already exists for</p>
          <p style={{color:'#fff',fontWeight:600,fontSize:'14px',margin:'0 0 16px'}}>{email}</p>
          <p style={{color:'#9ca3af',fontSize:'13px',margin:'0 0 28px'}}>We've sent a password reset link to that email address. Check your inbox and follow the instructions to access your account.</p>
          <button onClick={()=>switchMode('login')}
            style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px',fontSize:'15px',fontWeight:800,cursor:'pointer',marginBottom:'10px'}}>
            Back to Sign In
          </button>
          <button onClick={()=>switchMode('forgot')}
            style={{width:'100%',background:'none',border:'none',color:'#6b7280',fontSize:'13px',cursor:'pointer',padding:'6px 0'}}>
            Resend reset email
          </button>
        </div>
      </div>
    </div>
  )

  // Check email screen (new registration)
  if (screen === 'checkEmail') return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a',padding:'20px'}}>
      <div style={{width:'100%',maxWidth:'390px'}}>
        <div style={{textAlign:'center',marginBottom:'32px',display:'flex',alignItems:'center',justifyContent:'center',gap:'12px'}}>
          <XLogo size={44}/><div style={{textAlign:'left'}}><div style={{fontSize:'26px',fontWeight:800,color:'#fff',lineHeight:1}}>Xantie</div><div style={{fontSize:'10px',color:'#8DC63F',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}>Management System</div></div>
        </div>
        <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'32px',textAlign:'center'}}>
          <div style={{fontSize:'40px',marginBottom:'16px'}}>✉️</div>
          <h2 style={{margin:'0 0 10px',fontSize:'19px'}}>Check Your Email</h2>
          <p style={{color:'#9ca3af',fontSize:'13px',margin:'0 0 8px'}}>We've sent a verification link to</p>
          <p style={{color:'#fff',fontWeight:600,fontSize:'14px',margin:'0 0 16px'}}>{email}</p>
          <p style={{color:'#9ca3af',fontSize:'13px',margin:'0 0 28px'}}>Click the link in the email to verify your address and activate your account. The link expires in 24 hours.</p>
          <button onClick={()=>switchMode('login')}
            style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px',fontSize:'15px',fontWeight:800,cursor:'pointer'}}>
            Back to Sign In
          </button>
          <p style={{color:'#4b5563',fontSize:'12px',margin:'16px 0 0'}}>Didn't receive it? Check your spam folder.</p>
        </div>
      </div>
    </div>
  )

  // ---- Main login/register/forgot form ----
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a',padding:'20px'}}>
      <div style={{width:'100%',maxWidth:'390px'}}>
        <div style={{textAlign:'center',marginBottom:'36px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'14px'}}>
            <XLogo size={52}/>
            <div style={{textAlign:'left'}}>
              <div style={{fontSize:'28px',fontWeight:800,color:'#fff',letterSpacing:'-0.5px',lineHeight:1}}>Xantie</div>
              <div style={{fontSize:'11px',color:'#8DC63F',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}>Management System</div>
            </div>
          </div>
        </div>

        <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px'}}>
          {mode !== 'forgot' && (
            <div style={{display:'flex',marginBottom:'28px',background:'#0a0a0a',borderRadius:'8px',padding:'4px'}}>
              <button onClick={()=>switchMode('login')} style={{flex:1,padding:'9px',border:'none',borderRadius:'6px',background:mode==='login'?'#8DC63F':'transparent',color:mode==='login'?'#0a0a0a':'#6b7280',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Sign In</button>
              <button onClick={()=>switchMode('register')} style={{flex:1,padding:'9px',border:'none',borderRadius:'6px',background:mode==='register'?'#8DC63F':'transparent',color:mode==='register'?'#0a0a0a':'#6b7280',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Register</button>
            </div>
          )}

          {mode === 'forgot' && (
            <div style={{marginBottom:'24px'}}>
              <h2 style={{margin:'0 0 6px',fontSize:'18px'}}>Reset Password</h2>
              <p style={{color:'#6b7280',fontSize:'13px',margin:0}}>Enter your email and we'll send you a reset link.</p>
            </div>
          )}

          {mode === 'login' && (
            <>
              <div style={{marginBottom:'16px'}}>
                <label style={lbl}>Email</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={handleKeyDown} placeholder="you@xantie.com" style={inp} autoComplete="email"/>
              </div>
              <div style={{position:'relative',marginBottom:'8px'}}>
                <label style={lbl}>Password</label>
                <input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="••••••••" style={{...inp,paddingRight:'44px'}} autoComplete="current-password"/>
                <button type="button" onClick={()=>setShowPassword(!showPassword)} style={eyeBtn}><EyeIcon open={showPassword}/></button>
              </div>
              <div style={{textAlign:'right',marginBottom:'20px'}}>
                <button onClick={()=>switchMode('forgot')} style={{background:'none',border:'none',color:'#8DC63F',fontSize:'12px',cursor:'pointer',padding:0}}>Forgot password?</button>
              </div>
            </>
          )}

          {mode === 'register' && (
            <>
              <div style={{background:'rgba(141,198,63,0.08)',border:'1px solid rgba(141,198,63,0.2)',borderRadius:'8px',padding:'10px 14px',marginBottom:'20px'}}>
                <p style={{margin:0,fontSize:'12px',color:'#8DC63F'}}>Registration is open to <strong>@xantie.com</strong> email addresses. A verification email will be sent to activate your account.</p>
              </div>
              <div style={{marginBottom:'16px'}}>
                <label style={lbl}>Full Name</label>
                <input type="text" value={name} onChange={e=>setName(e.target.value)} onKeyDown={handleKeyDown} placeholder="Jane Smith" style={inp} autoComplete="name"/>
              </div>
              <div style={{marginBottom:'16px'}}>
                <label style={lbl}>Email</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={handleKeyDown} placeholder="you@xantie.com" style={inp} autoComplete="email"/>
              </div>
              <div style={{position:'relative',marginBottom:'16px'}}>
                <label style={lbl}>Password</label>
                <input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="Min 8 characters" style={{...inp,paddingRight:'44px'}} autoComplete="new-password"/>
                <button type="button" onClick={()=>setShowPassword(!showPassword)} style={eyeBtn}><EyeIcon open={showPassword}/></button>
              </div>
              <div style={{position:'relative',marginBottom:'24px'}}>
                <label style={lbl}>Confirm Password</label>
                <input type={showConfirm?'text':'password'} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="Repeat password" style={{...inp,paddingRight:'44px'}} autoComplete="new-password"/>
                <button type="button" onClick={()=>setShowConfirm(!showConfirm)} style={eyeBtn}><EyeIcon open={showConfirm}/></button>
              </div>
            </>
          )}

          {mode === 'forgot' && (
            <div style={{marginBottom:'24px'}}>
              <label style={lbl}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={handleKeyDown} placeholder="you@xantie.com" style={inp} autoFocus/>
            </div>
          )}

          {error && <div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}
          {success && <div style={{background:'rgba(141,198,63,0.08)',border:'1px solid rgba(141,198,63,0.2)',color:'#8DC63F',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>{success}</div>}

          {mode === 'login' && <button onClick={handleLogin} disabled={loading} style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'13px',fontSize:'15px',fontWeight:800,cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1}}>{loading?'Signing in...':'Sign In'}</button>}
          {mode === 'register' && <button onClick={handleRegister} disabled={loading} style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'13px',fontSize:'15px',fontWeight:800,cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1}}>{loading?'Creating account...':'Create Account'}</button>}
          {mode === 'forgot' && !success && <button onClick={handleForgot} disabled={loading} style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'13px',fontSize:'15px',fontWeight:800,cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1}}>{loading?'Sending...':'Send Reset Link'}</button>}
          {mode === 'forgot' && <button onClick={()=>switchMode('login')} style={{width:'100%',background:'none',border:'none',color:'#6b7280',fontSize:'13px',cursor:'pointer',padding:'10px 0 0',marginTop:'4px'}}>← Back to Sign In</button>}
        </div>
      </div>
    </div>
  )
}