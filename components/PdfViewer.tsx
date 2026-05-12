// @ts-nocheck
'use client'
import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Use the worker shipped with pdfjs-dist via cdnjs to avoid bundler issues
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
}

export default function PdfViewer({ fileUrl, fields, onAddFieldAtPage, onUpdateField, onRemoveField, scale = 1.2 }) {
  const [numPages, setNumPages] = useState(0)
  const [visiblePage, setVisiblePage] = useState(1)
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function handleScroll() {
      // Find the page wrapper most visible in the container's viewport
      const pages = el.querySelectorAll('[data-page]')
      const containerRect = el.getBoundingClientRect()
      let bestPage = 1, bestVisible = 0
      pages.forEach(p => {
        const r = p.getBoundingClientRect()
        const top = Math.max(r.top, containerRect.top)
        const bottom = Math.min(r.bottom, containerRect.bottom)
        const visible = Math.max(0, bottom - top)
        if (visible > bestVisible) {
          bestVisible = visible
          bestPage = parseInt(p.getAttribute('data-page'), 10) || 1
        }
      })
      setVisiblePage(bestPage)
    }
    el.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => el.removeEventListener('scroll', handleScroll)
  }, [numPages])

  // Notify parent of visible page so its "Add field" buttons know which page
  useEffect(() => {
    if (typeof onAddFieldAtPage === 'function') onAddFieldAtPage._visiblePage = visiblePage
  }, [visiblePage, onAddFieldAtPage])

  return (
    <div ref={containerRef} style={{flex:1,overflow:'auto',background:'#0a0a0a',padding:'16px',borderRadius:'12px',border:'1px solid #1e1e1e',position:'relative'}}>
      <div style={{position:'sticky',top:0,zIndex:5,background:'rgba(10,10,10,0.85)',backdropFilter:'blur(6px)',padding:'4px 10px',color:'#8DC63F',fontSize:'12px',fontWeight:600,marginBottom:'8px',borderRadius:'6px',display:'inline-block'}}>
        Page {visiblePage} / {numPages || '…'}
      </div>
      <Document file={fileUrl} onLoadSuccess={(p)=>setNumPages(p.numPages)}
        loading={<div style={{color:'#6b7280',padding:'40px',textAlign:'center'}}>Loading PDF...</div>}
        error={<div style={{color:'#f87171',padding:'40px',textAlign:'center'}}>Failed to load PDF</div>}>
        {Array.from({length: numPages}, (_, i) => {
          const pageNum = i + 1
          const pageFields = (fields || []).filter(f => f.page === pageNum)
          return (
            <div key={pageNum} data-page={pageNum}
              style={{position:'relative',marginBottom:'14px',background:'#fff',display:'inline-block'}}>
              <Page pageNumber={pageNum} scale={scale} renderTextLayer={false} renderAnnotationLayer={false}/>
              {pageFields.map(f => <FieldBox key={f.id} field={f} scale={scale} onUpdate={onUpdateField} onRemove={onRemoveField}/>)}
            </div>
          )
        })}
      </Document>
    </div>
  )
}

const TYPE_COLORS = {
  signature: { border:'#60a5fa', bg:'rgba(96,165,250,0.18)', label:'Signature' },
  initials:  { border:'#a78bfa', bg:'rgba(167,139,250,0.18)', label:'Initials' },
  text:      { border:'#34d399', bg:'rgba(52,211,153,0.18)', label:'Text' },
  date:      { border:'#fbbf24', bg:'rgba(251,191,36,0.18)', label:'Date' },
}
const ADMIN_OVERLAY = { border:'#f97316', bg:'rgba(249,115,22,0.18)' }

function FieldBox({ field, scale, onUpdate, onRemove }) {
  const { Rnd } = require('react-rnd')
  const baseC = TYPE_COLORS[field.type] || TYPE_COLORS.text
  const c = field.assignee === 'admin' ? { ...baseC, border: ADMIN_OVERLAY.border, bg: ADMIN_OVERLAY.bg } : baseC
  return (
    <Rnd
      size={{ width: field.width * scale, height: field.height * scale }}
      position={{ x: field.x * scale, y: field.y * scale }}
      onDragStop={(_, d) => onUpdate && onUpdate(field.id, { x: d.x / scale, y: d.y / scale })}
      onResizeStop={(_e, _d, ref, _delta, position) => onUpdate && onUpdate(field.id, {
        width: parseFloat(ref.style.width) / scale,
        height: parseFloat(ref.style.height) / scale,
        x: position.x / scale,
        y: position.y / scale,
      })}
      bounds="parent"
      style={{border:'2px solid '+c.border,background:c.bg,zIndex:3,display:'flex',alignItems:'center',justifyContent:'center',color:c.border,fontSize:'11px',fontWeight:700,cursor:'move',borderRadius:'2px'}}>
      <span style={{pointerEvents:'none',userSelect:'none'}}>{field.label || baseC.label}{field.assignee === 'admin' ? ' (admin)' : ''}</span>
    </Rnd>
  )
}
