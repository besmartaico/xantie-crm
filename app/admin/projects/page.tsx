// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const inp = { width:'100%', background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'10px 13px', color:'#fff', fontSize:'14px', outline:'none', boxSizing:'border-box' }
const lbl = { display:'block', color:'#6b7280', fontSize:'11px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.07em' }

export default function ClientsPage() {
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState({})
  const [expanded, setExpanded] = useState({})

  // New client form
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientDesc, setNewClientDesc] = useState('')
  const [savingClient, setSavingClient] = useState(false)

  // New project form (per client)
  const [addingProject, setAddingProject] = useState(null) // clientName
  const [newProjName, setNewProjName] = useState('')
  const [savingProj, setSavingProj] = useState(false)

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('xantie_user')||'{}')
    setCurrentUser(u)
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [c, p] = await Promise.all([
        fetch('/api/clients').then(r=>r.json()),
        fetch('/api/projects').then(r=>r.json()),
      ])
      setClients(c||[])
      setProjects(p||[])
    } catch(e){}
    setLoading(false)
  }

  async function addClient() {
    if (!newClientName.trim()) return
    setSavingClient(true)
    const u = JSON.parse(sessionStorage.getItem('xantie_user')||'{}')
    await fetch('/api/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newClientName.trim(),description:newClientDesc,createdBy:u.email})})
    setNewClientName(''); setNewClientDesc(''); setShowNewClient(false); setSavingClient(false)
    load()
  }

  async function addProject(clientName) {
    if (!newProjName.trim() || newProjName.trim()==='N/A') return
    setSavingProj(true)
    const u = JSON.parse(sessionStorage.getItem('xantie_user')||'{}')
    await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newProjName.trim(),clientName,createdBy:u.email})})
    setNewProjName(''); setAddingProject(null); setSavingProj(false)
    load()
  }

  async function deleteClient(name) {
    await fetch('/api/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',name})})
    setDeleteConfirm(null); load()
  }

  async function deleteProject(name, clientName) {
    if (name === 'N/A') return
    await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',name,clientName})})
    load()
  }

  const isAdmin = currentUser.role === 'admin'

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,margin:0}}>Clients</h1>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'4px 0 0'}}>Manage clients and their projects</p>
        </div>
        {isAdmin && (
          <button onClick={()=>setShowNewClient(true)}
            style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'10px 20px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
            + New Client
          </button>
        )}
      </div>

      {loading && <div style={{color:'#6b7280',textAlign:'center',padding:'48px'}}>Loading...</div>}

      {!loading && clients.length===0 && (
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'14px',padding:'56px',textAlign:'center'}}>
          <div style={{fontSize:'36px',marginBottom:'12px'}}>🏢</div>
          <p style={{color:'#6b7280',margin:0}}>No clients yet. Add your first client above.</p>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
        {clients.map(client => {
          const clientProjects = projects.filter(p=>p.clientName===client.name)
          const isExpanded = expanded[client.name]
          return (
            <div key={client.name} style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',overflow:'hidden'}}>
              {/* Client header row */}
              <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'16px 20px',cursor:'pointer'}}
                onClick={()=>setExpanded(e=>({...e,[client.name]:!e[client.name]}))}>
                <span style={{color:'#4b5563',fontSize:'12px',transform:isExpanded?'rotate(90deg)':'',transition:'transform 0.15s',display:'inline-block'}}>▶</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:'15px',color:'#fff'}}>{client.name}</div>
                  {client.description&&<div style={{fontSize:'12px',color:'#6b7280',marginTop:'2px'}}>{client.description}</div>}
                </div>
                <span style={{fontSize:'12px',color:'#4b5563',fontWeight:600,background:'#1a1a1a',borderRadius:'6px',padding:'3px 10px'}}>
                  {clientProjects.length} project{clientProjects.length!==1?'s':''}
                </span>
                {isAdmin && (
                  <button onClick={e=>{e.stopPropagation();setDeleteConfirm(client.name)}}
                    style={{background:'none',border:'none',color:'#4b5563',fontSize:'16px',cursor:'pointer',padding:'4px 8px',borderRadius:'6px'}}
                    onMouseEnter={e=>e.currentTarget.style.color='#f87171'}
                    onMouseLeave={e=>e.currentTarget.style.color='#4b5563'}>✕</button>
                )}
              </div>

              {/* Projects list (expanded) */}
              {isExpanded && (
                <div style={{borderTop:'1px solid #1e1e1e',background:'#0f0f0f',padding:'12px 20px'}}>
                  {clientProjects.map(proj => (
                    <div key={proj.name} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',borderRadius:'8px',marginBottom:'4px'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#1a1a1a'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <div style={{width:'6px',height:'6px',borderRadius:'50%',background:proj.name==='N/A'?'#3a3a3a':'#8DC63F',flexShrink:0}}/>
                      <span style={{fontSize:'13px',color:proj.name==='N/A'?'#4b5563':'#d1d5db',flex:1,fontStyle:proj.name==='N/A'?'italic':''}}>{proj.name}</span>
                      {isAdmin && proj.name !== 'N/A' && (
                        <button onClick={()=>deleteProject(proj.name, proj.clientName)}
                          style={{background:'none',border:'none',color:'#3a3a3a',fontSize:'13px',cursor:'pointer',padding:'2px 6px'}}
                          onMouseEnter={e=>e.currentTarget.style.color='#f87171'}
                          onMouseLeave={e=>e.currentTarget.style.color='#3a3a3a'}>✕</button>
                      )}
                    </div>
                  ))}

                  {/* Add project inline */}
                  {isAdmin && (
                    addingProject===client.name ? (
                      <div style={{display:'flex',gap:'8px',padding:'8px 12px',marginTop:'8px'}}>
                        <input autoFocus value={newProjName} onChange={e=>setNewProjName(e.target.value)}
                          onKeyDown={e=>{if(e.key==='Enter')addProject(client.name);if(e.key==='Escape'){setAddingProject(null);setNewProjName('')}}}
                          placeholder="Project name..." style={{...inp,padding:'7px 12px',flex:1}}/>
                        <button onClick={()=>addProject(client.name)} disabled={savingProj||!newProjName.trim()}
                          style={{background:'#8DC63F',color:'#0a0a0a',border:'none',borderRadius:'8px',padding:'7px 16px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
                          Add
                        </button>
                        <button onClick={()=>{setAddingProject(null);setNewProjName('')}}
                          style={{background:'#252525',border:'none',color:'#9ca3af',borderRadius:'8px',padding:'7px 12px',fontSize:'13px',cursor:'pointer'}}>✕</button>
                      </div>
                    ) : (
                      <button onClick={()=>setAddingProject(client.name)}
                        style={{background:'none',border:'1px dashed #252525',borderRadius:'8px',color:'#4b5563',fontSize:'12px',fontWeight:600,padding:'7px 16px',cursor:'pointer',margin:'8px 12px',transition:'all 0.15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='#8DC63F';e.currentTarget.style.color='#8DC63F'}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='#252525';e.currentTarget.style.color='#4b5563'}}>
                        + Add Project
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* New Client Modal */}
      {showNewClient && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowNewClient(false)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px',width:'420px',maxWidth:'90vw'}} onClick={e=>e.stopPropagation()}>
            <h2 style={{margin:'0 0 24px',fontSize:'18px'}}>New Client</h2>
            <div style={{marginBottom:'16px'}}>
              <label style={lbl}>Client Name *</label>
              <input autoFocus value={newClientName} onChange={e=>setNewClientName(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&addClient()} placeholder="e.g. Acme Corporation" style={inp}/>
            </div>
            <div style={{marginBottom:'24px'}}>
              <label style={lbl}>Description</label>
              <input value={newClientDesc} onChange={e=>setNewClientDesc(e.target.value)} placeholder="Optional" style={inp}/>
            </div>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={addClient} disabled={savingClient||!newClientName.trim()}
                style={{flex:1,background:newClientName.trim()?'#8DC63F':'#2a2a2a',color:newClientName.trim()?'#0a0a0a':'#4b5563',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:700,cursor:newClientName.trim()?'pointer':'not-allowed'}}>
                {savingClient?'Creating...':'Create Client'}
              </button>
              <button onClick={()=>setShowNewClient(false)} style={{padding:'12px 20px',background:'#252525',border:'none',borderRadius:'8px',color:'#9ca3af',cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setDeleteConfirm(null)}>
          <div style={{background:'#141414',border:'1px solid #252525',borderRadius:'16px',padding:'28px',width:'380px',maxWidth:'90vw'}} onClick={e=>e.stopPropagation()}>
            <h2 style={{margin:'0 0 12px',fontSize:'18px'}}>Delete Client?</h2>
            <p style={{color:'#9ca3af',margin:'0 0 24px',fontSize:'14px'}}>Delete <strong style={{color:'#fff'}}>{deleteConfirm}</strong> and all its projects? Time entries referencing this client will be unaffected.</p>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={()=>deleteClient(deleteConfirm)} style={{flex:1,background:'#f87171',color:'#fff',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>Delete</button>
              <button onClick={()=>setDeleteConfirm(null)} style={{padding:'12px 20px',background:'#252525',border:'none',borderRadius:'8px',color:'#9ca3af',cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}