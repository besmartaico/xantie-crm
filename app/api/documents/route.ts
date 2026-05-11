// @ts-nocheck
import { NextResponse } from 'next/server'
import { listPdfsInFolder, uploadPdfToDrive } from '@/lib/googleDrive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const files = await listPdfsInFolder()
    return NextResponse.json(files.map(f => ({
      id: f.id,
      name: f.name,
      webViewLink: f.webViewLink,
      modifiedTime: f.modifiedTime,
      createdTime: f.createdTime,
      size: f.size,
      hasFields: !!(f.appProperties && f.appProperties.fields),
    })))
  } catch(e) {
    console.error('GET /api/documents error:', e)
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 })
  }
}

// Upload via multipart form
export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    const arrayBuffer = await file.arrayBuffer()
    const buf = Buffer.from(arrayBuffer)
    const fileName = file.name || 'document.pdf'
    const result = await uploadPdfToDrive(buf, fileName)
    return NextResponse.json({ success: true, id: result.id, name: result.name })
  } catch(e) {
    console.error('POST /api/documents error:', e)
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 })
  }
}
