// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const inp = { width:'100%', background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'16px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.07em' }
const th = { textAlign:'left', padding:'11px 16px', fontSize:'11px', fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.08em', background:'#161616', borderBottom:'1px solid #1f1f1f' }
const td = { padding:'11px 16px', fontSize:'13px', color:'#d1d5db', borderBottom:'1px solid #1f1f1f', verticalAlign:'middle' }

export default function TimeEntries() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [user, setUser] = useState({name:'', email:''})
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], hours: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    setUser(u)
    load()
  }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/time')
    const data = await res.json()
    setEntries(data)
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const u = JSON.parse(sessionStorage.getItem('xantie_user') || '{}')
    if (editEntry) {
      await fetch('/api/time', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'update', id: editEntry.id, name: u.name||'', email: u.email||'', ...form, importedFrom: editEntry.importedFrom })
      })
    } else {
      await fetch('/api/time', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'add', name: u.name||'', email: u.email||'', ...form })
      })
    }
    setSaving(false)
    setShowAdd(false)
    setEditEntry(null)
    setForm({ date: new Date().toISOString().split('T')[0], hours: '', description: '' })
    load()
  }

  async function del(id) {
    if (!confirm('Delete this entry?')) return
    await fetch('/api/time', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'delete', id })
    })
    load()
  }

  function openEdit(e) {
    setEditEntry(e)
    setForm({ date: e.date, hours: e.hours, description: e.description })
    setShowAdd(true)
  }

  const filtered = entries.filter(e =>
    !filter || e.name?.toLowerCase().includes(filter.toLowerCase()) ||
    e.description?.toLowerCase().includes(filter.toLowerCase()) ||
    e.date?.includes(filter)
  )

  const totalHours = filtered.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0)

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Time Entries</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>{filtered.length} entries · {totalHours.toFixed(2)} hrs</p>
        </div>
        <button onClick={() => { setEditEntry(null); setForm({ date: new Date().toISOString().split('T')[0], hours:'', description:'' }); setShowAdd(true) }}
          style={{background:'#6366f1',color:'#fff',border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>
          + Add Entry
        </button>
      </div>

      <div style={{marginBottom:'16px'}}>
        <input placeholder="Search by name, date, or description..." value={filter} onChange={e => setFilter(e.target.value)} style={{...inp, maxWidth:'360px'}} />
      </div>

      <div className="tbl-wrap" style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'14px'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:'560px'}}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Date</th>
              <th style={th}>Hours</th>
              <th style={th}>Description</th>
              <th style={th}>Source</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{...td, textAlign:'center', color:'#6b7280'}}>Loading...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} style={{...td, textAlign:'center', color:'#6b7280'}}>No entries yet. Add your first one!</td></tr>}
            {filtered.map(e => (
              <tr key={e.id}>
                <td style={td}><div style={{fontWeight:500,color:'#fff'}}>{e.name}</div><div style={{fontSize:'11px',color:'#6b7280'}}>{e.email}</div></td>
                <td style={td}>{e.date}</td>
                <td style={td}><span style={{background:'#1e1e3a',color:'#6366f1',padding:'3px 8px',borderRadius:'6px',fontWeight:600}}>{e.hours}</span></td>
                <td style={td}>{e.description}</td>
                <td style={td}><span style={{fontSize:'11px',color:'#6b7280'}}>{e.importedFrom || 'manual'}</span></td>
                <td style={td}>
                  <button onClick={() => openEdit(e)} style={{background:'none',border:'none',color:'#6366f1',cursor:'pointer',fontSize:'12px',marginRight:'8px'}}>Edit</button>
                  <button onClick={() => del(e.id)} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:'12px'}}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="modal-wrap" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:'20px'}}>
          <div className="modal-inner" style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'16px',padding:'28px',width:'100%',maxWidth:'460px'}}>
            <h2 style={{margin:'0 0 24px',fontSize:'18px'}}>{editEntry ? 'Edit Entry' : 'Add Time Entry'}</h2>
            <div style={{marginBottom:'16px'}}>
              <label style={lbl}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({...form,date:e.target.value})} style={inp} />
            </div>
            <div style={{marginBottom:'16px'}}>
              <label style={lbl}>Hours (decimal)</label>
              <input type="number" step="0.25" placeholder="e.g. 2.5" value={form.hours} onChange={e => setForm({...form,hours:e.target.value})} style={inp} />
            </div>
            <div style={{marginBottom:'24px'}}>
              <label style={lbl}>Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm({...form,description:e.target.value})} style={{...inp,resize:'vertical'}} />
            </div>
            <div style={{display:'flex',gap:'12px'}}>
              <button onClick={save} disabled={saving} style={{flex:1,background:'#6366f1',color:'#fff',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>
                {saving ? 'Saving...' : editEntry ? 'Save Changes' : 'Add Entry'}
              </button>
              <button onClick={() => { setShowAdd(false); setEditEntry(null) }} style={{flex:1,background:'#2a2a2a',color:'#fff',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',cursor:'pointer'}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}