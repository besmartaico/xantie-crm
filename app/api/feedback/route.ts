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
const RANGE = "'Feedback'!A2:H5000"

async function ensureSheet(sheets) {
  try {
    await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: RANGE })
  } catch(e) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
    const exists = meta.data.sheets.some(s => s.properties.title === 'Feedback')
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SID(),
        requestBody: { requests: [{ addSheet: { properties: { title: 'Feedback' } } }] }
      })
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: "'Feedback'!A1:H1",
        valueInputOption: 'RAW',
        requestBody: { values: [['Type','Title','Description','Priority','Name','Email','Status','SubmittedAt']] }
      })
    }
  }
}

export async function GET() {
  try {
    const sheets = getSheets()
    await ensureSheet(sheets)
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: RANGE })
    const rows = (res.data.values || []).map((r, i) => ({
      id: i + 2,
      type: r[0]||'bug', title: r[1]||'', description: r[2]||'',
      priority: r[3]||'medium', name: r[4]||'', email: r[5]||'',
      status: r[6]||'open', submittedAt: r[7]||''
    }))
    return NextResponse.json(rows)
  } catch(err) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const sheets = getSheets()
    await ensureSheet(sheets)

        if (body.action === 'update') {
      const { id, title, description, priority, type } = body
      const range = `'Feedback'!A${id}:H${id}`
      const cur = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range })
      const r = (cur.data.values||[[]])[0] || []
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range, valueInputOption: 'RAW',
        requestBody: { values: [[type??r[0], title??r[1], description??r[2], priority??r[3], r[4]||'', r[5]||'', r[6]||'open', r[7]||'']] }
      })
      return NextResponse.json({ success: true })
    }
    if (body.action === 'update_status') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `'Feedback'!G${body.id}`,
        valueInputOption: 'RAW', requestBody: { values: [[body.status]] }
      })
      return NextResponse.json({ success: true })
    }

    const { type, title, description, priority, name, email } = body
    if (!title) return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })

    const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: RANGE })
    const nextRow = (existing.data.values || []).length + 2
    const submittedAt = new Date().toISOString()

    await sheets.spreadsheets.values.update({
      spreadsheetId: SID(), range: `'Feedback'!A${nextRow}:H${nextRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[type||'bug', title, description||'', priority||'medium', name||'', email||'', 'open', submittedAt]] }
    })
    return NextResponse.json({ success: true })
  } catch(err) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }) }
}