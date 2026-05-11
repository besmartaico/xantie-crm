// @ts-nocheck
import { NextResponse } from 'next/server'
import zlib from 'zlib'
import { getDriveFileMeta, updateDriveFileMeta, deleteDriveFile } from '@/lib/googleDrive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Drive appProperties: max 30 entries per file, ~124 chars per value.
// We gzip+base64 the field JSON to massively shrink it (typically 70-80% reduction),
// then chunk the result into 'f_N' keys.
const KEY_PREFIX = 'f_'
const CHUNK_SIZE = 100
const MAX_CHUNKS = 28

// Encode: JSON string -> gzip -> base64 (one compact string)
function encodePayload(jsonString) {
  const gz = zlib.gzipSync(jsonString, { level: 9 })
  return gz.toString('base64')
}

// Decode: try gzip+base64 first; fall back to raw JSON for legacy data
function decodePayload(joined) {
  if (!joined) return ''
  // Quick heuristic: raw JSON starts with [ or {; base64 doesn't.
  if (joined.startsWith('[') || joined.startsWith('{')) return joined
  try {
    const buf = Buffer.from(joined, 'base64')
    const out = zlib.gunzipSync(buf).toString()
    return out
  } catch {
    // Not gzip-base64; treat as raw
    return joined
  }
}

function readFieldsFromProps(props) {
  if (!props) return ''
  // New scheme: f_0, f_1, ...
  const newKeys = Object.keys(props).filter(k => /^f_\d+$/.test(k))
  if (newKeys.length > 0) {
    newKeys.sort((a, b) => parseInt(a.substring(2), 10) - parseInt(b.substring(2), 10))
    return decodePayload(newKeys.map(k => props[k]).join(''))
  }
  // Legacy: single 'fields' value
  if (props.fields) return props.fields
  // Legacy: fields_0, fields_1, ...
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
    const encoded = encodePayload(serialized)

    const chunks = []
    for (let i = 0; i < encoded.length; i += CHUNK_SIZE) {
      chunks.push(encoded.substring(i, i + CHUNK_SIZE))
    }

    if (chunks.length > MAX_CHUNKS) {
      return NextResponse.json({
        error: `Even after compression, the field data is too large (raw ${serialized.length} chars, compressed ${encoded.length} chars, needs ${chunks.length} chunks, max ${MAX_CHUNKS}). Consider shortening labels/groups or splitting into multiple templates.`,
      }, { status: 400 })
    }

    let existing = {}
    try {
      const meta = await getDriveFileMeta(documentId)
      existing = meta.appProperties || {}
    } catch(e) {
      console.warn('getDriveFileMeta failed before save:', e.message)
    }

    // Clear all old chunk keys (any scheme) + legacy 'fields' key, then set new
    const updates = { fields: null }
    Object.keys(existing).forEach(k => {
      if (k.startsWith(KEY_PREFIX) || /^fields_\d+$/.test(k)) {
        updates[k] = null
      }
    })
    chunks.forEach((c, i) => { updates[KEY_PREFIX + i] = c })

    await updateDriveFileMeta(documentId, updates)
    return NextResponse.json({
      success: true,
      chunks: chunks.length,
      rawBytes: serialized.length,
      compressedBytes: encoded.length,
    })
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
