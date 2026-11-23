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

// ── Sheets API is rate-limited to 60 reads/min PER USER (the one shared service
// account), so every call here is kept as cheap as possible: tabs are ensured
// once per warm instance, multi-tab reads go through a single batchGet, and
// 429/503 bursts are retried with backoff instead of surfacing to the user.
async function withRetry(fn, tries = 5) {
  let delay = 400
  for (let i = 0; i < tries; i++) {
    try { return await fn() }
    catch (e) {
      const code = e?.code || e?.response?.status || e?.response?.data?.error?.code
      if ((code === 429 || code === 503) && i < tries - 1) {
        await new Promise(r => setTimeout(r, delay + Math.floor(Math.random() * 200)))
        delay *= 2
        continue
      }
      throw e
    }
  }
}

let ensurePromise = null
async function ensureTabsImpl(sheets) {
  const meta = await withRetry(() => sheets.spreadsheets.get({ spreadsheetId: SID() }))
  const existing = (meta.data.sheets || []).map(s => s.properties.title)
  for (const [tab, headers] of Object.entries(TABS)) {
    if (!existing.includes(tab)) {
      await withRetry(() => sheets.spreadsheets.batchUpdate({ spreadsheetId: SID(), requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] } }))
      await withRetry(() => sheets.spreadsheets.values.update({ spreadsheetId: SID(), range: `'${tab}'!A1`, valueInputOption: 'RAW', requestBody: { values: [headers] } }))
    }
  }
}
// Memoize so tabs are verified/created only once per warm instance (saves one
// spreadsheets.get metadata read on every request). Resets on failure so a
// cold error doesn't permanently poison the cache.
function ensureTabs(sheets) {
  if (!ensurePromise) ensurePromise = ensureTabsImpl(sheets).catch(e => { ensurePromise = null; throw e })
  return ensurePromise
}

async function getRows(sheets, tab) {
  try { const r = await withRetry(() => sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: `'${tab}'!A2:Z200000` })); return r.data.values || [] } catch(e) { return [] }
}
// Read several tabs in ONE API request (counts as a single read against quota).
async function batchGet(sheets, tabs) {
  try {
    const r = await withRetry(() => sheets.spreadsheets.values.batchGet({ spreadsheetId: SID(), ranges: tabs.map(t => `'${t}'!A2:Z200000`) }))
    const vr = r.data.valueRanges || []
    const out = {}
    tabs.forEach((t, i) => { out[t] = (vr[i] && vr[i].values) || [] })
    return out
  } catch(e) {
    const out = {}; tabs.forEach(t => { out[t] = [] }); return out
  }
}
async function clearAndRewrite(sheets, tab, rows) {
  await withRetry(() => sheets.spreadsheets.values.clear({ spreadsheetId: SID(), range: `'${tab}'!A2:Z200000` }))
  if (rows.length) await withRetry(() => sheets.spreadsheets.values.update({ spreadsheetId: SID(), range: `'${tab}'!A2`, valueInputOption: 'RAW', requestBody: { values: rows } }))
}
// Append from an already-known row count (avoids a redundant read of the tab).
async function appendAt(sheets, tab, row, existingCount) {
  const nextRow = existingCount + 2
  await withRetry(() => sheets.spreadsheets.values.update({ spreadsheetId: SID(), range: `'${tab}'!A${nextRow}`, valueInputOption: 'RAW', requestBody: { values: [row] } }))
}
async function appendRow(sheets, tab, row) {
  const existing = await getRows(sheets, tab)
  await appendAt(sheets, tab, row, existing.length)
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

    // Lightweight check for the nav: is this email an active participant?
    // Only needs two tabs, fetched in a single batched read.
    if (check) {
      const m = await batchGet(sheets, ['Health_Competitions', 'Health_Participants'])
      const activeIds = new Set(m['Health_Competitions'].map(compObj).filter(c => c.status !== 'archived').map(c => c.id))
      const participant = m['Health_Participants'].map(partObj).some(p => p.email === check && activeIds.has(p.competitionId))
      return NextResponse.json({ participant })
    }

    const m = await batchGet(sheets, ['Health_Competitions', 'Health_Elements', 'Health_Participants', 'Health_Logs'])
    return NextResponse.json({
      competitions: m['Health_Competitions'].map(compObj),
      elements: m['Health_Elements'].map(elemObj),
      participants: m['Health_Participants'].map(partObj),
      logs: m['Health_Logs'].map(logObj),
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
      await appendAt(sheets, 'Health_Elements', [id, body.competitionId, body.name || '', String(body.points ?? 1), String(pos), now], rows.length)
      return NextResponse.json({ success: true, id })
    }

    if (a === 'update_element') {
      const rows = await getRows(sheets, 'Health_Elements')
      await clearAndRewrite(sheets, 'Health_Elements', rows.map(r => r[0] === body.id ? [r[0], r[1], body.name ?? r[2], body.points !== undefined ? String(body.points) : r[3], r[4], r[5]] : r))
      return NextResponse.json({ success: true })
    }

    if (a === 'delete_element') {
      const m = await batchGet(sheets, ['Health_Elements', 'Health_Participants', 'Health_Logs'])
      await clearAndRewrite(sheets, 'Health_Elements', m['Health_Elements'].filter(r => r[0] !== body.id))
      await clearAndRewrite(sheets, 'Health_Participants', m['Health_Participants'].map(r => {
        const ids = parseIds(r[4])
        return ids.includes(body.id) ? [r[0], r[1], r[2], r[3], JSON.stringify(ids.filter(x => x !== body.id)), r[5]] : r
      }))
      await clearAndRewrite(sheets, 'Health_Logs', m['Health_Logs'].filter(r => r[3] !== body.id))
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
      const m = await batchGet(sheets, ['Health_Participants', 'Health_Logs'])
      const rows = m['Health_Participants']
      const target = rows.find(r => r[0] === body.id)
      await clearAndRewrite(sheets, 'Health_Participants', rows.filter(r => r[0] !== body.id))
      if (target) {
        const email = (target[2] || '').toLowerCase(), comp = target[1]
        await clearAndRewrite(sheets, 'Health_Logs', m['Health_Logs'].filter(r => !((r[2] || '').toLowerCase() === email && r[1] === comp)))
      }
      return NextResponse.json({ success: true })
    }

    // Participant toggles a day's completion for one of their assigned activities.
    if (a === 'toggle_log') {
      const email = (body.email || '').toLowerCase()
      const { competitionId, elementId, date } = body
      if (!email || !competitionId || !elementId || !date) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      // Both tabs in a single read.
      const m = await batchGet(sheets, ['Health_Participants', 'Health_Logs'])
      const me = m['Health_Participants'].map(partObj).find(p => p.email === email && p.competitionId === competitionId)
      if (!me || !me.elementIds.includes(elementId)) return NextResponse.json({ error: 'Not assigned to this activity' }, { status: 403 })
      const logs = m['Health_Logs']
      const idx = logs.findIndex(r => (r[2] || '').toLowerCase() === email && r[1] === competitionId && r[3] === elementId && r[4] === date)
      if (idx >= 0) {
        logs.splice(idx, 1)
        await clearAndRewrite(sheets, 'Health_Logs', logs)
        return NextResponse.json({ success: true, logged: false })
      }
      await appendAt(sheets, 'Health_Logs', [uid('hl'), competitionId, email, elementId, date, now], logs.length)
      return NextResponse.json({ success: true, logged: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch(e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
