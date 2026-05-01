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

async function ensureSheets(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
  const existing = meta.data.sheets.map(s=>s.properties.title)
  const needed = [
    { title:'PM_Boards', headers:['id','name','description','ownerEmail','color','createdAt'] },
    { title:'PM_Members', headers:['boardId','email','role'] },
    { title:'PM_Columns', headers:['id','boardId','name','position'] },
    { title:'PM_Cards', headers:['id','columnId','boardId','title','description','assignedTo','dueDate','priority','position','createdAt','createdBy'] },
  ]
  for (const s of needed) {
    if (!existing.includes(s.title)) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId:SID(), requestBody:{ requests:[{ addSheet:{ properties:{ title:s.title } } }] } })
      await sheets.spreadsheets.values.update({ spreadsheetId:SID(), range:`'${s.title}'!A1`, valueInputOption:'RAW', requestBody:{ values:[s.headers] } })
    }
  }
}

async function getRows(sheets, tab) {
  try {
    const r = await sheets.spreadsheets.values.get({ spreadsheetId:SID(), range:`'${tab}'!A2:Z5000` })
    return r.data.values || []
  } catch(e) { return [] }
}

async function appendRow(sheets, tab, row) {
  const existing = await getRows(sheets, tab)
  const nextRow = existing.length + 2
  await sheets.spreadsheets.values.update({
    spreadsheetId:SID(), range:`'${tab}'!A${nextRow}`,
    valueInputOption:'RAW', requestBody:{ values:[row] }
  })
}

export async function GET(req) {
  try {
    const sheets = getSheets()
    await ensureSheets(sheets)
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')
    if (!email) return NextResponse.json([])

    const boards = await getRows(sheets, 'PM_Boards')
    const members = await getRows(sheets, 'PM_Members')

    // Boards user owns or is member of
    const memberBoardIds = new Set(members.filter(m=>m[1]===email).map(m=>m[0]))
    const visible = boards.filter(b => b[3]===email || memberBoardIds.has(b[0]))

    return NextResponse.json(visible.map(b=>({
      id:b[0], name:b[1], description:b[2]||'', ownerEmail:b[3], color:b[4]||'#8DC63F', createdAt:b[5]||'',
      isOwner: b[3]===email
    })))
  } catch(e) { return NextResponse.json({ error:e.message },{ status:500 }) }
}

export async function POST(req) {
  try {
    const sheets = getSheets()
    await ensureSheets(sheets)
    const body = await req.json()

    if (body.action === 'delete') {
      // Delete board + all its data
      const { boardId } = body
      for (const tab of ['PM_Boards','PM_Members','PM_Columns','PM_Cards']) {
        const rows = await getRows(sheets, tab)
        const col = tab === 'PM_Boards' ? 0 : 0 // boardId always col 0 or 1
        const colIdx = tab === 'PM_Boards' ? 0 : tab === 'PM_Members' ? 0 : 1
        const keep = rows.filter(r => r[colIdx] !== boardId)
        // Clear and rewrite
        const range = `'${tab}'!A2:Z5000`
        await sheets.spreadsheets.values.clear({ spreadsheetId:SID(), range })
        if (keep.length) {
          await sheets.spreadsheets.values.update({ spreadsheetId:SID(), range:`'${tab}'!A2`, valueInputOption:'RAW', requestBody:{ values:keep } })
        }
      }
      return NextResponse.json({ success:true })
    }

    const { name, description, ownerEmail, color } = body
    if (!name || !ownerEmail) return NextResponse.json({ error:'Missing fields' },{ status:400 })
    const id = uid()
    const createdAt = new Date().toISOString()
    await appendRow(sheets, 'PM_Boards', [id, name, description||'', ownerEmail, color||'#8DC63F', createdAt])
    // Owner is also a member
    await appendRow(sheets, 'PM_Members', [id, ownerEmail, 'owner'])
    return NextResponse.json({ success:true, id })
  } catch(e) { return NextResponse.json({ error:e.message },{ status:500 }) }
}