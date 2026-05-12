// @ts-nocheck
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export const runtime = 'nodejs'

export async function POST(req) {
  try {
    const body = await req.json()
    const { documentId, name, email, fields, documentName, appUrl } = body
    if (!documentId || !email || !name) {
      return NextResponse.json({ error: 'Missing documentId, name, or email' }, { status: 400 })
    }
    // Build signing URL — fields are loaded server-side from Drive on the sign page,
    // so we keep the URL short to avoid browser/email URL-length limits.
    const base = appUrl || process.env.APP_URL || 'https://crm.xantie.com'
    const url = `${base}/sign/${documentId}?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@xantie.com',
      to: [email],
      subject: `Please sign: ${documentName || 'Document'}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a">
          <h2 style="color:#0a0a0a;margin:0 0 12px">Document signature requested</h2>
          <p>Hi ${name},</p>
          <p>You've been asked to review and sign <strong>${documentName || 'a document'}</strong>.</p>
          <p style="margin:24px 0"><a href="${url}" style="background:#8DC63F;color:#0a0a0a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Review & Sign</a></p>
          <p style="color:#6b7280;font-size:13px">Or copy this link: ${url}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#9ca3af;font-size:12px">Xantie · noreply@xantie.com</p>
        </div>`,
      text: `Hi ${name},\n\nYou've been asked to sign ${documentName || 'a document'}.\nOpen this link to sign: ${url}\n\n— Xantie`,
    })
    return NextResponse.json({ success: true, url })
  } catch(e) {
    console.error('send-link error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
