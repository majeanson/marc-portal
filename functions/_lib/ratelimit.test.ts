import { describe, expect, it, vi, afterEach } from 'vitest'
import { rateLimitCheck, rateLimitSweep, clientIp } from './ratelimit'
import { makeMockEnv } from '../../tests/d1-mock'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('rateLimitCheck', () => {
  it('allows up to N within the window', async () => {
    const env = makeMockEnv()
    expect(await rateLimitCheck(env, 'k', 3, 3600)).toBe(true)
    expect(await rateLimitCheck(env, 'k', 3, 3600)).toBe(true)
    expect(await rateLimitCheck(env, 'k', 3, 3600)).toBe(true)
    // 4th hit blocked
    expect(await rateLimitCheck(env, 'k', 3, 3600)).toBe(false)
  })

  it('resets when window rolls over', async () => {
    vi.useFakeTimers()
    const start = Date.now()
    vi.setSystemTime(new Date(start))
    const env = makeMockEnv()
    expect(await rateLimitCheck(env, 'k', 1, 60)).toBe(true)
    expect(await rateLimitCheck(env, 'k', 1, 60)).toBe(false)
    // Advance past the window
    vi.setSystemTime(new Date(start + 61_000))
    expect(await rateLimitCheck(env, 'k', 1, 60)).toBe(true)
  })

  it('keys are independent', async () => {
    const env = makeMockEnv()
    expect(await rateLimitCheck(env, 'a', 1, 3600)).toBe(true)
    expect(await rateLimitCheck(env, 'b', 1, 3600)).toBe(true)
    expect(await rateLimitCheck(env, 'a', 1, 3600)).toBe(false)
    expect(await rateLimitCheck(env, 'b', 1, 3600)).toBe(false)
  })
})

describe('rateLimitSweep', () => {
  it('removes rows older than 24h when triggered', async () => {
    const env = makeMockEnv()
    const now = Math.floor(Date.now() / 1000)
    env._db.rate_limits.set('old', { key: 'old', count: 1, window_start: now - 86_500 })
    env._db.rate_limits.set('new', { key: 'new', count: 1, window_start: now })
    // Force the random gate to trigger
    vi.spyOn(Math, 'random').mockReturnValue(0)
    await rateLimitSweep(env, 50)
    expect(env._db.rate_limits.has('old')).toBe(false)
    expect(env._db.rate_limits.has('new')).toBe(true)
  })

  it('is a no-op when the random gate misses', async () => {
    const env = makeMockEnv()
    const now = Math.floor(Date.now() / 1000)
    env._db.rate_limits.set('old', { key: 'old', count: 1, window_start: now - 86_500 })
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    await rateLimitSweep(env, 50)
    expect(env._db.rate_limits.has('old')).toBe(true)
  })
})

describe('clientIp', () => {
  it('reads CF-Connecting-IP', () => {
    const r = new Request('http://x', { headers: { 'CF-Connecting-IP': '1.2.3.4' } })
    expect(clientIp(r)).toBe('1.2.3.4')
  })

  it("falls back to 'unknown'", () => {
    const r = new Request('http://x')
    expect(clientIp(r)).toBe('unknown')
  })
})
