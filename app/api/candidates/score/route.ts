// @ts-nocheck
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MODEL = () => process.env.RECRUIT_AI_MODEL || 'claude-sonnet-5-5'
const DEFAULT_ROLE = 'Data Engineer (full-time or contract). Core: SQL, Python, data pipelines/ETL, cloud data warehousing (Snowflake/BigQuery/Redshift), orchestration (Airflow/dbt), and strong data modeling.'

async function callClaude(system, user) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { error: 'not_configured' }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL(),
      max_tokens: 400,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    return { error: 'api_error', detail: t.slice(0, 300) }
  }
  const data = await res.json()
  const text = (data.content || []).map(b => b.text || '').join('')
  return { text }
}

function extractJson(text) {
  if (!text) return null
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch(e) { return null }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const c = body.candidate || {}
    const role = (body.role || '').trim() || DEFAULT_ROLE

    const system = `You are a senior technical recruiter screening candidates for a role. Score fit from 0-100 (be discerning; 80+ means a clear match worth contacting now). Consider skills, depth of experience, seniority, and whether their stated availability (full-time/contract) and rate fit the role. Respond with ONLY a JSON object: {"score": <int 0-100>, "fit": "strong"|"possible"|"weak", "reason": "<one concise sentence, max 25 words>"}`

    const profile = [
      `Name: ${c.name || '—'}`,
      `Open to: ${c.roleType || 'unspecified'}`,
      `Location: ${c.location || '—'}`,
      `Years experience: ${c.experienceYears || '—'}`,
      `Skills: ${c.skillset || '—'}`,
      `Certifications: ${c.certifications || '—'}`,
      `Rate/salary expectation: ${c.salaryRequirement || '—'}`,
      `Notes: ${c.notes || '—'}`,
    ].join('\n')

    const result = await callClaude(system, `ROLE:\n${role}\n\nCANDIDATE:\n${profile}`)

    if (result.error === 'not_configured') {
      return NextResponse.json({ success: false, error: 'not_configured', message: 'AI scoring is off. Add ANTHROPIC_API_KEY to the environment to enable it.' }, { status: 503 })
    }
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error, message: result.detail || 'AI request failed.' }, { status: 502 })
    }

    const parsed = extractJson(result.text)
    if (!parsed || typeof parsed.score === 'undefined') {
      return NextResponse.json({ success: false, error: 'parse_error', message: 'Could not read the AI response.' }, { status: 502 })
    }
    const score = Math.max(0, Math.min(100, parseInt(parsed.score, 10) || 0))
    const scoreReason = String(parsed.reason || '').slice(0, 300)

    // Persist to the candidate row if an id was given.
    if (body.id) {
      const base = process.env.APP_URL || 'https://crm.xantie.com'
      await fetch(`${base}/api/candidates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: body.id, score: String(score), scoreReason }),
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, score, fit: parsed.fit || '', scoreReason })
  } catch(e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
