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
const SHEET = "'Time Entries'"

export async function GET() {
  try {
    const sheets = getSheets()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SID(),
      range: SHEET + '!A2:G5000'
    })
    const rows = (res.data.values || []).map((r, i) => ({
      id: i + 2, name: r[0]||'', email: r[1]||'', date: r[2]||'',
      hours: r[3]||'', description: r[4]||'', importedFrom: r[5]||'', project: r[6]||'',
    }))
    return NextResponse.json(rows)
  } catch (err) {
    console.error('Time GET error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { action } = body
    const sheets = getSheets()

    if (action === 'add') {
      const { name, email, date, hours, description, project } = body
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SID(), range: SHEET + '!A2:A5000'
      })
      const nextRow = (existing.data.values || []).length + 2
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(),
        range: SHEET + `!A${nextRow}:G${nextRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[name, email, date, hours, description, '', project||'']] }
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'update') {
      const { id, name, email, date, hours, description, project, importedFrom } = body
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(),
        range: SHEET + `!A${id}:G${id}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[name, email, date, hours, description, importedFrom||'', project||'']] }
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      const { id } = body
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
      const sheet = meta.data.sheets?.find(s => s.properties?.title === 'Time Entries')
      if (!sheet) return NextResponse.json({ success: false, error: 'Sheet "Time Entries" not found' }, { status: 404 })
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SID(),
        requestBody: { requests: [{ deleteDimension: {
          range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: id - 1, endIndex: id }
        }}]}
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'import') {
      const { entries, userRole } = body
      if (userRole !== 'admin') return NextResponse.json({ success: false, error: 'Admin access required.' }, { status: 403 })
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SID(), range: SHEET + '!A2:A5000'
      })
      let nextRow = (existing.data.values || []).length + 2
      const data = entries.map(e => ({
        range: SHEET + `!A${nextRow++}:G${nextRow-1}`,
        values: [[e.name, e.email, e.date, e.hours, e.description, e.importedFrom||'import', e.project||'']]
      }))
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SID(),
        requestBody: { valueInputOption: 'RAW', data }
      })
      return NextResponse.json({ success: true, count: entries.length })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('Time POST error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}