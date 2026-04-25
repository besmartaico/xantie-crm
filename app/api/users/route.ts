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
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SID(), range: 'Users!A2:E5000'
    })
    const rows = (res.data.values || []).map((r, i) => ({
      id: i + 2,
      name: r[0]||'',
      email: r[1]||'',
      role: r[3]||'user',
      status: r[4]||'active'
    }))
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { action } = body
    const sheets = getSheets()

    if (action === 'update_role') {
      const { id, role } = body
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `Users!D${id}`,
        valueInputOption: 'RAW', requestBody: { values: [[role]] }
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'deactivate') {
      let rowNum = body.id
      if (!rowNum && body.email) {
        const lookup = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: 'Users!A2:E5000' })
        const rows = lookup.data.values || []
        const idx = rows.findIndex(r => r[1]?.toLowerCase() === body.email.toLowerCase())
        if (idx === -1) return NextResponse.json({ success: false, error: 'User not found' })
        rowNum = idx + 2
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `Users!E${rowNum}`,
        valueInputOption: 'RAW', requestBody: { values: [['inactive']] }
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'reactivate') {
      // support email lookup
      let rowNum = body.id
      if (!rowNum && body.email) {
        const lookup = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: 'Users!A2:E5000' })
        const rows = lookup.data.values || []
        const idx = rows.findIndex(r => r[1]?.toLowerCase() === body.email.toLowerCase())
        if (idx === -1) return NextResponse.json({ success: false, error: 'User not found' })
        rowNum = idx + 2
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `Users!E${rowNum}`,
        valueInputOption: 'RAW', requestBody: { values: [['active']] }
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}