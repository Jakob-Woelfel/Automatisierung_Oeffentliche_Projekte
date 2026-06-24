/**
 * Contract processing pipeline — entry point.
 *
 * Usage:
 *   pnpm start -- input/my_contract.pdf                      (default case)
 *   pnpm start -- --case=unterauftrag input/my_contract.pdf  (pick a case)
 *
 * `runPipeline(inputPdf, { case })` is the deployment-agnostic hook:
 *   Azure Function: import runPipeline() and call it from an HTTP/blob trigger
 *   Email trigger:  call runPipeline() after downloading the attachment
 *   Batch mode:     loop over files in input/ and call runPipeline() for each
 *
 * The pipeline engine lives in core/pipeline.ts; document types are CaseModules
 * under cases/. Add a new automation by adding a case (see cases/registry.ts).
 */
import { runPipeline } from './core/pipeline'
import { listCases, DEFAULT_CASE } from './cases/registry'

export { runPipeline } from './core/pipeline'
export type { RunResult } from './core/pipeline'

if (require.main === module) {
  const args = process.argv.slice(2)

  let caseId = DEFAULT_CASE
  const positional: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--case=')) caseId = a.slice('--case='.length)
    else if (a === '--case') caseId = args[++i] ?? caseId
    else positional.push(a)
  }

  const inputPdf = positional[0]
  if (!inputPdf) {
    console.error('Usage: pnpm start -- [--case=<id>] <path-to-contract.pdf>')
    console.error(`Available cases: ${listCases().join(', ')} (default: ${DEFAULT_CASE})`)
    process.exit(1)
  }

  runPipeline(inputPdf, { case: caseId }).catch((err: Error) => {
    console.error(err.message)
    process.exit(1)
  })
}
