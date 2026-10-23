import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ProjectCardPreview } from './ProjectCardPreview'

describe('ProjectCardPreview', () => {
  // An observer that reports every card as already on screen, so the only thing
  // standing between the card and an iframe is the `live` flag.
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private cb: (e: Array<{ isIntersecting: boolean }>) => void) {}
        observe() {
          this.cb([{ isIntersecting: true }])
        }
        disconnect() {}
      },
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('mounts the live build by default', () => {
    const { container } = render(
      <ProjectCardPreview buildHref="about:blank" title="App" sessionId="abc12345" />,
    )
    expect(container.querySelector('iframe')).not.toBeNull()
  })

  it('keeps the OG card and never mounts the iframe when live is false', () => {
    const { container } = render(
      <ProjectCardPreview
        buildHref="about:blank"
        title="App"
        sessionId="abc12345"
        live={false}
      />,
    )
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('img.project-card__preview-og')).not.toBeNull()
    expect(container.querySelector('.project-card__preview--idle')).not.toBeNull()
  })
})
