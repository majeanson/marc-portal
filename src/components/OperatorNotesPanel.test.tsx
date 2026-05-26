// Component tests for OperatorNotesPanel. Covers the dirty-tracking +
// save/clear/error UX without hitting the network — vi.spyOn replaces the
// three todayApi helpers (get/put/delete) at the module boundary.
//
// Why mock at the module boundary instead of the global fetch wrapper:
// the panel imports {getOperatorNote, putOperatorNote, deleteOperatorNote}
// from '../lib/todayApi'. Replacing those is one assertion away from "did
// the component call the right binding with the right args"; replacing
// fetch would require re-asserting the CSRF + JSON shape the wrapper
// already handles.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OperatorNotesPanel } from './OperatorNotesPanel'
import * as todayApi from '../lib/todayApi'

const SESSION_ID = 'sess_test_abc'

function mockGet(body: string | null, updatedAt = 1_700_000_000) {
  vi.spyOn(todayApi, 'getOperatorNote').mockResolvedValue({
    note:
      body === null ? null : { sessionId: SESSION_ID, body, updatedAt, updatedBy: 'admin@test' },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('OperatorNotesPanel — initial load', () => {
  it('renders empty when no note exists yet', async () => {
    mockGet(null)
    render(<OperatorNotesPanel sessionId={SESSION_ID} lang="en" />)
    await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument())
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
    // Save button is disabled when the textarea matches the saved body
    // (empty == empty).
    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled()
    // Clear button isn't rendered because there's no saved body to clear.
    expect(screen.queryByRole('button', { name: /Clear/i })).not.toBeInTheDocument()
  })

  it('renders the saved body when the GET returns one', async () => {
    mockGet('push back on scope tomorrow')
    render(<OperatorNotesPanel sessionId={SESSION_ID} lang="en" />)
    await waitFor(() =>
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        'push back on scope tomorrow',
      ),
    )
    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled()
    // Clear button visible because there's a saved body.
    expect(screen.getByRole('button', { name: /Clear/i })).toBeInTheDocument()
  })

  it('renders the FR copy when lang=fr', async () => {
    mockGet(null)
    render(<OperatorNotesPanel sessionId={SESSION_ID} lang="fr" />)
    await waitFor(() => expect(screen.getByText(/Notes opérateur/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Enregistrer/i })).toBeInTheDocument()
  })
})

describe('OperatorNotesPanel — save flow', () => {
  it('enables Save once the textarea diverges from the saved body', async () => {
    const user = userEvent.setup()
    mockGet(null)
    render(<OperatorNotesPanel sessionId={SESSION_ID} lang="en" />)

    const textarea = await waitFor(() => screen.getByRole('textbox'))
    const save = screen.getByRole('button', { name: /Save/i })
    expect(save).toBeDisabled()

    await user.type(textarea, 'first take')
    expect(save).not.toBeDisabled()
  })

  it('writes via putOperatorNote and shows "Saved" briefly', async () => {
    const user = userEvent.setup()
    mockGet(null)
    const putSpy = vi.spyOn(todayApi, 'putOperatorNote').mockResolvedValue({
      note: {
        sessionId: SESSION_ID,
        body: 'first take',
        updatedAt: 1_700_000_010,
        updatedBy: 'a@a',
      },
    })

    render(<OperatorNotesPanel sessionId={SESSION_ID} lang="en" />)
    const textarea = await waitFor(() => screen.getByRole('textbox'))
    await user.type(textarea, 'first take')
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => expect(putSpy).toHaveBeenCalledWith(SESSION_ID, 'first take'))
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument())
    // After saving, the Save button is disabled again (body === savedBody).
    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled()
  })

  it('surfaces the error tag when the PUT throws', async () => {
    const user = userEvent.setup()
    mockGet(null)
    vi.spyOn(todayApi, 'putOperatorNote').mockRejectedValue(new Error('boom'))

    render(<OperatorNotesPanel sessionId={SESSION_ID} lang="en" />)
    const textarea = await waitFor(() => screen.getByRole('textbox'))
    await user.type(textarea, 'will fail')
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Save failed/i))
  })

  it('caps typing at MAX_CHARS (4096) — the slice clamps the value', async () => {
    mockGet(null)
    render(<OperatorNotesPanel sessionId={SESSION_ID} lang="en" />)
    const textarea = (await waitFor(() => screen.getByRole('textbox'))) as HTMLTextAreaElement
    // Skip simulating 4097 key events; setting the value via fireEvent.change
    // exercises the same .slice(0, MAX_CHARS) guard.
    fireEvent.change(textarea, { target: { value: 'a'.repeat(5000) } })
    expect(textarea.value.length).toBe(4096)
  })
})

describe('OperatorNotesPanel — clear flow', () => {
  it('Clear button calls deleteOperatorNote and empties the textarea', async () => {
    mockGet('about to be cleared')
    const delSpy = vi.spyOn(todayApi, 'deleteOperatorNote').mockResolvedValue({ note: null })

    render(<OperatorNotesPanel sessionId={SESSION_ID} lang="en" />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Clear/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Clear/i }))

    await waitFor(() => expect(delSpy).toHaveBeenCalledWith(SESSION_ID))
    await waitFor(() => expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(''))
    // Clear button disappears once there's no saved body.
    expect(screen.queryByRole('button', { name: /Clear/i })).not.toBeInTheDocument()
  })
})
