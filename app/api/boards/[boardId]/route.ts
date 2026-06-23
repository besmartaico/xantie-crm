// @ts-nocheck
import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

// ── Recurring tasks ─────────────────────────────────────────────────────
// PM_Cards columns: 0 id,1 columnId,2 boardId,3 title,4 description,5 assignedTo,
//   6 dueDate(=occurrence date),7 priority,8 position,9 createdAt,10 createdBy,
//   11 recurrence(JSON),12 recurGroupId,13 homeColumnId
const DAY = 86400000
const DONE_RE = /\b(done|complete|completed)\b/i
function isDoneName(name){ return DONE_RE.test((name||'').toLowerCase()) }
function parseRec(s){ if(!s) return null; try{ const r = typeof s==='string'?JSON.parse(s):s; return (r&&r.type)?r:null }catch(e){ return null } }
const ymd = d => d.toISOString().slice(0,10)
const fromYmd = s => new Date(s+'T00:00:00Z')
const epochDays = d => Math.floor(d.getTime()/DAY)
const weekIndex = d => Math.floor((epochDays(d)+4)/7) // Sunday-aligned weeks
const daysInMonth = (y,m) => new Date(Date.UTC(y,m+1,0)).getUTCDate()

function nextOccurrence(dateStr, rec){
  const d = fromYmd(dateStr)
  const interval = Math.max(1, parseInt(rec.interval)||1)
  if (rec.type==='daily'){ const n=new Date(d); n.setUTCDate(n.getUTCDate()+interval); return ymd(n) }
  if (rec.type==='weekly'){
    const wds = Array.isArray(rec.weekdays)&&rec.weekdays.length ? rec.weekdays : [d.getUTCDay()]
    const ref = weekIndex(d)
    for (let i=1;i<=800;i++){
      const c=new Date(d); c.setUTCDate(c.getUTCDate()+i)
      if (wds.includes(c.getUTCDay()) && ((weekIndex(c)-ref)%interval+interval)%interval===0) return ymd(c)
    }
    return null
  }
  if (rec.type==='monthly'){
    const day = parseInt(rec.day)||d.getUTCDate()
    let y=d.getUTCFullYear(), m=d.getUTCMonth()+interval
    y += Math.floor(m/12); m=((m%12)+12)%12
    return ymd(new Date(Date.UTC(y,m,Math.min(day,daysInMonth(y,m)))))
  }
  return null
}
// Generation gate: occurrence becomes active at 2am EST (fixed UTC-5 ≈ 07:00 UTC)
const occurrenceActive = (dateStr, nowMs) => nowMs >= Date.parse(dateStr+'T07:00:00Z')

// Generate due instances + prune completed history to the latest 5, for one board.
// Returns { cards, changed }. Pure in-memory; caller persists if changed.
function materializeRecurring(allCards, boardId, boardColumns, nowMs){
  const colById = {}; boardColumns.forEach(c=>{ colById[c.id]=c })
  const firstColId = boardColumns.length ? boardColumns[0].id : null
  const isDoneCol = colId => { const c=colById[colId]; return c?isDoneName(c.name):false }

  let result = allCards.slice()
  let changed = false

  const groupIds = new Set()
  for (const r of result) { if (r[12] && r[2]===boardId) groupIds.add(r[12]) }

  for (const gid of groupIds) {
    const inst = result.filter(r=>r[12]===gid && r[2]===boardId)
    const latest = inst.slice().sort((a,b)=>(a[6]||'').localeCompare(b[6]||''))[inst.length-1]
    const rec = parseRec(latest[11])
    if (!rec) continue

    let cur = latest[6] || ymd(new Date(nowMs))
    let guard = 0
    while (guard++ < 2000) {
      const nx = nextOccurrence(cur, rec)
      if (!nx || !occurrenceActive(nx, nowMs)) break
      cur = nx
    }
    if (cur !== latest[6]) {
      const homeId = (latest[13] && colById[latest[13]]) ? latest[13] : (firstColId || latest[1])
      // Drop stale OPEN instances (missed, never completed); keep completed history.
      result = result.filter(r => (r[12]!==gid || r[2]!==boardId) ? true : isDoneCol(r[1]))
      const pos = result.filter(r=>r[1]===homeId).length
      const nowIso = new Date(nowMs).toISOString()
      result.push([ uid(), homeId, boardId, latest[3], latest[4]||'', latest[5]||'', cur, latest[7]||'medium', pos, nowIso, latest[10]||'', latest[11], gid, homeId ])
      changed = true
    }
  }

  // Prune completed instances per group to the most recent 5.
  const byGroup = {}
  for (const r of result) { if (r[12] && r[2]===boardId) (byGroup[r[12]]=byGroup[r[12]]||[]).push(r) }
  const remove = new Set()
  for (const gid of Object.keys(byGroup)) {
    byGroup[gid].filter(r=>isDoneCol(r[1]))
      .sort((a,b)=>(b[6]||b[9]||'').localeCompare(a[6]||a[9]||''))
      .slice(5).forEach(r=>remove.add(r[0]))
  }
  if (remove.size) { result = result.filter(r=>!remove.has(r[0])); changed = true }

  return { cards: result, changed }
}

export async function GET(req, { params }) {
  try {
    const { boardId } = params
    const sheets = getSheets()
    let [boards, members, columns, cards] = await Promise.all([
      getRows(sheets,'PM_Boards'), getRows(sheets,'PM_Members'),
      getRows(sheets,'PM_Columns'), getRows(sheets,'PM_Cards')
    ])
    const board = boards.find(b=>b[0]===boardId)
    if (!board) return NextResponse.json({ error:'Not found' },{ status:404 })

    const boardMembers = members.filter(m=>m[0]===boardId).map(m=>({ email:m[1], role:m[2] }))
    const boardColumns = columns.filter(c=>c[1]===boardId)
      .map(c=>({ id:c[0], name:c[2], position:parseInt(c[3])||0 }))
      .sort((a,b)=>a.position-b.position)

    // Recurring tasks: lazily generate due instances + prune completed history (latest 5)
    const mat = materializeRecurring(cards, boardId, boardColumns, Date.now())
    if (mat.changed) { await clearAndRewrite(sheets, 'PM_Cards', mat.cards); cards = mat.cards }

    const boardCards = cards.filter(c=>c[2]===boardId)
      .map(c=>({ id:c[0], columnId:c[1], title:c[3], description:c[4]||'', assignedTo:c[5]||'', dueDate:c[6]||'', priority:c[7]||'medium', position:parseInt(c[8])||0, createdAt:c[9]||'', createdBy:c[10]||'', recurrence:c[11]||'', recurGroupId:c[12]||'', homeColumnId:c[13]||'' }))

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
      const [cards, cols] = await Promise.all([ getRows(sheets,'PM_Cards'), getRows(sheets,'PM_Columns') ])
      const doneCol = colId => { const cr=cols.find(x=>x[0]===colId); return cr?isDoneName(cr[2]):false }
      let groupId = '', movedToDone = false
      const updated = cards.map(c=>{
        if (c[0]!==body.cardId) return c
        const newCol = body.columnId??c[1]
        let recurrence = body.recurrence!==undefined
          ? (body.recurrence ? (typeof body.recurrence==='string'?body.recurrence:JSON.stringify(body.recurrence)) : '')
          : (c[11]||'')
        let gid = c[12]||''
        let home = c[13]||''
        let dueDate = body.dueDate??c[6]
        if (recurrence && !gid) gid = uid()
        if (recurrence && !home) home = newCol
        if (recurrence && !dueDate) dueDate = ymd(new Date())
        groupId = gid
        movedToDone = !!gid && doneCol(newCol)
        return [c[0], newCol, c[2], body.title??c[3], body.description??c[4], body.assignedTo??c[5], dueDate, body.priority??c[7], body.position??c[8], c[9], c[10], recurrence, gid, home]
      })
      let final = updated
      if (movedToDone && groupId) {
        const done = updated.filter(r=>r[12]===groupId && doneCol(r[1]))
          .sort((a,b)=>(b[6]||b[9]||'').localeCompare(a[6]||a[9]||''))
        const remove = new Set(done.slice(5).map(r=>r[0]))
        if (remove.size) final = updated.filter(r=>!remove.has(r[0]))
      }
      await clearAndRewrite(sheets, 'PM_Cards', final)
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