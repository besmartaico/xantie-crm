// @ts-nocheck
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { put } from '@vercel/blob'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { downloadPdfFromDrive, getDriveFileMeta } from '@/lib/googleDrive'

export const runtime = 'nodejs'
export const maxDuration = 60

function dataUrlToBytes(dataUrl) {
  // expects data:image/png;base64,XXXX
  const idx = dataUrl.indexOf(',')
  if (idx === -1) return null
  return Buffer.from(dataUrl.substring(idx + 1), 'base64')
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { documentId, fields, values, signer } = body
    if (!documentId || !Array.isArray(fields) || !values) {
      return NextResponse.json({ error: 'Missing documentId, fields, or values' }, { status: 400 })
    }

    // Get document metadata + bytes
    const [meta, origBytes] = await Promise.all([
      getDriveFileMeta(documentId),
      downloadPdfFromDrive(documentId),
    ])

    // Load PDF and draw values
    const pdfDoc = await PDFDocument.load(origBytes)
    const pages = pdfDoc.getPages()
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

    for (const field of fields) {
      const val = values[field.id]
      if (!val) continue
      const pageIdx = (field.page || 1) - 1
      if (pageIdx < 0 || pageIdx >= pages.length) continue
      const page = pages[pageIdx]
      const { height: pageH } = page.getSize()
      // PDF coordinates are bottom-left origin. Field x/y/w/h are top-left origin in points.
      const fx = field.x
      const fy = pageH - field.y - field.height
      const fw = field.width
      const fh = field.height

      if (field.type === 'signature' || field.type === 'initials') {
        // val is a data URL (image)
        const bytes = dataUrlToBytes(val)
        if (!bytes) continue
        let img
        try { img = await pdfDoc.embedPng(bytes) } catch { try { img = await pdfDoc.embedJpg(bytes) } catch { img = null } }
        if (!img) continue
        page.drawImage(img, { x: fx, y: fy, width: fw, height: fh })
      } else {
        // text or date
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

    // Build a descriptive filename: <original> - <signer name> - <date>.pdf
    const dateStr = new Date().toISOString().split('T')[0]
    const safeName = (signer && signer.name ? signer.name : 'signer').replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'signer'
    const origName = (meta.name || 'document.pdf').replace(/\.pdf$/i, '')
    const filename = `${origName} - ${safeName} - ${dateStr}.pdf`

    // Upload to Blob (public)
    const blob = await put(filename, signedBytes, {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: true,
    })

    // Notify admin via email with the signed PDF as attachment
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
    if (adminEmail && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'noreply@xantie.com',
          to: [adminEmail],
          subject: `Signed: ${meta.name}`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a">
              <h2 style="margin:0 0 12px">Document signed</h2>
              <p><strong>${meta.name}</strong> was signed by:</p>
              <ul>
                <li><strong>Name:</strong> ${(signer && signer.name) || 'unknown'}</li>
                <li><strong>Email:</strong> ${(signer && signer.email) || 'unknown'}</li>
                <li><strong>Date:</strong> ${new Date().toLocaleString('en-US')}</li>
              </ul>
              <p><a href="${blob.url}" style="background:#8DC63F;color:#0a0a0a;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">View signed PDF</a></p>
              <p style="color:#9ca3af;font-size:12px">Xantie CRM Documents</p>
            </div>`,
          attachments: [{
            filename,
            content: Buffer.from(signedBytes).toString('base64'),
          }],
        })
      } catch(e) { console.error('admin notify failed:', e.message) }
    }

    return NextResponse.json({ success: true, url: blob.url, pathname: blob.pathname, filename })
  } catch(e) {
    console.error('sign-requests error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
