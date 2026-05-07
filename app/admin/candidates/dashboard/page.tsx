// @ts-nocheck
'use client'
import { useEffect, useState, useRef } from 'react'

const inp = { width:'100%', background:'#111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'14px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }

const HIRE_OPTIONS = ['No','Potential','Yes','Hired']
const EXP_BUCKETS = [
  { label:'All', test: () => true },
  { label:'0–3 yrs', test: y => y >= 0 && y <= 3 },
  { label:'3–5 yrs', test: y => y > 3 && y <= 5 },
  { label:'5–10 yrs', test: y => y > 5 && y <= 10 },
  { label:'10+ yrs', test: y => y > 10 },
]

const SKILLS = [
  'SQL','Power BI','Tableau','Python','Snowflake','SSIS','Data Modeling',
  'Data Factory','Databricks','Azure','AWS','Spark','ETL','Airflow','Kimball',
  'Pyspark','Java','JavaScript','Looker','Domo','Redshift','dbt','R','SAS',
  'Power Query','Synapse','Glue','Terraform'
]

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$' + '&')
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { year:'numeric', month:'2-digit', day:'2-digit' }).replace(/\//g,'-')
}

function parseSalary(s) {
  if (!s) return null
  const str = String(s).replace(/,/g,'').toLowerCase()
  const m = str.match(/(\d+(?:\.\d+)?)\s*([km])?/)
  if (!m) return null
  let n = parseFloat(m[1])
  const suffix = m[2]
  if (suffix === 'k') n *= 1000
  else if (suffix === 'm') n *= 1000000
  else if (n < 1000) n *= 1000
  return n
}

function fmtMoney(n) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (n >= 1000) return '$' + Math.round(n).toLocaleString('en-US')
  return '$' + n
}

function MultiSelect({ label, options, selected, onChange, allLabel='All' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  function toggle(opt) {
    if (selected.includes(opt)) onChange(selected.filter(x => x !== opt))
    else onChange([...selected, opt])
  }
  let display = allLabel
  if (selected.length > 0 && selected.length < options.length) display = selected.join(', ')
  return (
    <div ref={ref} style={{position:'relative'}}>
      <label style={lbl}>{label}</label>
      <button type="button" onClick={()=>setOpen(!open)}
        style={{...inp, display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', textAlign:'left'}}>
        <span style={{color: selected.length === 0 || selected.length === options.length ? '#9ca3af' : '#fff'}}>{display}</span>
        <span style={{color:'#6b7280', marginLeft:'8px', fontSize:'10px'}}>▼</span>
      </button>
      {open && (
        <div style={{position:'absolute', top:'100%', left:0, right:0, marginTop:'4px', background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:'8px', zIndex:50, overflow:'hidden'}}>
          {options.map(opt => {
            const checked = selected.includes(opt)
            return (
              <div key={opt} onClick={()=>toggle(opt)}
                style={{padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px', fontSize:'13px', color:checked?'#fff':'#9ca3af', background:checked?'rgba(141,198,63,0.06)':'transparent'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(141,198,63,0.10)'}
                onMouseLeave={e=>e.currentTarget.style.background=checked?'rgba(141,198,63,0.06)':'transparent'}>
                <span style={{width:'14px',height:'14px',border:'1px solid '+(checked?'#8DC63F':'#3a3a3a'),borderRadius:'3px',display:'flex',alignItems:'center',justifyContent:'center',background:checked?'#8DC63F':'transparent',flexShrink:0}}>
                  {checked && <span style={{color:'#0a0a0a',fontSize:'10px',fontWeight:900,lineHeight:1}}>✓</span>}
                </span>
                {opt}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const th = { padding:'12px 14px', textAlign:'left', fontSize:'11px', color:'#6b7280', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap', background:'#0f0f0f' }
const td = { padding:'10px 14px', fontSize:'13px', color:'#d1d5db', verticalAlign:'top' }

function ScatterChart({ points, salaryMin, salaryMax, yearsMax, selectedId, onClickPoint }) {
  const W = 520, H = 280, PADL = 44, PADB = 36, PADT = 12, PADR = 12
  const innerW = W - PADL - PADR, innerH = H - PADT - PADB
  function xPos(s) { return PADL + ((s - salaryMin) / (salaryMax - salaryMin)) * innerW }
  function yPos(y) { return PADT + innerH - (y / yearsMax) * innerH }
  const xTicks = []
  for (let v = salaryMin; v <= salaryMax; v += 20000) xTicks.push(v)
  const yTicks = []
  for (let v = 0; v <= yearsMax; v += 5) yTicks.push(v)
  const fmtTickK = v => '$' + Math.round(v / 1000) + 'K'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto'}}>
      {xTicks.map(v => <line key={'gx'+v} x1={xPos(v)} y1={PADT} x2={xPos(v)} y2={PADT+innerH} stroke="#1a1a1a" strokeDasharray="2,3"/>)}
      {yTicks.map(v => <line key={'gy'+v} x1={PADL} y1={yPos(v)} x2={PADL+innerW} y2={yPos(v)} stroke="#1a1a1a" strokeDasharray="2,3"/>)}
      <line x1={PADL} y1={PADT+innerH} x2={PADL+innerW} y2={PADT+innerH} stroke="#2a2a2a"/>
      <line x1={PADL} y1={PADT} x2={PADL} y2={PADT+innerH} stroke="#2a2a2a"/>
      {xTicks.map(v => <text key={'tx'+v} x={xPos(v)} y={PADT+innerH+18} fill="#6b7280" fontSize="10" textAnchor="middle">{fmtTickK(v)}</text>)}
      {yTicks.map(v => <text key={'ty'+v} x={PADL-6} y={yPos(v)+3} fill="#6b7280" fontSize="10" textAnchor="end">{v}</text>)}
      <text x={PADL+innerW/2} y={H-4} fill="#9ca3af" fontSize="11" textAnchor="middle">Salary</text>
      <text x={10} y={PADT+innerH/2} fill="#9ca3af" fontSize="11" textAnchor="middle" transform={`rotate(-90 10 ${PADT+innerH/2})`}>Years Experience</text>
      {points.map((p, i) => {
        const isSel = selectedId === p.id
        return (
          <g key={p.id || i} onClick={()=>onClickPoint && onClickPoint(p.id)} style={{cursor:'pointer'}}>
            <circle cx={xPos(p.salary)} cy={yPos(p.years)} r={isSel?9:6}
              fill={isSel?'#fff':'#8DC63F'} fillOpacity={isSel?1:0.7}
              stroke="#8DC63F" strokeWidth={isSel?2.5:1}>
              <title>{p.name + ' — ' + p.years + ' yrs · ' + fmtMoney(p.salary)}</title>
            </circle>
          </g>
        )
      })}
    </svg>
  )
}

export default function CandidateDashboard() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [hireFilter, setHireFilter] = useState(['Yes'])
  const [expBucket, setExpBucket] = useState('All')
  const [skillFilter, setSkillFilter] = useState(null)
  const [candidateFilter, setCandidateFilter] = useState(null)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    if (u.role !== 'admin') {
      window.location.href = '/admin/dashboard'
      return
    }
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await (await fetch('/api/candidates')).json()
      setCandidates(data || [])
    } catch(e) {}
    setLoading(false)
  }

  function candidateHasSkill(cand, skill) {
    if (!skill) return true
    const pat = '(?:^|[^a-z])' + escapeRegex(skill) + '(?:[^a-z]|' + '$' + ')'
    const re = new RegExp(pat, 'i')
    return re.test((cand.skillset||'') + ' ' + (cand.notes||''))
  }

  const expTest = EXP_BUCKETS.find(b => b.label === expBucket)?.test || (() => true)

  // Base set: top filters applied
  const base = candidates.filter(c => {
    if (hireFilter.length > 0 && !hireFilter.includes(c.wouldHire)) return false
    const yrs = parseFloat(c.experienceYears) || 0
    if (!expTest(yrs)) return false
    return true
  })

  // Final filtered: also apply cross-filters from charts
  const filtered = base.filter(c => {
    if (skillFilter && !candidateHasSkill(c, skillFilter)) return false
    if (candidateFilter && c.id !== candidateFilter) return false
    return true
  })

  // Skill counts: when a candidate is selected, count from just that one;
  // otherwise count from base (so clicking a skill doesn't collapse the chart)
  const skillSource = candidateFilter ? filtered : base
  const skillCounts = SKILLS.map(skill => {
    const count = skillSource.filter(c => candidateHasSkill(c, skill)).length
    return { skill, count }
  }).filter(x => x.count > 0).sort((a,b) => b.count - a.count).slice(0, 10)
  const maxSkillCount = Math.max(1, ...skillCounts.map(s => s.count))

  // Scatter source: when a skill is selected, show only matching candidates;
  // otherwise show all base candidates
  const scatterSource = skillFilter ? base.filter(c => candidateHasSkill(c, skillFilter)) : base
  const scatter = scatterSource.map(c => ({
    id: c.id,
    name: c.name,
    salary: parseSalary(c.salaryRequirement),
    years: parseFloat(c.experienceYears) || 0
  })).filter(p => p.salary !== null && p.years > 0)

  let salaryMin = scatter.length ? Math.min(...scatter.map(p => p.salary)) : 0
  let salaryMax = scatter.length ? Math.max(...scatter.map(p => p.salary)) : 200000
  salaryMin = Math.floor(salaryMin / 20000) * 20000
  salaryMax = Math.ceil(salaryMax / 20000) * 20000
  if (salaryMax === salaryMin) salaryMax = salaryMin + 20000
  const yearsMax = Math.max(10, Math.ceil((scatter.length ? Math.max(...scatter.map(p => p.years)) : 10) / 5) * 5)

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'18px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Candidates Dashboard</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Filter and analyze the recruiting pipeline · {filtered.length} of {candidates.length}</p>
        </div>
        <a href="/admin/candidates" style={{background:'#1e1e1e',color:'#9ca3af',border:'1px solid #252525',borderRadius:'8px',padding:'9px 14px',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>← Back to Candidates</a>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'12px',marginBottom:'20px',maxWidth:'640px'}}>
        <MultiSelect label="Would Hire" options={HIRE_OPTIONS} selected={hireFilter} onChange={setHireFilter} allLabel="All"/>
        <div>
          <label style={lbl}>Years of Experience</label>
          <select value={expBucket} onChange={e=>setExpBucket(e.target.value)} style={{...inp, cursor:'pointer'}}>
            {EXP_BUCKETS.map(b => <option key={b.label} value={b.label}>{b.label}</option>)}
          </select>
        </div>
      </div>

      {(skillFilter || candidateFilter) && (
        <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'14px',flexWrap:'wrap'}}>
          {skillFilter && (
            <span style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'rgba(141,198,63,0.10)',border:'1px solid rgba(141,198,63,0.3)',color:'#8DC63F',borderRadius:'8px',padding:'5px 10px',fontSize:'12px',fontWeight:600}}>
              Skill: {skillFilter}
              <button onClick={()=>setSkillFilter(null)} style={{background:'none',border:'none',color:'#8DC63F',cursor:'pointer',padding:0,fontSize:'14px',lineHeight:1}}>✕</button>
            </span>
          )}
          {candidateFilter && (
            <span style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'rgba(141,198,63,0.10)',border:'1px solid rgba(141,198,63,0.3)',color:'#8DC63F',borderRadius:'8px',padding:'5px 10px',fontSize:'12px',fontWeight:600}}>
              Candidate: {(candidates.find(x=>x.id===candidateFilter)||{}).name||candidateFilter}
              <button onClick={()=>setCandidateFilter(null)} style={{background:'none',border:'none',color:'#8DC63F',cursor:'pointer',padding:0,fontSize:'14px',lineHeight:1}}>✕</button>
            </span>
          )}
          <button onClick={()=>{setSkillFilter(null);setCandidateFilter(null)}}
            style={{background:'transparent',border:'1px solid #2a2a2a',color:'#9ca3af',borderRadius:'8px',padding:'5px 10px',fontSize:'12px',cursor:'pointer'}}>
            Clear chart filters
          </button>
        </div>
      )}

      {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>}

      {!loading && (
        <>
          <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',overflow:'hidden',marginBottom:'24px'}}>
            <div style={{overflow:'auto', maxHeight:'380px'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:'960px'}}>
                <thead style={{position:'sticky',top:0,zIndex:1}}>
                  <tr style={{borderBottom:'1px solid #1e1e1e'}}>
                    <th style={th}>Name</th>
                    <th style={th}>Notes</th>
                    <th style={{...th,textAlign:'right'}}>Salary</th>
                    <th style={{...th,textAlign:'right'}}>YearsOfExperience</th>
                    <th style={th}>ContactLocation</th>
                    <th style={th}>DateInterviewed</th>
                    <th style={{...th,textAlign:'center'}}>LinkedIn</th>
                    <th style={{...th,textAlign:'center'}}>Resume</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{textAlign:'center',padding:'32px',color:'#6b7280',fontSize:'13px'}}>No candidates match the current filters</td></tr>
                  )}
                  {filtered.map(c => {
                    const sal = parseSalary(c.salaryRequirement)
                    return (
                      <tr key={c.id} style={{borderBottom:'1px solid #1a1a1a'}}>
                        <td style={td}>{c.name}</td>
                        <td style={{...td,maxWidth:'420px',whiteSpace:'normal',color:'#9ca3af',fontSize:'12px'}}>{c.notes||''}</td>
                        <td style={{...td,textAlign:'right'}}>{fmtMoney(sal)}</td>
                        <td style={{...td,textAlign:'right'}}>{c.experienceYears||''}</td>
                        <td style={td}>{c.location||''}</td>
                        <td style={td}>{fmtDate(c.dateInterviewed)}</td>
                        <td style={{...td,textAlign:'center'}}>{c.linkedin?<a href={c.linkedin} target="_blank" rel="noopener" style={{color:'#60a5fa',textDecoration:'none'}}>🔗</a>:''}</td>
                        <td style={{...td,textAlign:'center'}}>{c.resume?<a href={c.resume} target="_blank" rel="noopener" style={{color:'#60a5fa',textDecoration:'none'}}>📄</a>:''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(360px,1fr))',gap:'16px'}}>
            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'18px'}}>
              <h3 style={{fontSize:'14px',fontWeight:700,margin:'0 0 14px',color:'#fff'}}>Technical Experience</h3>
              {skillCounts.length === 0 && <div style={{color:'#6b7280',fontSize:'13px',padding:'24px 0',textAlign:'center'}}>No skills detected in current results</div>}
              {skillCounts.map(s => {
                const isSel = skillFilter === s.skill
                return (
                  <div key={s.skill} onClick={()=>setSkillFilter(isSel ? null : s.skill)}
                    style={{display:'grid',gridTemplateColumns:'80px 1fr 30px',gap:'10px',alignItems:'center',marginBottom:'8px',fontSize:'12px',cursor:'pointer',padding:'2px 4px',borderRadius:'4px',background:isSel?'rgba(141,198,63,0.10)':'transparent'}}
                    onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background='rgba(141,198,63,0.05)'}}
                    onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background='transparent'}}>
                    <span style={{color: isSel?'#8DC63F':'#9ca3af',textAlign:'right',fontWeight:isSel?700:400}}>{s.skill}</span>
                    <div style={{height:'18px',background:'#0a0a0a',borderRadius:'3px',overflow:'hidden',border: isSel?'1px solid #8DC63F':'1px solid transparent'}}>
                      <div style={{height:'100%', width: (s.count / maxSkillCount * 100) + '%', background:'#8DC63F', transition:'width 0.3s'}}/>
                    </div>
                    <span style={{color:'#fff',fontWeight:700}}>{s.count}</span>
                  </div>
                )
              })}
              <div style={{fontSize:'11px',color:'#6b7280',marginTop:'10px',borderTop:'1px solid #1e1e1e',paddingTop:'8px'}}>Click any skill to filter the table and scatter chart</div>
            </div>

            <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'18px'}}>
              <h3 style={{fontSize:'14px',fontWeight:700,margin:'0 0 14px',color:'#fff'}}>Years of Experience vs Salary</h3>
              {scatter.length === 0 && <div style={{color:'#6b7280',fontSize:'13px',padding:'40px 0',textAlign:'center'}}>Not enough data with both salary and experience</div>}
              {scatter.length > 0 && (
                <ScatterChart points={scatter} salaryMin={salaryMin} salaryMax={salaryMax} yearsMax={yearsMax} selectedId={candidateFilter} onClickPoint={id=>setCandidateFilter(candidateFilter===id?null:id)}/>
              )}
              <div style={{fontSize:'11px',color:'#6b7280',marginTop:'10px',borderTop:'1px solid #1e1e1e',paddingTop:'8px'}}>Click any dot to filter to that candidate</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}