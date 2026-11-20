// @ts-nocheck
import { NextResponse } from 'next/server'
import { listPdfsInFolder, uploadPdfToDrive } from '@/lib/googleDrive'
import { readAllMeta, setMeta, canView, MASTER_ADMIN, norm } from '@/lib/documentMeta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function hasFieldsFrom(appProperties) {
  if (!appProperties) return false
  if (appProperties.fields) return true
  return Object.keys(appProperties).some(k => /^f_\d+$/.test(k) || /^fields_\d+$/.test(k))
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const viewer = norm(searchParams.get('email'))
    const isMaster = !!viewer && viewer === MASTER_ADMIN
    const [files, metaMap] = await Promise.all([listPdfsInFolder(), readAllMeta()])

    const docs = files.map(f => {
      const m = metaMap[f.id] || {}
      const ownerEmail = norm(m.ownerEmail)
      const sharedWith = (m.sharedWith || '').split(',').map(norm).filter(Boolean)
      const shareAll = m.shareAll === '1' || m.shareAll === 'true'
      return {
        id: f.id,
        name: f.name,
        webViewLink: f.webViewLink,
        modifiedTime: f.modifiedTime,
        createdTime: f.createdTime,
        size: f.size,
        hasFields: hasFieldsFrom(f.appProperties),
        ownerEmail,
        folderId: m.folderId || '',
        shareAll,
        sharedWith,
        legacy: !ownerEmail,
      }
    }).filter(d => canView(
      { ownerEmail: d.ownerEmail, shareAll: d.shareAll ? '1' : '', sharedWith: d.sharedWith.join(',') },
      viewer
    )).map(d => {
      const isOwner = !!viewer && d.ownerEmail === viewer
      return { ...d, isOwner, canManage: d.legacy ? true : (isOwner || isMaster), canClaim: d.legacy }
    })

    return NextResponse.json({ docs, viewer, isMaster })
  } catch (e) {
    console.error('GET /api/documents error:', e)
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 })
  }
}

// Upload via multipart form. ownerEmail (and optional folderId) make it private to the uploader.
export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    const ownerEmail = norm(formData.get('ownerEmail'))
    const folderId = (formData.get('folderId') || '').toString()
    const arrayBuffer = await file.arrayBuffer()
    const buf = Buffer.from(arrayBuffer)
    const fileName = file.name || 'document.pdf'
    const result = await uploadPdfToDrive(buf, fileName)
    if (ownerEmail) {
      try { await setMeta(result.id, { ownerEmail, folderId, shareAll: '', sharedWith: '' }) }
      catch (e) { console.warn('setMeta after upload failed:', e.message) }
    }
    return NextResponse.json({ success: true, id: result.id, name: result.name })
  } catch (e) {
    console.error('POST /api/documents error:', e)
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 })
  }
}
