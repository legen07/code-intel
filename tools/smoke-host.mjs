/**
 * Smoke-test the BUILT host bundle the way the DSH plugin loader would:
 * load lib/index.js, apply it to a context, and verify the tools register and
 * the service answers a live language-server query.
 */
import { Context } from '@deepseek-ai/cordis'
import { pathToFileURL } from 'node:url'

const plugin = await import(pathToFileURL('/home/joe/Dev/code-intel/lib/index.js').toString())
console.log('bundle exports:', Object.keys(plugin))
console.log('name:', plugin.name, '| inject:', JSON.stringify(plugin.inject))

const registered = []
const ctx = new Context().extend({
  tools: { register: (definition) => { registered.push(definition); return () => {} } },
})
plugin.apply(ctx, { rootPath: '/home/joe/Dev/code-intel/test/fixture' })
console.log('registered tools:', registered.map((t) => t.name).sort().join(', '))
console.log('ctx.codeIntel service available:', typeof ctx.codeIntel?.query)
const blueprint = JSON.parse(await ctx.codeIntel.query('blueprint', JSON.stringify({ root: '/home/joe/Dev/code-intel/test/fixture' })))
console.log('bundle->live LSP blueprint:', blueprint.fileCount, 'files,', blueprint.symbolCount, 'symbols')
const overview = JSON.parse(await ctx.codeIntel.query('overview', JSON.stringify({ file: 'src/account.ts' })))
console.log('bundle overview of account.ts:', overview.symbolCount, 'symbols')
await ctx.codeIntel.dispose()
process.exit(0)
