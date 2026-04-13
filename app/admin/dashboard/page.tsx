// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const DATE_OPTIONS = [
  { value:'', label:'All Time' },
  { value:'this_month', label:'This Month' },
  { value:'last_month', label:'Last Month' },
  { value:'this_quarter', label:'This Quarter' },
  { value:'this_year', label:'This Year' },
  { value:'custom', label:'Custom Range' },
]

function getRange(filter, start, end) {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth()
  if (filter==='this_month') return [new Date(y,m,1), new Date(y,m+1,0)]
  if (filter==='last_month') return [new Date(y,m-1,1), new Date(y,m,0)]
  if (filter==='this_quarter') { const q=Math.floor(m/3); return [new Date(y,q*3,1), new Date(y,q*3+3,0)] }
  if (filter==='this_year') return [new Date(y,0,1), new Date(y,11,31)]
  if (filter==='custom'&&start&&end) return [new Date(start), new Date(end)]
  return null
}

const sel = { background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'8px 12px', color:'#fff', fontSize:'13px', cursor:'pointer', outline:'none' }

export default function Dashboard() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('this_month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')

  useEffect(() => {
    fetch('/api/time').then(r=>r.json()).then(data => { setEntries(data); setLoading(false) })
  }, [])

  const employees = [...new Set(entries.map(e=>e.name).filter(Boolean))].sort()

  function applyFilters(data) {
    let out = data
    if (employeeFilter) out = out.filter(e=>e.name===employeeFilter)
    const range = getRange(dateFilter, customStart, customEnd)
    if (range) out = out.filter(e=>{ const d=new Date(e.date); return d>=range[0]&&d<=range[1] })
    return out
  }

  const filtered = applyFilters(entries)
  const totalHours = filtered.reduce((s,e)=>s+(parseFloat(e.hours)||0),0)
  const uniqueProjects = [...new Set(filtered.map(e=>e.project).filter(Boolean))]
  const uniqueEmployees = [...new Set(filtered.map(e=>e.name).filter(Boolean))]
  const datesWithEntries = [...new Set(filtered.map(e=>e.date).filter(Boolean))]
  const avgPerDay = datesWithEntries.length?(totalHours/datesWithEntries.length):0

  const byProject = Object.entries(
    filtered.reduce((acc,e)=>{ const k=e.project||'No Project'; acc[k]=(acc[k]||0)+(parseFloat(e.hours)||0); return acc },{})
  ).sort((a,b)=>b[1]-a[1])

  const byEmployee = Object.entries(
    filtered.reduce((acc,e)=>{ if(e.name) acc[e.name]=(acc[e.name]||0)+(parseFloat(e.hours)||0); return acc },{})
  ).sort((a,b)=>b[1]-a[1])

  const byMonth = {}
  filtered.forEach(e => {
    if (!e.date) return
    const d = new Date(e.date)
    const key = d.toLocaleString('default',{month:'short',year:'numeric'})
    byMonth[key]=(byMonth[key]||0)+(parseFloat(e.hours)||0)
  })

  const maxP = byProject[0]?.[1]||1
  const maxE = byEmployee[0]?.[1]||1

  const kpis = [
    { label:'Total Hours', value: loading?'…':totalHours.toFixed(1), color:'#8DC63F' },
    { label:'Entries', value: loading?'…':filtered.length },
    { label:'Active Projects', value: loading?'…':uniqueProjects.length },
    { label:'Employees', value: loading?'…':uniqueEmployees.length },
    { label:'Avg Hrs / Day', value: loading?'…':avgPerDay.toFixed(1) },
  ]

  return (
    <div>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Dashboard</h1>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Overview of all time entries</p>
      </div>

      <div style={{display:'flex',flexWrap:'wrap',gap:'10px',marginBottom:'28px',alignItems:'center'}}>
        <select value={dateFilter} onChange={e=>setDateFilter(e.target.value)} style={sel}>
          {DATE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {dateFilter==='custom' && (
          <>
            <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{...sel,colorScheme:'dark'}}/>
            <span style={{color:'#6b7280',fontSize:'13px'}}>to</span>
            <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{...sel,colorScheme:'dark'}}/>
          </>
        )}
        <select value={employeeFilter} onChange={e=>setEmployeeFilter(e.target.value)} style={sel}>
          <option value="">All Employees</option>
          {employees.map(e=><option key={e} value={e}>{e}</option>)}
        </select>
        {(dateFilter||employeeFilter) && (
          <button onClick={()=>{setDateFilter('');setEmployeeFilter('');setCustomStart('');setCustomEnd('')}}
            style={{background:'#252525',color:'#9ca3af',border:'none',borderRadius:'8px',padding:'8px 12px',fontSize:'13px',cursor:'pointer'}}>
            Clear filters
          </button>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:'12px',marginBottom:'28px'}}>
        {kpis.map(c=>(
          <div key={c.label} style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'18px'}}>
            <div style={{fontSize:'28px',fontWeight:800,color:c.color||'#fff',lineHeight:1,marginBottom:'6px'}}>{c.value}</div>
            <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em'}}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginBottom:'20px'}}>
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'20px'}}>
          <h3 style={{margin:'0 0 20px',fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Hours by Project</h3>
          {byProject.length===0 && <div style={{color:'#4b5563',fontSize:'13px'}}>No data for this period</div>}
          {byProject.map(([proj,hrs])=>(
            <div key={proj} style={{marginBottom:'14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
                <span style={{fontSize:'13px',color:'#d1d5db'}}>{proj}</span>
                <span style={{fontSize:'13px',color:'#8DC63F',fontWeight:700}}>{hrs.toFixed(1)}h</span>
              </div>
              <div style={{background:'#252525',borderRadius:'4px',height:'5px'}}>
                <div style={{background:'#8DC63F',borderRadius:'4px',height:'5px',width:((hrs/maxP)*100)+'%'}}/>
              </div>
            </div>
          ))}
        </div>

        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'20px'}}>
          <h3 style={{margin:'0 0 20px',fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Hours by Employee</h3>
          {byEmployee.length===0 && <div style={{color:'#4b5563',fontSize:'13px'}}>No data for this period</div>}
          {byEmployee.map(([emp,hrs])=>(
            <div key={emp} style={{marginBottom:'14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
                <span style={{fontSize:'13px',color:'#d1d5db'}}>{emp}</span>
                <span style={{fontSize:'13px',color:'#8DC63F',fontWeight:700}}>{hrs.toFixed(1)}h</span>
              </div>
              <div style={{background:'#252525',borderRadius:'4px',height:'5px'}}>
                <div style={{background:'#8DC63F',borderRadius:'4px',height:'5px',width:((hrs/maxE)*100)+'%'}}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {Object.keys(byMonth).length > 0 && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'20px'}}>
          <h3 style={{margin:'0 0 20px',fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Hours by Month</h3>
          <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
            {Object.entries(byMonth).sort().map(([month,hrs])=>(
              <div key={month} style={{background:'#1a1a1a',border:'1px solid #252525',borderRadius:'8px',padding:'14px 18px',minWidth:'90px',textAlign:'center'}}>
                <div style={{fontSize:'20px',fontWeight:700,color:'#8DC63F'}}>{hrs.toFixed(1)}h</div>
                <div style={{fontSize:'11px',color:'#6b7280',marginTop:'3px'}}>{month}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}