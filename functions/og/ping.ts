// GET /og/ping — dead-simple diagnostic. If this returns plain text "og-ok"
// the Function routing for /og/* is alive on the deploy. If it 404s or
// returns HTML, Pages didn't pick up the functions/og/ tree at deploy time
// (bundle error, size limit, or _routes.json drift).

export const onRequestGet: PagesFunction = async () => {
  return new Response('og-ok', {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
