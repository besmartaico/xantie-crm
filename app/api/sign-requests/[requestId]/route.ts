// @ts-nocheck
import { NextResponse } from 'next/server'
import { put, list, del } from '@vercel/blob'
import { Resend } from 'resend'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { downloadPdfFromDrive } from '@/lib/googleDrive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BLOB_PREFIX = 'sign-requests/'

async function getRequestById(id) {
  const { blobs } = await list({ prefix: `${BLOB_PREFIX}${id}`, limit: 5 })
  const match = blobs.find(b => b.pathname === `${BLOB_PREFIX}${id}.json`)
  if (!match) return null
  const res = await fetch(match.url)
  const data = await res.json()
  return { record: data, blobUrl: match.url }
}

async function saveRequest(record) {
  const json = JSON.stringify(record)
  await put(`${BLOB_PREFIX}${record.id}.json`, json, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

function dataUrlToBytes(dataUrl) {
  const idx = dataUrl.indexOf(',')
  if (idx === -1) return null
  return Buffer.from(dataUrl.substring(idx + 1), 'base64')
}

async function generateSignedPdf(record) {
  const origBytes = await downloadPdfFromDrive(record.documentId)
  const pdfDoc = await PDFDocument.load(origBytes)
  const pages = pdfDoc.getPages()
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  for (const field of record.fields) {
    const val = record.values[field.id]
    if (!val) continue
    const pageIdx = (field.page || 1) - 1
    if (pageIdx < 0 || pageIdx >= pages.length) continue
    const page = pages[pageIdx]
    const { height: pageH } = page.getSize()
    const fx = field.x
    const fy = pageH - field.y - field.height
    const fw = field.width
    const fh = field.height

    if (field.type === 'signature' || field.type === 'initials') {
      const bytes = dataUrlToBytes(val)
      if (!bytes) continue
      let img
      try { img = await pdfDoc.embedPng(bytes) } catch { try { img = await pdfDoc.embedJpg(bytes) } catch { img = null } }
      if (!img) continue
      page.drawImage(img, { x: fx, y: fy, width: fw, height: fh })
    } else {
      const text = String(val)
      const fontSize = Math.min(fh * 0.6, 14)
      page.drawText(text, {
        x: fx + 4,
        y: fy + fh - fontSize - 2,
        size: fontSize,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      })
    }
  }

  const signedBytes = await pdfDoc.save()
  const dateStr = new Date().toISOString().split('T')[0]
  const safeName = (record.signerName || 'signer').replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'signer'
  const origName = (record.documentName || 'document.pdf').replace(/\.pdf$/i, '')
  const filename = `${origName} - ${safeName} - ${dateStr}.pdf`

  const blob = await put(filename, signedBytes, {
    access: 'public',
    contentType: 'application/pdf',
    addRandomSuffix: true,
  })

  return { url: blob.url, pathname: blob.pathname, filename, bytes: signedBytes }
}

export async function GET(_req, ctx) {
  try {
    const { requestId } = await ctx.params
    const found = await getRequestById(requestId)
    if (!found) return NextResponse.json({ error: 'Sign request not found' }, { status: 404 })
    return NextResponse.json(found.record)
  } catch(e) {
    console.error('GET sign-request error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Update values + transition state
// Body: { values: {...newValues}, source: 'user' | 'admin_post' }
export async function PUT(req, ctx) {
  try {
    const { requestId } = await ctx.params
    const body = await req.json()
    const newValues = body.values || {}
    const source = body.source

    const found = await getRequestById(requestId)
    if (!found) return NextResponse.json({ error: 'Sign request not found' }, { status: 404 })
    const record = found.record

    // Merge values
    record.values = { ...(record.values || {}), ...newValues }

    // State transitions
    if (source === 'user') {
      if (record.status !== 'pending_user') {
        return NextResponse.json({ error: 'This signing request has already been completed by the signer.' }, { status: 400 })
      }
      record.userSignedAt = new Date().toISOString()
      // Are there any admin fields still empty?
      const adminFieldsPending = record.fields.some(f => f.assignee === 'admin' && !record.values[f.id])
      if (adminFieldsPending) {
        record.status = 'pending_admin_post'
        // Notify admin
        if (process.env.ADMIN_NOTIFICATION_EMAIL && process.env.RESEND_API_KEY) {
          try {
            const resend = new Resend(process.env.RESEND_API_KEY)
            const base = process.env.APP_URL || 'https://crm.xantie.com'
            const url = `${base}/admin/sign-requests/${record.id}/finish`
            await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL || 'noreply@xantie.com',
              to: [process.env.ADMIN_NOTIFICATION_EMAIL],
              subject: `Signer completed: ${record.documentName} — your turn`,
              html: `
                <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a">
                  <h2 style="margin:0 0 12px">Signer completed their part</h2>
                  <p><strong>${record.signerName}</strong> (${record.signerEmail}) finished signing <strong>${record.documentName}</strong>.</p>
                  <p>You have remaining admin fields to fill.</p>
                  <p style="margin:24px 0"><a href="${url}" style="background:#8DC63F;color:#0a0a0a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Complete signing →</a></p>
                </div>`,
            })
          } catch(e) { console.error('admin notify failed:', e.message) }
        }
        await saveRequest(record)
        return NextResponse.json({ success: true, status: record.status })
      } else {
        // No admin fields left — finalize
        const pdf = await generateSignedPdf(record)
        record.signedPdfUrl = pdf.url
        record.status = 'complete'
        record.completedAt = new Date().toISOString()
        await saveRequest(record)
        return NextResponse.json({ success: true, status: record.status, signedPdfUrl: pdf.url })
      }
    }

    if (source === 'admin_post') {
      if (record.status !== 'pending_admin_post') {
        return NextResponse.json({ error: 'This signing request is not awaiting admin completion.' }, { status: 400 })
      }
      // Finalize
      const pdf = await generateSignedPdf(record)
      record.signedPdfUrl = pdf.url
      record.status = 'complete'
      record.completedAt = new Date().toISOString()
      await saveRequest(record)
      return NextResponse.json({ success: true, status: record.status, signedPdfUrl: pdf.url })
    }

    return NextResponse.json({ error: 'Invalid source; must be "user" or "admin_post"' }, { status: 400 })
  } catch(e) {
    console.error('PUT sign-request error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req, ctx) {
  try {
    const { requestId } = await ctx.params
    const found = await getRequestById(requestId)
    if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await del(found.blobUrl)
    return NextResponse.json({ success: true })
  } catch(e) {
    console.error('DELETE sign-request error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
