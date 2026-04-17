// @ts-nocheck
import { NextResponse } from 'next/server'
import { google } from 'googleapis'

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
    const { name, email, role, source } = await req.json()
    if (!name || !email) return NextResponse.json({ success: false, error: 'Name and email required' }, { status: 400 })

    const sheets = getSheets()
    const SID = process.env.GOOGLE_SHEETS_ID

    // Check if already exists
    const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A2:E5000' })
    const rows = existing.data.values || []
    if (rows.some(r => r[1]?.toLowerCase() === email.toLowerCase())) {
      return NextResponse.json({ success: false, error: 'User already exists' })
    }

    const nextRow = rows.length + 2
    // Add with empty password hash - they can register later to set a password
    await sheets.spreadsheets.values.update({
      spreadsheetId: SID,
      range: `Users!A${nextRow}:E${nextRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[name, email.toLowerCase(), '', role || 'viewer', 'active']] }
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}