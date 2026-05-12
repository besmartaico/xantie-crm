// @ts-nocheck
import { NextResponse } from 'next/server'
import { put, list } from '@vercel/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BLOB_PREFIX = 'sign-requests/'

function uid() {
  return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9)
}

export async function GET() {
  try {
    const { blobs } = await list({ prefix: BLOB_PREFIX, limit: 1000 })
    // Fetch each request's metadata (parallel)
    const requests = await Promise.all(blobs.map(async b => {
      try {
        const res = await fetch(b.url)
        const data = await res.json()
        return {
          id: data.id,
          documentId: data.documentId,
          documentName: data.documentName,
          signerName: data.signerName,
          signerEmail: data.signerEmail,
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          status: data.status,
          signedPdfUrl: data.signedPdfUrl || null,
          completedAt: data.completedAt || null,
        }
      } catch(e) {
        return null
      }
    }))
    const filtered = requests.filter(Boolean).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return NextResponse.json(filtered)
  } catch(e) {
    console.error('list sign-requests error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Admin starts a new signing request
// Body: { documentId, documentName, fields, adminPreValues, signerName, signerEmail, createdBy }
export async function POST(req) {
  try {
    const body = await req.json()
    if (!body.documentId || !body.signerEmail || !body.signerName) {
      return NextResponse.json({ error: 'Missing documentId, signerName, or signerEmail' }, { status: 400 })
    }
    const id = uid()
    const now = new Date().toISOString()
    const fields = Array.isArray(body.fields) ? body.fields : []
    const adminPreValues = body.adminPreValues || {}

    // Determine initial status: do any user fields exist?
    const hasUserFields = fields.some(f => !f.assignee || f.assignee === 'user')
    const hasAdminFieldsRemaining = fields.some(f => f.assignee === 'admin' && !adminPreValues[f.id])
    let status
    if (hasUserFields) status = 'pending_user'
    else if (hasAdminFieldsRemaining) status = 'pending_admin_post'
    else status = 'complete'  // unusual, but handle it

    const events = [
      { at: now, type: 'created', message: 'Request created by ' + (body.createdBy || 'admin') + ' for signer ' + body.signerEmail },
    ]
    const adminFieldCount = fields.filter(f => f.assignee === 'admin').length
    const userFieldCount = fields.length - adminFieldCount
    const prefilledCount = Object.keys(adminPreValues).length
    if (prefilledCount > 0) {
      events.push({ at: now, type: 'admin_prefilled', message: 'Admin pre-filled ' + prefilledCount + ' field' + (prefilledCount===1?'':'s') })
    }
    const record = {
      id,
      documentId: body.documentId,
      documentName: body.documentName || '',
      fields,
      signerName: body.signerName,
      signerEmail: body.signerEmail,
      createdBy: body.createdBy || '',
      createdAt: now,
      status,
      values: adminPreValues,
      signedPdfUrl: null,
      partialPdfUrl: null,
      userSignedAt: null,
      completedAt: null,
      events,
    }

    // Persist
    await put(`${BLOB_PREFIX}${id}.json`, JSON.stringify(record), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    // Email signer if pending_user
    let signerEmailedOk = false
    if (status === 'pending_user' && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        const base = process.env.APP_URL || 'https://crm.xantie.com'
        const url = `${base}/sign/${id}`
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'noreply@xantie.com',
          to: [body.signerEmail],
          subject: `Please sign: ${record.documentName || 'Document'}`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a">
              <h2 style="color:#0a0a0a;margin:0 0 12px">Document signature requested</h2>
              <p>Hi ${body.signerName},</p>
              <p>You've been asked to review and sign <strong>${record.documentName || 'a document'}</strong>.</p>
              <p style="margin:24px 0"><a href="${url}" style="background:#8DC63F;color:#0a0a0a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Review & Sign</a></p>
              <p style="color:#6b7280;font-size:13px">Or copy this link: ${url}</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
              <p style="color:#9ca3af;font-size:12px">Xantie · noreply@xantie.com</p>
            </div>`,
          text: `Hi ${body.signerName},\n\nYou've been asked to sign ${record.documentName || 'a document'}.\nOpen this link to sign: ${url}`,
        })
        signerEmailedOk = true
      } catch(e) {
        console.error('email signer failed:', e.message)
        record.events.push({ at: new Date().toISOString(), type: 'email_failed', message: 'Failed to email signer: ' + (e.message || 'unknown') })
      }
    }
    if (signerEmailedOk) {
      record.events.push({ at: new Date().toISOString(), type: 'signer_emailed', message: 'Email sent to ' + body.signerEmail })
      // Resave with the new event
      await put(`${BLOB_PREFIX}${id}.json`, JSON.stringify(record), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true })
    }

    return NextResponse.json({ success: true, id, status })
  } catch(e) {
    console.error('create sign-request error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
