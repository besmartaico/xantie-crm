// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const LIME = '#8DC63F'
const inp = { background:'#111', border:'1px solid #252525', borderRadius:'8px', padding:'9px 12px', color:'#fff', fontSize:'13px', outline:'none', boxSizing:'border-box' }
const card = { background:'#141414', border:'1px solid #1e1e1e', borderRadius:'12px', padding:'16px' }

// ── date helpers (local, T00:00:00 to avoid UTC shift) ──────────────────
function todayStr() {
  const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}
function parseD(s) { return new Date(s + 'T00:00:00') }
function fmtD(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') }
function addDays(s, n) { const d = parseD(s); d.setDate(d.getDate()+n); return fmtD(d) }
function weekStart(s) { const d = parseD(s); d.setDate(d.getDate() - d.getDay()); return fmtD(d) } // Sunday
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function HealthPage() {
  const [u, setU] = useState({})
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ competitions:[], elements:[], participants:[], logs:[] })
  const [allUsers, setAllUsers] = useState([])
  const [compId, setCompId] = useState('')
  const [tab, setTab] = useState('')
  const [weekAnchor, setWeekAnchor] = useState(() => weekStart(todayStr()))
  const [err, setErr] = useState('')

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setU(user)
    load(user)
  }, [])

  async function load(user) {
    setLoading(true)
    try {
      const d = await (await fetch('/api/health')).json()
      setData(d)
      if ((user||u).role === 'admin') {
        try { setAllUsers(await (await fetch('/api/users')).json() || []) } catch(e) {}
      }
      // pick active competition
      const active = (d.competitions||[]).filter(c => c.status !== 'archived')
      const pick = (compId && (d.competitions||[]).some(c=>c.id===compId)) ? compId : (active[0]?.id || d.competitions?.[0]?.id || '')
      setCompId(pick)
    } catch(e) { setErr('Failed to load') }
    setLoading(false)
  }

  const email = (u.email || '').toLowerCase()
  const isAdmin = u.role === 'admin'
  const comps = data.competitions || []
  const comp = comps.find(c => c.id === compId) || null
  const elements = (data.elements || []).filter(e => e.competitionId === compId).sort((a,b)=>a.position-b.position)
  const participants = (data.participants || []).filter(p => p.competitionId === compId)
  const logs = (data.logs || []).filter(l => l.competitionId === compId)
  const me = participants.find(p => p.email === email)
  const myElements = me ? elements.filter(e => me.elementIds.includes(e.id)) : []

  // default sub-tab once we know role/participation
  useEffect(() => {
    if (loading) return
    if (!tab) setTab(me ? 'progress' : (isAdmin ? 'manage' : 'leaderboard'))
  }, [loading, me, isAdmin]) // eslint-disable-line

  function hasLog(em, elementId, date) {
    return logs.some(l => l.email === em && l.elementId === elementId && l.date === date)
  }
  // Completed days for a participant = days where ALL their assigned activities are logged, within the window.
  function completedDays(p) {
    const assigned = elements.filter(e => p.elementIds.includes(e.id)).map(e => e.id)
    if (!assigned.length) return 0
    const byDate = {}
    logs.forEach(l => { if (l.email === p.email) (byDate[l.date] = byDate[l.date] || new Set()).add(l.elementId) })
    const t = todayStr()
    let count = 0
    for (const d of Object.keys(byDate)) {
      if (comp?.startDate && d < comp.startDate) continue
      if (comp?.endDate && d > comp.endDate) continue
      if (d > t) continue
      if (assigned.every(id => byDate[d].has(id))) count++
    }
    return count
  }

  async function act(body) {
    setErr('')
    const res = await fetch('/api/health', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
    const j = await res.json().catch(()=>({}))
    if (!res.ok || !j.success) { setErr(j.error || 'Action failed'); return null }
    return j
  }

  async function toggle(elementId, date) {
    // optimistic
    const existing = hasLog(email, elementId, date)
    setData(prev => {
      const next = { ...prev }
      if (existing) next.logs = prev.logs.filter(l => !(l.email===email && l.competitionId===compId && l.elementId===elementId && l.date===date))
      else next.logs = [...prev.logs, { id:'tmp', competitionId:compId, email, elementId, date }]
      return next
    })
    const j = await act({ action:'toggle_log', competitionId:compId, email, elementId, date })
    if (!j) load(u) // revert by reloading on failure
  }

  if (loading) return <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading…</div>

  // Nothing set up + not admin
  if (!comp && !isAdmin) {
    return <div style={{...card, textAlign:'center', padding:'48px'}}><h1 style={{fontSize:'20px',fontWeight:700,margin:'0 0 8px'}}>Health Competition</h1><p style={{color:'#6b7280',margin:0}}>You haven't been added to a health competition yet.</p></div>
  }

  const subTabs = [
    ...(me ? [['progress','My Progress']] : []),
    ['leaderboard','Leaderboard'],
    ...(isAdmin ? [['manage','Manage']] : []),
  ]

  const days = Array.from({length:7}, (_,i) => addDays(weekAnchor, i))
  const t = todayStr()

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'12px',marginBottom:'16px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>🏆 Health Competition</h1>
          {comp && <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>{comp.name}{comp.startDate ? ` · ${comp.startDate}${comp.endDate?' → '+comp.endDate:''}` : ''}</p>}
        </div>
        {comps.length > 1 && (
          <select value={compId} onChange={e=>{setCompId(e.target.value);setTab('')}} style={{...inp,cursor:'pointer'}}>
            {comps.map(c => <option key={c.id} value={c.id}>{c.name}{c.status==='archived'?' (archived)':''}</option>)}
          </select>
        )}
      </div>

      {err && <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:'8px',padding:'10px 14px',marginBottom:'14px',fontSize:'13px'}}>{err}</div>}

      <div style={{display:'flex',gap:'8px',marginBottom:'18px',flexWrap:'wrap'}}>
        {subTabs.map(([k,label]) => (
          <button key={k} onClick={()=>setTab(k)} style={{background:tab===k?LIME:'#1e1e1e',color:tab===k?'#0a0a0a':'#9ca3af',border:'1px solid '+(tab===k?LIME:'#252525'),borderRadius:'8px',padding:'7px 14px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>{label}</button>
        ))}
      </div>

      {/* ── MY PROGRESS ─────────────────────────────────────────── */}
      {tab === 'progress' && me && (
        <div>
          <div style={{display:'flex',gap:'12px',flexWrap:'wrap',marginBottom:'16px'}}>
            <div style={{...card,flex:'1 1 180px'}}>
              <div style={{fontSize:'11px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700}}>Days completed</div>
              <div style={{fontSize:'32px',fontWeight:800,color:LIME}}>{completedDays(me)}</div>
              <div style={{fontSize:'11px',color:'#6b7280'}}>all {myElements.length} activit{myElements.length===1?'y':'ies'} done</div>
            </div>
          </div>

          {myElements.length === 0 ? (
            <div style={{...card,color:'#6b7280'}}>No activities assigned to you yet — an admin needs to assign your activities.</div>
          ) : (
            <div style={card}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
                <button onClick={()=>setWeekAnchor(addDays(weekAnchor,-7))} style={{background:'#1e1e1e',border:'1px solid #252525',color:'#9ca3af',borderRadius:'8px',padding:'6px 12px',fontSize:'13px',cursor:'pointer'}}>← Prev</button>
                <span style={{fontSize:'13px',color:'#9ca3af',fontWeight:600}}>Week of {weekAnchor}</span>
                <button onClick={()=>setWeekAnchor(addDays(weekAnchor,7))} style={{background:'#1e1e1e',border:'1px solid #252525',color:'#9ca3af',borderRadius:'8px',padding:'6px 12px',fontSize:'13px',cursor:'pointer'}}>Next →</button>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{borderCollapse:'collapse',width:'100%',minWidth:'560px'}}>
                  <thead>
                    <tr>
                      <th style={{textAlign:'left',padding:'8px',fontSize:'11px',color:'#6b7280',fontWeight:700,textTransform:'uppercase'}}>Activity</th>
                      {days.map(d => {
                        const all = myElements.every(e => hasLog(email, e.id, d))
                        const inWindow = (!comp?.startDate || d>=comp.startDate) && (!comp?.endDate || d<=comp.endDate) && d<=t
                        return (
                          <th key={d} style={{padding:'6px 4px',textAlign:'center',minWidth:'60px'}}>
                            <div style={{fontSize:'10px',color: d===t?LIME:'#6b7280',fontWeight:700}}>{DOW[parseD(d).getDay()]}</div>
                            <div style={{fontSize:'11px',color:'#9ca3af'}}>{d.slice(5)}</div>
                            <div style={{marginTop:'3px',fontSize:'12px',color: all&&inWindow?LIME:'#2a2a2a'}}>{all&&inWindow?'✓':'·'}</div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {myElements.map(e => (
                      <tr key={e.id} style={{borderTop:'1px solid #1a1a1a'}}>
                        <td style={{padding:'8px',fontSize:'13px',color:'#e5e7eb',fontWeight:500}}>{e.name}</td>
                        {days.map(d => {
                          const on = hasLog(email, e.id, d)
                          const future = d > t
                          return (
                            <td key={d} style={{textAlign:'center',padding:'4px'}}>
                              <button onClick={()=>!future&&toggle(e.id, d)} disabled={future} title={future?'Future date':''}
                                style={{width:'30px',height:'30px',borderRadius:'7px',cursor:future?'default':'pointer',
                                  border:'2px solid '+(on?LIME:'#2a2a2a'), background:on?LIME:'transparent', color:'#0a0a0a',
                                  fontSize:'15px',fontWeight:800,opacity:future?0.3:1,lineHeight:1}}>{on?'✓':''}</button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{fontSize:'11px',color:'#4b5563',margin:'12px 0 0'}}>Tap a box to mark an activity done for that day. A day counts only when every activity is checked.</p>
            </div>
          )}
        </div>
      )}

      {/* ── LEADERBOARD ─────────────────────────────────────────── */}
      {tab === 'leaderboard' && (
        <div style={card}>
          {participants.length === 0 ? <p style={{color:'#6b7280',margin:0}}>No participants yet.</p> : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>
                <th style={{textAlign:'left',padding:'8px',fontSize:'11px',color:'#6b7280',fontWeight:700,textTransform:'uppercase'}}>#</th>
                <th style={{textAlign:'left',padding:'8px',fontSize:'11px',color:'#6b7280',fontWeight:700,textTransform:'uppercase'}}>Participant</th>
                <th style={{textAlign:'center',padding:'8px',fontSize:'11px',color:'#6b7280',fontWeight:700,textTransform:'uppercase'}}>Activities</th>
                <th style={{textAlign:'right',padding:'8px',fontSize:'11px',color:'#6b7280',fontWeight:700,textTransform:'uppercase'}}>Days completed</th>
              </tr></thead>
              <tbody>
                {participants.map(p => ({ p, days: completedDays(p) })).sort((a,b)=>b.days-a.days).map((row, i) => {
                  const mine = row.p.email === email
                  return (
                    <tr key={row.p.id} style={{borderTop:'1px solid #1a1a1a', background: mine?'rgba(141,198,63,0.06)':'transparent'}}>
                      <td style={{padding:'10px 8px',fontSize:'14px',fontWeight:800,color: i===0?LIME:'#6b7280'}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
                      <td style={{padding:'10px 8px',fontSize:'14px',color:'#fff',fontWeight:500}}>{row.p.name||row.p.email}{mine&&<span style={{fontSize:'10px',color:LIME,marginLeft:'6px'}}>(you)</span>}</td>
                      <td style={{padding:'10px 8px',fontSize:'12px',color:'#6b7280',textAlign:'center'}}>{row.p.elementIds.filter(id=>elements.some(e=>e.id===id)).length}</td>
                      <td style={{padding:'10px 8px',fontSize:'18px',fontWeight:800,color:LIME,textAlign:'right'}}>{row.days}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── MANAGE (admin) ──────────────────────────────────────── */}
      {tab === 'manage' && isAdmin && (
        <ManageView comp={comp} comps={comps} elements={elements} participants={participants} allUsers={allUsers}
          u={u} compId={compId} setCompId={setCompId} act={act} reload={()=>load(u)} />
      )}
    </div>
  )
}

function ManageView({ comp, comps, elements, participants, allUsers, u, compId, setCompId, act, reload }) {
  const [newComp, setNewComp] = useState({ open:false, name:'', startDate: todayStr(), endDate:'' })
  const [newElem, setNewElem] = useState('')
  const [editElem, setEditElem] = useState(null) // {id, name}
  const [addPart, setAddPart] = useState(null) // { email, name, elementIds:[] }
  const [editPart, setEditPart] = useState(null) // participant being edited

  async function createComp() {
    if (!newComp.name.trim()) return
    const j = await act({ action:'create_competition', name:newComp.name.trim(), startDate:newComp.startDate, endDate:newComp.endDate, createdBy:u.email||'' })
    if (j) { setNewComp({ open:false, name:'', startDate:todayStr(), endDate:'' }); setCompId(j.id); reload() }
  }
  async function addElement() { if (!newElem.trim()||!comp) return; const j = await act({ action:'add_element', competitionId:comp.id, name:newElem.trim() }); if (j) { setNewElem(''); reload() } }
  async function saveElem() { const j = await act({ action:'update_element', id:editElem.id, name:editElem.name.trim() }); if (j) { setEditElem(null); reload() } }
  async function delElem(id) { const j = await act({ action:'delete_element', id }); if (j) reload() }
  async function saveAddPart() {
    const j = await act({ action:'add_participant', competitionId:comp.id, email:addPart.email, name:addPart.name, elementIds:addPart.elementIds })
    if (j) { setAddPart(null); reload() }
  }
  async function saveEditPart() { const j = await act({ action:'update_participant', id:editPart.id, elementIds:editPart.elementIds }); if (j) { setEditPart(null); reload() } }
  async function removePart(id) { const j = await act({ action:'remove_participant', id }); if (j) reload() }

  const availableUsers = (allUsers||[]).filter(usr => usr.status !== 'inactive' && !participants.some(p => p.email === (usr.email||'').toLowerCase()))

  const sec = { ...card, marginBottom:'16px' }
  const h3 = { fontSize:'12px',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 12px' }
  const btn = (bg,fg='#0a0a0a') => ({ background:bg, color:fg, border:'none', borderRadius:'8px', padding:'8px 14px', fontSize:'13px', fontWeight:700, cursor:'pointer' })

  return (
    <div>
      {/* Competition */}
      <div style={sec}>
        <h3 style={h3}>Competition</h3>
        {comp ? (
          <div style={{display:'flex',flexWrap:'wrap',gap:'12px',alignItems:'flex-end'}}>
            <CompField label="Name" value={comp.name} onSave={v=>act({action:'update_competition',id:comp.id,name:v}).then(reload)} />
            <CompField label="Start" type="date" value={comp.startDate} onSave={v=>act({action:'update_competition',id:comp.id,startDate:v}).then(reload)} />
            <CompField label="End" type="date" value={comp.endDate} onSave={v=>act({action:'update_competition',id:comp.id,endDate:v}).then(reload)} />
            <button onClick={()=>act({action:'update_competition',id:comp.id,status:comp.status==='archived'?'active':'archived'}).then(reload)}
              style={{...btn('#1e1e1e','#9ca3af'),border:'1px solid #252525'}}>{comp.status==='archived'?'Unarchive':'Archive'}</button>
            <button onClick={()=>setNewComp({ open:true, name:'', startDate:todayStr(), endDate:'' })} style={{...btn('#1e1e1e','#9ca3af'),border:'1px solid #252525'}}>+ New competition</button>
          </div>
        ) : (
          <div>
            <p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 12px'}}>No competition yet. Create one to get started.</p>
            <button onClick={()=>setNewComp({ open:true, name:'', startDate:todayStr(), endDate:'' })} style={btn(LIME)}>+ Create competition</button>
          </div>
        )}
        {newComp.open && (
          <div style={{marginTop:'14px',background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'10px',padding:'14px',display:'flex',flexWrap:'wrap',gap:'10px',alignItems:'flex-end'}}>
            <div><label style={lbl}>Name</label><input value={newComp.name} onChange={e=>setNewComp({...newComp,name:e.target.value})} placeholder="e.g. Partner Health Challenge" style={{...inp,minWidth:'220px'}}/></div>
            <div><label style={lbl}>Start</label><input type="date" value={newComp.startDate} onChange={e=>setNewComp({...newComp,startDate:e.target.value})} style={{...inp,colorScheme:'dark'}}/></div>
            <div><label style={lbl}>End</label><input type="date" value={newComp.endDate} onChange={e=>setNewComp({...newComp,endDate:e.target.value})} style={{...inp,colorScheme:'dark'}}/></div>
            <button onClick={createComp} disabled={!newComp.name.trim()} style={{...btn(LIME),opacity:newComp.name.trim()?1:0.5}}>Create</button>
            <button onClick={()=>setNewComp({open:false,name:'',startDate:todayStr(),endDate:''})} style={{...btn('#252525','#9ca3af')}}>Cancel</button>
          </div>
        )}
      </div>

      {comp && (
        <>
          {/* Activities */}
          <div style={sec}>
            <h3 style={h3}>Activities</h3>
            <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'12px'}}>
              {elements.length===0 && <p style={{color:'#6b7280',fontSize:'13px',margin:0}}>No activities yet. Add the things people need to do each day (e.g. Outside workout, Inside workout, Self Help Book).</p>}
              {elements.map(e => (
                <div key={e.id} style={{display:'flex',alignItems:'center',gap:'8px',background:'#0f0f0f',borderRadius:'8px',padding:'8px 12px'}}>
                  {editElem?.id===e.id ? (
                    <>
                      <input autoFocus value={editElem.name} onChange={ev=>setEditElem({...editElem,name:ev.target.value})} onKeyDown={ev=>ev.key==='Enter'&&saveElem()} style={{...inp,flex:1}}/>
                      <button onClick={saveElem} style={btn(LIME)}>Save</button>
                      <button onClick={()=>setEditElem(null)} style={btn('#252525','#9ca3af')}>✕</button>
                    </>
                  ) : (
                    <>
                      <span style={{flex:1,fontSize:'14px',color:'#e5e7eb',fontWeight:500}}>{e.name}</span>
                      <button onClick={()=>setEditElem({id:e.id,name:e.name})} style={{background:'none',border:'1px solid #252525',color:'#9ca3af',borderRadius:'6px',padding:'5px 10px',fontSize:'12px',cursor:'pointer'}}>Edit</button>
                      <button onClick={()=>delElem(e.id)} style={{background:'none',border:'none',color:'#f87171',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>Delete</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <input value={newElem} onChange={e=>setNewElem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addElement()} placeholder="New activity name…" style={{...inp,flex:1}}/>
              <button onClick={addElement} disabled={!newElem.trim()} style={{...btn(LIME),opacity:newElem.trim()?1:0.5}}>+ Add</button>
            </div>
          </div>

          {/* Participants */}
          <div style={sec}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
              <h3 style={{...h3,margin:0}}>Participants</h3>
              <button onClick={()=>setAddPart({ email:'', name:'', elementIds: elements.map(e=>e.id) })} disabled={availableUsers.length===0} style={{...btn(LIME),opacity:availableUsers.length?1:0.5}}>+ Add person</button>
            </div>
            {participants.length===0 && <p style={{color:'#6b7280',fontSize:'13px',margin:0}}>No participants yet.</p>}
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {participants.map(p => (
                <div key={p.id} style={{background:'#0f0f0f',borderRadius:'8px',padding:'10px 12px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                    <div style={{flex:'1 1 160px',minWidth:0}}>
                      <div style={{fontSize:'14px',color:'#fff',fontWeight:500}}>{p.name||p.email}</div>
                      <div style={{fontSize:'11px',color:'#6b7280'}}>{p.email}</div>
                    </div>
                    <button onClick={()=>setEditPart({ ...p })} style={{background:'none',border:'1px solid #252525',color:'#9ca3af',borderRadius:'6px',padding:'5px 10px',fontSize:'12px',cursor:'pointer'}}>Edit activities</button>
                    <button onClick={()=>removePart(p.id)} style={{background:'none',border:'none',color:'#f87171',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>Remove</button>
                  </div>
                  {editPart?.id===p.id ? (
                    <div style={{marginTop:'10px',borderTop:'1px solid #1a1a1a',paddingTop:'10px'}}>
                      <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
                        {elements.map(e => {
                          const on = editPart.elementIds.includes(e.id)
                          return <button key={e.id} onClick={()=>setEditPart({...editPart, elementIds: on?editPart.elementIds.filter(x=>x!==e.id):[...editPart.elementIds,e.id]})}
                            style={{border:'1px solid '+(on?LIME:'#252525'),background:on?LIME:'#1a1a1a',color:on?'#0a0a0a':'#9ca3af',borderRadius:'6px',padding:'5px 10px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>{on?'✓ ':''}{e.name}</button>
                        })}
                      </div>
                      <button onClick={saveEditPart} style={btn(LIME)}>Save</button>
                      <button onClick={()=>setEditPart(null)} style={{...btn('#252525','#9ca3af'),marginLeft:'8px'}}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{marginTop:'6px',display:'flex',flexWrap:'wrap',gap:'4px'}}>
                      {p.elementIds.filter(id=>elements.some(e=>e.id===id)).map(id => <span key={id} style={{fontSize:'11px',background:'#1a1a1a',color:'#9ca3af',borderRadius:'4px',padding:'2px 7px'}}>{elements.find(e=>e.id===id)?.name}</span>)}
                      {p.elementIds.filter(id=>elements.some(e=>e.id===id)).length===0 && <span style={{fontSize:'11px',color:'#4b5563'}}>No activities assigned</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {addPart && (
              <div style={{marginTop:'14px',background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:'10px',padding:'14px'}}>
                <label style={lbl}>Person</label>
                <select value={addPart.email} onChange={e=>{ const usr = availableUsers.find(x=>(x.email||'').toLowerCase()===e.target.value); setAddPart({...addPart, email:e.target.value, name: usr?.name||''}) }} style={{...inp,width:'100%',cursor:'pointer',marginBottom:'12px'}}>
                  <option value="">Select a user…</option>
                  {availableUsers.map(usr => <option key={usr.email} value={(usr.email||'').toLowerCase()}>{usr.name} ({usr.email})</option>)}
                </select>
                <label style={lbl}>Activities they participate in</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:'6px',margin:'6px 0 12px'}}>
                  {elements.map(e => {
                    const on = addPart.elementIds.includes(e.id)
                    return <button key={e.id} onClick={()=>setAddPart({...addPart, elementIds: on?addPart.elementIds.filter(x=>x!==e.id):[...addPart.elementIds,e.id]})}
                      style={{border:'1px solid '+(on?LIME:'#252525'),background:on?LIME:'#1a1a1a',color:on?'#0a0a0a':'#9ca3af',borderRadius:'6px',padding:'5px 10px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>{on?'✓ ':''}{e.name}</button>
                  })}
                  {elements.length===0 && <span style={{fontSize:'12px',color:'#4b5563'}}>Add activities first.</span>}
                </div>
                <button onClick={saveAddPart} disabled={!addPart.email} style={{...btn(LIME),opacity:addPart.email?1:0.5}}>Add to competition</button>
                <button onClick={()=>setAddPart(null)} style={{...btn('#252525','#9ca3af'),marginLeft:'8px'}}>Cancel</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.06em' }

function CompField({ label, value, onSave, type }) {
  const [v, setV] = useState(value || '')
  const [editing, setEditing] = useState(false)
  useEffect(()=>{ setV(value||'') }, [value])
  return (
    <div>
      <label style={lbl}>{label}</label>
      <div style={{display:'flex',gap:'6px'}}>
        <input type={type||'text'} value={v} onChange={e=>{setV(e.target.value);setEditing(true)}} style={{...inp, colorScheme:'dark'}}/>
        {editing && <button onClick={()=>{onSave(v);setEditing(false)}} style={{background:LIME,color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'0 12px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Save</button>}
      </div>
    </div>
  )
}
