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
  const { name, email, password } = await req.json()

  // Only @xantie.com emails allowed
  if (!email?.toLowerCase().endsWith('@xantie.com')) {
    return NextResponse.json({ success: false, error: 'Registration is limited to @xantie.com email addresses.' }, { status: 403 })
  }

  const sheets = getSheets()
  const SID = process.env.GOOGLE_SHEETS_ID

  // Check if already registered
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A2:D' })
  const rows = existing.data.values || []
  const alreadyExists = rows.some(r => r[1]?.toLowerCase() === email.toLowerCase())
  if (alreadyExists) {
    return NextResponse.json({ success: false, error: 'An account with this email already exists.' }, { status: 409 })
  }

  // jeff@xantie.com is always admin
  const role = email.toLowerCase() === 'jeff@xantie.com' ? 'admin' : 'user'
  const hash = await bcrypt.hash(password, 10)

  await sheets.spreadsheets.values.append({
    spreadsheetId: SID,
    range: 'Users!A:D',
    valueInputOption: 'RAW',
    requestBody: { values: [[name, email.toLowerCase(), hash, role]] }
  })

  return NextResponse.json({ success: true, name, email: email.toLowerCase(), role })
}