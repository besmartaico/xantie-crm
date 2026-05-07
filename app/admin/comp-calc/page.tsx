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

function CalcRow({ label, value, blue, big, accent }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #1a1a1a'}}>
      <span style={{color:'#9ca3af',fontSize:'13px'}}>{label}</span>
      <span style={{color: blue ? '#0066ff' : (accent || '#fff'), fontSize: big ? '17px' : '14px', fontWeight:700}}>{value}</span>
    </div>
  )
}

export default function ProfitSharePage() {
  const [currentUser, setCurrentUser] = useState({})
  // Salary Model inputs (Current Model)
  const [salBase, setSalBase] = useState(170000)
  const [salRate, setSalRate] = useState(110)
  const [salHours, setSalHours] = useState(168)
  const [salTaxes, setSalTaxes] = useState(1000)
  // Profit Share Model inputs (New Model)
  const [psBase, setPsBase] = useState(125000)
  const [psPercent, setPsPercent] = useState(20)  // stored as 20 for 20%
  const [psRate, setPsRate] = useState(110)
  const [psHours, setPsHours] = useState(168)
  const [psTaxes, setPsTaxes] = useState(1000)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u)
    if (u.role !== 'admin') {
      window.location.href = '/admin/dashboard'
    }
  }, [])

  // ── Salary Model (Current Model) ──
  // Revenue Generated = Hourly Rate × # Hours
  // Employee Base = Base Salary / 12
  // Employee Monthly = Employee Base   (Employee% always 0 in salary model)
  // Employee Annual = Employee Monthly × 12
  // Xantie Profit = Revenue Generated − Employee Monthly
  const salRevenue = (parseFloat(salRate)||0) * (parseFloat(salHours)||0)
  const salEmpBase = (parseFloat(salBase)||0) / 12
  const salEmpMonthly = salEmpBase
  const salEmpAnnual = salEmpMonthly * 12
  const salXantieProfit = salRevenue - salEmpMonthly - (parseFloat(salTaxes)||0)

  // ── Profit Share Model (New Model) ──
  // Revenue Generated = Hourly Rate × # Hours
  // Employee Base = Base Salary / 12
  // Employee Monthly = Employee Base + (Employee% × Hourly Rate × # Hours)
  // Employee Annual = Employee Monthly × 12
  // Xantie Profit = Revenue Generated − Employee Monthly
  const psRevenue = (parseFloat(psRate)||0) * (parseFloat(psHours)||0)
  const psEmpBase = (parseFloat(psBase)||0) / 12
  const psPercentDecimal = (parseFloat(psPercent)||0) / 100
  const psShareAmount = psPercentDecimal * (parseFloat(psRate)||0) * (parseFloat(psHours)||0)
  const psEmpMonthly = psEmpBase + psShareAmount
  const psEmpAnnual = psEmpMonthly * 12
  const psXantieProfit = psRevenue - psEmpMonthly - (parseFloat(psTaxes)||0)

  // Comparison
  const empAnnualDiff = psEmpAnnual - salEmpAnnual
  const empMonthlyDiff = psEmpMonthly - salEmpMonthly
  const xantieMonthlyDiff = psXantieProfit - salXantieProfit
  const xantieAnnualDiff = xantieMonthlyDiff * 12

  return (
    <div>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Compensation Calculator</h1>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>
          Compare salary model vs profit share model. <span style={{color:'#0066ff'}}>Blue values are inputs</span> · black values are calculated.
        </p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:'16px',marginBottom:'24px'}}>
        {/* SALARY / CURRENT MODEL */}
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'20px'}}>
          <div style={{borderBottom:'2px solid #2a2a2a',paddingBottom:'10px',marginBottom:'14px'}}>
            <h2 style={{fontSize:'16px',fontWeight:700,margin:0,color:'#fff'}}>💼 Salary Model</h2>
            <p style={{fontSize:'12px',color:'#6b7280',margin:'2px 0 0'}}>Employee paid base salary; Xantie keeps revenue</p>
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
            <CalcRow label="Employee Base (Mo)" value={fmt(salEmpBase)}/>
            <CalcRow label="Employee Share (0.0%)" value={fmt(0)}/>
            <CalcRow label="Taxes / Insurance" value={fmt(salTaxes)} blue/>
            <div style={{height:'4px'}}></div>
            <CalcRow label="Employee Monthly" value={fmt(salEmpMonthly)} big/>
            <CalcRow label="Employee Annual" value={fmt(salEmpAnnual, 0)} big/>
            <div style={{height:'4px'}}></div>
            <CalcRow label="Xantie Profit (Mo)" value={fmt(salXantieProfit)} accent="#8DC63F" big/>
          </div>
        </div>

        {/* PROFIT SHARE / NEW MODEL */}
        <div style={{background:'#141414',border:'1px solid rgba(141,198,63,0.3)',borderRadius:'14px',padding:'20px'}}>
          <div style={{borderBottom:'2px solid rgba(141,198,63,0.3)',paddingBottom:'10px',marginBottom:'14px'}}>
            <h2 style={{fontSize:'16px',fontWeight:700,margin:0,color:'#8DC63F'}}>🌱 Profit Share Model</h2>
            <p style={{fontSize:'12px',color:'#6b7280',margin:'2px 0 0'}}>Lower base + share of billable revenue</p>
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
            <CalcRow label="Employee Base (Mo)" value={fmt(psEmpBase)}/>
            <CalcRow label={`Employee Share (${fmtNum(psPercent,1)}%)`} value={fmt(psShareAmount)}/>
            <CalcRow label="Taxes / Insurance" value={fmt(psTaxes)} blue/>
            <div style={{height:'4px'}}></div>
            <CalcRow label="Employee Monthly" value={fmt(psEmpMonthly)} big/>
            <CalcRow label="Employee Annual" value={fmt(psEmpAnnual, 0)} big/>
            <div style={{height:'4px'}}></div>
            <CalcRow label="Xantie Profit (Mo)" value={fmt(psXantieProfit)} accent="#8DC63F" big/>
          </div>
        </div>
      </div>

      {/* COMPARISON */}
      <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'20px',marginBottom:'24px'}}>
        <h3 style={{fontSize:'14px',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 14px'}}>Comparison: New Model vs Current</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'16px'}}>
          <div>
            <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>Employee Annual Diff</div>
            <div style={{fontSize:'20px',fontWeight:700,color: empAnnualDiff >= 0 ? '#8DC63F' : '#f87171'}}>
              {empAnnualDiff >= 0 ? '+' : ''}{fmt(empAnnualDiff, 0)}
            </div>
            <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>{empAnnualDiff >= 0 ? 'Employee earns more in New Model' : 'Employee earns more in Current Model'}</div>
          </div>
          <div>
            <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>Xantie Annual Profit Diff</div>
            <div style={{fontSize:'20px',fontWeight:700,color: xantieAnnualDiff >= 0 ? '#8DC63F' : '#f87171'}}>
              {xantieAnnualDiff >= 0 ? '+' : ''}{fmt(xantieAnnualDiff, 0)}
            </div>
            <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>{xantieAnnualDiff >= 0 ? 'Xantie earns more in New Model' : 'Xantie earns more in Current Model'}</div>
          </div>
          <div>
            <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>Salary Model · Break-even Hrs</div>
            <div style={{fontSize:'20px',fontWeight:700,color:'#fff'}}>
              {(() => {
                const r = parseFloat(salRate) || 0
                if (r === 0) return 'N/A'
                const monthlyCost = ((parseFloat(salBase)||0) / 12) + (parseFloat(salTaxes)||0)
                const hrs = monthlyCost / r
                if (isNaN(hrs) || !isFinite(hrs)) return 'N/A'
                return fmtNum(hrs, 0) + ' hrs/mo'
              })()}
            </div>
            <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>For Xantie Profit = $0</div>
          </div>
          <div>
            <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>Profit Share Model · Break-even Hrs</div>
            <div style={{fontSize:'20px',fontWeight:700,color:'#fff'}}>
              {(() => {
                const r = parseFloat(psRate) || 0
                const denom = r * (1 - psPercentDecimal)
                if (denom === 0) return 'N/A'
                const monthlyCost = ((parseFloat(psBase)||0) / 12) + (parseFloat(psTaxes)||0)
                const hrs = monthlyCost / denom
                if (isNaN(hrs) || !isFinite(hrs)) return 'N/A'
                return fmtNum(hrs, 0) + ' hrs/mo'
              })()}
            </div>
            <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>For Xantie Profit = $0</div>
          </div>
        </div>
      </div>

      <div style={{background:'rgba(141,198,63,0.06)',border:'1px solid rgba(141,198,63,0.2)',borderRadius:'12px',padding:'14px 18px',fontSize:'13px',color:'#9ca3af',lineHeight:1.7}}>
        <strong style={{color:'#8DC63F'}}>How the math works:</strong>
        <div style={{marginTop:'6px'}}>
          <div><strong style={{color:'#fff'}}>Current Model:</strong> Employee Monthly = Base Salary ÷ 12 (employee gets salary; Xantie keeps all billable revenue).</div>
          <div style={{marginTop:'4px'}}><strong style={{color:'#8DC63F'}}>New Model:</strong> Employee Monthly = (Base Salary ÷ 12) + (Employee % × Hourly Rate × Hours). The employee earns a share of billable revenue on top of a lower base.</div>
          <div style={{marginTop:'4px'}}><strong style={{color:'#fff'}}>Xantie Profit</strong> = Revenue Generated − Employee Monthly − Taxes / Insurance (in both models).</div>
          <div style={{marginTop:'4px',color:'#6b7280'}}>Break-even hours = the number of billable hours per month required for Xantie Profit to reach $0.</div>
        </div>
      </div>
    </div>
  )
}