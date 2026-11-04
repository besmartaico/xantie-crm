// @ts-nocheck
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// PUBLIC endpoint — the inbound application form posts here. It validates input,
// then forwards an `add` to /api/candidates so the schema lives in one place.
export async function POST(req) {
  try {
    const body = await req.json()

    // Honeypot: real users leave this hidden field empty. Bots fill it.
    if (body.company_website) return NextResponse.json({ success: true }) // silently drop

    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim()
    if (!name) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'A valid email is required' }, { status: 400 })
    }

    const roleType = ['Full-time','Contract','Either'].includes(body.roleType) ? body.roleType : 'Either'

    const candidate = {
      action: 'add',
      name,
      email,
      phone: String(body.phone || '').trim(),
      location: String(body.location || '').trim(),
      linkedin: String(body.linkedin || '').trim(),
      resume: String(body.resume || '').trim(),
      skillset: String(body.skillset || '').trim(),
      experienceYears: String(body.experienceYears || '').trim(),
      salaryRequirement: String(body.salaryRequirement || '').trim(),
      notes: String(body.notes || '').trim(),
      roleType,
      source: 'Inbound Application',
      stage: 'Sourced',
      firstContactDate: new Date().toISOString().split('T')[0],
      firstContactMethod: 'Inbound Application',
      addedBy: 'Applicant (self)',
      status: 'active',
    }

    const base = process.env.APP_URL || 'https://crm.xantie.com'
    const res = await fetch(`${base}/api/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      return NextResponse.json({ success: false, error: data.error || 'Could not submit application' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch(e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
