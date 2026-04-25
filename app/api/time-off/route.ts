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
const RANGE = "'Time Off'!A2:H5000"

async function ensureSheet(sheets) {
  try {
    await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: RANGE })
  } catch(e) {
    // Sheet doesn't exist - create it
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
    const exists = meta.data.sheets.some(s => s.properties.title === 'Time Off')
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SID(),
        requestBody: { requests: [{ addSheet: { properties: { title: 'Time Off' } } }] }
      })
      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: "'Time Off'!A1:H1",
        valueInputOption: 'RAW',
        requestBody: { values: [['Name','Email','StartDate','EndDate','Notes','Status','SubmittedAt','ReviewedBy']] }
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
      name: r[0]||'', email: r[1]||'', startDate: r[2]||'', endDate: r[3]||'',
      notes: r[4]||'', status: r[5]||'pending', submittedAt: r[6]||'', reviewedBy: r[7]||''
    }))
    return NextResponse.json(rows)
  } catch(err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const sheets = getSheets()
    await ensureSheet(sheets)

    if (body.action === 'update_status') {
      const { id, status, reviewedBy } = body
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(), range: `'Time Off'!F${id}:H${id}`,
        valueInputOption: 'RAW', requestBody: { values: [[status, '', reviewedBy]] }
      })
      return NextResponse.json({ success: true })
    }

    // New request
    const { name, email, startDate, endDate, notes } = body
    if (!name || !email || !startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: RANGE })
    const nextRow = (existing.data.values || []).length + 2
    const submittedAt = new Date().toISOString()

    await sheets.spreadsheets.values.update({
      spreadsheetId: SID(), range: `'Time Off'!A${nextRow}:H${nextRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[name, email, startDate, endDate, notes||'', 'pending', submittedAt, '']] }
    })

    // Send email notification to Jeff and Jared
    if (process.env.RESEND_API_KEY) {
      const appUrl = process.env.APP_URL || 'https://time.xantie.com'
      const startFmt = new Date(startDate + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
      const endFmt = new Date(endDate + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
      const days = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          to: ['jeff@xantie.com', 'jared@xantie.com'],
          subject: `Time Off Request — ${name}`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px">
              <div style="margin-bottom:24px">
                <span style="font-size:22px;font-weight:800">Xantie</span>
                <span style="font-size:11px;color:#8DC63F;font-weight:700;text-transform:uppercase;margin-left:8px;letter-spacing:0.1em">CRM</span>
              </div>
              <h2 style="margin:0 0 16px;font-size:20px">New Time Off Request</h2>
              <div style="background:#1a1a1a;border-radius:10px;padding:20px;margin-bottom:20px">
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:120px">Employee</td><td style="padding:8px 0;color:#fff;font-size:14px;font-weight:600">${name}</td></tr>
                  <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Email</td><td style="padding:8px 0;color:#9ca3af;font-size:13px">${email}</td></tr>
                  <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Start Date</td><td style="padding:8px 0;color:#8DC63F;font-size:14px;font-weight:600">${startFmt}</td></tr>
                  <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">End Date</td><td style="padding:8px 0;color:#8DC63F;font-size:14px;font-weight:600">${endFmt}</td></tr>
                  <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Duration</td><td style="padding:8px 0;color:#fff;font-size:14px">${days} day${days===1?'':'s'}</td></tr>
                  ${notes ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top">Notes</td><td style="padding:8px 0;color:#d1d5db;font-size:13px">${notes}</td></tr>` : ''}
                </table>
              </div>
              <a href="${appUrl}/admin/time-off" style="display:inline-block;background:#8DC63F;color:#0a0a0a;text-decoration:none;padding:11px 24px;border-radius:8px;font-weight:700;font-size:14px">Review Request</a>
              <p style="color:#4b5563;font-size:12px;margin:20px 0 0">Submitted ${new Date(submittedAt).toLocaleString()}</p>
            </div>
          `
        })
      })
    }

    return NextResponse.json({ success: true })
  } catch(err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}