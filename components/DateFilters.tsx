// @ts-nocheck
'use client'

const DATE_OPTIONS = [
  { value: '', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
]

const sel = { background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'8px 12px', color:'#fff', fontSize:'13px', cursor:'pointer', outline:'none' }
const inp = { background:'#111111', border:'1px solid #252525', borderRadius:'8px', padding:'8px 10px', color:'#fff', fontSize:'13px', outline:'none' }

export default function DateFilters({ dateFilter, setDateFilter, customStart, setCustomStart, customEnd, setCustomEnd, employees=[], employeeFilter, setEmployeeFilter }) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:'10px',alignItems:'center'}}>
      <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={sel}>
        {DATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {dateFilter === 'custom' && (
        <>
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={inp} />
          <span style={{color:'#6b7280',fontSize:'13px'}}>to</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={inp} />
        </>
      )}
      {employees.length > 0 && (
        <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} style={sel}>
          <option value="">All Employees</option>
          {employees.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      )}
    </div>
  )
}