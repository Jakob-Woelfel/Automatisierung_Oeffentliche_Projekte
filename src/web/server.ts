/**
 * Local web app — a thin HTTP layer over the same `runPipeline()` the CLI uses.
 *
 * It is deliberately dependency-free (Node's built-in `http`/`fs` only), so it
 * adds nothing to the supply-chain surface the project hardens against. The
 * `.env` is loaded exactly as the CLI loads it (via core/llm.ts → dotenv) and
 * never leaves this machine: the browser only ever talks to localhost, and the
 * pipeline — text extraction, LLM call, form filling, email draft — runs here.
 *
 *   browser (localhost) → POST /api/process (raw PDF bytes)
 *                       → runPipeline()  [secrets + LLM call stay server-side]
 *                       ← extracted data + email draft + download links
 *
 * Usage:  pnpm web            (then open http://localhost:3000)
 *         PORT=4000 pnpm web  (pick a port)
 */
import http from 'http'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { readFile, writeFile, mkdtemp } from 'fs/promises'

import { runPipeline, rerunPipeline } from '../core/pipeline'
import { listCases, resolveCase, DEFAULT_CASE } from '../cases/registry'

const PORT = Number(process.env.PORT) || 3000
const PUBLIC_DIR = path.join(__dirname, 'public')
const OUTPUT_ROOT = path.resolve('output')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(data)
}

/** Read the full request body as a Buffer. */
function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** Serve a static file from public/, falling back to 404. */
async function serveStatic(res: http.ServerResponse, relPath: string): Promise<void> {
  const safe = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '')
  const filePath = path.join(PUBLIC_DIR, safe === '/' || safe === '' ? 'index.html' : safe)
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
    return
  }
  const ext = path.extname(filePath).toLowerCase()
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
}

/** POST /api/process?case=<id>&name=<filename> — body is the raw PDF. */
async function handleProcess(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const caseId = url.searchParams.get('case') || DEFAULT_CASE
  const rawName = url.searchParams.get('name') || 'upload.pdf'
  const stem = path.basename(rawName, path.extname(rawName)).replace(/[^\p{L}\p{N}._-]+/gu, '_') || 'upload'

  // Validate the case up-front so a bad selection fails clearly before upload work.
  try {
    resolveCase(caseId)
  } catch (err) {
    return sendJson(res, 400, { error: (err as Error).message })
  }

  const body = await readBody(req)
  if (body.length === 0) return sendJson(res, 400, { error: 'Leere Anfrage — keine PDF empfangen.' })
  if (body.subarray(0, 4).toString('latin1') !== '%PDF') {
    return sendJson(res, 400, { error: 'Die hochgeladene Datei ist kein gültiges PDF.' })
  }

  // Write the upload to a temp file; the original name becomes the output stem.
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'drimi-'))
  const tmpPdf = path.join(tmpDir, `${stem}.pdf`)
  await writeFile(tmpPdf, body)

  try {
    const result = await runPipeline(tmpPdf, { case: caseId })

    // Read back the artifacts the UI shows inline, and list everything for download.
    const extractedData = JSON.parse(await readFile(result.extractedJson, 'utf-8'))
    const emailDraft = await readFile(result.emailDraft, 'utf-8')

    const files = [result.extractedJson, ...result.filledPdfs, result.emailDraft].map((p) => ({
      name: path.basename(p),
      // Download path is relative to the output root; the download route re-validates it.
      download: '/api/download?file=' + encodeURIComponent(path.relative(OUTPUT_ROOT, path.resolve(p))),
    }))

    sendJson(res, 200, {
      case: caseId,
      outputDir: result.outputDir,
      extractedData,
      emailDraft,
      files,
    })
  } catch (err) {
    sendJson(res, 500, { error: (err as Error).message })
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }, () => {})
  }
}

/** POST /api/reprocess — body is JSON { case, outputDir, data }; re-renders docs with edited data. */
async function handleReprocess(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const body = await readBody(req)
  let payload: { case?: string; outputDir?: string; data?: unknown }
  try {
    payload = JSON.parse(body.toString('utf-8'))
  } catch {
    return sendJson(res, 400, { error: 'Ungültiges JSON.' })
  }

  const caseId = payload.case || DEFAULT_CASE
  const rawOutputDir = payload.outputDir
  if (!rawOutputDir) return sendJson(res, 400, { error: 'outputDir fehlt.' })

  const resolved = path.resolve(rawOutputDir)
  if (resolved !== OUTPUT_ROOT && !resolved.startsWith(OUTPUT_ROOT + path.sep)) {
    return sendJson(res, 403, { error: 'Ungültiges outputDir.' })
  }

  try {
    resolveCase(caseId)
  } catch (err) {
    return sendJson(res, 400, { error: (err as Error).message })
  }

  try {
    const result = await rerunPipeline(caseId, resolved, payload.data ?? {})

    const extractedData = JSON.parse(await readFile(result.extractedJson, 'utf-8'))
    const emailDraft = await readFile(result.emailDraft, 'utf-8')

    const files = [result.extractedJson, ...result.filledPdfs, result.emailDraft].map((p) => ({
      name: path.basename(p),
      download: '/api/download?file=' + encodeURIComponent(path.relative(OUTPUT_ROOT, path.resolve(p))),
    }))

    sendJson(res, 200, { case: caseId, outputDir: result.outputDir, extractedData, emailDraft, files })
  } catch (err) {
    sendJson(res, 500, { error: (err as Error).message })
  }
}

/** GET /api/download?file=<rel> — stream an output artifact, traversal-guarded. */
function handleDownload(res: http.ServerResponse, url: URL): void {
  const rel = url.searchParams.get('file') || ''
  const resolved = path.resolve(OUTPUT_ROOT, rel)
  // Never serve anything outside output/.
  if (resolved !== OUTPUT_ROOT && !resolved.startsWith(OUTPUT_ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Forbidden')
    return
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
    return
  }
  const ext = path.extname(resolved).toLowerCase()
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${path.basename(resolved)}"`,
  })
  fs.createReadStream(resolved).pipe(res)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)

    if (req.method === 'GET' && url.pathname === '/api/cases') {
      const cases = listCases().map((id) => ({ id, displayName: resolveCase(id).displayName }))
      return sendJson(res, 200, { cases, default: DEFAULT_CASE })
    }
    if (req.method === 'POST' && url.pathname === '/api/process') {
      return await handleProcess(req, res, url)
    }
    if (req.method === 'POST' && url.pathname === '/api/reprocess') {
      return await handleReprocess(req, res)
    }
    if (req.method === 'GET' && url.pathname === '/api/download') {
      return handleDownload(res, url)
    }
    if (req.method === 'GET') {
      return await serveStatic(res, url.pathname)
    }
    sendJson(res, 405, { error: 'Method not allowed' })
  } catch (err) {
    sendJson(res, 500, { error: (err as Error).message })
  }
})

server.listen(PORT, () => {
  console.log(`\n  Drittmittel-Pipeline — Weboberfläche`)
  console.log(`  ▸ http://localhost:${PORT}\n`)
  console.log(`  Cases: ${listCases().join(', ')}  (Standard: ${DEFAULT_CASE})`)
  console.log(`  Verarbeitung & .env bleiben lokal auf dieser Maschine.\n`)
})
