import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { EngagementStatusBar } from './EngagementStatusBar'

describe('EngagementStatusBar', () => {
  it('marks only the current stage with aria-current="step"', () => {
    const { container } = render(
      <EngagementStatusBar
        lang="fr"
        stages={[
          { stage: 'triage', date: '2026-11-01', completed: true },
          { stage: 'planning', date: '2026-11-10', completed: false, current: true },
        ]}
      />,
    )
    const current = container.querySelectorAll('[aria-current="step"]')
    expect(current).toHaveLength(1)
    expect(current[0]?.className).toMatch(/eng-status__node--current/)
  })

  it('has no aria-current when no stage is current', () => {
    const { container } = render(<EngagementStatusBar lang="en" stages={[]} />)
    expect(container.querySelector('[aria-current]')).toBeNull()
  })
})
