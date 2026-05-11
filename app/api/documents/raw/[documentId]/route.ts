// @ts-nocheck
import { downloadPdfFromDrive } from '@/lib/googleDrive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req, ctx) {
  try {
    const { documentId } = await ctx.params
    const buf = await downloadPdfFromDrive(documentId)
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch(e) {
    console.error('GET raw error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
