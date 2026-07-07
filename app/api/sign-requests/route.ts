// @ts-nocheck
import { NextResponse } from 'next/server'
import { put, list } from '@vercel/blob'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BLOB_PREFIX = 'sign-requests/'

function uid() {
  return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9)
}
function makeToken() {
  return crypto.randomBytes(18).toString('base64url')
}

// Normalize legacy fields: assignee 'user' or missing means recipient 1 ('r1').
function normalizeFields(rawFields) {
  return (Array.isArray(rawFields) ? rawFields : []).map(f => {
    const a = f.assignee
    if (!a || a === 'user') return { ...f, assignee: 'r1' }
    return f
  })
}

export async function GET() {
  try {
    const { blobs } = await list({ prefix: BLOB_PREFIX, limit: 1000 })
    // Parent records are `sign-requests/<id>.json`; recipient sub-blobs are
    // `sign-requests/<id>/rcpt-<rid>.json`. Separate them.
    const parents = blobs.filter(b => /^sign-requests\/[^/]+\.json$/.test(b.pathname))
    const signedByParent = {}
    blobs.forEach(b => {
      const m = b.pathname.match(/^sign-requests\/([^/]+)\/rcpt-(.+)\.json$/)
      if (m) { (signedByParent[m[1]] = signedByParent[m[1]] || new Set()).add(m[2]) }
    })
    const requests = await Promise.all(parents.map(async b => {
      try {
        const res = await fetch(b.url)
        const data = await res.json()
        const recips = Array.isArray(data.recipients) ? data.recipients : null
        return {
          id: data.id,
          documentId: data.documentId,
          documentName: data.documentName,
          signerName: data.signerName,
          signerEmail: data.signerEmail,
          recipients: recips ? recips.map(r => ({ rid: r.rid, name: r.name, email: r.email })) : null,
          recipientCount: recips ? recips.length : null,
          signedCount: recips ? (signedByParent[data.id] ? signedByParent[data.id].size : 0) : null,
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

// Admin starts a new signing request.
// New body: { documentId, documentName, fields, adminPreValues, recipients:[{rid,name,email}], visibility, createdBy }
// Back-compat body: { ..., signerName, signerEmail } → synthesized as a single 'r1' recipient.
export async function POST(req) {
  try {
    const body = await req.json()
    if (!body.documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
    }

    const fields = normalizeFields(body.fields)

    // Which recipient roles are actually used by the fields?
    const usedRids = Array.from(new Set(
      fields.filter(f => /^r\d+$/.test(f.assignee || '')).map(f => f.assignee)
    )).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))

    // Resolve recipients (name+email+token) for each used role.
    let recipients = Array.isArray(body.recipients) ? body.recipients : null
    if (!recipients && body.signerName && body.signerEmail) {
      recipients = [{ rid: 'r1', name: body.signerName, email: body.signerEmail }]
    }
    if (usedRids.length > 0) {
      if (!recipients || !recipients.length) {
        return NextResponse.json({ error: 'No recipients provided for this document' }, { status: 400 })
      }
      const resolved = []
      for (const rid of usedRids) {
        const r = recipients.find(x => x.rid === rid)
        if (!r || !r.name || !r.name.trim() || !r.email || !r.email.trim()) {
          return NextResponse.json({ error: `Missing name/email for ${rid.replace('r', 'Recipient ')}` }, { status: 400 })
        }
        resolved.push({ rid, name: r.name.trim(), email: r.email.trim(), token: makeToken() })
      }
      recipients = resolved
    } else {
      recipients = []
    }

    const visibility = body.visibility === 'shared' ? 'shared' : 'private'
    const adminPreValues = body.adminPreValues || {}
    const id = uid()
    const now = new Date().toISOString()

    const hasRecipients = recipients.length > 0
    const hasAdminRemaining = fields.some(f => f.assignee === 'admin' && !adminPreValues[f.id])
    let status
    if (hasRecipients) status = 'pending_recipients'
    else if (hasAdminRemaining) status = 'pending_admin_post'
    else status = 'ready_to_finalize'

    const events = [
      { at: now, type: 'created', message: 'Request created by ' + (body.createdBy || 'admin') + (recipients.length ? ' for ' + recipients.length + ' recipient' + (recipients.length === 1 ? '' : 's') : ' (admin-only)') },
    ]
    const prefilledCount = Object.keys(adminPreValues).length
    if (prefilledCount > 0) {
      events.push({ at: now, type: 'admin_prefilled', message: 'Admin pre-filled ' + prefilledCount + ' field' + (prefilledCount === 1 ? '' : 's') })
    }

    const record = {
      id,
      documentId: body.documentId,
      documentName: body.documentName || '',
      fields,
      recipients,
      visibility,
      signerName: recipients[0]?.name || body.signerName || '',
      signerEmail: recipients[0]?.email || body.signerEmail || '',
      createdBy: body.createdBy || '',
      createdAt: now,
      status,
      values: adminPreValues,
      signedPdfUrl: null,
      completedAt: null,
      events,
    }

    await put(`${BLOB_PREFIX}${id}.json`, JSON.stringify(record), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    // Email each recipient their scoped signing link.
    if (recipients.length && process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      const base = process.env.APP_URL || 'https://crm.xantie.com'
      for (const r of recipients) {
        try {
          const url = `${base}/sign/${id}?r=${encodeURIComponent(r.token)}`
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'noreply@xantie.com',
            to: [r.email],
            subject: `Please sign: ${record.documentName || 'Document'}`,
            html: `
              <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a">
                <h2 style="color:#0a0a0a;margin:0 0 12px">Document signature requested</h2>
                <p>Hi ${r.name},</p>
                <p>You've been asked to review and complete your part of <strong>${record.documentName || 'a document'}</strong>.</p>
                <p style="margin:24px 0"><a href="${url}" style="background:#8DC63F;color:#0a0a0a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Review & Sign</a></p>
                <p style="color:#6b7280;font-size:13px">Or copy this link: ${url}</p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
                <p style="color:#9ca3af;font-size:12px">Xantie · noreply@xantie.com</p>
              </div>`,
            text: `Hi ${r.name},\n\nYou've been asked to complete your part of ${record.documentName || 'a document'}.\nOpen this link to sign: ${url}`,
          })
          record.events.push({ at: new Date().toISOString(), type: 'recipient_emailed', message: 'Email sent to ' + r.email + ' (' + r.rid.replace('r', 'Recipient ') + ')' })
        } catch(e) {
          console.error('email recipient failed:', e.message)
          record.events.push({ at: new Date().toISOString(), type: 'email_failed', message: 'Failed to email ' + r.email + ': ' + (e.message || 'unknown') })
        }
      }
      // Resave with email events
      await put(`${BLOB_PREFIX}${id}.json`, JSON.stringify(record), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true })
    }

    return NextResponse.json({ success: true, id, status })
  } catch(e) {
    console.error('create sign-request error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
