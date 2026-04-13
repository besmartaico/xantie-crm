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
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: 'TimeEntries!A2:G' })
    const rows = (res.data.values || []).map((r, i) => ({
      id: i + 2, name: r[0]||'', email: r[1]||'', date: r[2]||'',
      hours: r[3]||'', description: r[4]||'', importedFrom: r[5]||'', project: r[6]||'',
    }))
    return NextResponse.json(rows)
  } catch (err) { return NextResponse.json([], { status: 500 }) }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { action } = body
    const sheets = getSheets()

    if (action === 'add') {
      const { name, email, date, hours, description, project } = body
      await sheets.spreadsheets.values.append({
        spreadsheetId: SID(), range: 'TimeEntries',
        valueInputOption: 'RAW',
        requestBody: { values: [[name, email, date, hours, description, '', project||'']] }
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'update') {
      const { id, name, email, date, hours, description, project, importedFrom } = body
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `TimeEntries!A${id}:G${id}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[name, email, date, hours, description, importedFrom||'', project||'']] }
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      const { id } = body
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
      const sheet = meta.data.sheets?.find(s => s.properties?.title === 'TimeEntries')
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
      const values = entries.map(e => [e.name, e.email, e.date, e.hours, e.description, e.importedFrom||'import', e.project||''])
      await sheets.spreadsheets.values.append({
        spreadsheetId: SID(), range: 'TimeEntries',
        valueInputOption: 'RAW', requestBody: { values }
      })
      return NextResponse.json({ success: true, count: values.length })
    }

    return NextResponse.json({ success: false }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}