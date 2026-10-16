import { describe, expect, it } from 'vitest'
import { pingBuilds, type ShowcasedBuild } from './showcaseHealth'

const BUILDS: ShowcasedBuild[] = [
  { id: 'a1', title: 'Up', url: 'https://up.example' },
  { id: 'b2', title: 'Down', url: 'https://down.example' },
  { id: 'c3', title: 'Gone', url: 'https://gone.example' },
]

function fakeFetch(byUrl: Record<string, number | Error>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    const outcome = byUrl[url]
    if (outcome instanceof Error) throw outcome
    return new Response(null, { status: outcome })
  }) as typeof fetch
}

describe('pingBuilds', () => {
  it('reports only the builds that fail, with the failure detail', async () => {
    const down = await pingBuilds(
      BUILDS,
      undefined,
      fakeFetch({
        'https://up.example': 200,
        'https://down.example': 503,
        'https://gone.example': new TypeError('fetch failed'),
      }),
    )
    expect(down).toHaveLength(2)
    expect(down.find((d) => d.id === 'b2')?.detail).toBe('HTTP 503')
    expect(down.find((d) => d.id === 'c3')?.detail).toBe('fetch failed')
  })

  it('labels an aborted ping as a timeout', async () => {
    const timeout = new DOMException('The operation timed out.', 'TimeoutError')
    const down = await pingBuilds(
      [BUILDS[0]],
      undefined,
      fakeFetch({ 'https://up.example': timeout as unknown as Error }),
    )
    expect(down).toHaveLength(1)
    expect(down[0].detail).toBe('timeout (10s)')
  })

  it('returns empty for an all-green wall', async () => {
    const down = await pingBuilds(
      BUILDS,
      undefined,
      fakeFetch({
        'https://up.example': 200,
        'https://down.example': 200,
        'https://gone.example': 304,
      }),
    )
    // 304 is not res.ok — but a build answering 304 to a no-cache GET is
    // misconfigured enough to want to hear about it, so only 2xx passes.
    expect(down.map((d) => d.id)).toEqual(['c3'])
  })

  it('sends X-Portal-Probe only when a probe token is configured', async () => {
    const seen: Array<string | null> = []
    const spy = (async (_i: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get('X-Portal-Probe'))
      return new Response(null, { status: 200 })
    }) as typeof fetch
    await pingBuilds([BUILDS[0]], 'secret', spy)
    await pingBuilds([BUILDS[0]], undefined, spy)
    expect(seen).toEqual(['secret', null])
  })
})
