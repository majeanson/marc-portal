import { describe, expect, it, vi } from 'vitest'
import { keyPart, pngFromR2OrRender } from './og-cache'

interface FakeBucket {
  store: Map<string, ArrayBuffer>
  get: (key: string) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> } | null>
  put: (key: string, val: ArrayBuffer) => Promise<void>
}

function fakeR2(): FakeBucket {
  const store = new Map<string, ArrayBuffer>()
  return {
    store,
    async get(key) {
      const v = store.get(key)
      return v ? { arrayBuffer: async () => v } : null
    },
    async put(key, val) {
      store.set(key, val)
    },
  }
}

const env = (bucket?: FakeBucket) => ({ MEDIA: bucket as unknown as R2Bucket | undefined })

describe('pngFromR2OrRender', () => {
  it('renders on a miss, stores the PNG, then serves the store on the next call', async () => {
    const bucket = fakeR2()
    const render = vi.fn(async () => new ArrayBuffer(16))

    const first = await pngFromR2OrRender(env(bucket), 'og/x.png', render)
    expect(first.source).toBe('render')
    expect(render).toHaveBeenCalledTimes(1)
    expect(bucket.store.has('og/x.png')).toBe(true)

    const second = await pngFromR2OrRender(env(bucket), 'og/x.png', render)
    expect(second.source).toBe('r2')
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('still serves the rendered PNG when the R2 put fails', async () => {
    const bucket = fakeR2()
    bucket.put = async () => {
      throw new Error('r2 down')
    }
    const { png, source } = await pngFromR2OrRender(env(bucket), 'og/y.png', async () => {
      return new ArrayBuffer(8)
    })
    expect(source).toBe('render')
    expect(png.byteLength).toBe(8)
  })

  it('renders every time without a MEDIA binding', async () => {
    const render = vi.fn(async () => new ArrayBuffer(4))
    await pngFromR2OrRender(env(), 'og/z.png', render)
    await pngFromR2OrRender(env(), 'og/z.png', render)
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('serializes renders: the second does not start until the first finishes', async () => {
    const order: string[] = []
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    const p1 = pngFromR2OrRender(env(), 'og/a.png', async () => {
      order.push('start1')
      await gate
      order.push('end1')
      return new ArrayBuffer(1)
    })
    const p2 = pngFromR2OrRender(env(), 'og/b.png', async () => {
      order.push('start2')
      return new ArrayBuffer(1)
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(order).toEqual(['start1'])
    release()
    await Promise.all([p1, p2])
    expect(order).toEqual(['start1', 'end1', 'start2'])
  })

  it('a failed render does not wedge the queue', async () => {
    await expect(
      pngFromR2OrRender(env(), 'og/fail.png', async () => {
        throw new Error('satori choked')
      }),
    ).rejects.toThrow('satori choked')
    const { source } = await pngFromR2OrRender(env(), 'og/after.png', async () => {
      return new ArrayBuffer(2)
    })
    expect(source).toBe('render')
  })
})

describe('keyPart', () => {
  it('slugs a title down to key-safe characters', () => {
    expect(keyPart('Babillard — un planificateur calme !')).toBe('babillard-un-planificateur-calme')
  })
  it('handles null and all-symbol inputs', () => {
    expect(keyPart(null)).toBe('none')
    expect(keyPart('***')).toBe('none')
  })
})
