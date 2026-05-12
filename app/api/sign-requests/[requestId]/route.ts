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

function addEvent(record, type, message) {
  if (!Array.isArray(record.events)) record.events = []
  record.events.push({ at: new Date().toISOString(), type, message: message || '' })
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

async function generateSignedPdf(record, filenameSuffix) {
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
  const filename = `${origName} - ${safeName} - ${dateStr}${filenameSuffix||''}.pdf`

  const blob = await put(filename, signedBytes, {
    access: 'public',
    contentType: 'application/pdf',
    addRandomSuffix: true,
  })

  return { url: blob.url, pathname: blob.pathname, filename, bytes: signedBytes }
}

export async function GET(req, ctx) {
  try {
    const { requestId } = await ctx.params
    const found = await getRequestById(requestId)
    if (!found) return NextResponse.json({ error: 'Sign request not found' }, { status: 404 })
    const record = found.record
    // Log 'signer_viewed' the first time the signer hits this endpoint (only when status is pending_user)
    // Skip if the call appears to come from the admin UI (referer contains '/admin')
    const referer = req.headers.get('referer') || ''
    const isFromAdmin = referer.includes('/admin/')
    const alreadyViewed = Array.isArray(record.events) && record.events.some(e => e.type === 'signer_viewed')
    if (record.status === 'pending_user' && !alreadyViewed && !isFromAdmin) {
      addEvent(record, 'signer_viewed', 'Signer opened the signing page')
      try { await saveRequest(record) } catch(e) { console.warn('failed to persist signer_viewed event:', e.message) }
    }
    return NextResponse.json(record)
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
      const userFieldsFilled = record.fields.filter(f => (!f.assignee || f.assignee === 'user') && record.values[f.id]).length

      // Capture consent metadata (required for legal validity under ESIGN/UETA)
      if (body.consent && body.consent.agreed) {
        const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
        const ip = (ipHeader.split(',')[0] || '').trim()
        record.signerConsent = {
          agreed: true,
          agreedAt: body.consent.agreedAt || new Date().toISOString(),
          disclosureVersion: body.consent.disclosure || '',
          userAgent: body.consent.userAgent || '',
          ip: ip || null,
        }
        addEvent(record, 'consent_given', 'Signer consented to electronic signature' + (ip ? ' (IP: ' + ip + ')' : ''))
      }

      addEvent(record, 'signer_signed', 'Signer submitted ' + userFieldsFilled + ' field' + (userFieldsFilled===1?'':'s'))

      // Are there any admin fields still empty?
      const adminFieldsPending = record.fields.some(f => f.assignee === 'admin' && !record.values[f.id])
      if (adminFieldsPending) {
        record.status = 'pending_admin_post'
        // Generate a partial PDF so the signer can download a copy of what they signed.
        try {
          const partial = await generateSignedPdf(record, '-partial-signer')
          record.partialPdfUrl = partial.url
          addEvent(record, 'partial_pdf_generated', 'Partial PDF generated for signer download: ' + partial.filename)
        } catch(e) {
          console.error('partial PDF generation failed:', e.message)
          addEvent(record, 'partial_pdf_failed', 'Failed to generate partial PDF: ' + (e.message || 'unknown'))
        }

        // Notify admin
        let adminNotified = false
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
            adminNotified = true
          } catch(e) {
            console.error('admin notify failed:', e.message)
            addEvent(record, 'admin_notify_failed', 'Failed to notify admin: ' + (e.message || 'unknown'))
          }
        }
        if (adminNotified) {
          addEvent(record, 'admin_notified', 'Admin notified that signer completed')
        }
        addEvent(record, 'status_changed', 'Status changed to pending_admin_post')
        await saveRequest(record)
        return NextResponse.json({ success: true, status: record.status, partialPdfUrl: record.partialPdfUrl || null })
      } else {
        // No admin fields left — finalize
        const pdf = await generateSignedPdf(record)
        record.signedPdfUrl = pdf.url
        record.status = 'complete'
        record.completedAt = new Date().toISOString()
        addEvent(record, 'final_pdf_generated', 'Final PDF generated: ' + pdf.filename)
        addEvent(record, 'status_changed', 'Status changed to complete')
        await saveRequest(record)
        return NextResponse.json({ success: true, status: record.status, signedPdfUrl: pdf.url })
      }
    }

    if (source === 'admin_post') {
      if (record.status !== 'pending_admin_post') {
        return NextResponse.json({ error: 'This signing request is not awaiting admin completion.' }, { status: 400 })
      }
      // Finalize
      const filledByAdminThisStep = Object.keys(newValues).length
      addEvent(record, 'admin_completed', 'Admin filled ' + filledByAdminThisStep + ' field' + (filledByAdminThisStep===1?'':'s') + ' and finalized')
      const pdf = await generateSignedPdf(record)
      record.signedPdfUrl = pdf.url
      record.status = 'complete'
      record.completedAt = new Date().toISOString()
      addEvent(record, 'final_pdf_generated', 'Final PDF generated: ' + pdf.filename)
      addEvent(record, 'status_changed', 'Status changed to complete')
      await saveRequest(record)

      // Email both signer and admin with the finalized PDF
      let signerEmailedFinal = false, adminEmailedFinal = false
      if (process.env.RESEND_API_KEY) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY)
          const attachment = { filename: pdf.filename, content: Buffer.from(pdf.bytes).toString('base64') }

          // Email the signer first
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'noreply@xantie.com',
            to: [record.signerEmail],
            subject: `Completed: ${record.documentName}`,
            html: `
              <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a">
                <h2 style="margin:0 0 12px">Your document has been finalized</h2>
                <p>Hi ${record.signerName},</p>
                <p>The administrator has completed signing <strong>${record.documentName}</strong>. The final document is attached to this email.</p>
                <p style="margin:24px 0"><a href="${pdf.url}" style="background:#8DC63F;color:#0a0a0a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Download signed PDF</a></p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
                <p style="color:#9ca3af;font-size:12px">Xantie · noreply@xantie.com</p>
              </div>`,
            attachments: [attachment],
          })
          signerEmailedFinal = true

          // Notify admin (separate send so a signer-side failure doesn't drop the admin copy)
          if (process.env.ADMIN_NOTIFICATION_EMAIL) {
            await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL || 'noreply@xantie.com',
              to: [process.env.ADMIN_NOTIFICATION_EMAIL],
              subject: `Signed: ${record.documentName}`,
              html: `
                <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a">
                  <h2 style="margin:0 0 12px">Document signed</h2>
                  <p><strong>${record.documentName}</strong> was finalized.</p>
                  <ul>
                    <li><strong>Signer:</strong> ${record.signerName} (${record.signerEmail})</li>
                    <li><strong>Completed:</strong> ${new Date().toLocaleString('en-US')}</li>
                  </ul>
                  <p><a href="${pdf.url}" style="background:#8DC63F;color:#0a0a0a;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">View signed PDF</a></p>
                </div>`,
              attachments: [attachment],
            })
            adminEmailedFinal = true
          }
        } catch(e) {
          console.error('completion email failed:', e.message)
          addEvent(record, 'final_email_failed', 'Final email error: ' + (e.message || 'unknown'))
        }
      }
      if (signerEmailedFinal) addEvent(record, 'signer_emailed_final', 'Final signed PDF emailed to ' + record.signerEmail)
      if (adminEmailedFinal) addEvent(record, 'admin_emailed_final', 'Final signed PDF emailed to admin')
      // Persist the post-email events (the earlier save() ran before emails were sent)
      try { await saveRequest(record) } catch(e) { console.warn('failed to save post-email events:', e.message) }

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
