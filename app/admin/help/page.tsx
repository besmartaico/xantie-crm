// @ts-nocheck
'use client'
import { useState } from 'react'

const sectionStyle = { background:'#141414', border:'1px solid #1e1e1e', borderRadius:'12px', marginBottom:'12px', overflow:'hidden' }
const headerStyle = { padding:'14px 18px', cursor:'pointer', display:'flex', alignItems:'center', gap:'12px', userSelect:'none' }
const bodyStyle = { padding:'4px 22px 18px', borderTop:'1px solid #1e1e1e', color:'#d1d5db', fontSize:'14px', lineHeight:1.7 }
const h3 = { fontSize:'13px', fontWeight:700, color:'#8DC63F', textTransform:'uppercase', letterSpacing:'0.06em', margin:'18px 0 8px' }
const tipBox = { background:'rgba(141,198,63,0.08)', border:'1px solid rgba(141,198,63,0.25)', borderRadius:'8px', padding:'10px 14px', margin:'10px 0', fontSize:'13px', color:'#cbd5e1' }
const codeChip = { background:'#1a1a1a', border:'1px solid #252525', borderRadius:'4px', padding:'1px 6px', fontSize:'12px', fontFamily:'ui-monospace,monospace', color:'#8DC63F' }

function Section({ title, icon, children, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div style={sectionStyle}>
      <div style={headerStyle} onClick={()=>setOpen(!open)}>
        <span style={{fontSize:'20px'}}>{icon}</span>
        <h2 style={{flex:1, margin:0, fontSize:'16px', fontWeight:700, color:'#fff'}}>{title}</h2>
        <span style={{color:'#6b7280', fontSize:'12px', transform: open?'rotate(90deg)':'', transition:'transform 0.15s'}}>▶</span>
      </div>
      {open && <div style={bodyStyle}>{children}</div>}
    </div>
  )
}

export default function HelpPage() {
  return (
    <div>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'22px', fontWeight:700, margin:0}}>How to Use Xantie CRM</h1>
        <p style={{color:'#6b7280', fontSize:'13px', margin:'4px 0 0'}}>
          Tap any section to expand. New here? Start with <strong style={{color:'#8DC63F'}}>Getting Started</strong>.
        </p>
      </div>

      <Section icon="👋" title="Getting Started" defaultOpen>
        <p>Welcome to Xantie CRM — your time tracking, project management, and team coordination hub.</p>
        <h3 style={h3}>Signing in</h3>
        <p>Sign in with your <span style={codeChip}>@xantie.com</span> email. If you don't have an account yet, register from the login page — your role defaults to Editor.</p>
        <h3 style={h3}>Your role</h3>
        <ul style={{paddingLeft:'18px'}}>
          <li><strong style={{color:'#fff'}}>Editor</strong> — Default for employees. Log your own time, submit time off and feedback, use boards.</li>
          <li><strong style={{color:'#fff'}}>Viewer</strong> — Bookkeepers/auditors. Read-only access to all team data.</li>
          <li><strong style={{color:'#fff'}}>Admin</strong> — Full access. Manage users, clients, approvals, imports.</li>
        </ul>
      </Section>

      <Section icon="📊" title="Dashboard">
        <p>Your overview of hours worked. Editors see only their own data; Viewers and Admins see everyone.</p>
        <h3 style={h3}>Filters</h3>
        <ul style={{paddingLeft:'18px'}}>
          <li><strong>Date range</strong> — All Time, This/Last Month, This/Last Pay Period (1st–15th, 16th–end), This Quarter, This Year, Custom Range</li>
          <li><strong>Employee</strong> filter (admin/viewer only)</li>
          <li><strong>Billable</strong> — billable, non-billable, or all</li>
        </ul>
        <h3 style={h3}>Chart granularity</h3>
        <p>Toggle the chart x-axis: <span style={codeChip}>Auto</span> <span style={codeChip}>Day</span> <span style={codeChip}>Week</span> <span style={codeChip}>Month</span></p>
        <h3 style={h3}>Export CSV</h3>
        <p>Click <span style={codeChip}>↓ Export CSV</span> top-right. Whatever filters you have active is what gets exported.</p>
      </Section>

      <Section icon="⏱️" title="Time Entries">
        <h3 style={h3}>Adding time</h3>
        <ol style={{paddingLeft:'18px'}}>
          <li>Click <span style={codeChip}>+ Add Entry</span></li>
          <li>The modal shows the full Mon–Sun week</li>
          <li>Pick a <strong>Client</strong>, then a <strong>Project</strong> if needed</li>
          <li>Enter hours per day, mark Billable / Non-Billable, add a description</li>
          <li>Click Save</li>
        </ol>
        <h3 style={h3}>Logging a previous week</h3>
        <p>Click <span style={codeChip}>+ Add previous week</span> to prepend prior 7 days, or use the "Week starting" date picker.</p>
        <div style={tipBox}>💡 The description applies to every day in that batch. For different descriptions, save in separate batches.</div>
      </Section>

      <Section icon="🌴" title="Time Off">
        <h3 style={h3}>Requesting</h3>
        <ol style={{paddingLeft:'18px'}}>
          <li>Go to Time Off → <strong>Request Time Off</strong></li>
          <li>Pick start/end dates (click anywhere in the field to open calendar)</li>
          <li>Add notes, click Submit</li>
        </ol>
        <p>Admins are notified by email. Track status under <strong>My Requests</strong>.</p>
        <h3 style={h3}>For admins</h3>
        <p>Switch to <strong>All Requests</strong> to approve or deny via the dropdown.</p>
      </Section>

      <Section icon="🐛" title="Bugs & Feature Requests">
        <h3 style={h3}>Submitting</h3>
        <p>Pick Bug or Feature, write a clear title and details, set priority, click Submit.</p>
        <h3 style={h3}>Discussion</h3>
        <p>Click any item to view full details. You can edit your own (admins can edit anyone's), post comments, and see status updates.</p>
        <p>Admins move status: Open → In Progress → Done → Closed.</p>
      </Section>

      <Section icon="📋" title="Boards">
        <p>Trello-style boards for tracking work.</p>
        <h3 style={h3}>Creating</h3>
        <p>Boards → <span style={codeChip}>+ New Board</span> → name, description, color → Create.</p>
        <h3 style={h3}>Working a board</h3>
        <ul style={{paddingLeft:'18px'}}>
          <li>Add columns with <span style={codeChip}>+ Add Column</span></li>
          <li>Double-click a column title to rename</li>
          <li>Add cards with <span style={codeChip}>+ Add card</span></li>
          <li>Drag cards between columns</li>
          <li>Click any card to edit details, set priority, due date, assignee</li>
        </ul>
        <h3 style={h3}>Sharing</h3>
        <p>Click <span style={codeChip}>Share</span> in the board header to add Xantie users. Shared boards appear under "Shared With You" on their boards page.</p>
      </Section>

      <Section icon="🏢" title="Clients & Projects (Admin)">
        <p>Hierarchy: <strong style={{color:'#fff'}}>Client</strong> → <strong style={{color:'#fff'}}>Project</strong>.</p>
        <p>Each new client gets an <span style={codeChip}>N/A</span> default project so people can log time without a sub-project.</p>
        <p>Expand a client card and click <span style={codeChip}>+ Add Project</span> to add specific projects.</p>
      </Section>

      <Section icon="👥" title="Users (Admin)">
        <h3 style={h3}>Roles</h3>
        <p>Use the dropdown next to the user's role. Saves automatically.</p>
        <h3 style={h3}>Inactivate / Reactivate</h3>
        <p>Disabling preserves their data. Reactivate later to restore access.</p>
        <h3 style={h3}>View As (Impersonation)</h3>
        <p>See the app exactly as another user does — useful for debugging or training. A yellow banner reminds you you're impersonating. Click <span style={codeChip}>Exit — Back to Admin</span> to return.</p>
      </Section>

      <Section icon="📥" title="Import (Admin)">
        <p>Bulk-import historical time entries from CSV. Columns must match the Time Entries sheet headers.</p>
      </Section>

      <Section icon="📱" title="Tips & Tricks">
        <h3 style={h3}>Date inputs</h3>
        <p>Click anywhere in a date field — the whole field opens the calendar.</p>
        <h3 style={h3}>Mobile</h3>
        <p>Tap <span style={codeChip}>☰</span> in the top-left for the navigation drawer.</p>
        <h3 style={h3}>Numbers</h3>
        <p>All hour totals show commas — 4,684.9 not 4684.9.</p>
        <h3 style={h3}>Found a bug?</h3>
        <p>Submit it under <strong>Feedback</strong>. Include what you clicked, what you expected, and what happened. Screenshots help.</p>
      </Section>

      <div style={{textAlign:'center', color:'#4b5563', fontSize:'12px', margin:'32px 0 16px'}}>
        Need something not covered? Drop a feature request in <strong style={{color:'#6b7280'}}>Feedback</strong>.
      </div>
    </div>
  )
}