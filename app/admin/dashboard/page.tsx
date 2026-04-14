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
  const hasInactiveData = entries.some(e => inactiveEmails.has(e.email))

  function getAccessibleEntries() {
    const role = currentUser.role; const email = currentUser.email
    let base = entries
    // Exclude inactive user data unless toggled on
    if (!includeInactive && inactiveEmails.size > 0) {
      base = base.filter(e => !inactiveEmails.has(e.email))
    }
    if (role === 'admin') return base
    const ledProjects = projects.filter(p=>p.teamLead===email).map(p=>p.name)
    if (ledProjects.length > 0) return base.filter(e=>e.email===email||ledProjects.includes(e.project))
    return base.filter(e=>e.email===email)
  }

  const accessibleEntries = getAccessibleEntries()
  const isAdmin = currentUser.role === 'admin'
  const ledProjects = projects.filter(p=>p.teamLead===currentUser.email).map(p=>p.name)
  const isTeamLead = ledProjects.length > 0
  const employees = (isAdmin||isTeamLead) ? [...new Set(accessibleEntries.map(e=>e.name).filter(Boolean))].sort() : []

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
  const nonBillableHours = filtered.filter(e=>e.billable==='no').reduce((s,e)=>s+(parseFloat(e.hours)||0),0)
  const uniqueProjects = [...new Set(filtered.map(e=>e.project).filter(Boolean))]
  const uniqueEmployees = [...new Set(filtered.map(e=>e.name).filter(Boolean))]
  const datesWithEntries = [...new Set(filtered.map(e=>e.date).filter(Boolean))]
  const avgPerDay = datesWithEntries.length?(totalHours/datesWithEntries.length):0

  const byProject = Object.entries(filtered.reduce((acc,e)=>{ const k=e.project||'No Project'; acc[k]=(acc[k]||0)+(parseFloat(e.hours)||0); return acc },{})).sort((a,b)=>b[1]-a[1])
  const byEmployee = Object.entries(filtered.reduce((acc,e)=>{ if(e.name) acc[e.name]=(acc[e.name]||0)+(parseFloat(e.hours)||0); return acc },{})).sort((a,b)=>b[1]-a[1])
  const byMonth = {}
  filtered.forEach(e => {
    if (!e.date) return
    const d = new Date(e.date)
    const key = d.toLocaleString('default',{month:'short',year:'numeric'})
    byMonth[key]=(byMonth[key]||0)+(parseFloat(e.hours)||0)
  })
  const maxP = byProject[0]?.[1]||1; const maxE = byEmployee[0]?.[1]||1


  function exportCSV(mode) {
    let rows, filename
    if (mode === 'project') {
      rows = [['Project','Total Hours','Billable Hours','Non-Billable Hours']]
      byProject.forEach(([proj, hrs]) => {
        const projEntries = filtered.filter(e => (e.project||'No Project') === proj)
        const bill = projEntries.filter(e=>e.billable!=='no').reduce((s,e)=>s+(parseFloat(e.hours)||0),0)
        rows.push([proj, hrs.toFixed(2), bill.toFixed(2), (hrs-bill).toFixed(2)])
      })
      filename = 'hours-by-project.csv'
    } else if (mode === 'employee') {
      rows = [['Employee','Email','Total Hours','Billable Hours','Non-Billable Hours']]
      byEmployee.forEach(([emp, hrs]) => {
        const empEntries = filtered.filter(e => e.name === emp)
        const email = empEntries[0]?.email || ''
        const bill = empEntries.filter(e=>e.billable!=='no').reduce((s,e)=>s+(parseFloat(e.hours)||0),0)
        rows.push([emp, email, hrs.toFixed(2), bill.toFixed(2), (hrs-bill).toFixed(2)])
      })
      filename = 'hours-by-employee.csv'
    } else {
      rows = [['Employee','Email','Project','Date','Hours','Billable','Description']]
      filtered.sort((a,b)=>a.date?.localeCompare(b.date)).forEach(e => {
        rows.push([e.name, e.email, e.project||'', e.date, e.hours, e.billable==='no'?'No':'Yes', e.description])
      })
      filename = 'all-entries.csv'
    }
    const csv = rows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const [showExportMenu, setShowExportMenu] = useState(false)

  const kpis = [
    { label:'Total Hours', value: loading?'…':totalHours.toFixed(1), color:'#8DC63F' },
    { label:'Billable', value: loading?'…':billableHours.toFixed(1), color:'#60a5fa' },
    { label:'Non-Billable', value: loading?'…':nonBillableHours.toFixed(1), color:'#9ca3af' },
    ...(isAdmin||isTeamLead ? [{ label:'Active Projects', value: loading?'…':uniqueProjects.length }] : []),
    ...(isAdmin||isTeamLead ? [{ label:'Employees', value: loading?'…':uniqueEmployees.length }] : []),
    { label:'Avg Hrs / Day', value: loading?'…':avgPerDay.toFixed(1) },
  ]

  const hasFilters = dateFilter||employeeFilter||billableFilter

  return (
    <div onClick={()=>showExportMenu&&setShowExportMenu(false)}>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Dashboard</h1>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>
          {isAdmin?'All team data':isTeamLead?'Your hours + projects you lead':'Your hours'}
          {includeInactive && inactiveEmails.size > 0 && <span style={{color:'#f59e0b'}}> · including inactive users</span>}
        </p>
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
        {employees.length > 0 && (
          <select value={employeeFilter} onChange={e=>setEmployeeFilter(e.target.value)} style={sel}>
            <option value="">All Employees</option>
            {employees.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
        )}
        <BillableFilter value={billableFilter} onChange={setBillableFilter}/>
        {isAdmin && hasInactiveData && (
          <button onClick={()=>setIncludeInactive(!includeInactive)}
            style={{background: includeInactive?'rgba(245,158,11,0.15)':'#1e1e1e', border: includeInactive?'1px solid rgba(245,158,11,0.4)':'1px solid #2a2a2a', color: includeInactive?'#f59e0b':'#6b7280', borderRadius:'8px', padding:'8px 14px', fontSize:'13px', fontWeight:600, cursor:'pointer'}}>
            {includeInactive ? 'Including inactive users' : 'Exclude inactive users'}
          </button>
        )}
        {hasFilters && (
          <button onClick={()=>{setDateFilter('');setEmployeeFilter('');setBillableFilter('');setCustomStart('');setCustomEnd('')}}
            style={{background:'#252525',color:'#9ca3af',border:'none',borderRadius:'8px',padding:'8px 12px',fontSize:'13px',cursor:'pointer'}}>
            Clear filters
          </button>
        )}

        {/* Export dropdown */}
        <div style={{position:'relative'}}>
          <button onClick={()=>setShowExportMenu(!showExportMenu)}
            style={{background:'#1e1e1e',border:'1px solid #2a2a2a',color:'#9ca3af',borderRadius:'8px',padding:'8px 14px',fontSize:'13px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
            Export CSV
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showExportMenu && (
            <div style={{position:'absolute',top:'calc(100% + 6px)',right:0,background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'10px',padding:'6px',zIndex:50,minWidth:'180px',boxShadow:'0 8px 24px rgba(0,0,0,0.4)'}}>
              {[
                {mode:'project', label:'By Project'},
                {mode:'employee', label:'By Employee'},
                {mode:'all', label:'All Entries (Detail)'},
              ].map(opt => (
                <button key={opt.mode} onClick={()=>{exportCSV(opt.mode);setShowExportMenu(false)}}
                  style={{display:'block',width:'100%',textAlign:'left',background:'none',border:'none',color:'#d1d5db',padding:'8px 12px',fontSize:'13px',cursor:'pointer',borderRadius:'6px'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#252525'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isTeamLead && !isAdmin && (
        <div style={{background:'rgba(96,165,250,0.08)',border:'1px solid rgba(96,165,250,0.2)',borderRadius:'10px',padding:'10px 16px',marginBottom:'20px'}}>
          <p style={{margin:0,fontSize:'13px',color:'#60a5fa'}}>Team Lead view — showing all hours for: <strong>{ledProjects.join(', ')}</strong></p>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:'12px',marginBottom:'28px'}}>
        {kpis.map(c=>(
          <div key={c.label} style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'18px'}}>
            <div style={{fontSize:'26px',fontWeight:800,color:c.color||'#fff',lineHeight:1,marginBottom:'6px'}}>{c.value}</div>
            <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em'}}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:(isAdmin||isTeamLead)?'1fr 1fr':'1fr',gap:'20px',marginBottom:'20px'}}>
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'20px'}}>
          <h3 style={{margin:'0 0 20px',fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Hours by Project</h3>
          {byProject.length===0&&<div style={{color:'#4b5563',fontSize:'13px'}}>No data for this period</div>}
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
        {(isAdmin||isTeamLead) && (
          <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'20px'}}>
            <h3 style={{margin:'0 0 20px',fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Hours by Employee</h3>
            {byEmployee.length===0&&<div style={{color:'#4b5563',fontSize:'13px'}}>No data for this period</div>}
            {byEmployee.map(([emp,hrs])=>{
              const isInactiveEmp = [...inactiveEmails].some(email => {
                const u = allUsers.find(u=>u.email===email); return u?.name===emp
              })
              return (
                <div key={emp} style={{marginBottom:'14px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
                    <span style={{fontSize:'13px',color: isInactiveEmp?'#6b7280':'#d1d5db'}}>{emp}{isInactiveEmp&&<span style={{fontSize:'10px',color:'#4b5563',marginLeft:'6px'}}>(inactive)</span>}</span>
                    <span style={{fontSize:'13px',color:'#8DC63F',fontWeight:700}}>{hrs.toFixed(1)}h</span>
                  </div>
                  <div style={{background:'#252525',borderRadius:'4px',height:'5px'}}>
                    <div style={{background: isInactiveEmp?'#4b5563':'#8DC63F',borderRadius:'4px',height:'5px',width:((hrs/maxE)*100)+'%'}}/>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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