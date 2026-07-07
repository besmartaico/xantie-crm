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
  const { blobs } = await list({ prefix: `${BLOB_PREFIX}${id}`, limit: 100 })
  const match = blobs.find(b => b.pathname === `${BLOB_PREFIX}${id}.json`)
  if (!match) return null
  const res = await fetch(match.url)
  const data = await res.json()
  return { record: data, blobUrl: match.url }
}

// Gather all recipient sub-blobs for a request: { rid: { rid, values, consent, signedAt } }
async function gatherRecipients(id) {
  const { blobs } = await list({ prefix: `${BLOB_PREFIX}${id}/rcpt-`, limit: 100 })
  const out = {}
  await Promise.all(blobs.map(async b => {
    const m = b.pathname.match(/\/rcpt-(.+)\.json$/)
    if (!m) return
    try { out[m[1]] = await (await fetch(b.url)).json() } catch(e) {}
  }))
  return out
}

// Merge admin-prefilled values + every recipient's submitted values into one map.
function mergeAllValues(record, recipientData) {
  const merged = { ...(record.values || {}) }
  Object.values(recipientData || {}).forEach(rd => {
    Object.assign(merged, rd && rd.values ? rd.values : {})
  })
  return merged
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

async function saveRecipientBlob(requestId, rid, payload) {
  await put(`${BLOB_PREFIX}${requestId}/rcpt-${rid}.json`, JSON.stringify(payload), {
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
    } else if (field.type === 'checkbox') {
      // Draw a checkmark with two vector strokes (avoids standard-font glyph limits).
      const t = Math.max(1.2, Math.min(fw, fh) * 0.12)
      const p1 = { x: fx + fw * 0.22, y: fy + fh * 0.50 }
      const p2 = { x: fx + fw * 0.42, y: fy + fh * 0.28 }
      const p3 = { x: fx + fw * 0.80, y: fy + fh * 0.74 }
      page.drawLine({ start: p1, end: p2, thickness: t, color: rgb(0, 0, 0) })
      page.drawLine({ start: p2, end: p3, thickness: t, color: rgb(0, 0, 0) })
    } else {
      // Text/date: shrink to fit the box width, then center vertically.
      const text = String(val)
      const maxW = Math.max(2, fw - 6)
      let fontSize = Math.min(fh * 0.7, 14)
      const measured = helveticaFont.widthOfTextAtSize(text, fontSize)
      if (measured > maxW) fontSize = Math.max(4, fontSize * (maxW / measured))
      page.drawText(text, {
        x: fx + 3,
        y: fy + (fh - fontSize) / 2 + fontSize * 0.18,
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
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token') || searchParams.get('r')

    const found = await getRequestById(requestId)
    if (!found) return NextResponse.json({ error: 'Sign request not found' }, { status: 404 })
    const record = found.record
    const isMultiRecipient = Array.isArray(record.recipients)

    // ── Recipient-scoped view (public signing link) ──────────────────────
    if (token && isMultiRecipient) {
      const recipient = record.recipients.find(r => r.token === token)
      if (!recipient) return NextResponse.json({ error: 'Invalid or expired signing link' }, { status: 404 })
      const recipientData = await gatherRecipients(requestId)
      const mine = recipientData[recipient.rid]
      // Read-only context: admin-prefilled values always; other recipients only if visibility is 'shared'.
      let values = { ...(record.values || {}) }
      if (record.visibility === 'shared') {
        Object.entries(recipientData).forEach(([rid, rd]) => {
          if (rid !== recipient.rid) Object.assign(values, rd && rd.values ? rd.values : {})
        })
      }
      if (mine && mine.values) Object.assign(values, mine.values) // let them review their own answers
      return NextResponse.json({
        id: record.id,
        documentId: record.documentId,
        documentName: record.documentName,
        fields: record.fields,
        restrictTo: recipient.rid,
        recipientName: recipient.name,
        visibility: record.visibility,
        values,
        alreadySigned: !!mine,
        status: record.status,
      })
    }

    // ── Admin view ───────────────────────────────────────────────────────
    if (isMultiRecipient) {
      const recipientData = await gatherRecipients(requestId)
      const merged = mergeAllValues(record, recipientData)
      const recipientsStatus = record.recipients.map(r => ({
        rid: r.rid,
        name: r.name,
        email: r.email,
        token: r.token,
        signed: !!recipientData[r.rid],
        signedAt: recipientData[r.rid]?.signedAt || null,
      }))
      const allRecipientsSigned = recipientsStatus.length > 0 && recipientsStatus.every(r => r.signed)
      // Derive ready-to-finalize if all signed but the stored status lagged behind.
      let effStatus = record.status
      if (record.status === 'pending_recipients' && allRecipientsSigned) effStatus = 'ready_to_finalize'
      return NextResponse.json({ ...record, status: effStatus, values: merged, recipientsStatus, allRecipientsSigned })
    }

    // ── Legacy single-signer record ──────────────────────────────────────
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

export async function PUT(req, ctx) {
  try {
    const { requestId } = await ctx.params
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token') || searchParams.get('r')
    const body = await req.json()

    const found = await getRequestById(requestId)
    if (!found) return NextResponse.json({ error: 'Sign request not found' }, { status: 404 })
    const record = found.record
    const isMultiRecipient = Array.isArray(record.recipients)

    // ── Recipient submit (writes only that recipient's sub-blob) ─────────
    if (token && isMultiRecipient) {
      const recipient = record.recipients.find(r => r.token === token)
      if (!recipient) return NextResponse.json({ error: 'Invalid or expired signing link' }, { status: 404 })
      if (record.status === 'complete') return NextResponse.json({ error: 'This document has already been finalized.' }, { status: 400 })

      const recipientData = await gatherRecipients(requestId)
      if (recipientData[recipient.rid]) {
        return NextResponse.json({ error: 'You have already submitted your part of this document.' }, { status: 400 })
      }

      // Keep only this recipient's own fields.
      const myFieldIds = new Set(record.fields.filter(f => f.assignee === recipient.rid).map(f => f.id))
      const incoming = body.values || {}
      const myValues = {}
      Object.keys(incoming).forEach(k => { if (myFieldIds.has(k)) myValues[k] = incoming[k] })

      const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
      const ip = (ipHeader.split(',')[0] || '').trim()
      const payload = {
        rid: recipient.rid,
        name: recipient.name,
        email: recipient.email,
        values: myValues,
        signedAt: new Date().toISOString(),
        consent: body.consent && body.consent.agreed ? {
          agreed: true,
          agreedAt: body.consent.agreedAt || new Date().toISOString(),
          disclosureVersion: body.consent.disclosure || '',
          userAgent: body.consent.userAgent || '',
          ip: ip || null,
        } : null,
      }
      await saveRecipientBlob(requestId, recipient.rid, payload)

      // Determine if everyone has now signed. Re-gather after writing, and count
      // this recipient as signed regardless (Blob list may lag on the just-written blob).
      const after = await gatherRecipients(requestId)
      const allSigned = record.recipients.every(r => r.rid === recipient.rid || !!after[r.rid])

      if (allSigned) {
        const adminFieldsRemaining = record.fields.some(f => f.assignee === 'admin' && !(record.values || {})[f.id])
        record.status = adminFieldsRemaining ? 'pending_admin_post' : 'ready_to_finalize'
        addEvent(record, 'all_recipients_signed', 'All ' + record.recipients.length + ' recipients have signed')
        addEvent(record, 'status_changed', 'Status changed to ' + record.status)
        try { await saveRequest(record) } catch(e) { console.warn('failed to save all-signed transition:', e.message) }
        // Notify admin it's ready to finalize
        if (process.env.ADMIN_NOTIFICATION_EMAIL && process.env.RESEND_API_KEY) {
          try {
            const resend = new Resend(process.env.RESEND_API_KEY)
            const base = process.env.APP_URL || 'https://crm.xantie.com'
            const url = `${base}/admin/sign-requests/${record.id}/finish`
            await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL || 'noreply@xantie.com',
              to: [process.env.ADMIN_NOTIFICATION_EMAIL],
              subject: `All recipients signed: ${record.documentName} — ready to finalize`,
              html: `
                <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a">
                  <h2 style="margin:0 0 12px">All recipients have signed</h2>
                  <p><strong>${record.documentName}</strong> — every recipient has completed their part.</p>
                  <p>${adminFieldsRemaining ? 'Fill your remaining admin fields, then consolidate & finalize.' : 'Review and consolidate & finalize to produce the signed PDF.'}</p>
                  <p style="margin:24px 0"><a href="${url}" style="background:#8DC63F;color:#0a0a0a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Consolidate & finalize →</a></p>
                </div>`,
            })
          } catch(e) { console.error('admin notify (ready) failed:', e.message) }
        }
      }

      return NextResponse.json({ success: true, waiting: !allSigned, status: allSigned ? record.status : 'pending_recipients' })
    }

    // ── Admin: consolidate & finalize (manual) ───────────────────────────
    if (body.action === 'finalize' && isMultiRecipient) {
      if (record.status === 'complete') {
        return NextResponse.json({ success: true, status: 'complete', signedPdfUrl: record.signedPdfUrl })
      }
      const recipientData = await gatherRecipients(requestId)
      const allSigned = record.recipients.every(r => !!recipientData[r.rid])
      if (!allSigned) {
        return NextResponse.json({ error: 'Not all recipients have signed yet.' }, { status: 400 })
      }
      // Merge: admin-prefilled + recipient values + admin values supplied at finalize time.
      const adminValues = body.values || {}
      record.values = { ...mergeAllValues(record, recipientData), ...adminValues }

      const adminFilledCount = Object.keys(adminValues).length
      if (adminFilledCount > 0) addEvent(record, 'admin_completed', 'Admin filled ' + adminFilledCount + ' field' + (adminFilledCount === 1 ? '' : 's'))

      const pdf = await generateSignedPdf(record)
      record.signedPdfUrl = pdf.url
      record.status = 'complete'
      record.completedAt = new Date().toISOString()
      addEvent(record, 'final_pdf_generated', 'Final PDF generated: ' + pdf.filename)
      addEvent(record, 'status_changed', 'Status changed to complete')
      await saveRequest(record)

      // Email every recipient + admin the finalized PDF.
      if (process.env.RESEND_API_KEY) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY)
          const attachment = { filename: pdf.filename, content: Buffer.from(pdf.bytes).toString('base64') }
          for (const r of record.recipients) {
            try {
              await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL || 'noreply@xantie.com',
                to: [r.email],
                subject: `Completed: ${record.documentName}`,
                html: `
                  <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a">
                    <h2 style="margin:0 0 12px">Your document has been finalized</h2>
                    <p>Hi ${r.name},</p>
                    <p><strong>${record.documentName}</strong> has been completed by all parties. The final signed document is attached.</p>
                    <p style="margin:24px 0"><a href="${pdf.url}" style="background:#8DC63F;color:#0a0a0a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Download signed PDF</a></p>
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
                    <p style="color:#9ca3af;font-size:12px">Xantie · noreply@xantie.com</p>
                  </div>`,
                attachments: [attachment],
              })
              addEvent(record, 'recipient_emailed_final', 'Final PDF emailed to ' + r.email)
            } catch(e) { addEvent(record, 'final_email_failed', 'Failed to email ' + r.email + ': ' + (e.message || 'unknown')) }
          }
          if (process.env.ADMIN_NOTIFICATION_EMAIL) {
            await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL || 'noreply@xantie.com',
              to: [process.env.ADMIN_NOTIFICATION_EMAIL],
              subject: `Signed: ${record.documentName}`,
              html: `
                <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a">
                  <h2 style="margin:0 0 12px">Document finalized</h2>
                  <p><strong>${record.documentName}</strong> was consolidated and finalized.</p>
                  <ul>${record.recipients.map(r => `<li>${r.name} (${r.email})</li>`).join('')}</ul>
                  <p><a href="${pdf.url}" style="background:#8DC63F;color:#0a0a0a;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">View signed PDF</a></p>
                </div>`,
              attachments: [attachment],
            })
            addEvent(record, 'admin_emailed_final', 'Final PDF emailed to admin')
          }
        } catch(e) { addEvent(record, 'final_email_failed', 'Final email error: ' + (e.message || 'unknown')) }
        try { await saveRequest(record) } catch(e) { console.warn('failed to save post-email events:', e.message) }
      }

      return NextResponse.json({ success: true, status: 'complete', signedPdfUrl: pdf.url })
    }

    // ── Legacy single-signer flow (in-flight pre-multi-recipient records) ─
    if (!isMultiRecipient && (body.source === 'user' || body.source === 'admin_post')) {
      return await legacyPut(req, record, body)
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch(e) {
    console.error('PUT sign-request error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Unchanged behavior for records created before multi-recipient support.
async function legacyPut(req, record, body) {
  const newValues = body.values || {}
  const source = body.source
  record.values = { ...(record.values || {}), ...newValues }

  if (source === 'user') {
    if (record.status !== 'pending_user') {
      return NextResponse.json({ error: 'This signing request has already been completed by the signer.' }, { status: 400 })
    }
    record.userSignedAt = new Date().toISOString()
    const userFieldsFilled = record.fields.filter(f => (!f.assignee || f.assignee === 'user') && record.values[f.id]).length
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
    addEvent(record, 'signer_signed', 'Signer submitted ' + userFieldsFilled + ' field' + (userFieldsFilled === 1 ? '' : 's'))

    const adminFieldsPending = record.fields.some(f => f.assignee === 'admin' && !record.values[f.id])
    if (adminFieldsPending) {
      record.status = 'pending_admin_post'
      try {
        const partial = await generateSignedPdf(record, '-partial-signer')
        record.partialPdfUrl = partial.url
        addEvent(record, 'partial_pdf_generated', 'Partial PDF generated for signer download: ' + partial.filename)
      } catch(e) {
        console.error('partial PDF generation failed:', e.message)
        addEvent(record, 'partial_pdf_failed', 'Failed to generate partial PDF: ' + (e.message || 'unknown'))
      }
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
      if (adminNotified) addEvent(record, 'admin_notified', 'Admin notified that signer completed')
      addEvent(record, 'status_changed', 'Status changed to pending_admin_post')
      await saveRequest(record)
      return NextResponse.json({ success: true, status: record.status, partialPdfUrl: record.partialPdfUrl || null })
    } else {
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
    const filledByAdminThisStep = Object.keys(newValues).length
    addEvent(record, 'admin_completed', 'Admin filled ' + filledByAdminThisStep + ' field' + (filledByAdminThisStep === 1 ? '' : 's') + ' and finalized')
    const pdf = await generateSignedPdf(record)
    record.signedPdfUrl = pdf.url
    record.status = 'complete'
    record.completedAt = new Date().toISOString()
    addEvent(record, 'final_pdf_generated', 'Final PDF generated: ' + pdf.filename)
    addEvent(record, 'status_changed', 'Status changed to complete')
    await saveRequest(record)

    let signerEmailedFinal = false, adminEmailedFinal = false
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const attachment = { filename: pdf.filename, content: Buffer.from(pdf.bytes).toString('base64') }
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
    try { await saveRequest(record) } catch(e) { console.warn('failed to save post-email events:', e.message) }

    return NextResponse.json({ success: true, status: record.status, signedPdfUrl: pdf.url })
  }

  return NextResponse.json({ error: 'Invalid source; must be "user" or "admin_post"' }, { status: 400 })
}

export async function DELETE(_req, ctx) {
  try {
    const { requestId } = await ctx.params
    const found = await getRequestById(requestId)
    if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // Remove the parent record and any recipient sub-blobs.
    await del(found.blobUrl)
    try {
      const { blobs } = await list({ prefix: `${BLOB_PREFIX}${requestId}/rcpt-`, limit: 100 })
      await Promise.all(blobs.map(b => del(b.url)))
    } catch(e) { console.warn('failed to delete recipient sub-blobs:', e.message) }
    return NextResponse.json({ success: true })
  } catch(e) {
    console.error('DELETE sign-request error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
