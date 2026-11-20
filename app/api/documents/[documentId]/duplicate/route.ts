// @ts-nocheck
import { NextResponse } from 'next/server'
import { getDriveFileMeta, copyDriveFile } from '@/lib/googleDrive'
import { setMeta, norm } from '@/lib/documentMeta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Duplicate a document template (copies the PDF + its placed fields).
// The copy is owned (private) by whoever duplicated it.
export async function POST(req, ctx) {
  try {
    const { documentId } = await ctx.params
    let name = '', ownerEmail = '', folderId = ''
    try { const b = await req.json(); name = (b && b.name) || ''; ownerEmail = norm(b && b.ownerEmail); folderId = (b && b.folderId) || '' } catch(e) {}

    const src = await getDriveFileMeta(documentId)
    let newName = (name || (String(src.name || 'document').replace(/\.pdf$/i, '') + ' (copy)')).trim()
    if (!/\.pdf$/i.test(newName)) newName += '.pdf'

    const copy = await copyDriveFile(documentId, newName)
    if (ownerEmail) {
      try { await setMeta(copy.id, { ownerEmail, folderId, shareAll: '', sharedWith: '' }) }
      catch(e) { console.warn('setMeta after duplicate failed:', e.message) }
    }
    return NextResponse.json({ success: true, id: copy.id, name: copy.name })
  } catch(e) {
    console.error('duplicate document error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
