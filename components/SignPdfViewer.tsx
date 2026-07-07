// @ts-nocheck
'use client'
import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
}

const TYPE_COLORS = {
  signature: { border:'#60a5fa', bg:'rgba(96,165,250,0.16)', label:'Sign here' },
  initials:  { border:'#a78bfa', bg:'rgba(167,139,250,0.16)', label:'Initials' },
  text:      { border:'#34d399', bg:'rgba(52,211,153,0.16)', label:'Type here' },
  date:      { border:'#fbbf24', bg:'rgba(251,191,36,0.16)', label:'Date' },
}

export default function SignPdfViewer({ fileUrl, fields, values, onClickField, scale = 1.2, restrictedAssignee, readOnlyFieldIds }) {
  // restrictedAssignee: if set, fields with field.assignee !== restrictedAssignee are shown but not clickable.
  // readOnlyFieldIds: set of field IDs that should be displayed (with their value) but not clickable (e.g., admin-prefilled).
  const readOnlySet = new Set(Array.isArray(readOnlyFieldIds) ? readOnlyFieldIds : (readOnlyFieldIds instanceof Set ? Array.from(readOnlyFieldIds) : []))
  const [numPages, setNumPages] = useState(0)
  // Original page dimensions (PDF points, i.e. scale 1) keyed by page number.
  const [pageDims, setPageDims] = useState({})
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Track the container's width so pages fit the screen (critical on mobile).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setContainerWidth(el.clientWidth)
    measure()
    let ro
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(measure); ro.observe(el) }
    if (typeof window !== 'undefined') window.addEventListener('resize', measure)
    return () => { if (ro) ro.disconnect(); if (typeof window !== 'undefined') window.removeEventListener('resize', measure) }
  }, [])

  const HPAD = 16
  const avail = containerWidth > 0 ? Math.max(120, containerWidth - HPAD * 2) : 0

  return (
    <div ref={containerRef} style={{flex:1,overflow:'auto',background:'#0a0a0a',padding:HPAD+'px',borderRadius:'12px',border:'1px solid #1e1e1e'}}>
      <Document file={fileUrl} onLoadSuccess={(p)=>setNumPages(p.numPages)}
        loading={<div style={{color:'#6b7280',padding:'40px',textAlign:'center'}}>Loading PDF...</div>}
        error={<div style={{color:'#f87171',padding:'40px',textAlign:'center'}}>Failed to load PDF</div>}>
        {avail > 0 && Array.from({length: numPages}, (_, i) => {
          const pageNum = i + 1
          const dim = pageDims[pageNum]
          // Fit the page to the container width, but never upscale past the desktop `scale` size.
          const renderW = dim ? Math.min(avail, dim.width * scale) : Math.min(avail, 800)
          // Effective scale that maps field coords (PDF points) → rendered pixels.
          const s = dim ? renderW / dim.width : scale
          const pageFields = (fields || []).filter(f => f.page === pageNum)
          return (
            <div key={pageNum} style={{position:'relative',marginBottom:'14px',background:'#fff',display:'inline-block',maxWidth:'100%'}}>
              <Page pageNumber={pageNum} width={renderW} renderTextLayer={false} renderAnnotationLayer={false}
                onLoadSuccess={(p)=>setPageDims(prev => (prev[pageNum] && prev[pageNum].width === p.originalWidth) ? prev : ({ ...prev, [pageNum]: { width: p.originalWidth, height: p.originalHeight } }))}/>
              {dim && pageFields.map(f => {
                const c = TYPE_COLORS[f.type] || TYPE_COLORS.text
                const val = values && values[f.id]
                const isReadOnly = readOnlySet.has(f.id) || (restrictedAssignee && f.assignee && f.assignee !== restrictedAssignee)
                const clickable = !isReadOnly
                return (
                  <div key={f.id} onClick={()=>clickable && onClickField && onClickField(f)}
                    title={isReadOnly ? (f.assignee === 'admin' ? 'Filled by admin' : 'Not your field') : (f.label || c.label)}
                    style={{position:'absolute',left:f.x*s,top:f.y*s,width:f.width*s,height:f.height*s,border:'2px solid '+(isReadOnly && f.assignee==='admin' ? '#f9731680' : c.border),background: val ? 'rgba(255,255,255,0.95)' : (isReadOnly ? 'rgba(0,0,0,0.04)' : c.bg),cursor:clickable?'pointer':'default',opacity: isReadOnly && !val ? 0.45 : 1, display:'flex',alignItems:'center',justifyContent:'center',color: val ? '#0a0a0a' : c.border,fontSize:'12px',fontWeight:600,borderRadius:'2px',overflow:'hidden'}}>
                    {val ? <PreviewValue type={f.type} value={val}/> : (f.label || c.label)}
                  </div>
                )
              })}
            </div>
          )
        })}
      </Document>
    </div>
  )
}

function PreviewValue({ type, value }) {
  if (type === 'signature' || type === 'initials') {
    return <img src={value} alt="" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/>
  }
  return <span style={{padding:'0 4px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',width:'100%',textAlign:'left',fontSize:'13px'}}>{value}</span>
}

// SignatureCanvas — draw your signature
export function SignatureCanvas({ value, onChange, height = 150 }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef({x:0,y:0})

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#0a0a0a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      img.src = value
    }
  }, [])

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const touch = e.touches && e.touches[0]
    return {
      x: ((touch ? touch.clientX : e.clientX) - rect.left) * (canvasRef.current.width / rect.width),
      y: ((touch ? touch.clientY : e.clientY) - rect.top) * (canvasRef.current.height / rect.height),
    }
  }

  function start(e) {
    e.preventDefault()
    drawing.current = true
    last.current = getPos(e)
  }
  function move(e) {
    if (!drawing.current) return
    e.preventDefault()
    const pos = getPos(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    last.current = pos
  }
  function end() {
    if (!drawing.current) return
    drawing.current = false
    onChange && onChange(canvasRef.current.toDataURL('image/png'))
  }
  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    onChange && onChange('')
  }

  return (
    <div>
      <canvas ref={canvasRef} width={600} height={height}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        style={{width:'100%',height:height+'px',background:'#fff',borderRadius:'8px',border:'1px solid #2a2a2a',cursor:'crosshair',touchAction:'none'}}/>
      <div style={{display:'flex',justifyContent:'flex-end',marginTop:'8px'}}>
        <button onClick={clear} style={{background:'none',border:'1px solid #2a2a2a',color:'#9ca3af',borderRadius:'6px',padding:'6px 12px',fontSize:'12px',cursor:'pointer'}}>Clear</button>
      </div>
    </div>
  )
}
