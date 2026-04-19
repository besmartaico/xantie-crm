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
    const { email, token } = await req.json()
    if (!email || !token) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })

    const sheets = getSheets()
    const SID = process.env.GOOGLE_SHEETS_ID
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A2:G5000' })
    const rows = res.data.values || []
    const rowIdx = rows.findIndex(r => r[1]?.toLowerCase() === email.toLowerCase())

    if (rowIdx === -1) return NextResponse.json({ success: false, error: 'Invalid verification link.' }, { status: 400 })

    const user = rows[rowIdx]
    const storedToken = user[5] || ''
    const expiry = user[6] || ''

    if (!storedToken || storedToken !== token) return NextResponse.json({ success: false, error: 'Invalid or already used verification link.' }, { status: 400 })
    if (expiry && new Date(expiry) < new Date()) return NextResponse.json({ success: false, error: 'Verification link expired. Please register again.' }, { status: 400 })

    const sheetRow = rowIdx + 2
    // Mark active, clear token
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SID,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          { range: `Users!E${sheetRow}`, values: [['active']] },
          { range: `Users!F${sheetRow}:G${sheetRow}`, values: [['', '']] },
        ]
      }
    })

    return NextResponse.json({ success: true, name: user[0], email: user[1], role: user[3] || 'viewer' })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}