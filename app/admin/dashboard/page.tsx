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

function BillableFilter({ value, onChange }) {
  return (
    <div style={{display:'flex',borderRadius:'8px',overflow:'hidden',border:'1px solid #252525'}}>
      {[{v:'',label:'All'},{v:'yes',label:'Billable'},{v:'no',label:'Non-Billable'}].map(o => (
        <button key={o.v} onClick={()=>onChange(o.v)}
          style={{padding:'8px 14px',border:'none',fontSize:'13px',fontWeight:600,cursor:'pointer',background:value===o.v?'#8DC63F':'#111111',color:value===o.v?'#0a0a0a':'#6b7280'}}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('this_month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [billableFilter, setBillableFilter] = useState('')
  const [includeInactive, setIncludeInactive] = useState(true)
  const [currentUser, setCurrentUser] = useState({})
  const [expandedProjects, setExpandedProjects] = useState({})

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u)
    Promise.all([
      fetch('/api/time').then(r=>r.json()),
      fetch('/api/projects').then(r=>r.json()),
      fetch('/api/users').then(r=>r.json()),
    ]).then(([e,p,u]) => { setEntries(e); setProjects(p); setAllUsers(u); setLoading(false) })
  }, [])

  const inactiveEmails = new Set(allUsers.filter(u=>u.status==='inactive').map(u=>u.email))
  const hasInactiveData = entries.some(e=>inactiveEmails.has(e.email))

  function getAccessibleEntries() {
    const role = currentUser.role; const email = currentUser.email
    let base = entries
    if (!includeInactive && inactiveEmails.size>0) base = base.filter(e=>!inactiveEmails.has(e.email))
    if (role==='admin') return base
    const ledProjects = projects.filter(p=>p.teamLead===email).map(p=>p.name)
    if (ledProjects.length>0) return base.filter(e=>e.email===email||ledProjects.includes(e.project))
    return base.filter(e=>e.email===email)
  }

  const accessibleEntries = getAccessibleEntries()
  const isAdmin = currentUser.role==='admin'
  const ledProjects = projects.filter(p=>p.teamLead===currentUser.email).map(p=>p.name)
  const isTeamLead = ledProjects.length>0
  const employees = (isAdmin||isTeamLead)?[...new Set(accessibleEntries.map(e=>e.name).filter(Boolean))].sort():[]

  function applyFilters(data) {
    let out = data
    if (employeeFilter) out = out.filter(e=>e.name===employeeFilter)
    if (billableFilter) out = out.filter(e=>e.billable===billableFilter)
    const range = getRange(dateFilter, customStart, customEnd)
    if (range) out = out.filter(e=>{ const d=new Date(e.date); return d>=range[0]&&d<=range[1] })
    return out
  }

  const filtered = applyFilters(accessibleEntries)
  const totalHours = filtered.reduce((s,e)=>s+(parseFloat(e.hours)||0),0)
  const billableHours = filtered.filter(e=>e.billable!=='no').reduce((s,e)=>s+(parseFloat(e.hours)||0),0)
  const nonBillableHours = totalHours - billableHours
  const uniqueProjects = [...new Set(filtered.map(e=>e.project).filter(Boolean))]
  const uniqueEmployees = [...new Set(filtered.map(e=>e.name).filter(Boolean))]
  const datesWithEntries = [...new Set(filtered.map(e=>e.date).filter(Boolean))]
  const avgPerDay = datesWithEntries.length?(totalHours/datesWithEntries.length):0

  // Active in last 30 days (always from unfiltered accessible entries, not affected by current filters)
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate()-30)
  const EXCLUDED_EMAILS = new Set(['jeff@xantie.com','mike@xantie.com','jared@xantie.com'])
  const recentEntries = accessibleEntries.filter(e => e.date && new Date(e.date) >= thirtyDaysAgo)
  const activeEmployees30 = new Set(recentEntries.map(e=>e.email).filter(e=>e&&!EXCLUDED_EMAILS.has(e.toLowerCase()))).size
  const activeProjects30 = new Set(recentEntries.map(e=>e.project).filter(Boolean)).size

  // Group by project with employee breakdown
  const byProject = {}
  filtered.forEach(e => {
    const k = e.project||'(No Project)'
    if (!byProject[k]) byProject[k] = { entries:[], total:0, billable:0 }
    byProject[k].entries.push(e)
    byProject[k].total += parseFloat(e.hours)||0
    if (e.billable!=='no') byProject[k].billable += parseFloat(e.hours)||0
  })
  const projectList = Object.entries(byProject).sort((a,b)=>b[1].total-a[1].total)

  // By employee
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

  const maxE = byEmployee[0]?.[1]||1
  const hasFilters = dateFilter||employeeFilter||billableFilter

  const kpis = [
    { label:'Total Hours', value: loading?'…':totalHours.toFixed(1), color:'#8DC63F' },
    { label:'Billable', value: loading?'…':billableHours.toFixed(1), color:'#60a5fa' },
    { label:'Non-Billable', value: loading?'…':nonBillableHours.toFixed(1), color:'#9ca3af' },
    { label:'Avg Hrs / Day', value: loading?'…':avgPerDay.toFixed(1) },
    ...(isAdmin||isTeamLead?[
      { label:'Active Employees', value: loading?'…':activeEmployees30, color:'#a78bfa' },
      { label:'Active Projects', value: loading?'…':activeProjects30, color:'#f59e0b' },
    ]:[]),
  ]

  function toggleProject(proj) {
    setExpandedProjects(prev=>({...prev,[proj]:!prev[proj]}))
  }

  return (
    <div>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Dashboard</h1>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>
          {isAdmin?'All team data':isTeamLead?'Your hours + projects you lead':'Your hours'}
          {includeInactive&&inactiveEmails.size>0&&<span style={{color:'#f59e0b'}}> · including inactive users</span>}
        </p>
      </div>

      {/* Filters */}
      <div style={{display:'flex',flexWrap:'wrap',gap:'10px',marginBottom:'28px',alignItems:'center'}}>
        <select value={dateFilter} onChange={e=>setDateFilter(e.target.value)} style={sel}>
          {DATE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {dateFilter==='custom'&&(
          <>
            <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{...sel,colorScheme:'dark'}}/>
            <span style={{color:'#6b7280',fontSize:'13px'}}>to</span>
            <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{...sel,colorScheme:'dark'}}/>
          </>
        )}
        {employees.length>0&&(
          <select value={employeeFilter} onChange={e=>setEmployeeFilter(e.target.value)} style={sel}>
            <option value="">All Employees</option>
            {employees.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
        )}
        <BillableFilter value={billableFilter} onChange={setBillableFilter}/>
        {isAdmin&&hasInactiveData&&(
          <button onClick={()=>setIncludeInactive(!includeInactive)}
            style={{background:includeInactive?'rgba(245,158,11,0.15)':'#1e1e1e',border:includeInactive?'1px solid rgba(245,158,11,0.4)':'1px solid #2a2a2a',color:includeInactive?'#f59e0b':'#6b7280',borderRadius:'8px',padding:'8px 14px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
            {includeInactive?'Including inactive users':'Include inactive users'}
          </button>
        )}
        {hasFilters&&(
          <button onClick={()=>{setDateFilter('');setEmployeeFilter('');setBillableFilter('');setCustomStart('');setCustomEnd('')}}
            style={{background:'#252525',color:'#9ca3af',border:'none',borderRadius:'8px',padding:'8px 12px',fontSize:'13px',cursor:'pointer'}}>
            Clear filters
          </button>
        )}
      </div>

      {isTeamLead&&!isAdmin&&(
        <div style={{background:'rgba(96,165,250,0.08)',border:'1px solid rgba(96,165,250,0.2)',borderRadius:'10px',padding:'10px 16px',marginBottom:'20px'}}>
          <p style={{margin:0,fontSize:'13px',color:'#60a5fa'}}>Team Lead view — <strong>{ledProjects.join(', ')}</strong></p>
        </div>
      )}

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:'12px',marginBottom:'28px'}}>
        {kpis.map(c=>(
          <div key={c.label} style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'18px'}}>
            <div style={{fontSize:'26px',fontWeight:800,color:c.color||'#fff',lineHeight:1,marginBottom:'6px'}}>{c.value}</div>
            <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em'}}>{c.label}</div>

          </div>
        ))}
      </div>

      {/* Hours by Project - grouped with subtotals */}
      <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',marginBottom:'20px',overflow:'hidden'}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid #1e1e1e',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <h3 style={{margin:0,fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Hours by Project</h3>
          <button onClick={()=>{
            const allExpanded = projectList.every(([p])=>expandedProjects[p])
            const next = {}
            projectList.forEach(([p])=>{ next[p] = !allExpanded })
            setExpandedProjects(next)
          }} style={{background:'none',border:'none',color:'#4b5563',fontSize:'12px',cursor:'pointer'}}>
            {projectList.every(([p])=>expandedProjects[p])?'Collapse all':'Expand all'}
          </button>
        </div>
        {projectList.length===0&&<div style={{padding:'20px',color:'#4b5563',fontSize:'13px'}}>No data for this period</div>}
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#111111'}}>
              <th style={{textAlign:'left',padding:'10px 20px',fontSize:'11px',color:'#4b5563',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',borderBottom:'1px solid #1e1e1e'}}>Project / Employee</th>
              <th style={{textAlign:'right',padding:'10px 16px',fontSize:'11px',color:'#4b5563',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',borderBottom:'1px solid #1e1e1e'}}>Total</th>
              <th style={{textAlign:'right',padding:'10px 16px',fontSize:'11px',color:'#4b5563',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',borderBottom:'1px solid #1e1e1e'}}>Billable</th>
              <th style={{textAlign:'right',padding:'10px 16px',fontSize:'11px',color:'#4b5563',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',borderBottom:'1px solid #1e1e1e'}}>Non-Bill.</th>
              <th style={{textAlign:'right',padding:'10px 16px',fontSize:'11px',color:'#4b5563',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',borderBottom:'1px solid #1e1e1e'}}>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {projectList.map(([proj, data]) => {
              const isExpanded = expandedProjects[proj]
              const pct = totalHours>0?(data.total/totalHours*100):0
              // Employee breakdown for this project
              const empBreakdown = Object.entries(
                data.entries.reduce((acc,e)=>{ if(e.name) { if(!acc[e.name]) acc[e.name]={total:0,billable:0}; acc[e.name].total+=parseFloat(e.hours)||0; if(e.billable!=='no') acc[e.name].billable+=parseFloat(e.hours)||0; } return acc },{})
              ).sort((a,b)=>b[1].total-a[1].total)
              return (
                <>
                  {/* Project row */}
                  <tr key={proj} onClick={()=>toggleProject(proj)}
                    style={{cursor:'pointer',background:'#141414'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#181818'}
                    onMouseLeave={e=>e.currentTarget.style.background='#141414'}>
                    <td style={{padding:'12px 20px',borderBottom:'1px solid #1a1a1a'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <span style={{color:'#4b5563',fontSize:'12px',transition:'transform 0.15s',display:'inline-block',transform:isExpanded?'rotate(90deg)':'rotate(0deg)'}}>▶</span>
                        <span style={{fontWeight:600,color:'#fff',fontSize:'14px'}}>{proj}</span>
                        <span style={{fontSize:'11px',color:'#4b5563'}}>{data.entries.length} entr{data.entries.length===1?'y':'ies'}</span>
                      </div>
                    </td>
                    <td style={{padding:'12px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}><span style={{color:'#8DC63F',fontWeight:700,fontSize:'14px'}}>{data.total.toFixed(2)}h</span></td>
                    <td style={{padding:'12px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}><span style={{color:'#60a5fa',fontSize:'13px'}}>{data.billable.toFixed(2)}h</span></td>
                    <td style={{padding:'12px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}><span style={{color:'#9ca3af',fontSize:'13px'}}>{(data.total-data.billable).toFixed(2)}h</span></td>
                    <td style={{padding:'12px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:'8px'}}>
                        <div style={{width:'60px',background:'#252525',borderRadius:'3px',height:'4px'}}>
                          <div style={{background:'#8DC63F',borderRadius:'3px',height:'4px',width:pct+'%'}}/>
                        </div>
                        <span style={{fontSize:'12px',color:'#6b7280',minWidth:'36px',textAlign:'right'}}>{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                  {/* Employee sub-rows */}
                  {isExpanded && empBreakdown.map(([emp, empData]) => (
                    <tr key={proj+emp} style={{background:'#111111'}}>
                      <td style={{padding:'9px 20px 9px 44px',borderBottom:'1px solid #1a1a1a'}}>
                        <span style={{fontSize:'13px',color:'#9ca3af'}}>{emp}</span>
                      </td>
                      <td style={{padding:'9px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}><span style={{color:'#6b7280',fontSize:'13px'}}>{empData.total.toFixed(2)}h</span></td>
                      <td style={{padding:'9px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}><span style={{color:'#4b5563',fontSize:'12px'}}>{empData.billable.toFixed(2)}h</span></td>
                      <td style={{padding:'9px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}><span style={{color:'#4b5563',fontSize:'12px'}}>{(empData.total-empData.billable).toFixed(2)}h</span></td>
                      <td style={{padding:'9px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}>
                        <span style={{fontSize:'11px',color:'#4b5563'}}>{data.total>0?(empData.total/data.total*100).toFixed(1):0}%</span>
                      </td>
                    </tr>
                  ))}
                </>
              )
            })}
            {/* Grand total row */}
            {projectList.length>0&&(
              <tr style={{background:'#1a1a1a',borderTop:'2px solid #2a2a2a'}}>
                <td style={{padding:'14px 20px'}}><span style={{fontWeight:700,color:'#fff',fontSize:'14px'}}>Total</span></td>
                <td style={{padding:'14px 16px',textAlign:'right'}}><span style={{color:'#8DC63F',fontWeight:800,fontSize:'15px'}}>{totalHours.toFixed(2)}h</span></td>
                <td style={{padding:'14px 16px',textAlign:'right'}}><span style={{color:'#60a5fa',fontWeight:700,fontSize:'14px'}}>{billableHours.toFixed(2)}h</span></td>
                <td style={{padding:'14px 16px',textAlign:'right'}}><span style={{color:'#9ca3af',fontWeight:700,fontSize:'14px'}}>{nonBillableHours.toFixed(2)}h</span></td>
                <td style={{padding:'14px 16px',textAlign:'right'}}><span style={{color:'#6b7280',fontSize:'13px'}}>100%</span></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Hours by Employee */}
      {(isAdmin||isTeamLead)&&byEmployee.length>0&&(
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
          <h3 style={{margin:'0 0 20px',fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Hours by Employee</h3>
          {byEmployee.map(([emp,hrs])=>{
            const isInactiveEmp = [...inactiveEmails].some(email=>{const u=allUsers.find(u=>u.email===email);return u?.name===emp})
            return (
              <div key={emp} style={{marginBottom:'14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
                  <span style={{fontSize:'13px',color:isInactiveEmp?'#6b7280':'#d1d5db'}}>{emp}{isInactiveEmp&&<span style={{fontSize:'10px',color:'#4b5563',marginLeft:'6px'}}>(inactive)</span>}</span>
                  <span style={{fontSize:'13px',color:'#8DC63F',fontWeight:700}}>{hrs.toFixed(1)}h</span>
                </div>
                <div style={{background:'#252525',borderRadius:'4px',height:'5px'}}>
                  <div style={{background:isInactiveEmp?'#4b5563':'#8DC63F',borderRadius:'4px',height:'5px',width:((hrs/maxE)*100)+'%'}}/>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Monthly breakdown */}
      {Object.keys(byMonth).length>0&&(
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