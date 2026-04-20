import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../components/common/Badge'
import ErrorMessage from '../components/common/ErrorMessage'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { usePlaylists } from '../context/PlaylistContext'
import { useProgress } from '../context/ProgressContext'
import { usersAPI, videosAPI } from '../utils/api'
import {
  getAccessMetadata,
  getCategoryLabel,
  getCreatorName,
  getCreatorProfileSlug,
} from '../utils/lessonMetadata'
import {
  formatNumericDate,
  formatRatingSummary,
  formatRelativeTime,
  formatViewCount,
  formatWatchTime,
  getProgressLabel,
  truncate,
} from '../utils/formatters'
import styles from './WatchHistory.module.css'

function normalizeVideoSnapshot(rawVideo, fallbackId = null) {
  const raw = rawVideo || {}
  const id = Number(raw.id ?? fallbackId ?? 0)

  return {
    ...raw,
    id,
    title: raw.title || (id ? `Lesson #${id}` : 'Untitled lesson'),
    description: raw.description || '',
    thumbnail_url: raw.thumbnail_url || raw.thumbnail || '',
    creator_id: raw.creator_id ?? raw.creator?.id ?? null,
    author_name:
      raw.author_name ||
      raw.creator_name ||
      raw.creator?.username ||
      (raw.creator_id ? `Creator #${raw.creator_id}` : ''),
    views: Number(raw.views || 0),
    created_at: raw.created_at || null,
    category: raw.category || raw.subject || raw.topic || '',
    average_rating: Number(raw.average_rating ?? 0),
    rating_count: Number(raw.rating_count ?? raw.like_count ?? 0),
    viewer_rating: Number(raw.viewer_rating ?? 0),
    subscription: raw.subscription || null,
  }
}

function normalizeRatingsPayload(payload) {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.items)
        ? payload.items
        : []

  return {
    items: items
      .map((item) => ({
        id: item?.id ?? `${item?.video_id ?? item?.video?.id ?? 'rating'}`,
        videoId: Number(item?.video_id ?? item?.video?.id ?? 0),
        rating: Number(item?.rating ?? item?.video?.viewer_rating ?? 0),
        video: normalizeVideoSnapshot(item?.video, item?.video_id),
      }))
      .filter((item) => item.videoId > 0),
    summary: {
      totalRatings: Number(payload?.summary?.total_ratings ?? items.length ?? 0),
      averageRatingGiven: Number(payload?.summary?.average_rating_given ?? 0),
    },
  }
}

function renderStars(rating) {
  return Array.from({ length: 5 }, (_, index) => index + 1).map((value) => (
    <span
      key={value}
      className={value <= rating ? styles.starFilled : styles.starEmpty}
      aria-hidden="true"
    >
      ★
    </span>
  ))
}

function EmptyState({ title, text, actionLabel, actionTo }) {
  return (
    <article className={styles.emptyState}>
      <h3 className={styles.emptyTitle}>{title}</h3>
      <p className={styles.emptyText}>{text}</p>
      {actionLabel && actionTo ? (
        <Link to={actionTo} className={styles.primaryLink}>
          {actionLabel}
        </Link>
      ) : null}
    </article>
  )
}

function Thumbnail({ video }) {
  return (
    <Link to={`/watch/${video.id}`} className={styles.thumbnailLink}>
      {video.thumbnail_url ? (
        <img
          src={video.thumbnail_url}
          alt={`Thumbnail for ${video.title}`}
          className={styles.thumbnail}
        />
      ) : (
        <div className={styles.thumbnailPlaceholder} aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="7 5 19 12 7 19 7 5" />
          </svg>
        </div>
      )}
    </Link>
  )
}

export default function WatchHistory() {
  const { user } = useAuth()
  const { progress, progressLoaded, progressSource, progressError } = useProgress()
  const {
    playlists,
    loading: playlistsLoading,
    error: playlistsError,
    source: playlistsSource,
  } = usePlaylists()

  const [ratedLessons, setRatedLessons] = useState([])
  const [ratingSummary, setRatingSummary] = useState({
    totalRatings: 0,
    averageRatingGiven: 0,
  })
  const [ratingsLoading, setRatingsLoading] = useState(true)
  const [ratingsError, setRatingsError] = useState('')
  const [hydratedVideos, setHydratedVideos] = useState({})

  const loadRatings = useCallback(async () => {
    if (!user?.id) {
      setRatedLessons([])
      setRatingSummary({ totalRatings: 0, averageRatingGiven: 0 })
      setRatingsLoading(false)
      return
    }

    setRatingsLoading(true)
    setRatingsError('')

    try {
      const payload = await usersAPI.getMyRatings(12)
      const normalized = normalizeRatingsPayload(payload)
      setRatedLessons(normalized.items)
      setRatingSummary(normalized.summary)
    } catch (requestError) {
      setRatedLessons([])
      setRatingSummary({ totalRatings: 0, averageRatingGiven: 0 })
      setRatingsError(
        requestError.message || 'Could not load your rated lessons right now.'
      )
    } finally {
      setRatingsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadRatings()
  }, [loadRatings])

  const progressEntries = useMemo(
    () =>
      Object.entries(progress || {})
        .map(([videoId, entry]) => ({
          videoId: Number(videoId),
          ...entry,
        }))
        .filter((entry) => entry.videoId > 0 && (entry.percent > 0 || entry.watchedSeconds > 0))
        .sort(
          (left, right) =>
            new Date(right.lastUpdated || 0).getTime() -
            new Date(left.lastUpdated || 0).getTime()
        ),
    [progress]
  )

  const progressIdsNeedingHydration = useMemo(
    () =>
      progressEntries
        .filter((entry) => !entry.video && !hydratedVideos[entry.videoId])
        .map((entry) => entry.videoId)
        .slice(0, 10),
    [hydratedVideos, progressEntries]
  )

  useEffect(() => {
    if (!progressIdsNeedingHydration.length) return undefined

    let active = true

    Promise.allSettled(progressIdsNeedingHydration.map((videoId) => videosAPI.getById(videoId)))
      .then((results) => {
        if (!active) return

        const nextVideos = {}
        results.forEach((result, index) => {
          if (result.status !== 'fulfilled') return

          const videoId = progressIdsNeedingHydration[index]
          nextVideos[videoId] = normalizeVideoSnapshot(result.value, videoId)
        })

        if (Object.keys(nextVideos).length > 0) {
          setHydratedVideos((previous) => ({
            ...previous,
            ...nextVideos,
          }))
        }
      })
      .catch(() => {
        // Keep the page usable even if missing video hydration fails.
      })

    return () => {
      active = false
    }
  }, [progressIdsNeedingHydration])

  const recentWatchItems = useMemo(
    () =>
      progressEntries.slice(0, 8).map((entry) => ({
        ...entry,
        video: normalizeVideoSnapshot(
          entry.video || hydratedVideos[entry.videoId],
          entry.videoId
        ),
      })),
    [hydratedVideos, progressEntries]
  )

  const learningPathItems = useMemo(() => {
    const itemsByVideoId = new Map()

    playlists.forEach((playlist) => {
      playlist.items.forEach((item) => {
        if (!item.videoId) return

        const existing = itemsByVideoId.get(item.videoId) || {
          videoId: Number(item.videoId),
          video: normalizeVideoSnapshot(item.rawVideo || item, item.videoId),
          addedAt: item.addedAt,
          playlists: [],
        }

        if (
          !existing.video?.thumbnail_url &&
          (item.rawVideo?.thumbnail_url || item.thumbnail_url)
        ) {
          existing.video = normalizeVideoSnapshot(item.rawVideo || item, item.videoId)
        }

        if (
          !existing.playlists.some(
            (playlistEntry) => playlistEntry.id === String(playlist.id)
          )
        ) {
          existing.playlists.push({
            id: String(playlist.id),
            title: playlist.title,
            isDefault: playlist.isDefault,
          })
        }

        const existingTime = new Date(existing.addedAt || 0).getTime()
        const itemTime = new Date(item.addedAt || 0).getTime()
        if (itemTime >= existingTime) {
          existing.addedAt = item.addedAt
        }

        itemsByVideoId.set(item.videoId, existing)
      })
    })

    return Array.from(itemsByVideoId.values())
      .sort(
        (left, right) =>
          new Date(right.addedAt || 0).getTime() - new Date(left.addedAt || 0).getTime()
      )
      .slice(0, 10)
  }, [playlists])

  const statCards = [
    {
      label: 'Recent watching',
      value: recentWatchItems.length,
      helper:
        recentWatchItems.length > 0
          ? `${formatWatchTime(
              progressEntries.reduce(
                (sum, entry) => sum + Math.max(0, Math.floor(entry.watchedSeconds || 0)),
                0
              )
            )} tracked so far`
          : 'Start a lesson to build your watch history',
    },
    {
      label: 'Rated lessons',
      value: ratingSummary.totalRatings || ratedLessons.length,
      helper:
        ratingSummary.totalRatings > 0
          ? `Average rating given ${ratingSummary.averageRatingGiven.toFixed(1)} / 5`
          : 'Rate a lesson to keep it in your history',
    },
    {
      label: 'Saved to paths',
      value: learningPathItems.length,
      helper:
        learningPathItems.length > 0
          ? `${playlists.length} learning path${playlists.length === 1 ? '' : 's'} contributing`
          : 'Save lessons into a learning path to revisit them here',
    },
  ]

  const pageLoading = !progressLoaded || playlistsLoading || ratingsLoading

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.badgeRow}>
            <Badge variant="info" size="md">
              Learning activity
            </Badge>
            <Badge variant={progressSource === 'backend' ? 'success' : 'warning'} size="md">
              {progressSource === 'backend' ? 'Progress saved' : 'Progress on this device'}
            </Badge>
            <Badge variant={playlistsSource === 'backend' ? 'success' : 'warning'} size="md">
              {playlistsSource === 'backend'
                ? 'Learning paths saved'
                : 'Learning paths on this device'}
            </Badge>
            <Badge variant={ratingsError ? 'warning' : 'success'} size="md">
              {ratingsError ? 'Ratings unavailable' : 'Ratings saved'}
            </Badge>
          </div>
          <h1 className={styles.title}>Watch history and learning activity</h1>
          <p className={styles.subtitle}>
            Track the lessons you watched recently, the ones you rated, and the videos
            you saved into learning paths so it is easier to pick up your learning flow.
          </p>
        </div>

        <div className={styles.heroActions}>
          <Link to="/dashboard" className={styles.secondaryLink}>
            Back to dashboard
          </Link>
          <Link to="/my-playlists" className={styles.primaryLink}>
            Open learning paths
          </Link>
        </div>
      </section>

      {pageLoading ? (
        <div className={styles.loadingWrap}>
          <LoadingSpinner size="lg" label="Loading your watch history..." />
        </div>
      ) : (
        <>
          {progressError ? (
            <ErrorMessage
              message={progressError}
              className={styles.inlineError}
            />
          ) : null}

          <section className={styles.statsGrid} aria-label="Watch history summary">
            {statCards.map((card) => (
              <article key={card.label} className={styles.statCard}>
                <span className={styles.statLabel}>{card.label}</span>
                <strong className={styles.statValue}>{card.value}</strong>
                <span className={styles.statHelper}>{card.helper}</span>
              </article>
            ))}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Recent watch videos</p>
                <h2 className={styles.sectionTitle}>Resume where you left off</h2>
              </div>
              <span className={styles.sectionHint}>
                {progressSource === 'backend'
                  ? 'Keeps your recent study activity ready to resume.'
                  : 'Your recent study activity is still available on this device.'}
              </span>
            </div>

            {recentWatchItems.length > 0 ? (
              <div className={styles.cardList}>
                {recentWatchItems.map((entry) => {
                  const video = entry.video
                  const creatorSlug = getCreatorProfileSlug(video)
                  const accessMetadata = getAccessMetadata(video)

                  return (
                    <article key={entry.videoId} className={styles.historyCard}>
                      <Thumbnail video={video} />

                      <div className={styles.cardBody}>
                        <div className={styles.cardHeader}>
                          <div className={styles.cardLabels}>
                            <Badge variant="primary" size="sm">
                              {getProgressLabel(entry.percent)}
                            </Badge>
                            <Badge
                              variant={accessMetadata.tierLevel > 0 ? 'warning' : 'default'}
                              size="sm"
                            >
                              {accessMetadata.badgeLabel}
                            </Badge>
                          </div>
                          <span className={styles.timestamp}>
                            Last watched {formatRelativeTime(entry.lastUpdated)}
                          </span>
                        </div>

                        <Link to={`/watch/${video.id}`} className={styles.cardTitle}>
                          {truncate(video.title, 88)}
                        </Link>

                        <div className={styles.metaRow}>
                          {creatorSlug ? (
                            <Link
                              to={`/profile/${encodeURIComponent(creatorSlug)}`}
                              className={styles.creatorLink}
                            >
                              {getCreatorName(video)}
                            </Link>
                          ) : (
                            <span>{getCreatorName(video)}</span>
                          )}
                          <span>{getCategoryLabel(video)}</span>
                          <span>{formatViewCount(video.views)} views</span>
                          <span>{formatRatingSummary(video.average_rating, video.rating_count)}</span>
                        </div>

                        <div className={styles.progressRow}>
                          <div
                            className={styles.progressTrack}
                            role="progressbar"
                            aria-label={`Lesson progress for ${video.title}`}
                            aria-valuemin="0"
                            aria-valuemax="100"
                            aria-valuenow={Math.round(entry.percent || 0)}
                          >
                            <span
                              className={styles.progressFill}
                              style={{
                                width: `${Math.max(
                                  entry.percent > 0 ? 8 : 0,
                                  Math.round(entry.percent || 0)
                                )}%`,
                              }}
                            />
                          </div>
                          <span className={styles.progressCopy}>
                            {Math.round(entry.percent || 0)}% watched
                          </span>
                        </div>

                        <p className={styles.cardNote}>
                          {entry.completed
                            ? 'This lesson reached the completion threshold and stays in your history for quick review.'
                            : `Watched ${formatWatchTime(entry.watchedSeconds || 0)} so far. Pick it back up anytime.`}
                        </p>

                        <div className={styles.cardActions}>
                          <Link to={`/watch/${video.id}`} className={styles.primaryLink}>
                            {entry.completed ? 'Review lesson' : 'Resume lesson'}
                          </Link>
                          <Link to={`/quiz/${video.id}`} className={styles.secondaryLink}>
                            Open quiz
                          </Link>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                title="No recent watch activity yet"
                text="As soon as you start a lesson, it will appear here with progress and resume links."
                actionLabel="Explore lessons"
                actionTo="/"
              />
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Rated videos</p>
                <h2 className={styles.sectionTitle}>Lessons you scored</h2>
              </div>
              <span className={styles.sectionHint}>
                Your saved lesson ratings.
              </span>
            </div>

            {ratingsError ? (
              <ErrorMessage
                message={ratingsError}
                onRetry={loadRatings}
                className={styles.inlineError}
              />
            ) : ratedLessons.length > 0 ? (
              <div className={styles.cardGrid}>
                {ratedLessons.map((entry) => {
                  const video = entry.video
                  const accessMetadata = getAccessMetadata(video)

                  return (
                    <article key={entry.id} className={styles.compactCard}>
                      <div className={styles.compactHeader}>
                        <Badge variant="info" size="sm">
                          Rated lesson
                        </Badge>
                        <Badge
                          variant={accessMetadata.tierLevel > 0 ? 'warning' : 'default'}
                          size="sm"
                        >
                          {accessMetadata.badgeLabel}
                        </Badge>
                      </div>

                      <Link to={`/watch/${video.id}`} className={styles.compactTitle}>
                        {truncate(video.title, 72)}
                      </Link>

                      <div
                        className={styles.starRow}
                        aria-label={`You rated this lesson ${entry.rating} out of 5 stars`}
                      >
                        {renderStars(entry.rating)}
                        <span className={styles.ratingCopy}>You rated this {entry.rating}/5</span>
                      </div>

                      <div className={styles.metaRow}>
                        <span>{getCreatorName(video)}</span>
                        <span>{formatRatingSummary(video.average_rating, video.rating_count)}</span>
                        {video.created_at ? <span>{formatNumericDate(video.created_at)}</span> : null}
                      </div>

                      <p className={styles.cardNote}>
                        This card reflects your current saved rating, alongside the lesson's
                        overall average from the platform.
                      </p>

                      <div className={styles.cardActions}>
                        <Link to={`/watch/${video.id}`} className={styles.primaryLink}>
                          Open lesson
                        </Link>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                title="No rated lessons yet"
                text="Rate a lesson from the watch page and it will show up here as part of your learning activity."
                actionLabel="Browse lessons"
                actionTo="/"
              />
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Added to learning path</p>
                <h2 className={styles.sectionTitle}>Lessons you saved for later</h2>
              </div>
              <span className={styles.sectionHint}>
                {playlistsSource === 'backend'
                  ? 'Pulled from your saved learning paths.'
                  : 'Showing the learning paths saved on this device.'}
              </span>
            </div>

            {playlistsError ? (
              <ErrorMessage
                message={playlistsError}
                className={styles.inlineError}
              />
            ) : learningPathItems.length > 0 ? (
              <div className={styles.cardGrid}>
                {learningPathItems.map((entry) => {
                  const video = entry.video
                  const primaryPlaylist = entry.playlists[0] || null

                  return (
                    <article key={entry.videoId} className={styles.compactCard}>
                      <div className={styles.compactHeader}>
                        <Badge variant="success" size="sm">
                          Saved lesson
                        </Badge>
                        <span className={styles.timestamp}>
                          Added {formatRelativeTime(entry.addedAt)}
                        </span>
                      </div>

                      <Link to={`/watch/${video.id}`} className={styles.compactTitle}>
                        {truncate(video.title, 72)}
                      </Link>

                      <div className={styles.metaRow}>
                        <span>{getCreatorName(video)}</span>
                        <span>{getCategoryLabel(video)}</span>
                        <span>{formatViewCount(video.views)} views</span>
                      </div>

                      <div className={styles.pathList}>
                        {entry.playlists.slice(0, 3).map((playlist) => (
                          <Link
                            key={playlist.id}
                            to={`/playlist/${playlist.id}`}
                            className={styles.pathPill}
                          >
                            {playlist.title}
                          </Link>
                        ))}
                        {entry.playlists.length > 3 ? (
                          <span className={styles.pathOverflow}>
                            +{entry.playlists.length - 3} more
                          </span>
                        ) : null}
                      </div>

                      <p className={styles.cardNote}>
                        {entry.playlists.length === 1
                          ? 'This lesson is saved into one learning path for easy review.'
                          : `This lesson appears in ${entry.playlists.length} learning paths.`}
                      </p>

                      <div className={styles.cardActions}>
                        <Link to={`/watch/${video.id}`} className={styles.secondaryLink}>
                          Open lesson
                        </Link>
                        {primaryPlaylist ? (
                          <Link
                            to={`/playlist/${primaryPlaylist.id}`}
                            className={styles.primaryLink}
                          >
                            Open learning path
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                title="Nothing saved to a learning path yet"
                text="Use the watch page to save lessons into a learning path and they will appear here with quick links back into the path."
                actionLabel="Open learning paths"
                actionTo="/my-playlists"
              />
            )}
          </section>
        </>
      )}
    </div>
  )
}
