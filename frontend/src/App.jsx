import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PlaylistProvider } from './context/PlaylistContext'
import { ProgressProvider } from './context/ProgressContext'
import MainLayout from './components/layout/MainLayout'
import ProtectedRoute from './components/common/ProtectedRoute'
import LoadingSpinner from './components/common/LoadingSpinner'

// Eager imports (auth pages, small and always needed)
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'

// Lazy imports (code-split by route)
const Watch          = lazy(() => import('./pages/Watch'))
const Upload         = lazy(() => import('./pages/Upload'))
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const CreatorDash    = lazy(() => import('./pages/CreatorDashboard'))
const Profile        = lazy(() => import('./pages/Profile'))
const Search         = lazy(() => import('./pages/Search'))
const Playlist       = lazy(() => import('./pages/Playlist'))
const MyPlaylists    = lazy(() => import('./pages/MyPlaylists'))
const WatchHistory   = lazy(() => import('./pages/WatchHistory'))
const Settings       = lazy(() => import('./pages/Settings'))
const Subscription   = lazy(() => import('./pages/Subscription'))
const Quiz           = lazy(() => import('./pages/Quiz'))

// Fallback page for unmatched routes
function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: '1rem', textAlign: 'center',
    }}>
      <span style={{ fontSize: '4rem' }}>404</span>
      <h2 style={{ fontFamily: 'var(--font-family-heading)' }}>Page not found</h2>
      <p style={{ color: 'var(--color-text-muted)' }}>
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
        Back to home
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PlaylistProvider>
          <ProgressProvider>
            <Suspense fallback={<LoadingSpinner size="fullPage" />}>
              <Routes>
                {/* Auth pages (no layout shell) */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Main app (with Navbar + Sidebar layout) */}
                <Route element={<MainLayout />}>
                  {/* Public routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/trending" element={<Home />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/watch/:videoId" element={<Watch />} />
                  <Route path="/profile/:username" element={<Profile />} />
                  <Route path="/playlist/:playlistId" element={<Playlist />} />

                  {/* Protected: any authenticated user */}
                  <Route path="/dashboard" element={
                    <ProtectedRoute><Dashboard /></ProtectedRoute>
                  } />
                  <Route path="/my-playlists" element={
                    <ProtectedRoute><MyPlaylists /></ProtectedRoute>
                  } />
                  <Route path="/history" element={
                    <ProtectedRoute><WatchHistory /></ProtectedRoute>
                  } />
                  <Route path="/settings" element={
                    <ProtectedRoute><Settings /></ProtectedRoute>
                  } />
                  <Route path="/subscription" element={
                    <ProtectedRoute><Subscription /></ProtectedRoute>
                  } />
                  <Route path="/quiz/:videoId" element={
                    <ProtectedRoute><Quiz /></ProtectedRoute>
                  } />

                  {/* Protected: creator only */}
                  <Route path="/upload" element={
                    <ProtectedRoute role="creator"><Upload /></ProtectedRoute>
                  } />
                  <Route path="/creator-dashboard" element={
                    <ProtectedRoute role="creator"><CreatorDash /></ProtectedRoute>
                  } />

                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </ProgressProvider>
        </PlaylistProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
