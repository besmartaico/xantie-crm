// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const inp = { width:'100%', background:'#111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#0066ff', fontSize:'14px', outline:'none', boxSizing:'border-box', fontWeight:600 }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }

function fmt(n, decimals = 2) {
  if (isNaN(n) || n === null || n === undefined || n === '') return '$0.00'
  const v = parseFloat(n) || 0
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtNum(n, decimals = 0) {
  const v = parseFloat(n) || 0
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function CalcRow({ label, value, blue, big }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #1a1a1a'}}>
      <span style={{color:'#9ca3af',fontSize:'13px'}}>{label}</span>
      <span style={{color: blue ? '#0066ff' : '#fff', fontSize: big ? '17px' : '14px', fontWeight:700}}>{value}</span>
    </div>
  )
}

export default function ProfitSharePage() {
  const [currentUser, setCurrentUser] = useState({})
  // Salary Model inputs
  const [salBase, setSalBase] = useState(115000)
  const [salRate, setSalRate] = useState(100)
  const [salHours, setSalHours] = useState(168)
  const [salTaxes, setSalTaxes] = useState(1000)
  // Profit Share Model inputs
  const [psBase, setPsBase] = useState(85000)
  const [psPercent, setPsPercent] = useState(25)  // stored as 25 for 25%
  const [psRate, setPsRate] = useState(125)
  const [psHours, setPsHours] = useState(168)
  const [psTaxes, setPsTaxes] = useState(1000)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u)
    if (u.role !== 'admin') {
      window.location.href = '/admin/dashboard'
    }
  }, [])

  // Salary Model calculations
  const salRevenue = (parseFloat(salRate)||0) * (parseFloat(salHours)||0)
  const salEmpBase = (parseFloat(salBase)||0) / 12
  const salEmpMonthly = salEmpBase + salRevenue
  const salEmpAnnual = salEmpMonthly * 12

  // Profit Share calculations
  const psRevenue = (parseFloat(psRate)||0) * (parseFloat(psHours)||0)
  const psEmpBase = (parseFloat(psBase)||0) / 12
  const psPercentDecimal = (parseFloat(psPercent)||0) / 100
  const psShareAmount = psRevenue * psPercentDecimal
  const psEmpMonthly = psEmpBase + psShareAmount
  const psEmpAnnual = psEmpMonthly * 12

  // Comparison
  const annualDiff = psEmpAnnual - salEmpAnnual
  const monthlyDiff = psEmpMonthly - salEmpMonthly

  return (
    <div>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Compensation Calculator</h1>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>
          Compare salary model vs profit share model. <span style={{color:'#0066ff'}}>Blue values are inputs</span> · black values are calculated.
        </p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:'16px',marginBottom:'24px'}}>
        {/* SALARY MODEL */}
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'20px'}}>
          <div style={{borderBottom:'2px solid #2a2a2a',paddingBottom:'10px',marginBottom:'14px'}}>
            <h2 style={{fontSize:'16px',fontWeight:700,margin:0,color:'#fff'}}>💼 Salary Model</h2>
            <p style={{fontSize:'12px',color:'#6b7280',margin:'2px 0 0'}}>Base salary + billable hours revenue</p>
          </div>

          <div style={{marginBottom:'14px'}}>
            <label style={lbl}>Base Salary (Annual)</label>
            <input type="number" value={salBase} onChange={e=>setSalBase(e.target.value)} style={inp}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'14px'}}>
            <div>
              <label style={lbl}>Hourly Rate</label>
              <input type="number" value={salRate} onChange={e=>setSalRate(e.target.value)} style={inp}/>
            </div>
            <div>
              <label style={lbl}># Billable Hours / Mo</label>
              <input type="number" value={salHours} onChange={e=>setSalHours(e.target.value)} style={inp}/>
            </div>
          </div>
          <div style={{marginBottom:'18px'}}>
            <label style={lbl}>Taxes / Insurance / Mo</label>
            <input type="number" value={salTaxes} onChange={e=>setSalTaxes(e.target.value)} style={inp}/>
          </div>

          <div>
            <CalcRow label="Revenue Generated" value={fmt(salRevenue)}/>
            <CalcRow label="Employee Base" value={fmt(salEmpBase)}/>
            <CalcRow label="Taxes / Insurance" value={fmt(salTaxes)} blue/>
            <div style={{height:'4px'}}></div>
            <CalcRow label="Employee Monthly" value={fmt(salEmpMonthly)} big/>
            <CalcRow label="Employee Annual" value={fmt(salEmpAnnual, 0)} big/>
          </div>
        </div>

        {/* PROFIT SHARE MODEL */}
        <div style={{background:'#141414',border:'1px solid rgba(141,198,63,0.3)',borderRadius:'14px',padding:'20px'}}>
          <div style={{borderBottom:'2px solid rgba(141,198,63,0.3)',paddingBottom:'10px',marginBottom:'14px'}}>
            <h2 style={{fontSize:'16px',fontWeight:700,margin:0,color:'#8DC63F'}}>🌱 Profit Share Model</h2>
            <p style={{fontSize:'12px',color:'#6b7280',margin:'2px 0 0'}}>Lower base + share of revenue</p>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'14px'}}>
            <div>
              <label style={lbl}>Base Salary</label>
              <input type="number" value={psBase} onChange={e=>setPsBase(e.target.value)} style={inp}/>
            </div>
            <div>
              <label style={lbl}>Employee % of Revenue</label>
              <input type="number" step="0.1" value={psPercent} onChange={e=>setPsPercent(e.target.value)} style={inp}/>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'14px'}}>
            <div>
              <label style={lbl}>Hourly Rate</label>
              <input type="number" value={psRate} onChange={e=>setPsRate(e.target.value)} style={inp}/>
            </div>
            <div>
              <label style={lbl}># Billable Hours / Mo</label>
              <input type="number" value={psHours} onChange={e=>setPsHours(e.target.value)} style={inp}/>
            </div>
          </div>
          <div style={{marginBottom:'18px'}}>
            <label style={lbl}>Taxes / Insurance / Mo</label>
            <input type="number" value={psTaxes} onChange={e=>setPsTaxes(e.target.value)} style={inp}/>
          </div>

          <div>
            <CalcRow label="Revenue Generated" value={fmt(psRevenue)}/>
            <CalcRow label="Employee Base" value={fmt(psEmpBase)}/>
            <CalcRow label={`Employee Share (${fmtNum(psPercent,1)}%)`} value={fmt(psShareAmount)}/>
            <CalcRow label="Taxes / Insurance" value={fmt(psTaxes)} blue/>
            <div style={{height:'4px'}}></div>
            <CalcRow label="Employee Monthly" value={fmt(psEmpMonthly)} big/>
            <CalcRow label="Employee Annual" value={fmt(psEmpAnnual, 0)} big/>
          </div>
        </div>
      </div>

      {/* COMPARISON */}
      <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'20px',marginBottom:'24px'}}>
        <h3 style={{fontSize:'14px',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 14px'}}>Comparison</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'16px'}}>
          <div>
            <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>Monthly Difference</div>
            <div style={{fontSize:'20px',fontWeight:700,color: monthlyDiff >= 0 ? '#8DC63F' : '#f87171'}}>
              {monthlyDiff >= 0 ? '+' : ''}{fmt(monthlyDiff)}
            </div>
            <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>{monthlyDiff >= 0 ? 'Profit Share earns more' : 'Salary earns more'}</div>
          </div>
          <div>
            <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>Annual Difference</div>
            <div style={{fontSize:'20px',fontWeight:700,color: annualDiff >= 0 ? '#8DC63F' : '#f87171'}}>
              {annualDiff >= 0 ? '+' : ''}{fmt(annualDiff, 0)}
            </div>
          </div>
          <div>
            <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>Break-even Hours</div>
            <div style={{fontSize:'20px',fontWeight:700,color:'#fff'}}>
              {(() => {
                const baseDiff = (parseFloat(salBase)||0) - (parseFloat(psBase)||0)
                if (psPercentDecimal === 0) return 'N/A'
                const monthlyBaseDiff = baseDiff / 12
                const breakEven = monthlyBaseDiff / (psPercentDecimal * (parseFloat(psRate)||0))
                if (isNaN(breakEven) || !isFinite(breakEven)) return 'N/A'
                return fmtNum(breakEven, 0) + ' hrs/mo'
              })()}
            </div>
            <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>For Profit Share to match Salary</div>
          </div>
        </div>
      </div>

      <div style={{background:'rgba(141,198,63,0.06)',border:'1px solid rgba(141,198,63,0.2)',borderRadius:'12px',padding:'14px 18px',fontSize:'13px',color:'#9ca3af',lineHeight:1.6}}>
        <strong style={{color:'#8DC63F'}}>How the math works:</strong> Employee Monthly = Employee Base (Salary ÷ 12) + Profit Share Amount.
        In the Salary Model, the "share" is 100% of revenue. In the Profit Share Model, it's the entered percentage of revenue. Taxes / Insurance are shown as a reference cost but are not added to compensation.
      </div>
    </div>
  )
}