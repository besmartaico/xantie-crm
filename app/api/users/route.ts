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
const SID = () => process.env.GOOGLE_SHEETS_ID

export async function GET() {
  try {
    const sheets = getSheets()
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: 'Users!A2:D5000' })
    const rows = (res.data.values || []).map((r, i) => ({
      id: i + 2, name: r[0]||'', email: r[1]||'', role: r[3]||'user'
    }))
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const { action, id, role } = await req.json()
    const sheets = getSheets()
    if (action === 'update_role') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(),
        range: `Users!D${id}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[role]] }
      })
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ success: false }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}