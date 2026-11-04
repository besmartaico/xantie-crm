// @ts-nocheck
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const MODEL = () => process.env.RECRUIT_AI_MODEL || 'claude-sonnet-5-5'
const DEFAULT_ROLE = 'Data Engineer (full-time or contract)'

async function callClaude(system, user, maxTokens = 600) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { error: 'not_configured' }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL(), max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  })
  if (!res.ok) return { error: 'api_error', detail: (await res.text()).slice(0, 300) }
  const data = await res.json()
  return { text: (data.content || []).map(b => b.text || '').join('') }
}

function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'there' }

function templateDraft(c, role, sender) {
  const subject = `${role} opportunity — ${c.name || 'quick intro'}`
  const body =
`Hi ${firstName(c.name)},

I came across your background${c.skillset ? ` in ${String(c.skillset).split(',')[0].trim()}` : ''} and thought it might be a strong match for a ${role} role we're hiring for${c.roleType && c.roleType !== 'Either' ? ` (${c.roleType.toLowerCase()})` : ''}.

Would you be open to a quick 15-minute call this week to see if it's a fit? Happy to share details.

Best,
${sender || 'The Xantie Team'}`
  return { subject, body }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const mode = body.mode || 'draft'
    const c = body.candidate || {}
    const role = (body.role || '').trim() || DEFAULT_ROLE
    const sender = (body.sender || '').trim()

    // ── DRAFT ──
    if (mode === 'draft') {
      const key = process.env.ANTHROPIC_API_KEY
      if (!key) {
        return NextResponse.json({ success: true, usedAI: false, ...templateDraft(c, role, sender) })
      }
      const system = `You are a recruiter writing a short, warm, personalized first-touch outreach email to a candidate. Rules: under 120 words, specific to their background (do not invent facts), no buzzwords, one clear ask (a brief intro call). Sign off as "${sender || 'The Xantie Team'}". Respond with ONLY JSON: {"subject": "...", "body": "..."} where body is plain text with line breaks.`
      const profile = [
        `Name: ${c.name || '—'}`, `Open to: ${c.roleType || 'unspecified'}`,
        `Skills: ${c.skillset || '—'}`, `Years experience: ${c.experienceYears || '—'}`,
        `Location: ${c.location || '—'}`, `Notes: ${c.notes || '—'}`,
      ].join('\n')
      const result = await callClaude(system, `ROLE: ${role}\n\nCANDIDATE:\n${profile}`)
      if (result.error) {
        // fall back to template rather than failing the user
        return NextResponse.json({ success: true, usedAI: false, ...templateDraft(c, role, sender) })
      }
      const m = (result.text || '').match(/\{[\s\S]*\}/)
      let parsed = null
      if (m) { try { parsed = JSON.parse(m[0]) } catch(e) {} }
      if (!parsed || !parsed.body) return NextResponse.json({ success: true, usedAI: false, ...templateDraft(c, role, sender) })
      return NextResponse.json({ success: true, usedAI: true, subject: parsed.subject || templateDraft(c, role, sender).subject, body: parsed.body })
    }

    // ── SEND ── (user-initiated only)
    if (mode === 'send') {
      const to = String(c.email || body.email || '').trim()
      const subject = String(body.subject || '').trim()
      const text = String(body.body || '').trim()
      if (!to) return NextResponse.json({ success: false, error: 'This candidate has no email address.' }, { status: 400 })
      if (!subject || !text) return NextResponse.json({ success: false, error: 'Subject and message are required.' }, { status: 400 })
      if (!process.env.RESEND_API_KEY) return NextResponse.json({ success: false, error: 'Email is not configured (RESEND_API_KEY missing).' }, { status: 503 })

      const resend = new Resend(process.env.RESEND_API_KEY)
      const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#0a0a0a;line-height:1.6;white-space:pre-wrap">${text.replace(/</g,'&lt;')}</div>`
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@xantie.com',
        to: [to],
        subject,
        text,
        html,
        replyTo: body.replyTo || undefined,
      })

      // Record the contact + advance the stage.
      if (body.id) {
        const base = process.env.APP_URL || 'https://crm.xantie.com'
        await fetch(`${base}/api/candidates`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'log_contact', id: body.id }),
        }).catch(() => {})
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Unknown mode' }, { status: 400 })
  } catch(e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
