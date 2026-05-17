import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Pia } from './Pia'
import { AuthContext } from '../lib/authContext'
import { TenantContext } from '../lib/tenantContext'

// Header pulls from auth + tenant context; stub them minimally so the
// component tree mounts without touching the real fetch-based providers.
function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <TenantContext.Provider
        value={{
          tenant: null,
          loading: false,
          refresh: vi.fn().mockResolvedValue(undefined),
        }}
      >
        <AuthContext.Provider
          value={{
            email: null,
            isAdmin: false,
            realIsAdmin: false,
            previewAsUser: false,
            setPreviewAsUser: vi.fn(),
            loading: false,
            requestLink: vi.fn().mockResolvedValue(false),
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

describe('Pia page', () => {
  it('renders both PIA sections with correct anchor ids', () => {
    const { container } = render(
      <Wrap>
        <Pia lang="fr" />
      </Wrap>,
    )
    // Top-level title (FR chrome)
    expect(screen.getByText(/Évaluations des facteurs/i)).toBeInTheDocument()
    // Both PIAs render with their canonical h2s
    expect(screen.getByText(/Sentry integration/i)).toBeInTheDocument()
    expect(screen.getByText(/Stripe integration/i)).toBeInTheDocument()
    // Anchors exist for Privacy.tsx deep-links to land on
    expect(container.querySelector('#sentry')).not.toBeNull()
    expect(container.querySelector('#stripe')).not.toBeNull()
  })

  it('renders EN chrome when lang=en', () => {
    render(
      <Wrap>
        <Pia lang="en" />
      </Wrap>,
    )
    expect(screen.getByText(/Privacy Impact Assessments/)).toBeInTheDocument()
    // Body of the PIA text is English regardless of chrome lang
    expect(screen.getByText(/Stripe integration/i)).toBeInTheDocument()
  })
})
