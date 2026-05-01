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

async function getRows(sheets, tab) {
  try {
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: `'${tab}'!A2:E5000` })
    return r.data.values || []
  } catch(e) { return [] }
}

export async function GET() {
  try {
    const sheets = getSheets()
    const rows = await getRows(sheets, 'Clients')
    return NextResponse.json(rows.map(r => ({
      name: r[0]||'', description: r[1]||'', createdBy: r[2]||'',
      createdAt: r[3]||'', teamLead: r[4]||''
    })).sort((a,b) => a.name.localeCompare(b.name)))
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const sheets = getSheets()
    
    if (body.action === 'delete') {
      const rows = await getRows(sheets, 'Clients')
      const filtered = rows.filter(r => r[0] !== body.name)
      await sheets.spreadsheets.values.clear({ spreadsheetId: SID(), range: "'Clients'!A2:E5000" })
      if (filtered.length) {
        await sheets.spreadsheets.values.update({ spreadsheetId: SID(), range: "'Clients'!A2", valueInputOption: 'RAW', requestBody: { values: filtered } })
      }
      return NextResponse.json({ success: true })
    }

    const { name, description, createdBy, teamLead } = body
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    const rows = await getRows(sheets, 'Clients')
    const nextRow = rows.length + 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: SID(), range: `'Clients'!A${nextRow}:E${nextRow}`,
      valueInputOption: 'RAW', requestBody: { values: [[name, description||'', createdBy||'', new Date().toISOString(), teamLead||'']] }
    })
    // Auto-create N/A sub-project
    const subRows = await (async () => {
      try { const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: "'Sub_Projects'!A2:E5000" }); return r.data.values||[] } catch(e){ return [] }
    })()
    const nextSub = subRows.length + 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: SID(), range: `'Sub_Projects'!A${nextSub}:E${nextSub}`,
      valueInputOption: 'RAW', requestBody: { values: [['N/A', name, 'Default project', createdBy||'', new Date().toISOString()]] }
    })
    return NextResponse.json({ success: true })
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}