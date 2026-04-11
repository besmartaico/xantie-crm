// @ts-nocheck
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { newName, existingProjects } = await req.json()
    if (!existingProjects || existingProjects.length === 0) {
      return NextResponse.json({ similar: false })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `You are checking if a new project name is too similar to existing ones.

New project name: "${newName}"
Existing projects: ${existingProjects.map(p => `"${p.name}"`).join(', ')}

Respond with JSON only, no other text:
- If the new name is clearly similar to an existing one: {"similar": true, "match": "the matching project name", "message": "Heads up — this looks a lot like \"[match]\". Are you sure you want to create a separate project?"}
- If it's not similar: {"similar": false}

Be practical — only flag genuine duplicates or very close variations (abbreviations, typos, same words reordered). Different projects with a shared word (e.g. "Marketing Campaign 2024" vs "Marketing Strategy") are fine.`
        }]
      })
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Similarity check error:', err)
    return NextResponse.json({ similar: false })
  }
}