// @ts-nocheck
import { NextResponse } from 'next/server'
import { diagnoseListing } from '@/lib/googleDrive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await diagnoseListing()
    return NextResponse.json(data, { status: 200 })
  } catch(e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 })
  }
}
