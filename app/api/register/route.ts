// @ts-nocheck
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import bcrypt from 'bcryptjs'
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

async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev', to, subject, html })
  })
}

export async function POST(req) {
  try {
    const { name, email, password } = await req.json()
    if (!name || !email || !password)
      return NextResponse.json({ success: false, error: 'All fields are required.' }, { status: 400 })
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail.endsWith('@xantie.com'))
      return NextResponse.json({ success: false, error: 'Registration is limited to @xantie.com email addresses.' }, { status: 403 })
    if (password.length < 8)
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters.' }, { status: 400 })

    const sheets = getSheets()
    const SID = process.env.GOOGLE_SHEETS_ID
    const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A2:G5000' })
    const rows = existing.data.values || []
    const existingIdx = rows.findIndex(r => r[1]?.toLowerCase() === normalizedEmail)
    const appUrl = process.env.APP_URL || 'https://time.xantie.com'

    if (existingIdx !== -1) {
      const existingUser = rows[existingIdx]
      const existingHash = existingUser[2] || ''

      // Imported user (no password) - let them set their password directly
      if (!existingHash) {
        const hash = await bcrypt.hash(password, 10)
        const sheetRow = existingIdx + 2
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SID,
          requestBody: {
            valueInputOption: 'RAW',
            data: [
              { range: `Users!A${sheetRow}`, values: [[name]] },
              { range: `Users!C${sheetRow}`, values: [[hash]] },
              { range: `Users!E${sheetRow}`, values: [['active']] },
            ]
          }
        })
        const role = existingUser[3] || 'viewer'
        return NextResponse.json({ success: true, name, email: normalizedEmail, role })
      }

      // Account exists with password - send reset email automatically
      const token = crypto.randomBytes(32).toString('hex')
      const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const sheetRow = existingIdx + 2
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID, range: `Users!F${sheetRow}:G${sheetRow}`,
        valueInputOption: 'RAW', requestBody: { values: [[token, expiry]] }
      })
      const resetUrl = `${appUrl}/reset?token=${token}&email=${encodeURIComponent(normalizedEmail)}`
      const existingName = existingUser[0] || normalizedEmail
      await sendEmail(normalizedEmail, 'Xantie CRM — Your Account Already Exists', `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px">
          <div style="margin-bottom:24px">
            <span style="font-size:22px;font-weight:800">Xantie</span>
            <span style="font-size:11px;color:#8DC63F;font-weight:700;text-transform:uppercase;margin-left:8px;letter-spacing:0.1em">CRM</span>
          </div>
          <h2 style="margin:0 0 12px">Hi ${existingName},</h2>
          <p style="color:#9ca3af;margin:0 0 16px">An account already exists for <strong style="color:#fff">${normalizedEmail}</strong>.</p>
          <p style="color:#9ca3af;margin:0 0 24px">If you forgot your password, click below to reset it. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#8DC63F;color:#0a0a0a;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px">Reset My Password</a>
          <p style="color:#6b7280;font-size:12px;margin:24px 0 0">If you didn't try to register, you can safely ignore this email.</p>
        </div>
      `)
      // Return special status so the frontend shows the right screen
      return NextResponse.json({ success: false, emailExists: true })
    }

    // Brand new user - create as pending, send verification email
    const hash = await bcrypt.hash(password, 10)
    const token = crypto.randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    const role = normalizedEmail === 'jeff@xantie.com' ? 'admin' : 'viewer'
    const nextRow = rows.length + 2

    await sheets.spreadsheets.values.update({
      spreadsheetId: SID, range: `Users!A${nextRow}:G${nextRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[name, normalizedEmail, hash, role, 'pending', token, expiry]] }
    })

    // jeff@xantie.com auto-verified (admin)
    if (normalizedEmail === 'jeff@xantie.com') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID, range: `Users!E${nextRow}`,
        valueInputOption: 'RAW', requestBody: { values: [['active']] }
      })
      return NextResponse.json({ success: true, name, email: normalizedEmail, role })
    }

    const verifyUrl = `${appUrl}/verify?token=${token}&email=${encodeURIComponent(normalizedEmail)}`
    await sendEmail(normalizedEmail, 'Verify your Xantie CRM account', `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px">
        <div style="margin-bottom:24px">
          <span style="font-size:22px;font-weight:800">Xantie</span>
          <span style="font-size:11px;color:#8DC63F;font-weight:700;text-transform:uppercase;margin-left:8px;letter-spacing:0.1em">CRM</span>
        </div>
        <h2 style="margin:0 0 12px">Hi ${name}, welcome!</h2>
        <p style="color:#9ca3af;margin:0 0 24px">Click the button below to verify your email and activate your Xantie CRM account. This link expires in 24 hours.</p>
        <a href="${verifyUrl}" style="display:inline-block;background:#8DC63F;color:#0a0a0a;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px">Verify My Email</a>
        <p style="color:#6b7280;font-size:12px;margin:24px 0 0">If you didn't create this account, you can safely ignore this email.</p>
      </div>
    `)

    return NextResponse.json({ success: false, pendingVerification: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Server error: ' + err.message }, { status: 500 })
  }
}