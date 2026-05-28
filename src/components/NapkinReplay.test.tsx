/**
 * The replay drives Excalidraw's updateScene from a click handler and from
 * setTimeout ticks — both escape React's render tree, so a throw there would
 * surface as an uncaught error in Sentry (the suspected origin of the napkin
 * read-side issue). This proves the recovery: a throwing updateScene is
 * caught, reported once, and the affordance is disabled instead of crashing.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const captureException = vi.fn()
vi.mock('../lib/sentry', () => ({ captureException: (...a: unknown[]) => captureException(...a) }))

// Stub the heavy Excalidraw wrapper: hand the replay a fake imperative API
// whose updateScene throws, the way a version-drifted scene element would.
const updateScene = vi.fn(() => {
  throw new Error('cannot hydrate element')
})
vi.mock('./SketchCanvas', () => ({
  SketchCanvas: (props: { onApiReady?: (api: unknown) => void }) => {
    props.onApiReady?.({ updateScene })
    return <div data-testid="canvas" />
  },
}))

import { NapkinReplay } from './NapkinReplay'

afterEach(() => {
  vi.clearAllMocks()
})

const scene = { elements: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }

describe('NapkinReplay error recovery', () => {
  it('catches a throwing replay, reports once, and disables the affordance', async () => {
    // Replay is suppressed under reduced motion; force it off for the test.
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
    )

    render(<NapkinReplay lang="en" scene={scene} />)

    const btn = await screen.findByRole('button')
    fireEvent.click(btn)

    // The synchronous clear (updateScene({elements:[]})) throws first; the
    // catch path runs without the error escaping the click handler.
    await waitFor(() => expect(captureException).toHaveBeenCalledTimes(1))
    expect(captureException.mock.calls[0][1]).toMatchObject({ surface: 'napkin-replay' })

    // Affordance is gone — a replay that threw once isn't offered again.
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    vi.unstubAllGlobals()
  })
})
