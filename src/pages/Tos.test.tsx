import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Tos } from './Tos'
import { Privacy } from './Privacy'
import { AuthContext } from '../lib/authContext'
import { TenantContext } from '../lib/tenantContext'

// Header pulls from auth + tenant context; stub them minimally so the tree
// mounts without the real fetch-based providers (same shape as Pia.test.tsx).
function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <TenantContext.Provider
        value={{ tenant: null, loading: false, refresh: vi.fn().mockResolvedValue(undefined) }}
      >
        <AuthContext.Provider
          value={{
            email: null,
            isAdmin: false,
            realIsAdmin: false,
            previewAsUser: false,
            setPreviewAsUser: vi.fn(),
            loading: false,
            requestLink: vi.fn().mockResolvedValue({ sent: false }),
            logout: vi.fn().mockResolvedValue(undefined),
            refresh: vi.fn().mockResolvedValue(undefined),
          }}
        >
          {children}
        </AuthContext.Provider>
      </TenantContext.Provider>
    </MemoryRouter>
  )
}

describe('Tos page', () => {
  it('renders the same numbered sections in both languages', () => {
    const ids = (lang: 'fr' | 'en') => {
      const { container, unmount } = render(
        <Wrap>
          <Tos lang={lang} />
        </Wrap>,
      )
      const found = [...container.querySelectorAll('section[id^="section-"]')].map((s) => s.id)
      unmount()
      return found
    }
    const fr = ids('fr')
    expect(fr).toHaveLength(14)
    expect(ids('en')).toEqual(fr)
  })

  it('states the tier prices the pricing copy states', () => {
    const { container } = render(
      <Wrap>
        <Tos lang="en" />
      </Wrap>,
    )
    const text = container.textContent ?? ''
    for (const price of ['$750', '$1,800', '$3,600', '$7,500']) expect(text).toContain(price)
  })

  it('links only to privacy anchors that exist', () => {
    const { container: tos } = render(
      <Wrap>
        <Tos lang="fr" />
      </Wrap>,
    )
    const anchors = [...tos.querySelectorAll('a[href^="/confidentialite#"]')].map(
      (a) => a.getAttribute('href')!.split('#')[1],
    )
    expect(anchors.length).toBeGreaterThan(0)
    const { container: privacy } = render(
      <Wrap>
        <Privacy lang="fr" />
      </Wrap>,
    )
    for (const id of anchors) {
      expect(privacy.querySelector(`#${id}`), `privacy page has no #${id}`).not.toBeNull()
    }
  })
})
