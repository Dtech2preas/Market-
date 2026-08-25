import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['worker.js'],
  bundle: true,
  outfile: 'dist/worker.js',
  format: 'esm',
  target: 'es2022',
  external: ['cloudflare:workers']
})
