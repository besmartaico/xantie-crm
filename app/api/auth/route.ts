// @ts-nocheck
import { NextResponse } from 'next/server'
export async function POST(req) {
  const { pin } = await req.json()
  if (pin === process.env.ADMIN_PIN) {
    return NextResponse.json({ success: true, role: 'admin' })
  }
  return NextResponse.json({ success: false }, { status: 401 })
}