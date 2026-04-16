import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import VideoCard from '../components/common/VideoCard'
import ErrorMessage from '../components/common/ErrorMessage'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { useProgress } from '../context/ProgressContext'
import { usePlaylists } from '../context/PlaylistContext'
import { usersAPI, videosAPI } from '../utils/api'
import { getCreatorName } from '../utils/lessonMetadata'
import {
  formatNumericDate,
  formatRelativeTime,
  formatViewCount,
  formatWatchTime,
  getProgressLabel,
  truncate,
} from '../utils/formatters'
import styles from './Dashboard.module.css'

function normalizeFeedResponse(data) {
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.videos)
        ? data.videos
        : Array.isArray(data?.items)
          ? data.items
          : []

  return {
    items,
    total: typeof data?.total === 'number' ? data.total : items.length,
  }
}

function normalizeSubscriptionsResponse(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.subscriptions)) return data.subscriptions
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.items)) return data.items
  return []
}

function getDisplayName(user) {
  return user?.username || 'Learner'
}

export default function Dashboard() {
  const { user } = useAuth()
  const { progress, stats, progressSource } = useProgress()
  const { playlists, source: playlistsSource } = usePlaylists()

  const [feed, setFeed] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    if (!user?.id) {
      setFeed([])
      setSubscriptions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [feedData, subscriptionsData] = await Promise.all([
        videosAPI.getFeed(1, 12),
        usersAPI.getSubscriptions(user.id),
      ])

      const normalizedFeed = normalizeFeedResponse(feedData)

      setFeed(normalizedFeed.items)
      setSubscriptions(normalizeSubscriptionsResponse(subscriptionsData))
    } catch (requestError) {
      setError(requestError.message || 'Failed to load your dashboard.')
      setFeed([])
      setSubscriptions([])
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const progressEntries = useMemo(
    () =>
      Object.entries(progress)
        .map(([videoId, entry]) => ({
          videoId: Number(videoId),
          ...entry,
        }))
        .sort(
          (a, b) =>
            new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime()
        ),
    [progress]
  )

  const progressByVideoId = useMemo(
    () => new Map(progressEntries.map((entry) => [entry.videoId, entry])),
    [progressEntries]
  )

  const playlistCount = useMemo(
    () => playlists.filter((playlist) => !playlist.isDefault || playlist.items.length > 0).length,
    [playlists]
  )

  const subscriptionCreatorIds = useMemo(
    () =>
      new Set(
        subscriptions
          .map((subscription) => Number(subscription.creator_id ?? subscription.id))
          .filter((value) => Number.isFinite(value))
      ),
    [subscriptions]
  )

  const inProgressLessons = useMemo(
    () => progressEntries.filter((entry) => entry.percent > 0 && !entry.completed),
    [progressEntries]
  )

  const completedLessons = useMemo(
    () => progressEntries.filter((entry) => entry.completed),
    [progressEntries]
  )

  const totalWatchedSeconds = useMemo(
    () =>
      progressEntries.reduce(
        (sum, entry) => sum + Math.max(0, Math.floor(entry.watchedSeconds || 0)),
        0
      ),
    [progressEntries]
  )

  const continueItems = useMemo(
    () =>
      feed
        .filter((video) => progressByVideoId.has(Number(video.id)))
        .map((video) => ({
          video,
          progress: progressByVideoId.get(Number(video.id)),
        }))
        .sort(
          (a, b) =>
            new Date(b.progress?.lastUpdated || 0).getTime() -
            new Date(a.progress?.lastUpdated || 0).getTime()
        ),
    [feed, progressByVideoId]
  )

  const continueCard = continueItems[0]
    ? continueItems[0]
    : feed[0]
      ? { video: feed[0], progress: null }
      : null

  const recentLearning = useMemo(() => {
    if (continueItems.length > 0) {
      return continueItems.slice(0, 3)
    }

    return feed.slice(0, 3).map((video) => ({
      video,
      progress: null,
    }))
  }, [continueItems, feed])

  const recommendedVideos = useMemo(() => {
    const continueVideoId = continueCard?.video?.id
    return feed
      .filter(
        (video) =>
          video.id !== continueVideoId &&
          !subscriptionCreatorIds.has(Number(video.creator_id))
      )
      .slice(0, 4)
  }, [continueCard?.video?.id, feed, subscriptionCreatorIds])

  const subscriptionVideos = useMemo(
    () =>
      feed
        .filter((video) => subscriptionCreatorIds.has(Number(video.creator_id)))
        .slice(0, 4),
    [feed, subscriptionCreatorIds]
  )

  const statCards = [
    {
      label: 'Creators followed',
      value: subscriptions.length,
      helper: subscriptions.length > 0 ? 'Active subscriptions' : 'Follow creators to build a custom feed',
    },
    {
      label: 'Learning paths',
      value: playlistCount,
      helper:
        playlistCount > 0
          ? playlistsSource === 'backend'
            ? 'Backend learning paths ready to continue'
            : 'Local fallback paths ready to continue'
          : 'Create a path to structure your lessons',
    },
    {
      label: 'In progress',
      value: inProgressLessons.length,
      helper: inProgressLessons.length > 0 ? 'Ready to continue' : 'Start a lesson to track progress',
    },
    {
      label: 'Completed',
      value: completedLessons.length,
      helper: completedLessons.length > 0 ? 'Marked complete in this session' : 'Completions appear here',
    },
  ]

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Learner dashboard</p>
          <h1 className={styles.heroTitle}>Welcome back, {getDisplayName(user)}</h1>
          <p className={styles.heroSubtitle}>
            Track your current lessons, see what the creators you follow are doing
            next, and keep your momentum inside the HowToob learning flow.
          </p>
        </div>

        <div className={styles.heroActions}>
          <Link to="/" className={styles.primaryLink}>
            Explore feed
          </Link>
          <Link to="/subscription" className={styles.secondaryLink}>
            View subscriptions
          </Link>
        </div>
      </section>

      {loading ? (
        <div className={styles.loadingWrap}>
          <LoadingSpinner size="lg" label="Loading your dashboard..." />
        </div>
      ) : (
        <>
          {error ? (
            <ErrorMessage
              message={error}
              onRetry={loadDashboard}
              className={styles.inlineError}
            />
          ) : null}

          <section className={styles.statsGrid} aria-label="Learning stats">
            {statCards.map((card) => (
              <article key={card.label} className={styles.statCard}>
                <span className={styles.statLabel}>{card.label}</span>
                <strong className={styles.statValue}>{card.value}</strong>
                <span className={styles.statHelper}>{card.helper}</span>
              </article>
            ))}
          </section>

          <section className={styles.contentGrid}>
            <article className={`${styles.panel} ${styles.featurePanel}`}>
              <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Continue learning</p>
                    <h2 className={styles.panelTitle}>
                    {continueCard?.progress ? 'Pick up where you left off' : 'Start your next lesson'}
                    </h2>
                  </div>
                <span className={styles.panelMeta}>
                  {continueCard?.progress
                    ? getProgressLabel(continueCard.progress.percent)
                    : 'Fresh from your feed'}
                </span>
              </div>

              {continueCard ? (
                <div className={styles.continueCard}>
                  <Link
                    to={`/watch/${continueCard.video.id}`}
                    className={styles.continueArtwork}
                  >
                    {continueCard.video.thumbnail_url ? (
                      <img
                        src={continueCard.video.thumbnail_url}
                        alt={`Thumbnail for ${continueCard.video.title}`}
                        className={styles.continueImage}
                      />
                    ) : (
                      <div className={styles.continuePlaceholder} aria-hidden="true">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="7 5 19 12 7 19 7 5" />
                        </svg>
                      </div>
                    )}
                  </Link>

                  <div className={styles.continueContent}>
                    <Link
                      to={`/watch/${continueCard.video.id}`}
                      className={styles.continueTitle}
                    >
                      {truncate(continueCard.video.title, 88)}
                    </Link>
                    <p className={styles.continueText}>
                      {continueCard.progress
                        ? progressSource === 'backend'
                          ? 'This card is driven by your synced backend progress so recent lessons are easier to resume across the app.'
                          : 'Backend progress is unavailable right now, so this card is using local fallback progress from this browser.'
                        : 'You have not started a lesson in this session yet, so this card is highlighting a strong place to jump back in.'}
                    </p>

                    <div className={styles.progressRow}>
                      <div
                        className={styles.progressTrack}
                        aria-label="Lesson progress"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={Math.round(continueCard.progress?.percent || 0)}
                        role="progressbar"
                      >
                        <span
                          className={styles.progressFill}
                          style={{
                            width: continueCard.progress
                              ? `${Math.max(8, Math.round(continueCard.progress.percent))}%`
                              : '0%',
                          }}
                        />
                      </div>
                      <span className={styles.progressCopy}>
                        {continueCard.progress
                          ? `${Math.round(continueCard.progress.percent)}% watched`
                          : 'Not started yet'}
                      </span>
                    </div>

                    <div className={styles.continueMeta}>
                      <span>{formatViewCount(continueCard.video.views || 0)} views</span>
                      <span className={styles.metaDot}>•</span>
                      <span>{formatNumericDate(continueCard.video.created_at)}</span>
                    </div>

                    <div className={styles.continueActions}>
                      <Link
                        to={`/watch/${continueCard.video.id}`}
                        className={styles.primaryLink}
                      >
                        {continueCard.progress ? 'Resume lesson' : 'Open lesson'}
                      </Link>
                      <Link to="/" className={styles.ghostLink}>
                        Browse all lessons
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyPanel}>
                  <p className={styles.emptyTitle}>Your feed is still warming up</p>
                  <p className={styles.emptyText}>
                    As soon as videos are available, your next lesson and current
                    progress will appear here.
                  </p>
                  <Link to="/" className={styles.primaryLink}>
                    Go to home feed
                  </Link>
                </div>
              )}
            </article>

            <aside className={styles.sideColumn}>
              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Subscription summary</p>
                    <h2 className={styles.panelTitle}>Your learning network</h2>
                  </div>
                </div>

                {subscriptions.length > 0 ? (
                  <>
                    <p className={styles.summaryLead}>
                      You are currently following {subscriptions.length} creator{subscriptions.length === 1 ? '' : 's'}.
                    </p>
                    <div className={styles.pillGroup}>
                      {subscriptions.slice(0, 6).map((subscription) => (
                        <span key={subscription.id} className={styles.creatorPill}>
                          {getCreatorName(subscription)}
                        </span>
                      ))}
                    </div>
                    <Link to="/subscription" className={styles.inlineAction}>
                      Manage subscriptions
                    </Link>
                  </>
                ) : (
                  <div className={styles.placeholderCard}>
                    <h3 className={styles.placeholderTitle}>No subscriptions yet</h3>
                    <p className={styles.placeholderText}>
                      Follow creators from the watch page to make your dashboard
                      feel more personal and easier to revisit.
                    </p>
                    <Link to="/" className={styles.inlineAction}>
                      Explore creators in the feed
                    </Link>
                  </div>
                )}
              </article>

              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Session snapshot</p>
                    <h2 className={styles.panelTitle}>Learning activity</h2>
                  </div>
                </div>

                <div className={styles.snapshotList}>
                  <div className={styles.snapshotItem}>
                    <span className={styles.snapshotLabel}>Time invested</span>
                    <strong className={styles.snapshotValue}>
                      {formatWatchTime(totalWatchedSeconds)}
                    </strong>
                  </div>
                  <div className={styles.snapshotItem}>
                    <span className={styles.snapshotLabel}>Quiz attempts</span>
                    <strong className={styles.snapshotValue}>
                      {stats.quizScores.length}
                    </strong>
                  </div>
                  <div className={styles.snapshotItem}>
                    <span className={styles.snapshotLabel}>Completed milestones</span>
                    <strong className={styles.snapshotValue}>
                      {stats.completedPlaylists.length}
                    </strong>
                  </div>
                </div>

                <p className={styles.snapshotFootnote}>
                  {progressSource === 'backend'
                    ? 'Progress cards now prefer backend watch state. Quiz attempts and playlist completion badges still stay local until those features fully sync.'
                    : 'Progress is currently falling back to this browser, while quiz stats and playlist completion badges remain local MVP features.'}
                </p>
              </article>
            </aside>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Recent learning</p>
                <h2 className={styles.sectionTitle}>What to revisit next</h2>
              </div>
              <Link to="/history" className={styles.sectionLink}>
                History
              </Link>
            </div>

            <div className={styles.recentGrid}>
              {recentLearning.length > 0 ? (
                recentLearning.map(({ video, progress: itemProgress }, index) => (
                  <article key={video.id} className={styles.recentCard}>
                    <span className={styles.recentLabel}>
                      {itemProgress
                        ? index === 0
                          ? 'Continue now'
                          : 'Recently active'
                        : index === 0
                          ? 'Suggested start'
                          : 'Recommended'}
                    </span>
                    <Link to={`/watch/${video.id}`} className={styles.recentTitle}>
                      {truncate(video.title, 68)}
                    </Link>
                    <p className={styles.recentText}>
                      {itemProgress
                        ? `${Math.round(itemProgress.percent)}% watched • last active ${formatRelativeTime(
                            itemProgress.lastUpdated
                          )}`
                        : 'Watch progress will appear here once you start a lesson.'}
                    </p>
                    <div className={styles.recentMeta}>
                      <span>{formatViewCount(video.views || 0)} views</span>
                      <span className={styles.metaDot}>•</span>
                      <span>{formatNumericDate(video.created_at)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <article className={styles.placeholderWide}>
                  <h3 className={styles.placeholderTitle}>Recent learning will show up here</h3>
                  <p className={styles.placeholderText}>
                    Start a lesson and your latest session activity will be easier to
                    resume from this dashboard.
                  </p>
                </article>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>From subscriptions</p>
                <h2 className={styles.sectionTitle}>Lessons from creators you follow</h2>
              </div>
              <span className={styles.sectionHint}>
                Filtered from the current backend feed using your subscription list
              </span>
            </div>

            {subscriptionVideos.length > 0 ? (
              <div className={styles.videoGrid}>
                {subscriptionVideos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <article className={styles.placeholderWide}>
                <h3 className={styles.placeholderTitle}>Subscription lessons will appear here</h3>
                <p className={styles.placeholderText}>
                  You may need more followed creators or more matching feed items before this shelf fills in.
                </p>
              </article>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Recommended next</p>
                <h2 className={styles.sectionTitle}>Keep the momentum going</h2>
              </div>
              <span className={styles.sectionHint}>
                Based on the current feed from the backend
              </span>
            </div>

            {recommendedVideos.length > 0 ? (
              <div className={styles.videoGrid}>
                {recommendedVideos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <article className={styles.placeholderWide}>
                <h3 className={styles.placeholderTitle}>Recommendations are waiting on feed data</h3>
                <p className={styles.placeholderText}>
                  Once `/videos/feed` returns lessons, this section becomes your
                  next-up learning shelf.
                </p>
              </article>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Saved and planning</p>
                <h2 className={styles.sectionTitle}>Features expanding next</h2>
              </div>
            </div>

            <div className={styles.placeholderGrid}>
              <article className={styles.placeholderCard}>
                <h3 className={styles.placeholderTitle}>Learning paths</h3>
                <p className={styles.placeholderText}>
                  {playlistCount > 0
                    ? playlistsSource === 'backend'
                      ? `${playlistCount} playlist${playlistCount === 1 ? '' : 's'} are now loading from the backend learning-path system.`
                      : `${playlistCount} playlist${playlistCount === 1 ? '' : 's'} are using local fallback because backend playlist loading is unavailable right now.`
                    : 'Create a learning path to start organizing lessons into a structured course.'}
                </p>
                <Link to="/my-playlists" className={styles.inlineAction}>
                  Open learning paths
                </Link>
              </article>

              <article className={styles.placeholderCard}>
                <h3 className={styles.placeholderTitle}>Milestones and streaks</h3>
                <p className={styles.placeholderText}>
                  Certificates, streaks, and deeper learning milestones will fit here
                  after the platform adds richer backend milestone tracking.
                </p>
                <span className={styles.placeholderHint}>
                  For now, the dashboard focuses on live feed data, synced progress
                  where available, and honest MVP fallbacks elsewhere.
                </span>
              </article>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
