// @ts-nocheck
'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function XLogo({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <polygon points="0,0 14,0 44,44 30,44" fill="#8DC63F"/>
      <polygon points="30,0 44,0 14,44 0,44" fill="#666666"/>
      <polygon points="30,0 44,0 29,19 15,19" fill="#8DC63F"/>
      <polygon points="0,44 14,44 29,25 15,25" fill="#8DC63F"/>
    </svg>
  )
}

function VerifyInner() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') || ''
  const email = params.get('email') || ''
  const [status, setStatus] = useState('verifying') // verifying | success | error
  const [error, setError] = useState('')
  const [userData, setUserData] = useState(null)

  useEffect(() => {
    if (!token || !email) { setStatus('error'); setError('Invalid verification link.'); return }
    fetch('/api/auth/verify-email', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email, token })
    }).then(r=>r.json()).then(data => {
      if (data.success) {
        setUserData(data)
        // Auto sign in
        sessionStorage.setItem('xantie_auth', data.role)
        sessionStorage.setItem('xantie_user', JSON.stringify({ name: data.name, email: data.email, role: data.role }))
        setStatus('success')
      } else {
        setStatus('error'); setError(data.error || 'Verification failed.')
      }
    }).catch(() => { setStatus('error'); setError('Network error.') })
  }, [])

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a',padding:'20px'}}>
      <div style={{width:'100%',maxWidth:'400px',textAlign:'center'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'12px',marginBottom:'36px'}}>
          <XLogo/>
          <div style={{textAlign:'left'}}>
            <div style={{fontSize:'26px',fontWeight:800,color:'#fff',lineHeight:1}}>Xantie</div>
            <div style={{fontSize:'10px',color:'#8DC63F',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}>Management System</div>
          </div>
        </div>

        <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'32px'}}>
          {status === 'verifying' && (
            <>
              <div style={{fontSize:'36px',marginBottom:'16px'}}>⏳</div>
              <h2 style={{margin:'0 0 8px',fontSize:'18px'}}>Verifying your email...</h2>
              <p style={{color:'#6b7280',fontSize:'13px',margin:0}}>Just a moment</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div style={{fontSize:'40px',marginBottom:'16px'}}>✅</div>
              <h2 style={{margin:'0 0 8px',fontSize:'18px'}}>Email Verified!</h2>
              <p style={{color:'#9ca3af',fontSize:'13px',margin:'0 0 24px'}}>Your account is active. Taking you to the dashboard...</p>
              <button onClick={()=>router.push('/admin')}
                style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px',fontSize:'15px',fontWeight:800,cursor:'pointer'}}>
                Go to Dashboard
              </button>
            </>
          )}
          {status === 'error' && (
            <>
              <div style={{fontSize:'40px',marginBottom:'16px'}}>❌</div>
              <h2 style={{margin:'0 0 8px',fontSize:'18px'}}>Verification Failed</h2>
              <p style={{color:'#f87171',fontSize:'13px',margin:'0 0 24px'}}>{error}</p>
              <button onClick={()=>router.push('/login')}
                style={{width:'100%',background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'12px',fontSize:'15px',fontWeight:800,cursor:'pointer'}}>
                Back to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh',background:'#0a0a0a'}}/>}>
      <VerifyInner/>
    </Suspense>
  )
}