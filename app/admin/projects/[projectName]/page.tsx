// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

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
const td = { padding:'11px 16px', fontSize:'13px', color:'#d1d5db', borderBottom:'1px solid #1a1a1a', verticalAlign:'middle' }
const th = { textAlign:'left', padding:'11px 16px', fontSize:'11px', fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.08em', background:'#111111', borderBottom:'1px solid #1e1e1e' }

function BillableFilter({ value, onChange }) {
  return (
    <div style={{display:'flex',gap:'0',borderRadius:'8px',overflow:'hidden',border:'1px solid #252525'}}>
      {[{v:'',label:'All'},{v:'yes',label:'Billable'},{v:'no',label:'Non-Billable'}].map(o => (
        <button key={o.v} onClick={()=>onChange(o.v)}
          style={{padding:'8px 14px',border:'none',fontSize:'13px',fontWeight:600,cursor:'pointer',
            background:value===o.v?'#8DC63F':'#111111',color:value===o.v?'#0a0a0a':'#6b7280'}}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function ProjectDetail() {
  const { projectName } = useParams()
  const router = useRouter()
  const name = decodeURIComponent(projectName)
  const [allEntries, setAllEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [billableFilter, setBillableFilter] = useState('')
  const [currentUser, setCurrentUser] = useState({})

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u)
    Promise.all([
      fetch('/api/time').then(r=>r.json()),
      fetch('/api/projects').then(r=>r.json())
    ]).then(([entries, projs]) => {
      setAllEntries(entries.filter(e => e.project === name))
      setProjects(projs)
      setLoading(false)
    })
  }, [name])

  // Role-based access: same logic as dashboard
  function getAccessibleEntries() {
    const role = currentUser.role
    const email = currentUser.email
    if (role === 'admin') return allEntries
    // Team lead for THIS project can see all entries
    const thisProject = projects.find(p => p.name === name)
    if (thisProject?.teamLead === email) return allEntries
    // Everyone else: own entries only
    return allEntries.filter(e => e.email === email)
  }

  const accessibleEntries = getAccessibleEntries()
  const isAdmin = currentUser.role === 'admin'
  const thisProject = projects.find(p => p.name === name)
  const isLeadForThis = thisProject?.teamLead === currentUser.email
  const canSeeAll = isAdmin || isLeadForThis

  // Only show employee filter for admin/team lead
  const employees = canSeeAll ? [...new Set(accessibleEntries.map(e=>e.name).filter(Boolean))].sort() : []

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
  const hasFilters = dateFilter||employeeFilter||billableFilter

  return (
    <div>
      <div style={{marginBottom:'24px'}}>
        <button onClick={()=>router.push('/admin/projects')} style={{background:'none',border:'none',color:'#6b7280',fontSize:'13px',cursor:'pointer',padding:0,marginBottom:'12px'}}>← Back to Projects</button>
        <h1 style={{fontSize:'24px',fontWeight:700,margin:0}}>{name}</h1>
        <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>
          {filtered.length} entries · <span style={{color:'#8DC63F',fontWeight:600}}>{totalHours.toFixed(2)} hrs</span>
          {billableFilter==='' && <span style={{color:'#6b7280'}}> · <span style={{color:'#60a5fa'}}>{billableHours.toFixed(2)} billable</span></span>}
          {!canSeeAll && <span style={{color:'#6b7280'}}> · your hours only</span>}
        </p>
      </div>

      <div style={{display:'flex',flexWrap:'wrap',gap:'10px',marginBottom:'24px',alignItems:'center'}}>
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
        {hasFilters && (
          <button onClick={()=>{setDateFilter('');setEmployeeFilter('');setBillableFilter('');setCustomStart('');setCustomEnd('')}}
            style={{background:'#252525',color:'#9ca3af',border:'none',borderRadius:'8px',padding:'8px 12px',fontSize:'13px',cursor:'pointer'}}>
            Clear
          </button>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:'12px',marginBottom:'24px'}}>
        {[
          { label:'Total Hours', value:totalHours.toFixed(2), color:'#8DC63F' },
          { label:'Billable', value:billableHours.toFixed(2), color:'#60a5fa' },
          { label:'Non-Billable', value:(totalHours-billableHours).toFixed(2), color:'#9ca3af' },
          { label:'Entries', value:filtered.length },
          ...(canSeeAll ? [{ label:'Employees', value:[...new Set(filtered.map(e=>e.name).filter(Boolean))].length }] : []),
        ].map(c=>(
          <div key={c.label} style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'10px',padding:'16px'}}>
            <div style={{fontSize:'11px',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:'6px'}}>{c.label}</div>
            <div style={{fontSize:'24px',fontWeight:700,color:c.color||'#fff'}}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Employee breakdown - only for admin/team lead */}
      {canSeeAll && filtered.length > 0 && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
          <h3 style={{margin:'0 0 16px',fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Hours by Employee</h3>
          {Object.entries(filtered.reduce((acc,e)=>{ acc[e.name]=(acc[e.name]||0)+(parseFloat(e.hours)||0); return acc },{})).sort((a,b)=>b[1]-a[1]).map(([emp,hrs])=>{
            const pct = totalHours>0?(hrs/totalHours)*100:0
            return (
              <div key={emp} style={{marginBottom:'12px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                  <span style={{fontSize:'13px',color:'#d1d5db'}}>{emp}</span>
                  <span style={{fontSize:'13px',color:'#8DC63F',fontWeight:600}}>{hrs.toFixed(2)} hrs</span>
                </div>
                <div style={{background:'#252525',borderRadius:'4px',height:'6px'}}>
                  <div style={{background:'#8DC63F',borderRadius:'4px',height:'6px',width:pct+'%'}}/>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="tbl-wrap" style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:'500px'}}>
          <thead>
            <tr>
              {canSeeAll && <th style={th}>Employee</th>}
              <th style={th}>Date</th><th style={th}>Hours</th>
              <th style={th}>Billable</th><th style={th}>Description</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={canSeeAll?5:4} style={{...td,textAlign:'center',color:'#6b7280'}}>Loading...</td></tr>}
            {!loading && filtered.length===0 && <tr><td colSpan={canSeeAll?5:4} style={{...td,textAlign:'center',color:'#6b7280'}}>No entries match these filters.</td></tr>}
            {filtered.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>(
              <tr key={e.id} onMouseEnter={ev=>ev.currentTarget.style.background='#181818'} onMouseLeave={ev=>ev.currentTarget.style.background=''}>
                {canSeeAll && <td style={td}><div style={{fontWeight:500,color:'#fff'}}>{e.name}</div><div style={{fontSize:'11px',color:'#6b7280'}}>{e.email}</div></td>}
                <td style={td}>{e.date}</td>
                <td style={td}><span style={{background:'rgba(141,198,63,0.12)',color:'#8DC63F',padding:'3px 8px',borderRadius:'6px',fontWeight:700,fontSize:'12px'}}>{e.hours}</span></td>
                <td style={td}>
                  <span style={{background:e.billable==='no'?'rgba(156,163,175,0.1)':'rgba(96,165,250,0.1)',color:e.billable==='no'?'#9ca3af':'#60a5fa',padding:'2px 8px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>
                    {e.billable==='no'?'Non-Billable':'Billable'}
                  </span>
                </td>
                <td style={td}>{e.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}