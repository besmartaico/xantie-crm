// @ts-nocheck
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function XLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
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

function ResetInner() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') || ''
  const email = params.get('email') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showCf, setShowCf] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const inp = { width:'100%', background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'8px', padding:'12px 14px', color:'#fff', fontSize:'16px', outline:'none', boxSizing:'border-box' }
  const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }
  const eyeBtn = { position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:'4px', display:'flex', alignItems:'center' }

  async function handleSubmit() {
    if (!password || !confirm) { setError('Please fill in all fields.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/reset-confirm', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email, token, password })
      })
      const data = await res.json()
      if (data.success) setDone(true)
      else setError(data.error || 'Reset failed.')
    } catch(e) { setError('Network error.') }
    setLoading(false)
  }

  if (!token || !email) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a'}}>
        <div style={{textAlign:'center',color:'#f87171'}}>
          <p style={{fontSize:'16px'}}>Invalid reset link.</p>
          <button onClick={()=>router.push('/login')} style={{marginTop:'16px',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 20px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>Back to Login</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a',padding:'20px'}}>
      <div style={{width:'100%',maxWidth:'390px'}}>
        <div style={{textAlign:'center',marginBottom:'32px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'12px'}}>
            <XLogo size={44}/>
            <div style={{textAlign:'left'}}>
              <div style={{fontSize:'26px',fontWeight:800,color:'#fff',letterSpacing:'-0.5px',lineHeight:1}}>Xantie</div>
              <div style={{fontSize:'10px',color:'#8DC63F',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}>Management System</div>
            </div>
          </div>
        </div>

        <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px'}}>
          {done ? (
            <div style={{textAlign:'center',padding:'16px 0'}}>
              <div style={{fontSize:'40px',marginBottom:'12px'}}>✅</div>
              <h2 style={{margin:'0 0 8px',fontSize:'18px'}}>Password Updated</h2>
              <p style={{color:'#9ca3af',fontSize:'13px',margin:'0 0 24px'}}>Your password has been set successfully.</p>
              <button onClick={()=>router.push('/login')} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px 24px',fontSize:'14px',fontWeight:700,cursor:'pointer',width:'100%'}}>
                Sign In
              </button>
            </div>
          ) : (
            <>
              <h2 style={{margin:'0 0 6px',fontSize:'18px'}}>Set New Password</h2>
              <p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 24px'}}>{email}</p>

              <div style={{marginBottom:'16px'}}>
                <label style={lbl}>New Password</label>
                <div style={{position:'relative'}}>
                  <input type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&handleSubmit()}
                    placeholder="Min 8 characters" style={{...inp,paddingRight:'44px'}} autoFocus/>
                  <button type="button" onClick={()=>setShowPw(!showPw)} style={eyeBtn}><EyeIcon open={showPw}/></button>
                </div>
              </div>

              <div style={{marginBottom:'24px'}}>
                <label style={lbl}>Confirm Password</label>
                <div style={{position:'relative'}}>
                  <input type={showCf?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&handleSubmit()}
                    placeholder="Repeat password" style={{...inp,paddingRight:'44px'}}/>
                  <button type="button" onClick={()=>setShowCf(!showCf)} style={eyeBtn}><EyeIcon open={showCf}/></button>
                </div>
              </div>

              {error && <div style={{background:'#1a0a0a',border:'1px solid #5a1a1a',color:'#f87171',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}

              <button onClick={handleSubmit} disabled={loading}
                style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'13px',fontSize:'15px',fontWeight:800,cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1}}>
                {loading?'Saving...':'Set Password'}
              </button>
              <button onClick={()=>router.push('/login')} style={{width:'100%',background:'none',border:'none',color:'#6b7280',fontSize:'13px',cursor:'pointer',padding:'10px 0 0',marginTop:'4px'}}>
                Back to login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh',background:'#0a0a0a'}}/>}>
      <ResetInner />
    </Suspense>
  )
}