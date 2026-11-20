// @ts-nocheck
import { NextResponse } from 'next/server'
import { readAllMeta, setMeta, MASTER_ADMIN, norm } from '@/lib/documentMeta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Update folder placement and/or sharing for one document.
// Allowed for: the owner, the master admin, or (for legacy/unowned docs) any admin
// — organizing a legacy doc assigns ownership to the requester (an implicit claim).
export async function PATCH(req, ctx) {
  try {
    const { documentId } = await ctx.params
    const body = await req.json()
    const requester = norm(body.email)
    if (!requester) return NextResponse.json({ error: 'Missing user' }, { status: 400 })

    const metaMap = await readAllMeta()
    const cur = metaMap[documentId] || {}
    const owner = norm(cur.ownerEmail)
    const isMaster = requester === MASTER_ADMIN
    const isLegacy = !owner
    if (!(isMaster || isLegacy || owner === requester)) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    const patch = {}
    if ('folderId' in body) patch.folderId = (body.folderId || '').toString()
    if ('shareAll' in body) patch.shareAll = body.shareAll ? '1' : ''
    if ('sharedWith' in body) {
      const list = Array.isArray(body.sharedWith) ? body.sharedWith : String(body.sharedWith || '').split(',')
      patch.sharedWith = list.map(norm).filter(Boolean).join(',')
    }
    // Organizing/sharing a legacy (unowned) doc claims it for the requester so it
    // behaves like their own private document going forward.
    if (isLegacy && requester) patch.ownerEmail = requester
    if (body.ownerEmail !== undefined && isMaster) patch.ownerEmail = norm(body.ownerEmail)

    const saved = await setMeta(documentId, patch)
    return NextResponse.json({ success: true, meta: saved })
  } catch (e) {
    console.error('PATCH /api/documents/[id]/meta error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
