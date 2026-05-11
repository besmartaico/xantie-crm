// @ts-nocheck
import { NextResponse } from 'next/server'
import { getDriveFileMeta, updateDriveFileMeta, deleteDriveFile } from '@/lib/googleDrive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Drive appProperties has a 124-char-per-value limit and a 30-property-per-file cap.
// Using key prefix 'f_' (max 5 chars including index) leaves plenty of room per value.
const KEY_PREFIX = 'f_'
const CHUNK_SIZE = 100  // 'f_99' (4 chars) + 100 char value = 104 total, well under any per-property limit
const MAX_CHUNKS = 28   // leave room for a few other appProperties; Drive caps at 30 total

function readFieldsFromProps(props) {
  if (!props) return ''
  // Prefer the new 'f_N' scheme
  const newKeys = Object.keys(props).filter(k => k.startsWith(KEY_PREFIX) && /^f_\d+$/.test(k))
  if (newKeys.length > 0) {
    newKeys.sort((a, b) => parseInt(a.substring(2), 10) - parseInt(b.substring(2), 10))
    return newKeys.map(k => props[k]).join('')
  }
  // Legacy schemes (backward compat with files saved before this commit)
  if (props.fields) return props.fields
  const legacyKeys = Object.keys(props).filter(k => /^fields_\d+$/.test(k))
  if (legacyKeys.length > 0) {
    legacyKeys.sort((a, b) => parseInt(a.substring(7), 10) - parseInt(b.substring(7), 10))
    return legacyKeys.map(k => props[k]).join('')
  }
  return ''
}

export async function GET(_req, ctx) {
  try {
    const { documentId } = await ctx.params
    const meta = await getDriveFileMeta(documentId)
    const serialized = readFieldsFromProps(meta.appProperties)
    let fields = []
    if (serialized) {
      try { fields = JSON.parse(serialized) } catch { fields = [] }
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

    const serialized = JSON.stringify(fields)

    // Chunk the JSON into <= CHUNK_SIZE pieces
    const chunks = []
    for (let i = 0; i < serialized.length; i += CHUNK_SIZE) {
      chunks.push(serialized.substring(i, i + CHUNK_SIZE))
    }

    if (chunks.length > MAX_CHUNKS) {
      return NextResponse.json({
        error: `Too many fields. Data is ${serialized.length} characters, would need ${chunks.length} chunks (max ${MAX_CHUNKS}). Try shortening labels/groups or reducing the number of fields.`,
      }, { status: 400 })
    }

    // Read existing appProperties so we can clear stale keys (Drive's partial update keeps any key we don't mention)
    let existing = {}
    try {
      const meta = await getDriveFileMeta(documentId)
      existing = meta.appProperties || {}
    } catch(e) {
      console.warn('getDriveFileMeta failed before save:', e.message)
    }

    // Build the update payload: clear all old chunk keys + legacy keys, set new chunks
    const updates = { fields: null }  // clear the very-old single-property scheme
    Object.keys(existing).forEach(k => {
      if (k.startsWith(KEY_PREFIX) || /^fields_\d+$/.test(k)) {
        updates[k] = null
      }
    })
    chunks.forEach((c, i) => { updates[KEY_PREFIX + i] = c })

    await updateDriveFileMeta(documentId, updates)
    return NextResponse.json({ success: true, chunks: chunks.length, bytes: serialized.length })
  } catch(e) {
    console.error('POST fields error:', e)
    const code = e && (e.code || (e.response && e.response.status))
    const detail = e && e.errors && e.errors[0] && e.errors[0].message
    return NextResponse.json({
      error: e.message + (detail ? ' — ' + detail : ''),
      code,
    }, { status: 500 })
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
