// @ts-nocheck
import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
function uid(p = 'h') { return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }

// Sheet tabs for the health competition feature (auto-created on first use).
const TABS = {
  Health_Competitions: ['id', 'name', 'startDate', 'endDate', 'status', 'createdBy', 'createdAt'],
  Health_Elements:     ['id', 'competitionId', 'name', 'points', 'position', 'createdAt'],
  Health_Participants: ['id', 'competitionId', 'email', 'name', 'elementIds', 'addedAt'],
  Health_Logs:         ['id', 'competitionId', 'email', 'elementId', 'date', 'createdAt'],
}

async function ensureTabs(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
  const existing = (meta.data.sheets || []).map(s => s.properties.title)
  for (const [tab, headers] of Object.entries(TABS)) {
    if (!existing.includes(tab)) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SID(), requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] } })
      await sheets.spreadsheets.values.update({ spreadsheetId: SID(), range: `'${tab}'!A1`, valueInputOption: 'RAW', requestBody: { values: [headers] } })
    }
  }
}

async function getRows(sheets, tab) {
  try { const r = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: `'${tab}'!A2:Z200000` }); return r.data.values || [] } catch(e) { return [] }
}
async function clearAndRewrite(sheets, tab, rows) {
  await sheets.spreadsheets.values.clear({ spreadsheetId: SID(), range: `'${tab}'!A2:Z200000` })
  if (rows.length) await sheets.spreadsheets.values.update({ spreadsheetId: SID(), range: `'${tab}'!A2`, valueInputOption: 'RAW', requestBody: { values: rows } })
}
async function appendRow(sheets, tab, row) {
  const existing = await getRows(sheets, tab)
  const nextRow = existing.length + 2
  await sheets.spreadsheets.values.update({ spreadsheetId: SID(), range: `'${tab}'!A${nextRow}`, valueInputOption: 'RAW', requestBody: { values: [row] } })
}

function parseIds(s) { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : [] } catch(e) { return (s || '').split(',').map(x => x.trim()).filter(Boolean) } }
const compObj = r => ({ id: r[0], name: r[1] || '', startDate: r[2] || '', endDate: r[3] || '', status: r[4] || 'active', createdBy: r[5] || '', createdAt: r[6] || '' })
const elemObj = r => ({ id: r[0], competitionId: r[1], name: r[2] || '', points: parseFloat(r[3]) || 1, position: parseInt(r[4]) || 0, createdAt: r[5] || '' })
const partObj = r => ({ id: r[0], competitionId: r[1], email: (r[2] || '').toLowerCase(), name: r[3] || '', elementIds: parseIds(r[4]), addedAt: r[5] || '' })
const logObj  = r => ({ id: r[0], competitionId: r[1], email: (r[2] || '').toLowerCase(), elementId: r[3], date: r[4] || '', createdAt: r[5] || '' })

export async function GET(req) {
  try {
    const sheets = getSheets()
    const { searchParams } = new URL(req.url)
    const check = (searchParams.get('check') || '').trim().toLowerCase()
    await ensureTabs(sheets)
    const [comps, elems, parts, logs] = await Promise.all([
      getRows(sheets, 'Health_Competitions'), getRows(sheets, 'Health_Elements'),
      getRows(sheets, 'Health_Participants'), getRows(sheets, 'Health_Logs'),
    ])
    const participants = parts.map(partObj)

    // Lightweight check for the nav: is this email an active participant?
    if (check) {
      const activeIds = new Set(comps.map(compObj).filter(c => c.status !== 'archived').map(c => c.id))
      return NextResponse.json({ participant: participants.some(p => p.email === check && activeIds.has(p.competitionId)) })
    }

    return NextResponse.json({
      competitions: comps.map(compObj),
      elements: elems.map(elemObj),
      participants,
      logs: logs.map(logObj),
    })
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function POST(req) {
  try {
    const sheets = getSheets()
    await ensureTabs(sheets)
    const body = await req.json()
    const a = body.action
    const now = new Date().toISOString()

    if (a === 'create_competition') {
      const id = uid('hc')
      await appendRow(sheets, 'Health_Competitions', [id, body.name || 'Health Competition', body.startDate || '', body.endDate || '', 'active', body.createdBy || '', now])
      return NextResponse.json({ success: true, id })
    }

    if (a === 'update_competition') {
      const rows = await getRows(sheets, 'Health_Competitions')
      await clearAndRewrite(sheets, 'Health_Competitions', rows.map(r => r[0] === body.id ? [r[0], body.name ?? r[1], body.startDate ?? r[2], body.endDate ?? r[3], body.status ?? r[4], r[5], r[6]] : r))
      return NextResponse.json({ success: true })
    }

    if (a === 'add_element') {
      const rows = await getRows(sheets, 'Health_Elements')
      const pos = rows.filter(r => r[1] === body.competitionId).length
      const id = uid('he')
      await appendRow(sheets, 'Health_Elements', [id, body.competitionId, body.name || '', String(body.points ?? 1), String(pos), now])
      return NextResponse.json({ success: true, id })
    }

    if (a === 'update_element') {
      const rows = await getRows(sheets, 'Health_Elements')
      await clearAndRewrite(sheets, 'Health_Elements', rows.map(r => r[0] === body.id ? [r[0], r[1], body.name ?? r[2], body.points !== undefined ? String(body.points) : r[3], r[4], r[5]] : r))
      return NextResponse.json({ success: true })
    }

    if (a === 'delete_element') {
      const elems = await getRows(sheets, 'Health_Elements')
      await clearAndRewrite(sheets, 'Health_Elements', elems.filter(r => r[0] !== body.id))
      const parts = await getRows(sheets, 'Health_Participants')
      await clearAndRewrite(sheets, 'Health_Participants', parts.map(r => {
        const ids = parseIds(r[4])
        return ids.includes(body.id) ? [r[0], r[1], r[2], r[3], JSON.stringify(ids.filter(x => x !== body.id)), r[5]] : r
      }))
      const logs = await getRows(sheets, 'Health_Logs')
      await clearAndRewrite(sheets, 'Health_Logs', logs.filter(r => r[3] !== body.id))
      return NextResponse.json({ success: true })
    }

    if (a === 'add_participant') {
      const id = uid('hp')
      await appendRow(sheets, 'Health_Participants', [id, body.competitionId, (body.email || '').toLowerCase(), body.name || '', JSON.stringify(body.elementIds || []), now])
      return NextResponse.json({ success: true, id })
    }

    if (a === 'update_participant') {
      const rows = await getRows(sheets, 'Health_Participants')
      await clearAndRewrite(sheets, 'Health_Participants', rows.map(r => r[0] === body.id ? [r[0], r[1], r[2], body.name ?? r[3], body.elementIds !== undefined ? JSON.stringify(body.elementIds) : r[4], r[5]] : r))
      return NextResponse.json({ success: true })
    }

    if (a === 'remove_participant') {
      const rows = await getRows(sheets, 'Health_Participants')
      const target = rows.find(r => r[0] === body.id)
      await clearAndRewrite(sheets, 'Health_Participants', rows.filter(r => r[0] !== body.id))
      if (target) {
        const email = (target[2] || '').toLowerCase(), comp = target[1]
        const logs = await getRows(sheets, 'Health_Logs')
        await clearAndRewrite(sheets, 'Health_Logs', logs.filter(r => !((r[2] || '').toLowerCase() === email && r[1] === comp)))
      }
      return NextResponse.json({ success: true })
    }

    // Participant toggles a day's completion for one of their assigned activities.
    if (a === 'toggle_log') {
      const email = (body.email || '').toLowerCase()
      const { competitionId, elementId, date } = body
      if (!email || !competitionId || !elementId || !date) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      const parts = (await getRows(sheets, 'Health_Participants')).map(partObj)
      const me = parts.find(p => p.email === email && p.competitionId === competitionId)
      if (!me || !me.elementIds.includes(elementId)) return NextResponse.json({ error: 'Not assigned to this activity' }, { status: 403 })
      const logs = await getRows(sheets, 'Health_Logs')
      const idx = logs.findIndex(r => (r[2] || '').toLowerCase() === email && r[1] === competitionId && r[3] === elementId && r[4] === date)
      if (idx >= 0) {
        logs.splice(idx, 1)
        await clearAndRewrite(sheets, 'Health_Logs', logs)
        return NextResponse.json({ success: true, logged: false })
      }
      await appendRow(sheets, 'Health_Logs', [uid('hl'), competitionId, email, elementId, date, now])
      return NextResponse.json({ success: true, logged: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
