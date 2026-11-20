// @ts-nocheck
import { NextResponse } from 'next/server'
import { listFolders, createFolder, renameFolder, deleteFolder, MASTER_ADMIN, norm } from '@/lib/documentMeta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const email = norm(searchParams.get('email'))
    const all = searchParams.get('all') === '1' && email === MASTER_ADMIN
    const folders = await listFolders(email, all)
    return NextResponse.json({ folders })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const b = await req.json()
    const email = norm(b.email)
    const name = (b.name || '').trim()
    if (!email) return NextResponse.json({ error: 'Missing user' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'Folder name required' }, { status: 400 })
    const folder = await createFolder(name, email)
    return NextResponse.json({ success: true, folder })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req) {
  try {
    const b = await req.json()
    const folder = await renameFolder(b.id, (b.name || '').trim(), norm(b.email))
    return NextResponse.json({ success: true, folder })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Not allowed' ? 403 : 500 })
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url)
    await deleteFolder(searchParams.get('id'), norm(searchParams.get('email')))
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Not allowed' ? 403 : 500 })
  }
}
