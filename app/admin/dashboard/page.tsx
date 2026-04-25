Object.keys(byMonth).length>0&&(
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'20px'}}>
          <h3 style={{margin:'0 0 20px',fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Hours by Month</h3>
          {(() => {
            const entries = Object.entries(byMonth).sort((a,b)=>a[0].localeCompare(b[0]))
            if (!entries.length) return null
            const vals = entries.map(([,v])=>v)
            const maxVal = Math.max(...vals, 1)
            const W = 600, H = 160, padL = 44, padR = 16, padT = 16, padB = 36
            const chartW = W - padL - padR
            const chartH = H - padT - padB
            const pts = entries.map(([,v],i) => ({
              x: padL + (entries.length===1 ? chartW/2 : i/(entries.length-1)*chartW),
              y: padT + chartH - (v/maxVal)*chartH,
              v, label: monthLabel(entries[i][0])
            }))
            const polyline = pts.map(p=>p.x+','+p.y).join(' ')
            // Grid lines
            const gridCount = 4
            const grids = Array.from({length:gridCount+1},(_,i)=>({
              y: padT + (i/gridCount)*chartH,
              val: maxVal*(1-i/gridCount)
            }))
            return (
              <div style={{overflowX:'auto'}}>
                <svg viewBox={'0 0 '+W+' '+H} style={{width:'100%',minWidth:'300px',display:'block'}}>
                  {/* Grid lines */}
                  {grids.map((g,i)=>(
                    <g key={i}>
                      <line x1={padL} y1={g.y} x2={W-padR} y2={g.y} stroke="#1e1e1e" strokeWidth="1"/>
                      <text x={padL-6} y={g.y+4} textAnchor="end" fontSize="9" fill="#4b5563">{g.val>0?g.val.toFixed(0):''}</text>
                    </g>
                  ))}
                  {/* Area fill */}
                  <polygon
                    points={[pts[0].x+','+(padT+chartH), ...pts.map(p=>p.x+','+p.y), pts[pts.length-1].x+','+(padT+chartH)].join(' ')}
                    fill="rgba(141,198,63,0.08)"/>
                  {/* Line */}
                  <polyline points={polyline} fill="none" stroke="#8DC63F" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                  {/* Dots + labels */}
                  {pts.map((p,i)=>(
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="4" fill="#8DC63F" stroke="#141414" strokeWidth="2"/>
                      <text x={p.x} y={p.y-10} textAnchor="middle" fontSize="9" fill="#8DC63F" fontWeight="700">{p.v.toFixed(1)}</text>
                      <text x={p.x} y={H-8} textAnchor="middle" fontSize="9" fill="#6b7280">{p.label}</text>
                    </g>
                  ))}
                </svg>
              </div>
            )
          })()}
        </div>
      )Object.keys(byMonth).length>0&&(
        <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'20px'}}>
          <h3 style={{margin:'0 0 20px',fontSize:'13px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>Hours by Month</h3>
          <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
            {Object.entries(byMonth).sort().map(([month,hrs])=>(
              <div key={month} style={{background:'#1a1a1a',border:'1px solid #252525',borderRadius:'8px',padding:'14px 18px',minWidth:'90px',textAlign:'center'}}>
                <div style={{fontSize:'20px',fontWeight:700,color:'#8DC63F'}}>{hrs.toFixed(1)}h</div>
                <div style={{fontSize:'11px',color:'#6b7280',marginTop:'3px'}}>{month}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}