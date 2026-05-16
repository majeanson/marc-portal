// GET /og/ping — diagnostic endpoint for the OG renderer.
//
// Default response: plain text "og-ok". If this returns 404 or HTML
// instead of "og-ok", Pages didn't pick up the functions/og/ tree at
// deploy time (bundle error, size limit, or _routes.json drift).
//
// ?fonts=1 → JSON probe of every font asset the renderer needs. Use
// when /og/share/:id returns a corrupt PNG to confirm whether fonts are
// reachable / valid TTF/OTF without hitting the satori path.

import { probeOgFonts } from '../_lib/og-fonts'

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url)

  if (url.searchParams.get('fonts') === '1') {
    const fonts = await probeOgFonts(request)
    const allOk = Object.values(fonts).every((f) => f.ok)
    return new Response(JSON.stringify({ ok: allOk, fonts }, null, 2), {
      status: allOk ? 200 : 503,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  }

  return new Response('og-ok', {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
