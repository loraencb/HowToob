import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import VideoCard from '../components/common/VideoCard'
import ErrorMessage from '../components/common/ErrorMessage'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { usePlaylists } from '../context/PlaylistContext'
import { useProgress } from '../context/ProgressContext'
import { usersAPI } from '../utils/api'
import { formatNumericDate, getInitials } from '../utils/formatters'
import styles from './Profile.module.css'

function getRoleLabel(role, hasVideos) {
  if (role === 'creator') return 'Creator'
  if (role === 'viewer') return 'Explorer'
  if (role === 'admin') return 'Admin'
  if (hasVideos) return 'Creator'
  return 'Explorer'
}

function getProfileSourceLabel(source) {
  if (source === 'backend-profile') return 'Backend profile'
  if (source === 'auth') return 'Authenticated session'
  if (source === 'route-id') return 'Numeric creator route'
  if (source === 'route-name') return 'Username route only'
  return 'Route fallback'
}

export default function Profile() {
  const { username } = useParams()
  const requestedIdentity = decodeURIComponent(username || '')
  const { user } = useAuth()
  const { progress, stats } = useProgress()
  const { playlists, source: playlistsSource } = usePlaylists()

  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profileSummary, setProfileSummary] = useState(null)
  const [resolvedProfile, setResolvedProfile] = useState({
    id: null,
    username: requestedIdentity,
    role: null,
    source: 'route',
  })

  const isCurrentUser =
    Boolean(user) &&
    (requestedIdentity === user.username || requestedIdentity === String(user.id))

  useEffect(() => {
    let active = true

    async function loadProfile() {
      setLoading(true)
      setError('')

      try {
        const data = await usersAPI.getProfile(isCurrentUser ? user.username : requestedIdentity)
        if (!active) return

        const profile = data?.profile || {}
        setResolvedProfile({
          id: profile.id ?? null,
          username: profile.username || requestedIdentity,
          role: profile.role || null,
          source: 'backend-profile',
        })
        setProfileSummary(data?.summary || null)
        setVideos(Array.isArray(data?.videos) ? data.videos : [])
      } catch (requestError) {
        if (!active) return
        setVideos([])
        setProfileSummary(null)
        setResolvedProfile({
          id: isCurrentUser ? user?.id ?? null : null,
          username: isCurrentUser ? user?.username || requestedIdentity : requestedIdentity,
          role: isCurrentUser ? user?.role || null : null,
          source: isCurrentUser ? 'auth' : 'route-name',
        })
        setError(requestError.message || 'Could not load this creator profile.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      active = false
    }
  }, [isCurrentUser, requestedIdentity, user])

  const roleLabel = useMemo(
    () => getRoleLabel(resolvedProfile.role, videos.length > 0),
    [resolvedProfile.role, videos.length]
  )

  const canHydrateProfile = Boolean(resolvedProfile.id)
  const savedPath = useMemo(
    () => (isCurrentUser ? playlists.find((playlist) => playlist.isDefault) || null : null),
    [isCurrentUser, playlists]
  )
  const customPlaylists = useMemo(
    () => (isCurrentUser ? playlists.filter((playlist) => !playlist.isDefault) : []),
    [isCurrentUser, playlists]
  )
  const resumeReadyLessons = useMemo(
    () =>
      isCurrentUser
        ? Object.values(progress).filter((entry) => entry?.percent > 0 && !entry?.completed).length
        : 0,
    [isCurrentUser, progress]
  )
  const latestCompletedPath = useMemo(() => {
    if (!isCurrentUser || !Array.isArray(stats.completedPlaylists)) return null

    return [...stats.completedPlaylists]
      .sort(
        (left, right) =>
          new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime()
      )[0] || null
  }, [isCurrentUser, stats.completedPlaylists])

  const statCards = isCurrentUser
    ? [
        {
          label: 'Role',
          value: roleLabel,
          helper: 'Derived from your authenticated session when available',
        },
        {
          label: 'Published lessons',
          value: profileSummary?.published_video_count ?? videos.length,
          helper: 'Loaded from the backend profile endpoint',
        },
        {
          label: playlistsSource === 'backend' ? 'Learning paths' : 'Fallback paths',
          value: customPlaylists.length,
          helper:
            playlistsSource === 'backend'
              ? 'Private playlists from the backend learning-path system'
              : 'Private fallback playlists stored in this browser',
        },
        {
          label: 'Subscribers',
          value: profileSummary?.subscriber_count ?? '--',
          helper: 'Returned by the backend profile endpoint when available',
        },
      ]
    : [
        {
          label: 'Role',
          value: roleLabel,
          helper: 'Inferred from available creator data',
        },
        {
          label: 'Published lessons',
          value: profileSummary?.published_video_count ?? videos.length,
          helper: 'Videos returned by the backend profile endpoint',
        },
        {
          label: 'Profile source',
          value: getProfileSourceLabel(resolvedProfile.source),
          helper: 'Explains how this page resolved the profile',
        },
        {
          label: 'Subscribers',
          value: profileSummary?.subscriber_count ?? '--',
          helper: 'Returned when the backend profile endpoint has that metadata',
        },
      ]

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <LoadingSpinner size="lg" label="Loading profile..." />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.identity}>
          <div className={styles.avatar}>{getInitials(resolvedProfile.username || 'Profile')}</div>
          <div className={styles.identityCopy}>
            <p className={styles.eyebrow}>
              {isCurrentUser ? 'Your profile' : 'Creator profile'}
            </p>
            <h1 className={styles.title}>{resolvedProfile.username || requestedIdentity}</h1>
            <p className={styles.subtitle}>
                {isCurrentUser
                  ? 'This page blends backend creator data with your local learning-path and progress MVP so your identity feels like a learner profile, not only a channel page.'
                  : canHydrateProfile
                  ? 'This creator page is grounded in the backend profile endpoint, with graceful fallbacks where public identity data is still limited.'
                  : 'The current profile lookup could not be resolved, so this page is using the safest available fallback identity data.'}
            </p>
          </div>
        </div>

        <div className={styles.heroMeta}>
          <span className={styles.roleBadge}>{roleLabel}</span>
          {isCurrentUser ? (
            <span className={styles.sourceBadge}>Local learning data is private to this browser</span>
          ) : (
            <span className={styles.sourceBadge}>
              {getProfileSourceLabel(resolvedProfile.source)}
            </span>
          )}
          <Link to="/" className={styles.secondaryLink}>
            Back to feed
          </Link>
        </div>
      </section>

      {error ? <ErrorMessage message={error} /> : null}

      <section className={styles.statsGrid}>
        {statCards.map((card) => (
          <article key={card.label} className={styles.statCard}>
            <span className={styles.statLabel}>{card.label}</span>
            <strong className={styles.statValue}>{card.value}</strong>
            <span className={styles.statHelper}>{card.helper}</span>
          </article>
        ))}
      </section>

      <section className={styles.insightGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Identity</p>
              <h2 className={styles.panelTitle}>
                {isCurrentUser ? 'Profile fidelity' : 'Creator availability'}
              </h2>
            </div>
          </div>

          <div className={styles.detailList}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Profile mode</span>
              <strong className={styles.detailValue}>
                {isCurrentUser ? 'Signed-in learner view' : 'Public creator view'}
              </strong>
              <span className={styles.detailNote}>
                {isCurrentUser
                  ? 'Uses your active auth session as the most reliable identity source.'
                  : 'Public creator pages prefer the backend profile endpoint when a stable identifier can be resolved.'}
              </span>
            </div>

            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Creator route</span>
              <strong className={styles.detailValue}>
                {canHydrateProfile ? '/users/profile/:identifier' : 'Unavailable'}
              </strong>
              <span className={styles.detailNote}>
                {canHydrateProfile
                  ? 'Creator details and lesson shelves below are backend-connected.'
                  : 'This route can show the requested identity, but it could not fully hydrate the backend profile.'}
              </span>
            </div>

            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Subscriber counts</span>
              <strong className={styles.detailValue}>
                {profileSummary?.subscriber_count ?? 'Unavailable'}
              </strong>
              <span className={styles.detailNote}>
                Subscriber counts now come from the backend profile endpoint when available.
              </span>
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>
                {isCurrentUser ? 'Learning profile' : 'Learning paths'}
              </p>
              <h2 className={styles.panelTitle}>
                {isCurrentUser ? 'Private learning-path summary' : 'Availability notes'}
              </h2>
            </div>
          </div>

          {isCurrentUser ? (
            <div className={styles.detailList}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Saved path lessons</span>
                <strong className={styles.detailValue}>{savedPath?.items.length || 0}</strong>
                <span className={styles.detailNote}>
                  Lessons saved to your default local learning path.
                </span>
              </div>

              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Custom paths</span>
                <strong className={styles.detailValue}>{customPlaylists.length}</strong>
                <span className={styles.detailNote}>
                  {playlistsSource === 'backend'
                    ? 'These playlists now come from the backend learning-path system.'
                    : 'These playlists are using local fallback data in this browser.'}
                </span>
              </div>

              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Resume-ready lessons</span>
                <strong className={styles.detailValue}>{resumeReadyLessons}</strong>
                <span className={styles.detailNote}>
                  Lessons with local progress that are not complete yet.
                </span>
              </div>

              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Completed paths</span>
                <strong className={styles.detailValue}>{stats.completedPlaylists.length}</strong>
                <span className={styles.detailNote}>
                  {latestCompletedPath
                    ? `Latest completion: ${latestCompletedPath.title} on ${formatNumericDate(latestCompletedPath.completedAt)}.`
                    : 'No local playlist completion has been recorded yet.'}
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <h3 className={styles.emptyTitle}>Learning paths stay private for now</h3>
              <p className={styles.emptyText}>
                Playlist and progress data are still local MVP features, so they are only
                shown on your own signed-in profile and are not exposed on public creator pages.
              </p>
            </div>
          )}

          {isCurrentUser ? (
            <div className={styles.panelActions}>
              <Link to="/my-playlists" className={styles.secondaryLink}>
                Open learning paths
              </Link>
              <Link to="/dashboard" className={styles.secondaryLink}>
                Return to dashboard
              </Link>
            </div>
          ) : null}
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.panelEyebrow}>Published lessons</p>
            <h2 className={styles.panelTitle}>Creator videos</h2>
          </div>
        </div>

        {!canHydrateProfile ? (
          <div className={styles.emptyState}>
            <h3 className={styles.emptyTitle}>Public username lookup is not available yet</h3>
            <p className={styles.emptyText}>
              The backend can load creator videos by numeric user id and for your own
              authenticated profile, but it does not currently expose a route to resolve
              arbitrary public usernames.
            </p>
          </div>
        ) : videos.length > 0 ? (
          <div className={styles.videoGrid}>
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h3 className={styles.emptyTitle}>No published lessons yet</h3>
            <p className={styles.emptyText}>
              This profile does not currently have any creator videos returned by
              the backend profile endpoint.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
