// @ts-nocheck
import { NextResponse } from 'next/server'
import { list, del } from '@vercel/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { blobs } = await list({ limit: 1000 })
    // Exclude internal state files (sign-request JSON blobs) — these live in the same bucket but
    // aren't user-facing signed PDFs.
    const filtered = blobs.filter(b => {
      const p = b.pathname || ''
      if (p.startsWith('sign-requests/')) return false
      if (p.toLowerCase().endsWith('.json')) return false
      return true
    })
    filtered.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    return NextResponse.json(filtered.map(b => ({
      url: b.url,
      pathname: b.pathname,
      size: b.size,
      uploadedAt: b.uploadedAt,
    })))
  } catch(e) {
    console.error('list signed error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  try {
    const body = await req.json()
    const url = body.url
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })
    await del(url)
    return NextResponse.json({ success: true })
  } catch(e) {
    console.error('delete signed error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
