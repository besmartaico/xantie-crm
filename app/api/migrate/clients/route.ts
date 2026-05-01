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

export async function POST() {
  try {
    const sheets = getSheets()
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SID() })
    const existing = meta.data.sheets.map(s => s.properties.title)
    const log = []

    // ── STEP 1: Read existing Projects sheet ──────────────────────────────
    let clientNames = []
    if (existing.includes('Projects')) {
      const projRes = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: "'Projects'!A2:E5000" })
      const projRows = projRes.data.values || []
      clientNames = [...new Set(projRows.map(r => r[0]).filter(Boolean))]
      log.push('Read ' + projRows.length + ' projects (now clients): ' + clientNames.join(', '))

      // ── STEP 2: Create Clients sheet (copy of Projects) ──────────────────
      if (!existing.includes('Clients')) {
        await sheets.spreadsheets.batchUpdate({ spreadsheetId: SID(), requestBody: { requests: [{ addSheet: { properties: { title: 'Clients' } } }] } })
        await sheets.spreadsheets.values.update({
          spreadsheetId: SID(), range: "'Clients'!A1:E1",
          valueInputOption: 'RAW', requestBody: { values: [['Name','Description','CreatedBy','CreatedAt','TeamLead']] }
        })
        if (projRows.length) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SID(), range: "'Clients'!A2",
            valueInputOption: 'RAW', requestBody: { values: projRows }
          })
        }
        log.push('Created Clients sheet with ' + projRows.length + ' rows')
      } else {
        log.push('Clients sheet already exists - skipped')
      }

      // ── STEP 3: Create Sub_Projects sheet ─────────────────────────────────
      if (!existing.includes('Sub_Projects')) {
        await sheets.spreadsheets.batchUpdate({ spreadsheetId: SID(), requestBody: { requests: [{ addSheet: { properties: { title: 'Sub_Projects' } } }] } })
        await sheets.spreadsheets.values.update({
          spreadsheetId: SID(), range: "'Sub_Projects'!A1:E1",
          valueInputOption: 'RAW', requestBody: { values: [['Name','ClientName','Description','CreatedBy','CreatedAt']] }
        })
        // Add "N/A" default project for every existing client
        const defaultRows = clientNames.map(name => ['N/A', name, 'Default project', '', new Date().toISOString()])
        if (defaultRows.length) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SID(), range: "'Sub_Projects'!A2",
            valueInputOption: 'RAW', requestBody: { values: defaultRows }
          })
        }
        log.push('Created Sub_Projects sheet with ' + defaultRows.length + ' N/A defaults')
      } else {
        log.push('Sub_Projects sheet already exists - skipped')
      }
    } else {
      log.push('No Projects sheet found')
    }

    // ── STEP 4: Update Time Entries - add Project (sub) column I ─────────
    const teRes = await sheets.spreadsheets.values.get({ spreadsheetId: SID(), range: "'Time Entries'!A1:I5000" })
    const teRows = teRes.data.values || []
    
    if (teRows.length > 0) {
      const header = teRows[0]
      const alreadyMigrated = header[8] === 'Project' || header[6] === 'Client'
      
      if (!alreadyMigrated) {
        // Update header: G=Client (was Project), add I=Project
        const newHeader = [...header]
        newHeader[6] = 'Client'  // rename G
        if (newHeader.length < 9) newHeader[8] = 'Project'
        
        // Update data rows: add "N/A" at index 8 for all existing rows
        const newRows = [newHeader]
        for (let i = 1; i < teRows.length; i++) {
          const row = [...teRows[i]]
          if (row.length < 9) row[8] = 'N/A'
          newRows.push(row)
        }
        
        // Rewrite all of Time Entries
        await sheets.spreadsheets.values.clear({ spreadsheetId: SID(), range: "'Time Entries'!A1:I5000" })
        await sheets.spreadsheets.values.update({
          spreadsheetId: SID(), range: "'Time Entries'!A1",
          valueInputOption: 'RAW', requestBody: { values: newRows }
        })
        log.push('Updated Time Entries: renamed G to Client, added I:Project=N/A for ' + (teRows.length-1) + ' rows')
      } else {
        log.push('Time Entries already migrated - skipped')
      }
    }

    return NextResponse.json({ success: true, log })
  } catch(e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}