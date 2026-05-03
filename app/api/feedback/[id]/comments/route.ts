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
function uid() { return Date.now().toString(36)+Math.random().toString(36).substr(2,5) }

async function ensureSheet(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
  if (!meta.data.sheets.find(s=>s.properties.title==='Feedback_Comments')) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SID(), requestBody: { requests:[{ addSheet:{ properties:{ title:'Feedback_Comments' } } }] } })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SID(), range: "'Feedback_Comments'!A1:F1",
      valueInputOption: 'RAW', requestBody: { values: [['id','feedbackId','name','email','comment','createdAt']] }
    })
  }
}

async function getRows(sheets) {
  try {
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: "'Feedback_Comments'!A2:F5000" })
    return r.data.values || []
  } catch(e) { return [] }
}

export async function GET(req, { params }) {
  try {
    const sheets = getSheets()
    await ensureSheet(sheets)
    const { id } = params
    const rows = await getRows(sheets)
    const comments = rows
      .filter(r => r[1] === id)
      .map(r => ({ id:r[0], feedbackId:r[1], name:r[2]||'', email:r[3]||'', comment:r[4]||'', createdAt:r[5]||'' }))
      .sort((a,b) => (a.createdAt||'').localeCompare(b.createdAt||''))
    return NextResponse.json(comments)
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function POST(req, { params }) {
  try {
    const sheets = getSheets()
    await ensureSheet(sheets)
    const { id } = params
    const body = await req.json()
    const rows = await getRows(sheets)
    const nextRow = rows.length + 2
    const commentId = uid()
    await sheets.spreadsheets.values.update({
      spreadsheetId: SID(), range: `'Feedback_Comments'!A${nextRow}:F${nextRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[commentId, id, body.name||'', body.email||'', body.comment||'', new Date().toISOString()]] }
    })
    return NextResponse.json({ success:true, id:commentId })
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}