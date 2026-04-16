import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ErrorMessage from './ErrorMessage'
import LoadingSpinner from './LoadingSpinner'

/**
 * Wraps routes that require authentication (and optionally a specific role).
 *
 * Usage:
 *   <ProtectedRoute>               requires any authenticated user
 *   <ProtectedRoute role="creator"> requires creator role
 */
export default function ProtectedRoute({ children, role }) {
  const { isAuthenticated, loading, user, authError, checkAuth } = useAuth()
  const location = useLocation()

  // Still checking session on mount, show spinner instead of flashing redirect
  if (loading) {
    return <LoadingSpinner size="fullPage" label="Checking session…" />
  }

  if (!isAuthenticated && authError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '2rem',
      }}>
        <ErrorMessage message={authError} onRetry={checkAuth} />
      </div>
    )
  }

  // Not logged in → redirect to login, preserving intended destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Logged in but wrong role
  if (role && user?.role !== role) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem',
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <h2 style={{ fontFamily: 'var(--font-family-heading)', marginBottom: '0.5rem' }}>
          Access Denied
        </h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          This page requires a <strong>{role}</strong> account.
        </p>
      </div>
    )
  }

  return children
}
