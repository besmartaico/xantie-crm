// @ts-nocheck
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import bcrypt from 'bcryptjs'

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
    const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A2:D5000' })
    const rows = existing.data.values || []
    if (rows.some(r => r[1]?.toLowerCase() === normalizedEmail))
      return NextResponse.json({ success: false, error: 'An account with this email already exists.' }, { status: 409 })

    const role = normalizedEmail === 'jeff@xantie.com' ? 'admin' : 'user'
    const hash = await bcrypt.hash(password, 10)
    const nextRow = rows.length + 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: SID,
      range: `Users!A${nextRow}:D${nextRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[name, normalizedEmail, hash, role]] }
    })
    return NextResponse.json({ success: true, name, email: normalizedEmail, role })
  } catch (err) {
    console.error('Register error:', err.message)
    return NextResponse.json({ success: false, error: 'Server error: ' + err.message }, { status: 500 })
  }
}