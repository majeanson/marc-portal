// Render-once store for the dynamic OG PNGs (og/share, og/home,
// og/certificate).
//
// Why this exists: the satori + resvg render path lives at the Worker CPU
// cliff. Verified in prod 2026-10-15: a cache-busted GET of /og/share/:id
// died with Cloudflare error 1102 (CPU exceeded), and eight parallel
// requests (what one /projects pageview fires) all failed — some as 1102
// (503/504 before our try/catch can run), the luckier ones as the fallback
// 302. The edge cache only papers over it per-colo and per-day; every
// cache miss gambles again.
//
// Two levers, both boring:
//   1. R2 read-through (the optional MEDIA bucket): a PNG that rendered
//      successfully ONCE is stored and never rendered again. Even a 10%
//      render success rate converges on a fully-populated store, because
//      misses retry on every view and hits are permanent. Keys embed the
//      content inputs (updated_at, stats), so edits mint a new key and the
//      stale object just ages out of relevance. Orphans are ~60 KB PNGs on
//      rarely-edited copy; not worth a sweeper.
//   2. A per-isolate render queue: renders run one at a time, so a burst of
//      distinct cards can't stack eight WASM rasterizations in one isolate
//      (memory pressure makes 1102 more likely, and one render at the CPU
//      edge is bad enough).
//
// No MEDIA binding (local dev without R2) = render every time, exactly the
// old behavior. R2 put failures are swallowed: serving the freshly-rendered
// PNG matters more than storing it, and the next successful render will
// try again.

let renderChain: Promise<unknown> = Promise.resolve()

function enqueueRender<T>(job: () => Promise<T>): Promise<T> {
  const run = renderChain.then(job, job)
  // Keep the chain alive past failures; errors surface to THIS caller only.
  renderChain = run.catch(() => {})
  return run
}

export async function pngFromR2OrRender(
  env: { MEDIA?: R2Bucket },
  key: string,
  render: () => Promise<ArrayBuffer>,
): Promise<{ png: ArrayBuffer; source: 'r2' | 'render' }> {
  if (env.MEDIA) {
    try {
      const hit = await env.MEDIA.get(key)
      // Buffer rather than stream the body through: ~60 KB, and the uniform
      // ArrayBuffer shape sidesteps Miniflare's strict stream-length checks.
      if (hit) return { png: await hit.arrayBuffer(), source: 'r2' }
    } catch (err) {
      console.warn('og-cache: r2 get failed (rendering instead)', err)
    }
  }

  const png = await enqueueRender(render)

  if (env.MEDIA) {
    try {
      await env.MEDIA.put(key, png, { httpMetadata: { contentType: 'image/png' } })
    } catch (err) {
      console.warn('og-cache: r2 put failed (serving uncached)', err)
    }
  }
  return { png, source: 'render' }
}

// R2 keys take most characters, but titles land in keys (og/home embeds the
// active project's title); normalize to a short safe slug so a weird title
// can't mint an unusable key.
export function keyPart(s: string | null | undefined): string {
  if (!s) return 'none'
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'none'
  )
}
