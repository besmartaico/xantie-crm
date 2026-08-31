// @ts-nocheck
import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// One-off, guarded migration: reassign a single user's Time Entries from one
// client to another. Preview by default; only mutates when apply:true.
// Only overwrites specific Client (col G) cells — never clears/rewrites the sheet.
const TOKEN = 'gocollectiv-2026'

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

export async function POST(req) {
  try {
    const body = await req.json()
    if (body.token !== TOKEN) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const email = (body.email || '').trim().toLowerCase()
    const fromClient = (body.fromClient || '').trim()
    const toClient = (body.toClient || '').trim()
    const apply = body.apply === true
    // Optional: restrict to entries whose date (YYYY-MM-DD) starts with one of these prefixes.
    const datePrefixes = Array.isArray(body.datePrefixes) && body.datePrefixes.length ? body.datePrefixes.map(String) : null
    if (!email || !fromClient || !toClient) {
      return NextResponse.json({ error: 'email, fromClient, toClient required' }, { status: 400 })
    }

    const sheets = getSheets()

    // Read Time Entries data rows (A2:I). B=Email(1), G=Client(6), I=Project(8).
    const teRes = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: "'Time Entries'!A2:I5000" })
    const rows = teRes.data.values || []

    const matches = []
    rows.forEach((r, i) => {
      if ((r[1] || '').trim().toLowerCase() === email && (r[6] || '').trim() === fromClient) {
        const date = (r[2] || '').trim()
        if (datePrefixes && !datePrefixes.some(p => date.startsWith(p))) return
        matches.push({ sheetRow: i + 2, date, hours: r[3] || '', sub: r[8] || 'N/A' })
      }
    })
    const distinctSubs = [...new Set(matches.map(m => m.sub || 'N/A'))]

    if (!apply) {
      return NextResponse.json({
        success: true, apply: false, version: 'v2-datefilter', matched: matches.length,
        datePrefixes: datePrefixes || 'all',
        distinctSubProjects: distinctSubs,
        sample: matches.slice(0, 8).map(m => ({ row: m.sheetRow, date: m.date, hours: m.hours, sub: m.sub })),
      })
    }

    // ── APPLY ────────────────────────────────────────────────────────────
    const log = []

    // 1) Ensure the target client exists (append-only).
    const clientsRes = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: "'Clients'!A2:E5000" })
    const clientRows = clientsRes.data.values || []
    if (!clientRows.some(r => (r[0] || '').trim() === toClient)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `'Clients'!A${clientRows.length + 2}:E${clientRows.length + 2}`,
        valueInputOption: 'RAW', requestBody: { values: [[toClient, '', 'migration', new Date().toISOString(), '']] },
      })
      log.push('Created client "' + toClient + '"')
    } else { log.push('Client "' + toClient + '" already exists') }

    // 2) Ensure each used sub-project exists under the target client (append-only).
    const subRes = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: "'Sub_Projects'!A2:E5000" })
    const subRows = subRes.data.values || []
    const needSubs = [...new Set([...distinctSubs, 'N/A'])]
    const toAppendSubs = needSubs.filter(s => !subRows.some(r => (r[0] || '').trim() === (s || 'N/A').trim() && (r[1] || '').trim() === toClient))
    if (toAppendSubs.length) {
      const now = new Date().toISOString()
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `'Sub_Projects'!A${subRows.length + 2}`,
        valueInputOption: 'RAW',
        requestBody: { values: toAppendSubs.map(s => [s || 'N/A', toClient, 'migrated from ' + fromClient, 'migration', now]) },
      })
      log.push('Added sub-projects under "' + toClient + '": ' + toAppendSubs.join(', '))
    }

    // 3) Overwrite only the matched Client cells (col G). Never clears the sheet.
    if (matches.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SID(),
        requestBody: {
          valueInputOption: 'RAW',
          data: matches.map(m => ({ range: `'Time Entries'!G${m.sheetRow}`, values: [[toClient]] })),
        },
      })
      log.push('Reassigned ' + matches.length + ' entries from "' + fromClient + '" to "' + toClient + '" for ' + email)
    }

    return NextResponse.json({ success: true, apply: true, changed: matches.length, log })
  } catch(e) {
    console.error('reassign-client error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
