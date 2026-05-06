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
          <li><strong style={{color:'#fff'}}>Editor</strong> — Default for employees. Log your own time, submit time off, submit feedback, use boards.</li>
          <li><strong style={{color:'#fff'}}>Viewer</strong> — Bookkeepers/auditors. Read-only access to <em>all</em> team data — see everyone's hours, but cannot add or edit anything.</li>
          <li><strong style={{color:'#fff'}}>Admin</strong> — Full access. Manage users, clients, approve time off, set status on feedback, run imports.</li>
        </ul>
        <div style={tipBox}>
          💡 Don't see a section in the sidebar? It's only available to admins. Ask Jeff if you think you should have access.
        </div>
      </Section>

      <Section icon="📊" title="Dashboard">
        <p>The Dashboard is your overview of hours worked. Editors see only their own data; Viewers and Admins see everyone.</p>

        <h3 style={h3}>Filters</h3>
        <p>Use the filter row at the top to narrow what you're looking at:</p>
        <ul style={{paddingLeft:'18px'}}>
          <li><strong>Date range</strong> — All Time, This Month, Last Month, <strong style={{color:'#8DC63F'}}>This Pay Period</strong> (1st–15th or 16th–end), <strong style={{color:'#8DC63F'}}>Last Pay Period</strong>, This Quarter, This Year, or Custom Range</li>
          <li><strong>Employee</strong> — only visible to admins/viewers</li>
          <li><strong>Billable</strong> — show only billable, non-billable, or all</li>
        </ul>

        <h3 style={h3}>Chart granularity</h3>
        <p>Above the chart there's a 4-button toggle: <span style={codeChip}>Auto</span> <span style={codeChip}>Day</span> <span style={codeChip}>Week</span> <span style={codeChip}>Month</span></p>
        <p><strong>Auto</strong> picks daily for short ranges and monthly for longer ones. Override anytime to see the data the way you want.</p>

        <h3 style={h3}>Export CSV</h3>
        <p>Click <span style={codeChip}>↓ Export CSV</span> in the top-right. The export respects every active filter — what you see on the dashboard is what gets exported.</p>
      </Section>

      <Section icon="⏱️" title="Time Entries">
        <p>Log the hours you've worked across the week.</p>

        <h3 style={h3}>Adding time</h3>
        <ol style={{paddingLeft:'18px'}}>
          <li>Click <span style={codeChip}>+ Add Entry</span></li>
          <li>The modal opens showing the full Mon–Sun week</li>
          <li>Pick a <strong>Client</strong> from the dropdown</li>
          <li>If the client has sub-projects, pick a <strong>Project</strong> (otherwise it stays "N/A")</li>
          <li>Add a <strong>Description</strong> of what you worked on</li>
          <li>Enter hours per day, choose Billable / Non-Billable</li>
          <li>Click <span style={codeChip}>Save</span></li>
        </ol>

        <h3 style={h3}>Logging a previous week</h3>
        <p>Need to enter time for a week you missed? Click <span style={codeChip}>+ Add previous week</span> at the bottom of the modal — it prepends the prior 7 days. Or use the "Week starting" date picker at the top to jump to any week.</p>

        <h3 style={h3}>Editing or deleting</h3>
        <p>Find the entry in the table and click the pencil icon to edit, or the trash icon to delete. Editors can only edit their own entries.</p>

        <div style={tipBox}>
          💡 The description applies to every day in that week's batch. If different days need different descriptions, save them in separate batches.
        </div>
      </Section>

      <Section icon="🌴" title="Time Off">
        <p>Submit time-off requests and track their status.</p>

        <h3 style={h3}>Requesting time off</h3>
        <ol style={{paddingLeft:'18px'}}>
          <li>Go to <strong>Time Off</strong> → <strong>Request Time Off</strong> tab</li>
          <li>Pick a <strong>Start Date</strong> and <strong>End Date</strong> — click anywhere in the date field to open the calendar</li>
          <li>Add notes about the reason or any context for managers</li>
          <li>Click <span style={codeChip}>Submit Request</span></li>
        </ol>
        <p>Admins are notified by email. Track your request status under <strong>My Requests</strong>.</p>

        <h3 style={h3}>For admins</h3>
        <p>Switch to the <strong>All Requests</strong> tab to see everyone's requests. Use the dropdown next to each request to mark it Pending, Approved, or Denied.</p>
      </Section>

      <Section icon="🐛" title="Bugs & Feature Requests (Feedback)">
        <p>Report issues or suggest improvements. The team uses this to track what needs to change.</p>

        <h3 style={h3}>Submitting</h3>
        <ol style={{paddingLeft:'18px'}}>
          <li>Pick <strong>🐛 Bug</strong> or <strong>💡 Feature Request</strong></li>
          <li>Write a clear title and detailed description</li>
          <li>Set priority: Low / Medium / High</li>
          <li>Click <span style={codeChip}>Submit</span></li>
        </ol>

        <h3 style={h3}>Discussion</h3>
        <p>Click any item in the list to open the full detail view. You can:</p>
        <ul style={{paddingLeft:'18px'}}>
          <li>Read the full description (no truncation)</li>
          <li>Edit your own submissions (admins can edit anyone's)</li>
          <li>Post comments to discuss with the team</li>
          <li>See the current status and priority</li>
        </ul>
        <p>Admins update the status (Open → In Progress → Done → Closed) from the detail view.</p>
      </Section>

      <Section icon="📋" title="Boards (Project Management)">
        <p>Trello-style boards for tracking work. Each user can create boards and share them with others.</p>

        <h3 style={h3}>Creating a board</h3>
        <ol style={{paddingLeft:'18px'}}>
          <li>Go to <strong>Boards</strong> and click <span style={codeChip}>+ New Board</span></li>
          <li>Name it, add an optional description, pick a color</li>
          <li>Click <span style={codeChip}>Create Board</span></li>
        </ol>

        <h3 style={h3}>Working a board</h3>
        <ul style={{paddingLeft:'18px'}}>
          <li><strong>Add columns</strong> with the <span style={codeChip}>+ Add Column</span> button at the right edge</li>
          <li><strong>Rename a column</strong> by double-clicking its title</li>
          <li><strong>Add cards</strong> using <span style={codeChip}>+ Add card</span> at the bottom of any column</li>
          <li><strong>Drag cards</strong> between columns to update their state</li>
          <li><strong>Click a card</strong> to edit title, description, priority, due date, assignee</li>
        </ul>

        <h3 style={h3}>Sharing</h3>
        <p>Click the <span style={codeChip}>Share · N</span> button in the board header. As the owner you can add any Xantie user, and they'll see the board under "Shared With You" on their boards page.</p>
      </Section>

      <Section icon="🏢" title="Clients & Projects (Admin only)">
        <p>The hierarchy is: <strong style={{color:'#fff'}}>Client</strong> → <strong style={{color:'#fff'}}>Project</strong>. Time entries reference both.</p>

        <h3 style={h3}>Adding a client</h3>
        <ol style={{paddingLeft:'18px'}}>
          <li>Go to <strong>Clients</strong> (admin section)</li>
          <li>Click <span style={codeChip}>+ New Client</span></li>
          <li>Every new client automatically gets an <span style={codeChip}>N/A</span> default project — so people can log time without picking a sub-project</li>
        </ol>

        <h3 style={h3}>Adding sub-projects</h3>
        <p>Expand a client card and click <span style={codeChip}>+ Add Project</span> to add specific projects under that client. These appear in the time entry dropdown when that client is selected.</p>

        <div style={tipBox}>
          ⚠️ Deleting a client only removes it from new dropdowns — existing time entries are unaffected.
        </div>
      </Section>

      <Section icon="👥" title="Users (Admin only)">
        <p>Manage who has access and what they can do.</p>

        <h3 style={h3}>Changing a role</h3>
        <p>Use the dropdown next to a user's role. Changes save automatically — no save button needed.</p>

        <h3 style={h3}>Deactivating a user</h3>
        <p>Click <span style={codeChip}>Inactivate</span>. Their account is disabled but their historical time entries are preserved. Reactivate them later by clicking <span style={codeChip}>Reactivate</span>.</p>

        <h3 style={h3}>Impersonation (View As)</h3>
        <p>Click <span style={codeChip}>View As</span> to see the app exactly as that user does. Helpful for debugging permissions or training. A yellow banner across the top reminds you you're impersonating — click <span style={codeChip}>Exit — Back to Admin</span> to switch back.</p>
      </Section>

      <Section icon="📥" title="Import (Admin only)">
        <p>Bulk-import historical time entries from CSV. The importer expects columns matching the Time Entries sheet headers.</p>
      </Section>

      <Section icon="📱" title="Tips & Tricks">
        <h3 style={h3}>Date inputs</h3>
        <p>Click anywhere inside a date field — the whole field is clickable to open the calendar.</p>

        <h3 style={h3}>Mobile</h3>
        <p>Tap the <span style={codeChip}>☰</span> hamburger icon in the top-left to open the navigation drawer.</p>

        <h3 style={h3}>Numbers</h3>
        <p>All hour totals are formatted with commas — 4,684.9 not 4684.9.</p>

        <h3 style={h3}>Something broken?</h3>
        <p>Submit it under <strong>Feedback</strong> as a bug. Include what you clicked, what you expected, and what happened instead. Screenshots help.</p>
      </Section>

      <div style={{textAlign:'center', color:'#4b5563', fontSize:'12px', margin:'32px 0 16px'}}>
        Need help that isn't covered here? Drop a feature request in <strong style={{color:'#6b7280'}}>Feedback</strong>.
      </div>
    </div>
  )
}