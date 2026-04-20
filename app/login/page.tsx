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

// Register is a 3-step flow:
// Step 1: enter email → check if exists
// Step 2a (exists): show "account exists" options — send reset link
// Step 2b (new): enter name + password → submit → send verification email
// Step 3: confirmation screen

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot'

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPw, setLoginPw] = useState('')
  const [showLoginPw, setShowLoginPw] = useState(false)

  // Register state — step based
  const [regStep, setRegStep] = useState(1) // 1=email, 2a=exists, 2b=new, 3=done
  const [regEmail, setRegEmail] = useState('')
  const [regName, setRegName] = useState('')
  const [regPw, setRegPw] = useState('')
  const [regPwConfirm, setRegPwConfirm] = useState('')
  const [showRegPw, setShowRegPw] = useState(false)
  const [showRegPwC, setShowRegPwC] = useState(false)
  const [regDoneMsg, setRegDoneMsg] = useState('')

  // Forgot state
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotDone, setForgotDone] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const eyeBtn = { position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:'4px', display:'flex', alignItems:'center' }

  function switchMode(m) { setMode(m); setError(''); setRegStep(1); setRegEmail(''); setRegName(''); setRegPw(''); setRegPwConfirm(''); setForgotEmail(''); setForgotDone(false); setLoginEmail(''); setLoginPw('') }

  // ---- LOGIN ----
  async function handleLogin() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: loginEmail.trim().toLowerCase(), password: loginPw }) })
      const data = await res.json()
      if (data.success) {
        sessionStorage.setItem('xantie_auth', data.role)
        sessionStorage.setItem('xantie_user', JSON.stringify({ name: data.name, email: data.email, role: data.role }))
        router.push('/admin')
      } else setError(data.error || 'Invalid email or password.')
    } catch { setError('Network error.') }
    setLoading(false)
  }

  // ---- REGISTER STEP 1: check email ----
  async function checkEmail() {
    const email = regEmail.trim().toLowerCase()
    if (!email) { setError('Please enter your email.'); return }
    if (!email.endsWith('@xantie.com')) { setError('Registration is limited to @xantie.com email addresses.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/check-email', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) })
      const data = await res.json()
      if (data.exists && data.hasPassword) {
        setRegStep('2a') // Account with password exists
      } else {
        setRegStep('2b') // New user or imported (no password)
      }
    } catch { setError('Network error.') }
    setLoading(false)
  }

  // ---- REGISTER STEP 2a: exists — send reset email ----
  async function sendResetForExisting() {
    setLoading(true); setError('')
    try {
      await fetch('/api/auth/reset-request', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: regEmail.trim().toLowerCase() }) })
      setRegDoneMsg('We\'ve sent a password reset link to ' + regEmail.trim().toLowerCase() + '. Check your inbox and follow the link to set your password.')
      setRegStep(3)
    } catch { setError('Network error.') }
    setLoading(false)
  }

  // ---- REGISTER STEP 2b: new user — create + send verification ----
  async function createAccount() {
    const email = regEmail.trim().toLowerCase()
    if (!regName.trim()) { setError('Please enter your name.'); return }
    if (regPw.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (regPw !== regPwConfirm) { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: regName.trim(), email, password: regPw }) })
      const data = await res.json()
      if (data.success) {
        // Imported user — auto sign in
        sessionStorage.setItem('xantie_auth', data.role)
        sessionStorage.setItem('xantie_user', JSON.stringify({ name: data.name, email: data.email, role: data.role }))
        router.push('/admin')
      } else if (data.pendingVerification) {
        setRegDoneMsg('We\'ve sent a verification link to ' + email + '. Click the link in the email to activate your account.')
        setRegStep(3)
      } else {
        setError(data.error || 'Registration failed.')
      }
    } catch { setError('Network error.') }
    setLoading(false)
  }

  // ---- FORGOT ----
  async function handleForgot() {
    setLoading(true); setError('')
    try {
      await fetch('/api/auth/reset-request', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }) })
      setForgotDone(true)
    } catch { setError('Network error.') }
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a',padding:'20px'}}>
      <div style={{width:'100%',maxWidth:'400px'}}>

        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'14px',marginBottom:'36px'}}>
          <XLogo size={52}/>
          <div style={{textAlign:'left'}}>
            <div style={{fontSize:'28px',fontWeight:800,color:'#fff',letterSpacing:'-0.5px',lineHeight:1}}>Xantie</div>
            <div style={{fontSize:'11px',color:'#8DC63F',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}>Management System</div>
          </div>
        </div>

        <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px'}}>

          {/* Mode tabs — only show on main form states */}
          {mode !== 'forgot' && !(mode === 'register' && regStep === 3) && (
            <div style={{display:'flex',marginBottom:'28px',background:'#0a0a0a',borderRadius:'8px',padding:'4px'}}>
              <button onClick={()=>switchMode('login')} style={{flex:1,padding:'9px',border:'none',borderRadius:'6px',background:mode==='login'?'#8DC63F':'transparent',color:mode==='login'?'#0a0a0a':'#6b7280',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Sign In</button>
              <button onClick={()=>switchMode('register')} style={{flex:1,padding:'9px',border:'none',borderRadius:'6px',background:mode==='register'?'#8DC63F':'transparent',color:mode==='register'?'#0a0a0a':'#6b7280',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Register</button>
            </div>
          )}

          {/* ===== LOGIN ===== */}
          {mode === 'login' && (
            <>
              <div style={{marginBottom:'16px'}}>
                <label style={lbl}>Email</label>
                <input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!loading&&handleLogin()} placeholder="you@xantie.com" style={inp} autoComplete="email"/>
              </div>
              <div style={{position:'relative',marginBottom:'8px'}}>
                <label style={lbl}>Password</label>
                <input type={showLoginPw?'text':'password'} value={loginPw} onChange={e=>setLoginPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!loading&&handleLogin()} placeholder="••••••••" style={{...inp,paddingRight:'44px'}} autoComplete="current-password"/>
                <button type="button" onClick={()=>setShowLoginPw(!showLoginPw)} style={eyeBtn}><EyeIcon open={showLoginPw}/></button>
              </div>
              <div style={{textAlign:'right',marginBottom:'20px'}}>
                <button onClick={()=>switchMode('forgot')} style={{background:'none',border:'none',color:'#8DC63F',fontSize:'12px',cursor:'pointer',padding:0}}>Forgot password?</button>
              </div>
              {error && <div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}
              <button onClick={handleLogin} disabled={loading} style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'13px',fontSize:'15px',fontWeight:800,cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1}}>
                {loading?'Signing in...':'Sign In'}
              </button>
            </>
          )}

          {/* ===== REGISTER ===== */}

          {/* Step 1: Email */}
          {mode === 'register' && regStep === 1 && (
            <>
              <div style={{marginBottom:'20px'}}>
                <label style={lbl}>Email Address</label>
                <input type="email" value={regEmail} onChange={e=>setRegEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!loading&&checkEmail()} placeholder="you@xantie.com" style={inp} autoFocus autoComplete="email"/>
                <p style={{margin:'6px 0 0',fontSize:'12px',color:'#4b5563'}}>Must be a @xantie.com address</p>
              </div>
              {error && <div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}
              <button onClick={checkEmail} disabled={loading} style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'13px',fontSize:'15px',fontWeight:800,cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1}}>
                {loading?'Checking...':'Continue →'}
              </button>
            </>
          )}

          {/* Step 2a: Email exists with password */}
          {mode === 'register' && regStep === '2a' && (
            <>
              <div style={{textAlign:'center',marginBottom:'20px'}}>
                <div style={{fontSize:'32px',marginBottom:'12px'}}>👤</div>
                <h3 style={{margin:'0 0 8px',fontSize:'17px'}}>Account Already Exists</h3>
                <p style={{color:'#9ca3af',fontSize:'13px',margin:'0 0 4px'}}>An account already exists for</p>
                <p style={{color:'#fff',fontWeight:600,fontSize:'14px',margin:0}}>{regEmail}</p>
              </div>
              <p style={{color:'#6b7280',fontSize:'13px',textAlign:'center',margin:'0 0 24px'}}>
                Click below and we'll send a link to that email address so you can create or reset your password.
              </p>
              {error && <div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}
              <button onClick={sendResetForExisting} disabled={loading} style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'13px',fontSize:'15px',fontWeight:800,cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1,marginBottom:'10px'}}>
                {loading?'Sending...':'Send Password Link'}
              </button>
              <button onClick={()=>{setRegStep(1);setError('')}} style={{width:'100%',background:'none',border:'none',color:'#6b7280',fontSize:'13px',cursor:'pointer',padding:'6px 0'}}>
                ← Use a different email
              </button>
            </>
          )}

          {/* Step 2b: New user — enter name + password */}
          {mode === 'register' && regStep === '2b' && (
            <>
              <div style={{background:'#1a1a1a',border:'1px solid #252525',borderRadius:'8px',padding:'10px 14px',marginBottom:'20px',display:'flex',alignItems:'center',gap:'10px'}}>
                <span style={{fontSize:'13px',color:'#8DC63F'}}>✓</span>
                <span style={{fontSize:'13px',color:'#9ca3af'}}>{regEmail}</span>
                <button onClick={()=>{setRegStep(1);setError('')}} style={{background:'none',border:'none',color:'#4b5563',fontSize:'12px',cursor:'pointer',marginLeft:'auto',padding:0}}>Change</button>
              </div>
              <div style={{marginBottom:'16px'}}>
                <label style={lbl}>Full Name</label>
                <input type="text" value={regName} onChange={e=>setRegName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!loading&&createAccount()} placeholder="Jane Smith" style={inp} autoFocus autoComplete="name"/>
              </div>
              <div style={{position:'relative',marginBottom:'16px'}}>
                <label style={lbl}>Password</label>
                <input type={showRegPw?'text':'password'} value={regPw} onChange={e=>setRegPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!loading&&createAccount()} placeholder="Min 8 characters" style={{...inp,paddingRight:'44px'}} autoComplete="new-password"/>
                <button type="button" onClick={()=>setShowRegPw(!showRegPw)} style={eyeBtn}><EyeIcon open={showRegPw}/></button>
              </div>
              <div style={{position:'relative',marginBottom:'24px'}}>
                <label style={lbl}>Confirm Password</label>
                <input type={showRegPwC?'text':'password'} value={regPwConfirm} onChange={e=>setRegPwConfirm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!loading&&createAccount()} placeholder="Repeat password" style={{...inp,paddingRight:'44px'}} autoComplete="new-password"/>
                <button type="button" onClick={()=>setShowRegPwC(!showRegPwC)} style={eyeBtn}><EyeIcon open={showRegPwC}/></button>
              </div>
              {error && <div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}
              <button onClick={createAccount} disabled={loading} style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'13px',fontSize:'15px',fontWeight:800,cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1}}>
                {loading?'Creating account...':'Create Account'}
              </button>
            </>
          )}

          {/* Step 3: Done (verification or reset sent) */}
          {mode === 'register' && regStep === 3 && (
            <div style={{textAlign:'center',padding:'8px 0'}}>
              <div style={{fontSize:'40px',marginBottom:'14px'}}>✉️</div>
              <h3 style={{margin:'0 0 10px',fontSize:'18px'}}>Check Your Email</h3>
              <p style={{color:'#9ca3af',fontSize:'13px',margin:'0 0 28px',lineHeight:1.6}}>{regDoneMsg}</p>
              <button onClick={()=>switchMode('login')} style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px',fontSize:'15px',fontWeight:800,cursor:'pointer',marginBottom:'10px'}}>
                Back to Sign In
              </button>
              <p style={{color:'#4b5563',fontSize:'12px',margin:0}}>Didn't receive it? Check your spam folder.</p>
            </div>
          )}

          {/* ===== FORGOT ===== */}
          {mode === 'forgot' && (
            <>
              <div style={{marginBottom:'24px'}}>
                <h2 style={{margin:'0 0 6px',fontSize:'18px'}}>Reset Password</h2>
                <p style={{color:'#6b7280',fontSize:'13px',margin:0}}>Enter your email and we'll send you a reset link.</p>
              </div>
              {!forgotDone ? (
                <>
                  <div style={{marginBottom:'24px'}}>
                    <label style={lbl}>Email</label>
                    <input type="email" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!loading&&handleForgot()} placeholder="you@xantie.com" style={inp} autoFocus/>
                  </div>
                  {error && <div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}
                  <button onClick={handleForgot} disabled={loading} style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'13px',fontSize:'15px',fontWeight:800,cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1,marginBottom:'10px'}}>
                    {loading?'Sending...':'Send Reset Link'}
                  </button>
                </>
              ) : (
                <div style={{textAlign:'center',padding:'8px 0',marginBottom:'16px'}}>
                  <div style={{fontSize:'36px',marginBottom:'12px'}}>✉️</div>
                  <p style={{color:'#9ca3af',fontSize:'13px',margin:0}}>If that email exists in our system, a reset link has been sent. Check your inbox.</p>
                </div>
              )}
              <button onClick={()=>switchMode('login')} style={{width:'100%',background:'none',border:'none',color:'#6b7280',fontSize:'13px',cursor:'pointer',padding:'6px 0'}}>
                ← Back to Sign In
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}