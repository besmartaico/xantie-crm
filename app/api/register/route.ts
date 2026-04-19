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
    const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A2:E5000' })
    const rows = existing.data.values || []
    const existingIdx = rows.findIndex(r => r[1]?.toLowerCase() === normalizedEmail)

    const hash = await bcrypt.hash(password, 10)

    if (existingIdx !== -1) {
      const existingUser = rows[existingIdx]
      const existingHash = existingUser[2] || ''
      const existingStatus = existingUser[4] || 'active'

      // Imported user with no password - allow them to complete setup
      if (!existingHash) {
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
        return NextResponse.json({ success: true, name, email: normalizedEmail, role, activated: true })
      }

      return NextResponse.json({ success: false, error: 'An account with this email already exists. Use "Forgot password?" if you need to reset it.' }, { status: 409 })
    }

    // New user
    const role = normalizedEmail === 'jeff@xantie.com' ? 'admin' : 'viewer'
    const nextRow = rows.length + 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: SID, range: `Users!A${nextRow}:E${nextRow}`,
      valueInputOption: 'RAW', requestBody: { values: [[name, normalizedEmail, hash, role, 'active']] }
    })
    return NextResponse.json({ success: true, name, email: normalizedEmail, role })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Server error: ' + err.message }, { status: 500 })
  }
}