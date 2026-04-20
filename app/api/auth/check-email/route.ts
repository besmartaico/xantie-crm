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
    const { email } = await req.json()
    if (!email) return NextResponse.json({ exists: false })
    const sheets = getSheets()
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: 'Users!A2:C5000' })
    const rows = res.data.values || []
    const user = rows.find(r => r[1]?.toLowerCase() === email.toLowerCase())
    if (!user) return NextResponse.json({ exists: false })
    // exists with password = full account, exists without = imported/no password
    return NextResponse.json({ exists: true, hasPassword: !!(user[2]) })
  } catch (err) {
    return NextResponse.json({ exists: false })
  }
}