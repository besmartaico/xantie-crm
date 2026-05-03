// @ts-nocheck
'use client'
import React, { useEffect, useState } from 'react'

// Format number with commas and optional decimals
function fmt(n, decimals=1) {
  const num = parseFloat(n) || 0
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

const DATE_OPTIONS = [
  { value:'', label:'All Time' },
  { value:'this_month', label:'This Month' },
  { value:'last_month', label:'Last Month' },
  { value:'this_pay_period', label:'This Pay Period' },
  { value:'last_pay_period', label:'Last Pay Period' },
  { value:'this_quarter', label:'This Quarter' },
  { value:'this_year', label:'This Year' },
  { value:'custom', label:'Custom Range' },
]
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const PREF_KEY = (email) => 'xantie_dash_prefs_' + (email||'default')
const EXCLUDED_EMAILS = new Set(['jeff@xantie.com','mike@xantie.com','jared@xantie.com'])

function getRange(filter, start, end) {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth()
  if (filter==='this_month') return [new Date(y,m,1), new Date(y,m+1,0)]
  if (filter==='last_month') return [new Date(y,m-1,1), new Date(y,m,0)]
  if (filter==='this_quarter') { const q=Math.floor(m/3); return [new Date(y,q*3,1), new Date(y,q*3+3,0)] }
  if (filter==='this_year') return [new Date(y,0,1), new Date(y,11,31)]
  if (filter==='this_pay_period') {
    const isFirstHalf = now.getDate() <= 15
    return isFirstHalf ? [new Date(y,m,1), new Date(y,m,15)] : [new Date(y,m,16), new Date(y,m+1,0)]
  }
  if (filter==='last_pay_period') {
    const isFirstHalf = now.getDate() <= 15
    if (isFirstHalf) {
      const lm = m===0?11:m-1; const ly = m===0?y-1:y
      return [new Date(ly,lm,16), new Date(ly,lm+1,0)]
    }
    return [new Date(y,m,1), new Date(y,m,15)]
  }
  if (filter==='custom'&&start&&end) return [new Date(start), new Date(end)]
  return null
}

const selSty = { background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'8px 12px', color:'#fff', fontSize:'13px', cursor:'pointer', outline:'none' }

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

// Maximally distinct color palette
const PROJECT_COLORS = [
  '#8DC63F', // lime green
  '#e05c5c', // red
  '#60a5fa', // blue
  '#f59e0b', // amber
  '#a78bfa', // purple
  '#34d399', // emerald
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // yellow-green (distinct from lime)
  '#6366f1', // indigo
  '#14b8a6', // teal
]

function MonthLineChart({ byMonth, filtered, granularity }) {
  const [hoveredProject, setHoveredProject] = React.useState(null)
  const [tooltip, setTooltip] = React.useState(null) // {x, y, proj, hours}

  const entries = Object.entries(byMonth).sort((a,b)=>a[0].localeCompare(b[0]))
  if (!entries.length) return null

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  function monthLabel(key) {
    const parts = key.split('-')
    if (parts.length === 3) {
      // Daily: show "Mon Jan 1"
      const d = new Date(key + 'T12:00:00')
      return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]+' '+MONTH_NAMES[d.getMonth()]+' '+d.getDate()
    }
    return MONTH_NAMES[parseInt(parts[1])-1]+' '+parts[0]
  }

  const allProjects = [...new Set(filtered.map(e=>e.project).filter(Boolean))].sort()
  const projectColorMap = {}
  allProjects.forEach((p,i) => { projectColorMap[p] = PROJECT_COLORS[i % PROJECT_COLORS.length] })

  const byProjectMonth = {}
  filtered.forEach(e => {
    if (!e.date || !e.project) return
    const d = new Date(e.date)
    const key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')
    if (!byProjectMonth[e.project]) byProjectMonth[e.project] = {}
    byProjectMonth[e.project][key] = (byProjectMonth[e.project][key]||0) + (parseFloat(e.hours)||0)
  })

  const months = entries.map(([k])=>k)
  const maxVal = Math.max(...entries.map(([,v])=>v), 1)
  const W=600, H=180, padL=44, padR=16, padT=16, padB=36
  const chartW = W-padL-padR, chartH = H-padT-padB

  function xPos(i) { return padL + (months.length===1 ? chartW/2 : i/(months.length-1)*chartW) }
  function yPos(val) { return padT + chartH - (val/maxVal)*chartH }

  const stackedData = months.map((mo,i) => {
    let cum = 0
    const layers = allProjects.map(proj => {
      const val = byProjectMonth[proj]?.[mo] || 0
      const base = cum; cum += val
      return { proj, val, base, top: cum }
    })
    return { mo, i, total: cum, layers }
  })

  const grids = Array.from({length:5},(_,i)=>({ y:padT+(i/4)*chartH, val:maxVal*(1-i/4) }))

  function buildPolygon(proj) {
    const top = stackedData.map(d => { const l=d.layers.find(l=>l.proj===proj); return [xPos(d.i), yPos(l?l.top:0)] })
    const bot = [...stackedData].reverse().map(d => { const l=d.layers.find(l=>l.proj===proj); return [xPos(d.i), yPos(l?l.base:0)] })
    return [...top,...bot].map(([x,y])=>x+','+y).join(' ')
  }

  const totalPts = stackedData.map(d=>[xPos(d.i), yPos(d.total)])

  // SVG coordinate conversion for mouse events
  function svgCoords(e, svgEl) {
    const rect = svgEl.getBoundingClientRect()
    const scaleX = 600 / rect.width
    const scaleY = 180 / rect.height
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY]
  }

  function handleSvgMouseMove(e) {
    const svg = e.currentTarget
    const [mx, my] = svgCoords(e, svg)
    // Find which month column we're closest to
    let closestI = 0, closestDist = Infinity
    months.forEach((mo,i) => { const d=Math.abs(xPos(i)-mx); if(d<closestDist){closestDist=d;closestI=i} })
    if (closestDist > 30) { setTooltip(null); return }
    // Find which project layer we're in at this x
    const sd = stackedData[closestI]
    let foundProj = null, foundHours = 0
    for (const layer of [...sd.layers].reverse()) {
      if (my >= yPos(layer.top) && my <= yPos(layer.base) && layer.val > 0) {
        foundProj = layer.proj; foundHours = layer.val; break
      }
    }
    if (foundProj) {
      setTooltip({ x: xPos(closestI), y: yPos(sd.layers.find(l=>l.proj===foundProj)?.top||0) - 8, proj: foundProj, hours: foundHours, month: monthLabel(sd.mo) })
    } else {
      setTooltip(null)
    }
  }

  return (
    <div>
      <div style={{overflowX:'auto',position:'relative'}}>
        <svg viewBox="0 0 600 180" style={{width:'100%',minWidth:'300px',display:'block',cursor:'crosshair'}}
          onMouseMove={handleSvgMouseMove} onMouseLeave={()=>setTooltip(null)}>
          {grids.map((g,i)=>(
            <g key={i}>
              <line x1={padL} y1={g.y} x2={W-padR} y2={g.y} stroke="#1e1e1e" strokeWidth="1"/>
              <text x={padL-6} y={g.y+4} textAnchor="end" fontSize="9" fill="#4b5563">{g.val>0?fmt(g.val, 0):''}</text>
            </g>
          ))}
          {allProjects.map(proj => {
            const isHovered = hoveredProject === proj
            const isDimmed = hoveredProject && hoveredProject !== proj
            return (
              <polygon key={proj} points={buildPolygon(proj)}
                fill={projectColorMap[proj]}
                opacity={isDimmed ? 0.1 : isHovered ? 0.95 : 0.75}
                style={{transition:'opacity 0.15s', cursor:'pointer'}}/>
            )
          })}
          <polyline points={totalPts.map(([x,y])=>x+','+y).join(' ')}
            fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
          {stackedData.map((d,i)=>(
            <g key={i}>
              <circle cx={xPos(i)} cy={yPos(d.total)} r="3" fill="#fff" stroke="#141414" strokeWidth="1.5"/>
              <text x={xPos(i)} y={yPos(d.total)-8} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="700">{fmt(d.total, 1)}</text>
              <text x={xPos(i)} y={H-8} textAnchor="middle" fontSize="9" fill="#6b7280">{monthLabel(d.mo)}</text>
            </g>
          ))}
          {/* Tooltip */}
          {tooltip && (
            <g>
              <rect x={tooltip.x-50} y={tooltip.y-28} width="100" height="26" rx="5"
                fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1"/>
              <text x={tooltip.x} y={tooltip.y-16} textAnchor="middle" fontSize="9" fill="#8DC63F" fontWeight="700">{tooltip.proj}</text>
              <text x={tooltip.x} y={tooltip.y-7} textAnchor="middle" fontSize="8" fill="#9ca3af">{fmt(tooltip.hours, 1)}h · {tooltip.month}</text>
            </g>
          )}
        </svg>
      </div>
      {/* Legend with hover interaction */}
      {allProjects.length > 0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginTop:'14px'}}>
          {allProjects.map(proj=>{
            const isDimmed = hoveredProject && hoveredProject !== proj
            const isActive = hoveredProject === proj
            return (
              <div key={proj}
                onMouseEnter={()=>setHoveredProject(proj)}
                onMouseLeave={()=>setHoveredProject(null)}
                style={{display:'flex',alignItems:'center',gap:'5px',cursor:'pointer',
                  opacity: isDimmed ? 0.25 : 1,
                  background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                  borderRadius:'5px', padding:'3px 7px',
                  border: isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                  transition:'all 0.15s'}}>
                <div style={{width:'10px',height:'10px',borderRadius:'2px',background:projectColorMap[proj],flexShrink:0}}/>
                <span style={{fontSize:'11px',color: isDimmed?'#4b5563':'#9ca3af'}}>{proj}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


export default function Dashboard() {
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState({})
  const [expandedProjects, setExpandedProjects] = useState({})

  // Filters — loaded from localStorage per user
  const [dateFilter, setDateFilter] = useState('this_month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [billableFilter, setBillableFilter] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u)
    // Load saved prefs
    try {
      const saved = localStorage.getItem(PREF_KEY(u.email))
      if (saved) {
        const p = JSON.parse(saved)
        if (p.dateFilter !== undefined) setDateFilter(p.dateFilter)
        if (p.customStart !== undefined) setCustomStart(p.customStart)
        if (p.customEnd !== undefined) setCustomEnd(p.customEnd)
        if (p.employeeFilter !== undefined) setEmployeeFilter(p.employeeFilter)
        if (p.billableFilter !== undefined) setBillableFilter(p.billableFilter)
        if (p.includeInactive !== undefined) setIncludeInactive(p.includeInactive)
      }
    } catch(e) {}
    setPrefsLoaded(true)
    Promise.all([
      fetch('/api/time').then(r=>r.json()),
      fetch('/api/projects').then(r=>r.json()),
      fetch('/api/users').then(r=>r.json()),
    ]).then(([e,p,u]) => { setEntries(e||[]); setProjects(p||[]); setAllUsers(u||[]); setLoading(false) })
  }, [])

  // Persist prefs whenever they change
  useEffect(() => {
    if (!prefsLoaded) return
    try {
      const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
      if (!u.email) return
      localStorage.setItem(PREF_KEY(u.email), JSON.stringify({ dateFilter, customStart, customEnd, employeeFilter, billableFilter, includeInactive }))
    } catch(e) {}
  }, [dateFilter, customStart, customEnd, employeeFilter, billableFilter, includeInactive, prefsLoaded])

  const inactiveEmails = new Set(allUsers.filter(u=>u.status==='inactive').map(u=>u.email))
  const hasInactiveData = entries.some(e=>inactiveEmails.has(e.email))
  const isAdmin = currentUser.role==='admin'
  const isViewer = currentUser.role==='viewer'
  const ledProjects = projects.filter(p=>p.teamLead===currentUser.email).map(p=>p.name)
  const isTeamLead = ledProjects.length>0

  function getAccessibleEntries() {
    let base = entries
    if (!includeInactive) base = base.filter(e=>!inactiveEmails.has(e.email))
    if (isAdmin || isViewer) return base
    if (isTeamLead) return base.filter(e=>e.email===currentUser.email||ledProjects.includes(e.project))
    return base.filter(e=>e.email===currentUser.email)
  }

  const accessibleEntries = getAccessibleEntries()
  const employees = (isAdmin||isViewer||isTeamLead) ? [...new Set(accessibleEntries.map(e=>e.name).filter(Boolean))].sort() : []

  function applyFilters(data) {
    let out = data
    if (employeeFilter) out = out.filter(e=>e.name===employeeFilter)
    if (billableFilter) out = out.filter(e=>e.billable===billableFilter)
    const range = getRange(dateFilter, customStart, customEnd)
    if (range) out = out.filter(e=>{ const d=new Date(e.date); return d>=range[0]&&d<=range[1] })
    return out
  }

  const filtered = applyFilters(accessibleEntries)
  function exportCSV() {
    const headers = ['Name','Email','Date','Hours','Description','Client','Project','Billable']
    const rows = filtered.map(e => [
      e.name, e.email, e.date, e.hours, e.description,
      e.project, e.subProject||'N/A', e.billable==='no'?'Non-Billable':'Billable'
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(val => '"'+(String(val||'').replace(/"/g,'""'))+'"').join(','))
      .join('\n')
    const blob = new Blob([csv], { type:'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // Build filename from active filters
    const parts = ['xantie-timesheet']
    if (dateFilter) parts.push(dateFilter.replace(/_/g,'-'))
    if (employeeFilter) parts.push(employeeFilter.replace(/\s+/g,'-').toLowerCase())
    a.download = parts.join('_') + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalHours = filtered.reduce((s,e)=>s+(parseFloat(e.hours)||0),0)
  const billableHours = filtered.filter(e=>e.billable!=='no').reduce((s,e)=>s+(parseFloat(e.hours)||0),0)
  const nonBillableHours = totalHours - billableHours
  const datesWithEntries = [...new Set(filtered.map(e=>e.date).filter(Boolean))]
  const avgPerDay = datesWithEntries.length ? totalHours/datesWithEntries.length : 0

  // Active in last 30 days
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate()-30)
  const recentEntries = accessibleEntries.filter(e=>e.date&&new Date(e.date)>=thirtyDaysAgo)
  const activeEmployees30 = new Set(recentEntries.map(e=>e.email).filter(e=>e&&!EXCLUDED_EMAILS.has(e.toLowerCase()))).size
  const activeProjects30 = new Set(recentEntries.map(e=>e.project).filter(Boolean)).size

  const kpis = [
    { label:'Total Hours', value: loading?'…':fmt(totalHours, 1), color:'#8DC63F' },
    { label:'Billable', value: loading?'…':fmt(billableHours, 1), color:'#60a5fa' },
    { label:'Non-Billable', value: loading?'…':fmt(nonBillableHours, 1), color:'#9ca3af' },
    { label:'Avg Hrs / Day', value: loading?'…':fmt(avgPerDay, 1) },
    ...(isAdmin||isTeamLead ? [
      { label:'Active Employees', value: loading?'…':activeEmployees30, color:'#a78bfa' },
      { label:'Active Projects', value: loading?'…':activeProjects30, color:'#f59e0b' },
    ] : []),
  ]

  // By project with employee breakdown
  const byProject = {}
  filtered.forEach(e => {
    const k = e.project||'(No Project)'
    if (!byProject[k]) byProject[k] = { entries:[], total:0, billable:0 }
    byProject[k].entries.push(e)
    byProject[k].total += parseFloat(e.hours)||0
    if (e.billable!=='no') byProject[k].billable += parseFloat(e.hours)||0
  })
  const projectList = Object.entries(byProject).sort((a,b)=>b[1].total-a[1].total)

  // By employee (active only)
  const byEmployee = Object.entries(
    filtered.reduce((acc,e)=>{
      if (e.name && !inactiveEmails.has(e.email)) acc[e.name]=(acc[e.name]||0)+(parseFloat(e.hours)||0)
      return acc
    },{})
  ).sort((a,b)=>b[1]-a[1])
  const maxE = byEmployee[0]?.[1]||1

  // Smart grouping: daily for short ranges, weekly for month view, monthly for longer
  const useDaily = ['this_month','last_month','this_pay_period','last_pay_period'].includes(dateFilter)
  const useWeekly = false // future option
  
  const byMonth = {}
  filtered.forEach(e => {
    if (!e.date) return
    const d = new Date(e.date + 'T12:00:00')
    let key
    if (useDaily) {
      key = e.date // YYYY-MM-DD
    } else {
      key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')
    }
    byMonth[key] = (byMonth[key]||0) + (parseFloat(e.hours)||0)
  })
  const chartGranularity = useDaily ? 'day' : 'month'

  const hasFilters = dateFilter||employeeFilter||billableFilter

  return (
    <div>
      <div style={{marginBottom:'24px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:'12px'}}>
          <div>
            <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Dashboard</h1>
            <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>
          {isAdmin?'All team data':isViewer?'Read-only · All team data':isTeamLead?'Your hours + projects you lead':'Your hours'}
        </p>
          </div>
          <button onClick={exportCSV} disabled={loading||filtered.length===0}
            style={{background:filtered.length===0?'#1e1e1e':'#1e1e1e',border:'1px solid '+(filtered.length===0?'#252525':'#8DC63F'),color:filtered.length===0?'#3a3a3a':'#8DC63F',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontWeight:700,cursor:filtered.length===0?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:'6px',flexShrink:0,transition:'all 0.15s'}}>
            ↓ Export CSV {filtered.length>0&&<span style={{fontSize:'11px',color:'inherit',opacity:0.7}}>({filtered.length} rows)</span>}
          </button>
        </div>

      {/* Filters */}
      <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'20px',alignItems:'center'}}>
        <select value={dateFilter} onChange={e=>setDateFilter(e.target.value)} style={selSty}>
          {DATE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {dateFilter==='custom'&&(
          <>
            <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{...selSty,colorScheme:'dark'}}/>
            <span style={{color:'#6b7280',fontSize:'13px'}}>to</span>
            <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{...selSty,colorScheme:'dark'}}/>
          </>
        )}
        {employees.length>0&&(
          <select value={employeeFilter} onChange={e=>setEmployeeFilter(e.target.value)} style={selSty}>
            <option value="">All Employees</option>
            {employees.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
        )}
        <BillableFilter value={billableFilter} onChange={setBillableFilter}/>
        {isAdmin&&hasInactiveData&&(
          <button onClick={()=>setIncludeInactive(!includeInactive)}
            style={{background:includeInactive?'rgba(245,158,11,0.15)':'#1e1e1e',border:includeInactive?'1px solid rgba(245,158,11,0.4)':'1px solid #2a2a2a',color:includeInactive?'#f59e0b':'#6b7280',borderRadius:'8px',padding:'8px 14px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
            {includeInactive?'Including inactive':'Include inactive'}
          </button>
        )}
        {hasFilters&&(
          <button onClick={()=>{setDateFilter('');setEmployeeFilter('');setBillableFilter('');setCustomStart('');setCustomEnd('')}}
            style={{background:'#252525',color:'#9ca3af',border:'none',borderRadius:'8px',padding:'8px 12px',fontSize:'13px',cursor:'pointer'}}>
            Clear filters
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className='kpi-grid' style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:'10px',marginBottom:'24px'}}>
        {kpis.map(c=>(
          <div key={c.label} style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'16px'}}>
            <div style={{fontSize:'26px',fontWeight:800,color:c.color||'#fff',lineHeight:1,marginBottom:'6px'}}>{c.value}</div>
            <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em'}}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Hours by Project */}
      <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',marginBottom:'20px',overflow:'hidden'}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid #1e1e1e',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <h3 style={{margin:0,fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Hours by Project</h3>
          {projectList.length>0&&(
            <button onClick={()=>{
              const allExp = projectList.every(([p])=>expandedProjects[p])
              const next={}; projectList.forEach(([p])=>{next[p]=!allExp}); setExpandedProjects(next)
            }} style={{background:'none',border:'none',color:'#4b5563',fontSize:'12px',cursor:'pointer'}}>
              {projectList.every(([p])=>expandedProjects[p])?'Collapse all':'Expand all'}
            </button>
          )}
        </div>
        {projectList.length===0&&<div style={{padding:'20px',color:'#4b5563',fontSize:'13px'}}>No data for this period</div>}
        {projectList.length>0&&(
          <div className='mobile-table-scroll'><table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#111111'}}>
                {['Project / Employee','Total','Billable','Non-Bill.','% of Total'].map(h=>(
                  <th key={h} style={{textAlign:h==='Project / Employee'?'left':'right',padding:'10px 16px',fontSize:'11px',color:'#4b5563',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',borderBottom:'1px solid #1e1e1e',whiteSpace:'nowrap'}}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projectList.map(([proj,data])=>{
                const isExp = expandedProjects[proj]
                const pct = totalHours>0?(data.total/totalHours*100):0
                const empBreakdown = Object.entries(
                  data.entries.reduce((acc,e)=>{
                    if(e.name&&!inactiveEmails.has(e.email)){
                      if(!acc[e.name]) acc[e.name]={total:0,billable:0}
                      acc[e.name].total+=parseFloat(e.hours)||0
                      if(e.billable!=='no') acc[e.name].billable+=parseFloat(e.hours)||0
                    }
                    return acc
                  },{})
                ).sort((a,b)=>b[1].total-a[1].total)
                return (
                  <React.Fragment key={proj}>
                    <tr onClick={()=>setExpandedProjects(p=>({...p,[proj]:!p[proj]}))} style={{cursor:'pointer',background:'#141414'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#181818'} onMouseLeave={e=>e.currentTarget.style.background='#141414'}>
                      <td style={{padding:'12px 20px',borderBottom:'1px solid #1a1a1a'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                          <span style={{color:'#4b5563',fontSize:'11px',display:'inline-block',transform:isExp?'rotate(90deg)':'rotate(0deg)',transition:'transform 0.15s'}}>▶</span>
                          <span style={{fontWeight:600,color:'#fff',fontSize:'14px'}}>{proj}</span>
                          <span style={{fontSize:'11px',color:'#4b5563'}}>{data.entries.length} entr{data.entries.length===1?'y':'ies'}</span>
                        </div>
                      </td>
                      <td style={{padding:'12px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}><span style={{color:'#8DC63F',fontWeight:700}}>{fmt(data.total, 2)}h</span></td>
                      <td style={{padding:'12px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}><span style={{color:'#60a5fa',fontSize:'13px'}}>{fmt(data.billable, 2)}h</span></td>
                      <td style={{padding:'12px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}><span style={{color:'#9ca3af',fontSize:'13px'}}>{fmt(data.total-data.billable, 2)}h</span></td>
                      <td style={{padding:'12px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:'8px'}}>
                          <div style={{width:'60px',background:'#252525',borderRadius:'3px',height:'4px'}}>
                            <div style={{background:'#8DC63F',borderRadius:'3px',height:'4px',width:pct+'%'}}/>
                          </div>
                          <span style={{fontSize:'12px',color:'#6b7280',minWidth:'36px',textAlign:'right'}}>{fmt(pct, 1)}%</span>
                        </div>
                      </td>
                    </tr>
                    {isExp&&empBreakdown.map(([emp,d])=>(
                      <tr key={proj+emp} style={{background:'#111111'}}>
                        <td style={{padding:'9px 20px 9px 48px',borderBottom:'1px solid #1a1a1a'}}><span style={{fontSize:'13px',color:'#9ca3af'}}>{emp}</span></td>
                        <td style={{padding:'9px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}><span style={{color:'#6b7280',fontSize:'13px'}}>{fmt(d.total, 2)}h</span></td>
                        <td style={{padding:'9px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}><span style={{color:'#4b5563',fontSize:'12px'}}>{fmt(d.billable, 2)}h</span></td>
                        <td style={{padding:'9px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}><span style={{color:'#4b5563',fontSize:'12px'}}>{fmt(d.total-d.billable, 2)}h</span></td>
                        <td style={{padding:'9px 16px',textAlign:'right',borderBottom:'1px solid #1a1a1a'}}><span style={{fontSize:'11px',color:'#4b5563'}}>{data.total>0?fmt(d.total/data.total*100, 1):0}%</span></td>
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}
              <tr style={{background:'#1a1a1a',borderTop:'2px solid #2a2a2a'}}>
                <td style={{padding:'14px 20px'}}><span style={{fontWeight:700,color:'#fff',fontSize:'14px'}}>Total</span></td>
                <td style={{padding:'14px 16px',textAlign:'right'}}><span style={{color:'#8DC63F',fontWeight:800,fontSize:'15px'}}>{fmt(totalHours, 2)}h</span></td>
                <td style={{padding:'14px 16px',textAlign:'right'}}><span style={{color:'#60a5fa',fontWeight:700}}>{fmt(billableHours, 2)}h</span></td>
                <td style={{padding:'14px 16px',textAlign:'right'}}><span style={{color:'#9ca3af',fontWeight:700}}>{fmt(nonBillableHours, 2)}h</span></td>
                <td style={{padding:'14px 16px',textAlign:'right'}}><span style={{color:'#6b7280',fontSize:'13px'}}>100%</span></td>
              </tr>
            </tbody>
          </table></div>
        )}
      </div>

      {/* Hours by Employee */}
      {(isAdmin||isViewer||isTeamLead)&&byEmployee.length>0&&(
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
          <h3 style={{margin:'0 0 20px',fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Hours by Employee</h3>
          {byEmployee.map(([emp,hrs])=>(
            <div key={emp} style={{marginBottom:'14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
                <span style={{fontSize:'13px',color:'#d1d5db'}}>{emp}</span>
                <span style={{fontSize:'13px',color:'#8DC63F',fontWeight:700}}>{fmt(hrs, 1)}h</span>
              </div>
              <div style={{background:'#252525',borderRadius:'4px',height:'5px'}}>
                <div style={{background:'#8DC63F',borderRadius:'4px',height:'5px',width:((hrs/maxE)*100)+'%'}}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hours by Month — line chart */}
      {Object.keys(byMonth).length>0&&(
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'20px'}}>
          <h3 style={{margin:'0 0 20px',fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Hours by Month</h3>
          <MonthLineChart byMonth={byMonth} filtered={filtered} granularity={chartGranularity}/>
        </div>
      )}
    </div>
  )
}