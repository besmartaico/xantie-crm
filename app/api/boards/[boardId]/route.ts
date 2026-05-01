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

async function getRows(sheets, tab) {
  try {
    const r = await sheets.spreadsheets.values.get({ spreadsheetId:SID(), range:`'${tab}'!A2:Z5000` })
    return r.data.values || []
  } catch(e) { return [] }
}
async function clearAndRewrite(sheets, tab, rows) {
  await sheets.spreadsheets.values.clear({ spreadsheetId:SID(), range:`'${tab}'!A2:Z5000` })
  if (rows.length) {
    await sheets.spreadsheets.values.update({ spreadsheetId:SID(), range:`'${tab}'!A2`, valueInputOption:'RAW', requestBody:{ values:rows } })
  }
}
async function appendRow(sheets, tab, row) {
  const existing = await getRows(sheets, tab)
  const nextRow = existing.length + 2
  await sheets.spreadsheets.values.update({
    spreadsheetId:SID(), range:`'${tab}'!A${nextRow}`,
    valueInputOption:'RAW', requestBody:{ values:[row] }
  })
}

export async function GET(req, { params }) {
  try {
    const { boardId } = params
    const sheets = getSheets()
    const [boards, members, columns, cards] = await Promise.all([
      getRows(sheets,'PM_Boards'), getRows(sheets,'PM_Members'),
      getRows(sheets,'PM_Columns'), getRows(sheets,'PM_Cards')
    ])
    const board = boards.find(b=>b[0]===boardId)
    if (!board) return NextResponse.json({ error:'Not found' },{ status:404 })

    const boardMembers = members.filter(m=>m[0]===boardId).map(m=>({ email:m[1], role:m[2] }))
    const boardColumns = columns.filter(c=>c[1]===boardId)
      .map(c=>({ id:c[0], name:c[2], position:parseInt(c[3])||0 }))
      .sort((a,b)=>a.position-b.position)
    const boardCards = cards.filter(c=>c[2]===boardId)
      .map(c=>({ id:c[0], columnId:c[1], title:c[3], description:c[4]||'', assignedTo:c[5]||'', dueDate:c[6]||'', priority:c[7]||'medium', position:parseInt(c[8])||0, createdAt:c[9]||'', createdBy:c[10]||'' }))

    return NextResponse.json({
      id:board[0], name:board[1], description:board[2]||'', ownerEmail:board[3], color:board[4]||'#8DC63F', createdAt:board[5]||'',
      members: boardMembers, columns: boardColumns, cards: boardCards
    })
  } catch(e) { return NextResponse.json({ error:e.message },{ status:500 }) }
}

export async function POST(req, { params }) {
  try {
    const { boardId } = params
    const body = await req.json()
    const sheets = getSheets()

    // Add member
    if (body.action === 'add_member') {
      const members = await getRows(sheets, 'PM_Members')
      if (!members.find(m=>m[0]===boardId&&m[1]===body.email)) {
        await appendRow(sheets, 'PM_Members', [boardId, body.email, body.role||'editor'])
      }
      return NextResponse.json({ success:true })
    }

    // Remove member
    if (body.action === 'remove_member') {
      const members = await getRows(sheets, 'PM_Members')
      const filtered = members.filter(m=>!(m[0]===boardId&&m[1]===body.email&&m[2]!=='owner'))
      await clearAndRewrite(sheets, 'PM_Members', filtered)
      return NextResponse.json({ success:true })
    }

    // Add column
    if (body.action === 'add_column') {
      const cols = await getRows(sheets, 'PM_Columns')
      const boardCols = cols.filter(c=>c[1]===boardId)
      const position = boardCols.length
      const id = uid()
      await appendRow(sheets, 'PM_Columns', [id, boardId, body.name, position])
      return NextResponse.json({ success:true, id })
    }

    // Rename column
    if (body.action === 'rename_column') {
      const cols = await getRows(sheets, 'PM_Columns')
      const updated = cols.map(c=>c[0]===body.columnId?[c[0],c[1],body.name,c[3]]:c)
      await clearAndRewrite(sheets, 'PM_Columns', updated)
      return NextResponse.json({ success:true })
    }

    // Delete column + its cards
    if (body.action === 'delete_column') {
      const cols = await getRows(sheets, 'PM_Columns')
      await clearAndRewrite(sheets, 'PM_Columns', cols.filter(c=>c[0]!==body.columnId))
      const cards = await getRows(sheets, 'PM_Cards')
      await clearAndRewrite(sheets, 'PM_Cards', cards.filter(c=>c[1]!==body.columnId))
      return NextResponse.json({ success:true })
    }

    // Add card
    if (body.action === 'add_card') {
      const cards = await getRows(sheets, 'PM_Cards')
      const colCards = cards.filter(c=>c[1]===body.columnId)
      const position = colCards.length
      const id = uid()
      const now = new Date().toISOString()
      await appendRow(sheets, 'PM_Cards', [id, body.columnId, boardId, body.title, body.description||'', body.assignedTo||'', body.dueDate||'', body.priority||'medium', position, now, body.createdBy||''])
      return NextResponse.json({ success:true, id })
    }

    // Update card
    if (body.action === 'update_card') {
      const cards = await getRows(sheets, 'PM_Cards')
      const updated = cards.map(c=>{
        if (c[0]!==body.cardId) return c
        return [c[0], body.columnId??c[1], c[2], body.title??c[3], body.description??c[4], body.assignedTo??c[5], body.dueDate??c[6], body.priority??c[7], body.position??c[8], c[9], c[10]]
      })
      await clearAndRewrite(sheets, 'PM_Cards', updated)
      return NextResponse.json({ success:true })
    }

    // Delete card
    if (body.action === 'delete_card') {
      const cards = await getRows(sheets, 'PM_Cards')
      await clearAndRewrite(sheets, 'PM_Cards', cards.filter(c=>c[0]!==body.cardId))
      return NextResponse.json({ success:true })
    }

    // Update board name/description/color
    if (body.action === 'update_board') {
      const boards = await getRows(sheets, 'PM_Boards')
      const updated = boards.map(b=>b[0]===boardId?[b[0],body.name??b[1],body.description??b[2],b[3],body.color??b[4],b[5]]:b)
      await clearAndRewrite(sheets, 'PM_Boards', updated)
      return NextResponse.json({ success:true })
    }

    return NextResponse.json({ error:'Unknown action' },{ status:400 })
  } catch(e) { return NextResponse.json({ error:e.message },{ status:500 }) }
}