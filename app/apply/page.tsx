// @ts-nocheck
'use client'
import { useState } from 'react'

const inp = { width:'100%', background:'#111', border:'1px solid #252525', borderRadius:'10px', padding:'12px 14px', color:'#fff', fontSize:'15px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#9ca3af', fontSize:'12px', fontWeight:600, marginBottom:'6px' }

function XLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,0 14,0 44,44 30,44" fill="#8DC63F"/>
      <polygon points="30,0 44,0 14,44 0,44" fill="#666666"/>
      <polygon points="30,0 44,0 29,19 15,19" fill="#8DC63F"/>
      <polygon points="0,44 14,44 29,25 15,25" fill="#8DC63F"/>
    </svg>
  )
}

export default function ApplyPage() {
  const [form, setForm] = useState({ roleType: 'Either' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const valid = form.name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email || '')

  async function submit() {
    if (!valid) { setError('Please enter your name and a valid email.'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/apply', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      const data = await res.json()
      if (data.success) setDone(true)
      else setError(data.error || 'Something went wrong. Please try again.')
    } catch(e) { setError('Network error. Please try again.') }
    setSubmitting(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',color:'#fff',display:'flex',justifyContent:'center',padding:'32px 16px'}}>
      <div style={{width:'100%',maxWidth:'620px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'28px'}}>
          <XLogo size={34}/>
          <div>
            <div style={{fontSize:'20px',fontWeight:800,lineHeight:1}}>Xantie</div>
            <div style={{fontSize:'10px',color:'#8DC63F',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}>Talent</div>
          </div>
        </div>

        {done ? (
          <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'16px',padding:'40px 28px',textAlign:'center'}}>
            <div style={{width:'52px',height:'52px',borderRadius:'50%',background:'rgba(141,198,63,0.15)',color:'#8DC63F',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'26px',margin:'0 auto 16px'}}>✓</div>
            <h1 style={{fontSize:'22px',fontWeight:700,margin:'0 0 8px'}}>Application received</h1>
            <p style={{color:'#9ca3af',fontSize:'15px',lineHeight:1.6,margin:0}}>Thanks, {form.name.split(' ')[0]}. Our team will review your background and reach out if there's a fit.</p>
          </div>
        ) : (
          <>
            <h1 style={{fontSize:'28px',fontWeight:800,margin:'0 0 8px',letterSpacing:'-0.02em'}}>Data Engineering roles</h1>
            <p style={{color:'#9ca3af',fontSize:'15px',lineHeight:1.6,margin:'0 0 28px'}}>
              We're building a bench of strong data engineers for full-time and contract work. Tell us about yourself and we'll be in touch.
            </p>

            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'16px',padding:'24px'}}>
              {/* honeypot — hidden from humans, catches bots */}
              <input tabIndex={-1} autoComplete="off" value={form.company_website||''} onChange={set('company_website')}
                style={{position:'absolute',left:'-9999px',width:'1px',height:'1px',opacity:0}} aria-hidden="true"/>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px',marginBottom:'14px'}}>
                <div><label style={lbl}>Full name *</label><input value={form.name||''} onChange={set('name')} style={inp} placeholder="Jane Doe"/></div>
                <div><label style={lbl}>Email *</label><input value={form.email||''} onChange={set('email')} style={inp} placeholder="jane@email.com"/></div>
                <div><label style={lbl}>Phone</label><input value={form.phone||''} onChange={set('phone')} style={inp} placeholder="(optional)"/></div>
                <div><label style={lbl}>Location</label><input value={form.location||''} onChange={set('location')} style={inp} placeholder="City, State / Remote"/></div>
              </div>

              <div style={{marginBottom:'14px'}}>
                <label style={lbl}>What are you open to? *</label>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                  {['Full-time','Contract','Either'].map(r => (
                    <button key={r} type="button" onClick={()=>setForm(f=>({...f,roleType:r}))}
                      style={{flex:'1 1 120px',padding:'11px',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer',
                        background: form.roleType===r ? 'rgba(141,198,63,0.15)' : '#111',
                        border: '1px solid '+(form.roleType===r ? '#8DC63F' : '#252525'),
                        color: form.roleType===r ? '#8DC63F' : '#9ca3af'}}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px',marginBottom:'14px'}}>
                <div><label style={lbl}>LinkedIn URL</label><input value={form.linkedin||''} onChange={set('linkedin')} style={inp} placeholder="linkedin.com/in/..."/></div>
                <div><label style={lbl}>Resume URL</label><input value={form.resume||''} onChange={set('resume')} style={inp} placeholder="Link to resume / portfolio"/></div>
                <div><label style={lbl}>Years of experience</label><input type="number" value={form.experienceYears||''} onChange={set('experienceYears')} style={inp}/></div>
                <div><label style={lbl}>Rate / salary expectation</label><input value={form.salaryRequirement||''} onChange={set('salaryRequirement')} style={inp} placeholder="e.g. $150k or $90/hr"/></div>
              </div>

              <div style={{marginBottom:'14px'}}>
                <label style={lbl}>Core skills & tools</label>
                <textarea rows={3} value={form.skillset||''} onChange={set('skillset')} style={{...inp,resize:'vertical'}} placeholder="SQL, Python, Spark, dbt, Airflow, Snowflake, AWS..."/>
              </div>

              <div style={{marginBottom:'18px'}}>
                <label style={lbl}>Anything else</label>
                <textarea rows={3} value={form.notes||''} onChange={set('notes')} style={{...inp,resize:'vertical'}} placeholder="Availability, what you're looking for, standout work..."/>
              </div>

              {error && <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'10px 14px',marginBottom:'14px',fontSize:'13px'}}>{error}</div>}

              <button onClick={submit} disabled={submitting||!valid}
                style={{width:'100%',background:valid?'#8DC63F':'#2a2a2a',color:valid?'#0a0a0a':'#4b5563',border:'none',borderRadius:'10px',padding:'14px',fontSize:'15px',fontWeight:700,cursor:valid?'pointer':'not-allowed'}}>
                {submitting?'Submitting...':'Submit application'}
              </button>
            </div>
          </>
        )}

        <p style={{color:'#4b5563',fontSize:'12px',textAlign:'center',marginTop:'20px'}}>Xantie · Your information is used only for recruiting and is never sold.</p>
      </div>
    </div>
  )
}
