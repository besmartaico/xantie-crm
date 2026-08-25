// @ts-nocheck
import { NextResponse } from 'next/server'
import { getDriveFileMeta, copyDriveFile } from '@/lib/googleDrive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Duplicate a document template (copies the PDF + its placed fields).
export async function POST(req, ctx) {
  try {
    const { documentId } = await ctx.params
    let name = ''
    try { const b = await req.json(); name = (b && b.name) || '' } catch(e) {}

    const src = await getDriveFileMeta(documentId)
    let newName = (name || (String(src.name || 'document').replace(/\.pdf$/i, '') + ' (copy)')).trim()
    if (!/\.pdf$/i.test(newName)) newName += '.pdf'

    const copy = await copyDriveFile(documentId, newName)
    return NextResponse.json({ success: true, id: copy.id, name: copy.name })
  } catch(e) {
    console.error('duplicate document error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
