// @ts-nocheck
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import bcrypt from 'bcryptjs'

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

export async function POST(req) {
  const { email, password } = await req.json()
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: 'Users!A2:D'
  })
  const rows = res.data.values || []
  const user = rows.find(r => r[1]?.toLowerCase() === email.toLowerCase())
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  const valid = await bcrypt.compare(password, user[2])
  if (!valid) return NextResponse.json({ success: false }, { status: 401 })
  return NextResponse.json({ success: true, name: user[0], email: user[1], role: user[3] || 'user' })
}