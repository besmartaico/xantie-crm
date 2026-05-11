// @ts-nocheck
import { NextResponse } from 'next/server'
import { getDriveFileMeta, updateDriveFileMeta, deleteDriveFile } from '@/lib/googleDrive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req, ctx) {
  try {
    const { documentId } = await ctx.params
    const meta = await getDriveFileMeta(documentId)
    const fieldsRaw = meta.appProperties && meta.appProperties.fields
    let fields = []
    if (fieldsRaw) {
      try { fields = JSON.parse(fieldsRaw) } catch { fields = [] }
    }
    return NextResponse.json({ fields, name: meta.name, id: meta.id })
  } catch(e) {
    console.error('GET fields error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req, ctx) {
  try {
    const { documentId } = await ctx.params
    const body = await req.json()
    const fields = Array.isArray(body.fields) ? body.fields : []
    // Drive appProperties values must be <= 124 chars per value; split if needed
    const serialized = JSON.stringify(fields)
    // For now, store inline if small enough; otherwise chunk
    if (serialized.length <= 124) {
      await updateDriveFileMeta(documentId, { fields: serialized })
    } else {
      // Chunk across fields_0, fields_1, ...
      const chunkSize = 120
      const chunks = []
      for (let i = 0; i < serialized.length; i += chunkSize) {
        chunks.push(serialized.substring(i, i + chunkSize))
      }
      const updates = { fields: null }  // clear single key
      chunks.forEach((c, i) => { updates['fields_' + i] = c })
      // Also clear any prior chunks beyond the new count
      const meta = await getDriveFileMeta(documentId)
      const existing = meta.appProperties || {}
      Object.keys(existing).forEach(k => {
        if (k.startsWith('fields_') && !(k in updates)) updates[k] = null
      })
      await updateDriveFileMeta(documentId, updates)
    }
    return NextResponse.json({ success: true })
  } catch(e) {
    console.error('POST fields error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req, ctx) {
  try {
    const { documentId } = await ctx.params
    await deleteDriveFile(documentId)
    return NextResponse.json({ success: true })
  } catch(e) {
    console.error('DELETE template error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
