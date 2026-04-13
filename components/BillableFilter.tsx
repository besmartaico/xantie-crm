// @ts-nocheck
export default function BillableFilter({ value, onChange }) {
  const opts = [
    { v: '', label: 'All' },
    { v: 'yes', label: 'Billable' },
    { v: 'no', label: 'Non-Billable' },
  ]
  return (
    <div style={{display:'flex',gap:'0',borderRadius:'8px',overflow:'hidden',border:'1px solid #252525'}}>
      {opts.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          style={{
            padding:'8px 14px', border:'none', fontSize:'13px', fontWeight:600, cursor:'pointer',
            background: value===o.v ? '#8DC63F' : '#111111',
            color: value===o.v ? '#0a0a0a' : '#6b7280',
            transition:'all 0.15s',
          }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}