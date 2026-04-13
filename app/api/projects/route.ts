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
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: 'Projects!A2:E5000' })
    const rows = (res.data.values || []).map((r, i) => ({
      id: i + 2, name: r[0]||'', description: r[1]||'', createdBy: r[2]||'', createdAt: r[3]||'', teamLead: r[4]||''
    }))
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { action } = body
    const sheets = getSheets()

    if (action === 'add') {
      const { name, description, createdBy } = body
      const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: 'Projects!A2:A5000' })
      const nextRow = (existing.data.values || []).length + 2
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `Projects!A${nextRow}:E${nextRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[name, description||'', createdBy||'', new Date().toISOString().split('T')[0], '']] }
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'update_lead') {
      const { id, teamLead } = body
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `Projects!E${id}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[teamLead]] }
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      const { id } = body
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
      const sheet = meta.data.sheets?.find(s => s.properties?.title === 'Projects')
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SID(),
        requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: id-1, endIndex: id } }}]}
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}