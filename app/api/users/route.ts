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

export async function GET() {
  try {
    const sheets = getSheets()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SID(),
      range: 'Users!A2:D5000'
    })
    const rows = (res.data.values || []).map((r, i) => ({
      id: i + 2, name: r[0]||'', email: r[1]||'', role: r[3]||'user'
    }))
    return NextResponse.json(rows)
  } catch (err) {
    console.error('Users GET error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { action } = body
    const sheets = getSheets()

    if (action === 'update_role') {
      const { id, role } = body
      await sheets.spreadsheets.values.update({
        spreadsheetId: SID(),
        range: `Users!D${id}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[role]] }
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      const { id } = body
      // Get spreadsheet metadata to find Users sheet ID
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
      const allSheets = meta.data.sheets || []
      // Log all sheet titles to help debug
      const sheetTitles = allSheets.map(s => s.properties?.title)
      console.log('Available sheets:', sheetTitles)
      // Match case-insensitively
      const sheet = allSheets.find(s =>
        s.properties?.title?.toLowerCase() === 'users' ||
        s.properties?.title === 'Users'
      )
      if (!sheet) {
        console.error('Users sheet not found. Available:', sheetTitles)
        return NextResponse.json({
          success: false,
          error: `Users sheet not found. Available sheets: ${sheetTitles.join(', ')}`
        }, { status: 404 })
      }
      const sheetId = sheet.properties.sheetId
      // startIndex is 0-based: row 2 in sheet = index 1
      const startIndex = id - 1
      const endIndex = id
      console.log(`Deleting row: sheetId=${sheetId}, startIndex=${startIndex}, endIndex=${endIndex}`)
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SID(),
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex,
                endIndex
              }
            }
          }]
        }
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('Users POST error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}