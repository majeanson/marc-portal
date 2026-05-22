/**
 * Coverage for the printable proposal sheet — it must reflect the intake
 * data faithfully and resolve coded answers to human labels.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProposalSheet } from './ProposalSheet'
import { getSchemaForType } from '../../lib/intakeSchemas'

describe('ProposalSheet', () => {
  it('renders a brief from the intake data, one question per schema field', () => {
    render(
      <ProposalSheet
        lang="en"
        account={{ email: 'visitor@example.com' }}
        type="paperasse"
        values={{}}
        submittedAt="2026-05-22"
      />,
    )
    expect(screen.getByText('Project brief')).toBeInTheDocument()
    expect(screen.getByText('visitor@example.com')).toBeInTheDocument()
    // Two meta terms + one per schema field.
    const fieldCount = getSchemaForType('paperasse').fields.length
    expect(screen.getAllByRole('term')).toHaveLength(2 + fieldCount)
  })

  it("prefers the visitor's name over their email when present", () => {
    render(
      <ProposalSheet
        lang="fr"
        account={{ email: 'a@b.com', name: 'Sophie Tremblay' }}
        type="suivi"
        values={{}}
        submittedAt="2026-05-22"
      />,
    )
    expect(screen.getByText('Sophie Tremblay')).toBeInTheDocument()
    expect(screen.getByText('Dossier de projet')).toBeInTheDocument()
  })

  it('resolves a select/radio answer to its human label', () => {
    const schema = getSchemaForType('paperasse')
    const choice = schema.fields.find(
      (f) => (f.type === 'select' || f.type === 'radio') && f.options,
    )
    expect(choice).toBeDefined()
    if (!choice?.options) return
    const option = choice.options[0]
    render(
      <ProposalSheet
        lang="en"
        account={{ email: 'a@b.com' }}
        type="paperasse"
        values={{ [choice.id]: option.value }}
        submittedAt="2026-05-22"
      />,
    )
    expect(screen.getByText(option.label.en)).toBeInTheDocument()
  })
})
