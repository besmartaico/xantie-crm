// @ts-nocheck
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import crypto from 'crypto'

function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

export async function POST(req) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ success: false, error: 'Email required' }, { status: 400 })

    const sheets = getSheets()
    const SID = process.env.GOOGLE_SHEETS_ID
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A2:G5000' })
    const rows = res.data.values || []
    const rowIdx = rows.findIndex(r => r[1]?.toLowerCase() === email.toLowerCase())

    // Always return success to avoid email enumeration
    if (rowIdx === -1) return NextResponse.json({ success: true })

    const user = rows[rowIdx]
    const name = user[0] || email
    const token = crypto.randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

    // Store token in col F, expiry in col G
    const sheetRow = rowIdx + 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: SID, range: `Users!F${sheetRow}:G${sheetRow}`,
      valueInputOption: 'RAW', requestBody: { values: [[token, expiry]] }
    })

    // Send email via Resend
    const appUrl = process.env.APP_URL || 'https://time.xantie.com'
    const resetUrl = `${appUrl}/reset?token=${token}&email=${encodeURIComponent(email)}`

    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'noreply@xantie.com',
          to: email,
          subject: 'Xantie CRM — Reset Your Password',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px">
              <div style="margin-bottom:24px">
                <span style="font-size:22px;font-weight:800;color:#fff">Xantie</span>
                <span style="font-size:11px;color:#8DC63F;font-weight:700;text-transform:uppercase;margin-left:8px;letter-spacing:0.1em">CRM</span>
              </div>
              <h2 style="margin:0 0 12px;font-size:20px">Hi ${name},</h2>
              <p style="color:#9ca3af;margin:0 0 24px">Someone requested a password reset for your Xantie CRM account. Click the button below to set a new password. This link expires in 1 hour.</p>
              <a href="${resetUrl}" style="display:inline-block;background:#8DC63F;color:#0a0a0a;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px">Reset Password</a>
              <p style="color:#6b7280;font-size:12px;margin:24px 0 0">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
            </div>
          `
        })
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Reset request error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}