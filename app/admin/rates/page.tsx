// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const inp = { width:'100%', background:'#111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'14px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }

function fmtMoney(n) {
  const v = parseFloat(n) || 0
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}

export default function RatesPage() {
  const [rates, setRates] = useState([])
  const [users, setUsers] = useState([])
  const [clients, setClients] = useState([])
  const [subProjects, setSubProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({email:'', name:'', clientName:'', projectName:'N/A', hourlyRate:''})
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [currentUser, setCurrentUser] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setCurrentUser(u)
    if (u.role !== 'admin') {
      // redirect non-admins
      window.location.href = '/admin/dashboard'
      return
    }
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [r, u, c, s] = await Promise.all([
        fetch('/api/rates').then(r=>r.json()),
        fetch('/api/users').then(r=>r.json()),
        fetch('/api/clients').then(r=>r.json()),
        fetch('/api/projects').then(r=>r.json()),
      ])
      setRates(r||[])
      setUsers((u||[]).filter(x => x.status !== 'inactive'))
      setClients((c||[]).sort((a,b)=>a.name.localeCompare(b.name)))
      setSubProjects(s||[])
    } catch(e) {}
    setLoading(false)
  }

  function openAdd() {
    setEditId(null)
    setForm({email:'', name:'', clientName:'', projectName:'N/A', hourlyRate:''})
    setShowModal(true)
  }

  function openEdit(rate) {
    setEditId(rate.id)
    setForm({email:rate.email, name:rate.name, clientName:rate.clientName, projectName:rate.projectName||'N/A', hourlyRate:rate.hourlyRate})
    setShowModal(true)
  }

  async function save() {
    if (!form.email || !form.clientName || !form.hourlyRate) return
    setSaving(true)
    const action = editId ? 'update' : 'add'
    const body = { action, ...form, hourlyRate: parseFloat(form.hourlyRate)||0 }
    if (editId) body.id = editId
    await fetch('/api/rates', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)})
    setShowModal(false)
    setSaving(false)
    load()
  }

  async function doDelete(id) {
    await fetch('/api/rates', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'delete', id})})
    setConfirmDelete(null)
    load()
  }

  // Filter rates
  const filtered = rates.filter(r => {
    if (filterEmployee && r.email !== filterEmployee) return false
    if (filterClient && r.clientName !== filterClient) return false
    if (search) {
      const s = search.toLowerCase()
      if (!r.name.toLowerCase().includes(s) && !r.email.toLowerCase().includes(s) &&
          !r.clientName.toLowerCase().includes(s) && !(r.projectName||'').toLowerCase().includes(s)) return false
    }
    return true
  })

  // Pre-fill name when email is selected
  function selectEmail(email) {
    const u = users.find(x => x.email === email)
    setForm({...form, email, name: u?.name || form.name})
  }

  // Sub-projects for selected client
  const projectsForClient = subProjects.filter(p => p.clientName === form.clientName).map(p => p.name)
  const allProjectOptions = ['N/A', ...projectsForClient]

  const employees = [...new Set(rates.map(r => r.email).filter(Boolean))].sort()
  const clientNames = [...new Set(rates.map(r => r.clientName).filter(Boolean))].sort()

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Employee Rates</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Hourly rates by employee, client, and project</p>
        </div>
        <button onClick={openAdd} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
          + New Rate
        </button>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'20px',alignItems:'center'}}>
        <input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{...inp, width:'auto', minWidth:'200px'}}/>
        <select value={filterEmployee} onChange={e=>setFilterEmployee(e.target.value)} style={{...inp, width:'auto', cursor:'pointer'}}>
          <option value="">All Employees</option>
          {employees.map(em => {
            const u = users.find(x => x.email === em) || rates.find(r=>r.email===em)
            return <option key={em} value={em}>{u?.name || em}</option>
          })}
        </select>
        <select value={filterClient} onChange={e=>setFilterClient(e.target.value)} style={{...inp, width:'auto', cursor:'pointer'}}>
          <option value="">All Clients</option>
          {clientNames.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || filterEmployee || filterClient) && (
          <button onClick={()=>{setSearch('');setFilterEmployee('');setFilterClient('')}}
            style={{background:'#1e1e1e',border:'1px solid #252525',color:'#9ca3af',borderRadius:'8px',padding:'9px 14px',fontSize:'12px',cursor:'pointer'}}>
            Clear
          </button>
        )}
        <span style={{color:'#6b7280',fontSize:'12px',marginLeft:'auto'}}>{filtered.length} of {rates.length} rates</span>
      </div>

      {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>}

      {!loading && rates.length === 0 && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'48px',textAlign:'center'}}>
          <p style={{color:'#6b7280',margin:'0 0 16px'}}>No rates yet. Add the first one to get started.</p>
          <button onClick={openAdd} style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 20px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
            + Add First Rate
          </button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {filtered.map(r => (
            <div key={r.id}
              style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'10px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
              <div style={{flex:'1 1 200px', minWidth:0}}>
                <div style={{fontSize:'14px',fontWeight:600,color:'#fff'}}>{r.name||r.email}</div>
                <div style={{fontSize:'12px',color:'#6b7280'}}>{r.email}</div>
              </div>
              <div style={{flex:'1 1 200px', minWidth:0}}>
                <div style={{fontSize:'13px',color:'#d1d5db'}}>{r.clientName}</div>
                <div style={{fontSize:'12px',color:'#6b7280'}}>{r.projectName||'N/A'}</div>
              </div>
              <div style={{textAlign:'right',minWidth:'100px'}}>
                <div style={{fontSize:'15px',fontWeight:700,color:'#8DC63F'}}>{fmtMoney(r.hourlyRate)}<span style={{fontSize:'11px',color:'#6b7280',fontWeight:400}}>/hr</span></div>
                <div style={{fontSize:'10px',color:'#4b5563'}}>{fmtDate(r.updatedAt)}</div>
              </div>
              <div style={{display:'flex',gap:'4px'}}>
                <button onClick={()=>openEdit(r)} style={{background:'#1e1e1e',border:'1px solid #252525',color:'#9ca3af',borderRadius:'6px',padding:'6px 10px',fontSize:'12px',cursor:'pointer'}}>✎</button>
                <button onClick={()=>setConfirmDelete(r.id)} style={{background:'#1e1e1e',border:'1px solid #252525',color:'#f87171',borderRadius:'6px',padding:'6px 10px',fontSize:'12px',cursor:'pointer'}}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}}
          onClick={()=>setShowModal(false)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'24px',width:'480px',maxWidth:'100%',maxHeight:'92vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <h2 style={{fontSize:'18px',fontWeight:700,margin:'0 0 18px'}}>{editId?'Edit Rate':'New Rate'}</h2>

            <div style={{marginBottom:'14px'}}>
              <label style={lbl}>Employee *</label>
              <select value={form.email} onChange={e=>selectEmail(e.target.value)} style={{...inp, cursor:'pointer'}}>
                <option value="">— Select employee —</option>
                {users.sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(u => (
                  <option key={u.email} value={u.email}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>

            <div style={{marginBottom:'14px'}}>
              <label style={lbl}>Client *</label>
              <select value={form.clientName} onChange={e=>setForm({...form, clientName:e.target.value, projectName:'N/A'})} style={{...inp, cursor:'pointer'}}>
                <option value="">— Select client —</option>
                {clients.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            <div style={{marginBottom:'14px'}}>
              <label style={lbl}>Project</label>
              <select value={form.projectName} onChange={e=>setForm({...form, projectName:e.target.value})} style={{...inp, cursor:'pointer'}}>
                {allProjectOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <div style={{fontSize:'11px',color:'#6b7280',marginTop:'4px'}}>Use "N/A" for a default rate that applies to all projects under this client</div>
            </div>

            <div style={{marginBottom:'18px'}}>
              <label style={lbl}>Hourly Rate (USD) *</label>
              <input type="number" step="0.01" value={form.hourlyRate} onChange={e=>setForm({...form, hourlyRate:e.target.value})}
                placeholder="125.00" style={inp}/>
            </div>

            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',flexWrap:'wrap'}}>
              <button onClick={()=>setShowModal(false)} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'10px 16px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button onClick={save} disabled={saving||!form.email||!form.clientName||!form.hourlyRate}
                style={{background:(form.email&&form.clientName&&form.hourlyRate)?'#8DC63F':'#2a2a2a',color:(form.email&&form.clientName&&form.hourlyRate)?'#0a0a0a':'#4b5563',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:700,cursor:(form.email&&form.clientName&&form.hourlyRate)?'pointer':'not-allowed'}}>
                {saving?'Saving...':(editId?'Save Changes':'Add Rate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}}
          onClick={()=>setConfirmDelete(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'14px',padding:'20px',width:'380px',maxWidth:'100%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:'0 0 12px',fontSize:'16px'}}>Delete this rate?</h3>
            <p style={{color:'#9ca3af',fontSize:'13px',margin:'0 0 18px'}}>This cannot be undone. Existing time entries are not affected.</p>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setConfirmDelete(null)} style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button onClick={()=>doDelete(confirmDelete)} style={{background:'#dc2626',border:'none',color:'#fff',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}