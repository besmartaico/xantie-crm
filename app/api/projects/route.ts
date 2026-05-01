// @ts-nocheck
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'

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

async function getRows(sheets) {
  try {
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: "'Sub_Projects'!A2:E5000" })
    return r.data.values || []
  } catch(e) { return [] }
}

export async function GET(req) {
  try {
    const sheets = getSheets()
    const rows = await getRows(sheets)
    const { searchParams } = new URL(req.url)
    const clientName = searchParams.get('client')
    let projects = rows.map(r => ({
      name: r[0]||'', clientName: r[1]||'', description: r[2]||'',
      createdBy: r[3]||'', createdAt: r[4]||''
    }))
    if (clientName) projects = projects.filter(p => p.clientName === clientName)
    return NextResponse.json(projects.sort((a,b) => {
      if (a.name === 'N/A') return -1
      if (b.name === 'N/A') return 1
      return a.name.localeCompare(b.name)
    }))
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const sheets = getSheets()

    if (body.action === 'delete') {
      const rows = await getRows(sheets)
      const filtered = rows.filter(r => !(r[0]===body.name && r[1]===body.clientName))
      await sheets.spreadsheets.values.clear({ spreadsheetId: SID(), range: "'Sub_Projects'!A2:E5000" })
      if (filtered.length) {
        await sheets.spreadsheets.values.update({ spreadsheetId: SID(), range: "'Sub_Projects'!A2", valueInputOption: 'RAW', requestBody: { values: filtered } })
      }
      return NextResponse.json({ success: true })
    }

    const { name, clientName, description, createdBy } = body
    if (!name || !clientName) return NextResponse.json({ error: 'Name and clientName required' }, { status: 400 })
    const rows = await getRows(sheets)
    const nextRow = rows.length + 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: SID(), range: `'Sub_Projects'!A${nextRow}:E${nextRow}`,
      valueInputOption: 'RAW', requestBody: { values: [[name, clientName, description||'', createdBy||'', new Date().toISOString()]] }
    })
    return NextResponse.json({ success: true })
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}