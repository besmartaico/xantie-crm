// @ts-nocheck
import { NextResponse } from 'next/server'
import { google } from 'googleapis'

function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g,'\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version:'v4', auth })
}
const SID = () => process.env.GOOGLE_SHEETS_ID
const RANGE = "'Time Entries'!A2:I5000"

function rowToEntry(r, i) {
  return {
    id: i + 2,
    name: r[0]||'', email: r[1]||'', date: r[2]||'',
    hours: r[3]||'', description: r[4]||'', importedFrom: r[5]||'',
    project: r[6]||'',   // this is the CLIENT (column G)
    billable: r[7]||'yes',
    subProject: r[8]||'N/A',  // column I
  }
}

export async function GET() {
  try {
    const sheets = getSheets()
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: RANGE })
    return NextResponse.json((res.data.values||[]).map(rowToEntry))
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const sheets = getSheets()

    if (body.action === 'delete') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: RANGE })
      const rows = res.data.values || []
      const sheetId = (await sheets.spreadsheets.get({ spreadsheetId: SID() })).data.sheets.find(s=>s.properties.title==='Time Entries')?.properties.sheetId
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SID(), requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension:'ROWS', startIndex: body.id-2, endIndex: body.id-1 } } }] } })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'update') {
      const { id, name, email, date, hours, description, project, billable, subProject } = body
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `'Time Entries'!A${id}:I${id}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[name, email, date, hours, description, '', project, billable, subProject||'N/A']] }
      })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'import') {
      const { entries } = body
      if (!entries?.length) return NextResponse.json({ success: true, count: 0 })
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: RANGE })
      let nextRow = (res.data.values||[]).length + 2
      for (const e of entries) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SID(), range: `'Time Entries'!A${nextRow}:I${nextRow}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[e.name, e.email, e.date, e.hours, e.description, e.importedFrom||'import', e.project||'', e.billable||'yes', e.subProject||'N/A']] }
        })
        nextRow++
      }
      return NextResponse.json({ success: true, count: entries.length })
    }

    // Add new entries (array)
    const { entries } = body
    if (!entries?.length) return NextResponse.json({ success: true })
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: RANGE })
    let nextRow = (res.data.values||[]).length + 2
    for (const e of entries) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `'Time Entries'!A${nextRow}:I${nextRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[e.name, e.email, e.date, e.hours, e.description, '', e.project||'', e.billable||'yes', e.subProject||'N/A']] }
      })
      nextRow++
    }
    return NextResponse.json({ success: true })
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}