import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MessageRow, SessionRow } from './sessionsApi'

vi.mock('./sessionsApi', () => ({
  listSessions: vi.fn(),
  listMessages: vi.fn(),
}))

import { exportMyData } from './export'
import { listMessages, listSessions } from './sessionsApi'

const mockedListSessions = vi.mocked(listSessions)
const mockedListMessages = vi.mocked(listMessages)

const session = (id: string) => ({ id }) as unknown as SessionRow
const message = (id: string) => ({ id }) as unknown as MessageRow

beforeEach(() => {
  vi.clearAllMocks()
})

describe('exportMyData', () => {
  it('bundles each session with its thread + a self-describing metadata block', async () => {
    mockedListSessions.mockResolvedValue({ sessions: [session('a'), session('b')] } as never)
    mockedListMessages.mockImplementation(
      async (id: string) => ({ messages: [message(`m_${id}`)] }) as never,
    )

    const bundle = await exportMyData('visitor@x.com')

    expect(bundle.exportFormat).toBe('marc-portal-export-v1')
    expect(bundle.exportedBy).toBe('visitor@x.com')
    expect(bundle.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(bundle.sessions).toHaveLength(2)
    expect(bundle.sessions[0]!.session.id).toBe('a')
    expect(bundle.sessions[0]!.messages.map((m) => m.id)).toEqual(['m_a'])
  })

  it('keeps a session in the bundle (with empty messages) when its thread fetch fails', async () => {
    // One bad thread must not abort the whole export — the visitor still gets
    // an archive of everything that loaded.
    mockedListSessions.mockResolvedValue({ sessions: [session('ok'), session('bad')] } as never)
    mockedListMessages.mockImplementation(async (id: string) => {
      if (id === 'bad') throw new Error('thread 500')
      return { messages: [message('m1')] } as never
    })

    const bundle = await exportMyData('visitor@x.com')

    expect(bundle.sessions).toHaveLength(2)
    const ok = bundle.sessions.find((s) => s.session.id === 'ok')!
    const bad = bundle.sessions.find((s) => s.session.id === 'bad')!
    expect(ok.messages).toHaveLength(1)
    expect(bad.messages).toEqual([])
  })

  it('returns an empty session list when the visitor has no sessions', async () => {
    mockedListSessions.mockResolvedValue({ sessions: [] } as never)
    const bundle = await exportMyData('visitor@x.com')
    expect(bundle.sessions).toEqual([])
  })
})
