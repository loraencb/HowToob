import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ErrorMessage from '../components/common/ErrorMessage'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { useProgress } from '../context/ProgressContext'
import { usePlaylists } from '../context/PlaylistContext'
import { videosAPI } from '../utils/api'
import {
  formatNumericDate,
  formatRelativeTime,
  formatViewCount,
  truncate,
} from '../utils/formatters'
import styles from './Playlist.module.css'

function normalizeVideoResponse(data) {
  const raw = data?.video ?? data?.data ?? data ?? null
  if (!raw) return null

  return {
    ...raw,
    id: Number(raw.id),
    title: raw.title || 'Untitled lesson',
    description: raw.description || '',
    thumbnail_url: raw.thumbnail_url || raw.thumbnail || '',
    views: raw.views || 0,
    created_at: raw.created_at || null,
    creator_id: raw.creator_id ?? null,
    author_name:
      raw.author_name ||
      raw.creator_name ||
      raw.creator?.username ||
      (raw.creator_id ? `Creator #${raw.creator_id}` : 'HowToob creator'),
  }
}

export default function Playlist() {
  const navigate = useNavigate()
  const { playlistId } = useParams()
  const { getPlaylistProgress, getVideoProgress, markPlaylistCompleted } = useProgress()
  const {
    getPlaylistById,
    getPlaylistDetail,
    removeVideoFromPlaylist,
    deletePlaylist,
    loading: playlistsLoading,
    source: playlistsSource,
  } = usePlaylists()

  const playlist = useMemo(
    () => getPlaylistById(playlistId),
    [getPlaylistById, playlistId]
  )

  const [lessonDetails, setLessonDetails] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removingVideoId, setRemovingVideoId] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    let active = true

    async function ensurePlaylistDetail() {
      if (!playlistId) return

      try {
        await getPlaylistDetail(playlistId)
      } catch (requestError) {
        if (active) {
          setError(requestError.message || 'Could not load this learning path.')
        }
      }
    }

    ensurePlaylistDetail()

    return () => {
      active = false
    }
  }, [getPlaylistDetail, playlistId])

  useEffect(() => {
    let active = true

    async function hydratePlaylist() {
      if (!playlist) {
        setLoading(false)
        setLessonDetails(new Map())
        return
      }

      if (playlist.items.length === 0) {
        setLoading(false)
        setLessonDetails(new Map())
        return
      }

      setLoading(true)
      setError('')

      try {
        const results = await Promise.allSettled(
          playlist.items.map((item) => videosAPI.getById(item.videoId))
        )

        if (!active) return

        const nextMap = new Map()

        results.forEach((result, index) => {
          const fallback = playlist.items[index]
          const normalized =
            result.status === 'fulfilled'
              ? normalizeVideoResponse(result.value)
              : {
                  id: fallback.videoId,
                  title: fallback.title,
                  description: fallback.description,
                  thumbnail_url: fallback.thumbnail_url,
                  creator_id: fallback.creator_id,
                  author_name:
                    fallback.author_name ||
                    (fallback.creator_id ? `Creator #${fallback.creator_id}` : 'HowToob creator'),
                  created_at: fallback.created_at,
                  views: fallback.views,
                }

          if (normalized) {
            nextMap.set(Number(normalized.id), normalized)
          }
        })

        setLessonDetails(nextMap)
      } catch (requestError) {
        if (!active) return
        setError(requestError.message || 'Could not load this learning path.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    hydratePlaylist()

    return () => {
      active = false
    }
  }, [playlist])

  const orderedLessons = useMemo(() => {
    if (!playlist) return []

    return playlist.items.map((item, index) => {
      const hydrated = lessonDetails.get(item.videoId)
      const lesson = hydrated || {
        id: item.videoId,
        title: item.title,
        description: item.description,
        thumbnail_url: item.thumbnail_url,
        creator_id: item.creator_id,
        author_name:
          item.author_name || (item.creator_id ? `Creator #${item.creator_id}` : 'HowToob creator'),
        created_at: item.created_at,
        views: item.views,
      }

      const progress = getVideoProgress(item.videoId)

      return {
        index,
        item,
        lesson,
        progress,
      }
    })
  }, [getVideoProgress, lessonDetails, playlist])

  const progressSummary = useMemo(
    () => getPlaylistProgress(orderedLessons.map((entry) => entry.lesson.id)),
    [getPlaylistProgress, orderedLessons]
  )

  useEffect(() => {
    if (!playlist || orderedLessons.length === 0 || progressSummary.percent < 100) return
    markPlaylistCompleted(playlist.id, playlist.title)
  }, [markPlaylistCompleted, orderedLessons.length, playlist, progressSummary.percent])

  const nextLesson =
    orderedLessons.find((entry) => entry.progress.percent > 0 && !entry.progress.completed) ||
    orderedLessons.find((entry) => !entry.progress.completed) ||
    orderedLessons[0] ||
    null

  async function handleRemoveLesson(videoId) {
    setRemovingVideoId(videoId)

    try {
      await removeVideoFromPlaylist(playlistId, videoId)
    } catch (requestError) {
      setError(requestError.message || 'Could not remove this lesson from the path.')
    } finally {
      setRemovingVideoId(null)
    }
  }

  async function handleDeletePlaylist() {
    if (!playlist || playlist.isDefault) return

    setDeleteLoading(true)

    try {
      const deleted = await deletePlaylist(playlist.id)
      if (deleted) {
        navigate('/my-playlists')
      }
    } catch (requestError) {
      setError(requestError.message || 'Could not delete this learning path.')
    } finally {
      setDeleteLoading(false)
    }
  }

  if (!playlist && playlistsLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <LoadingSpinner size="lg" label="Loading playlist..." />
        </div>
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className={styles.page}>
        <article className={styles.emptyState}>
          <h1 className={styles.emptyTitle}>Learning path not found</h1>
          <p className={styles.emptyText}>
            This playlist may have been removed locally, or it was never saved in this browser.
          </p>
          <Link to="/my-playlists" className={styles.primaryButton}>
            Back to playlists
          </Link>
        </article>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Learning path detail</p>
          <h1 className={styles.title}>{playlist.title}</h1>
          <p className={styles.subtitle}>
            {playlist.description ||
              (playlistsSource === 'backend'
                ? 'A backend learning path that keeps lessons in sequence for structured study.'
                : 'A local fallback learning path that keeps lessons in sequence in this browser.')}
          </p>
        </div>

        <div className={styles.heroActions}>
          {nextLesson ? (
            <Link
              to={`/watch/${nextLesson.lesson.id}?playlist=${playlist.id}`}
              className={styles.primaryButton}
            >
              {nextLesson.progress.percent > 0 && !nextLesson.progress.completed
                ? 'Continue playlist'
                : 'Play playlist'}
            </Link>
          ) : null}
          <Link to="/my-playlists" className={styles.secondaryButton}>
            Back to playlists
          </Link>
        </div>
      </section>

      {loading ? (
        <div className={styles.loadingWrap}>
          <LoadingSpinner size="lg" label="Loading playlist..." />
        </div>
      ) : (
        <>
          {error ? <ErrorMessage message={error} className={styles.inlineError} /> : null}

          <section className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Lessons</span>
              <strong className={styles.summaryValue}>{orderedLessons.length}</strong>
              <span className={styles.summaryText}>
                {playlistsSource === 'backend'
                  ? 'Ordered in your backend learning path.'
                  : 'Ordered in the local fallback path saved in this browser.'}
              </span>
            </article>

            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Completed</span>
              <strong className={styles.summaryValue}>
                {progressSummary.completed}/{progressSummary.total}
              </strong>
              <span className={styles.summaryText}>Driven by saved watch progress.</span>
            </article>

            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Progress</span>
              <strong className={styles.summaryValue}>{progressSummary.percent}%</strong>
              <span className={styles.summaryText}>
                Updated {formatRelativeTime(playlist.updatedAt)}
              </span>
            </article>
          </section>

          <section className={styles.layout}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Sequential lessons</p>
                  <h2 className={styles.panelTitle}>Course outline</h2>
                </div>
              </div>

              {orderedLessons.length > 0 ? (
                <div className={styles.lessonList}>
                  {orderedLessons.map(({ item, index, lesson, progress }) => (
                    <article key={lesson.id} className={styles.lessonCard}>
                      <div className={styles.lessonIndex}>{index + 1}</div>

                      <Link
                        to={`/watch/${lesson.id}?playlist=${playlist.id}`}
                        className={styles.thumbnailLink}
                      >
                        {lesson.thumbnail_url ? (
                          <img
                            src={lesson.thumbnail_url}
                            alt={`Thumbnail for ${lesson.title}`}
                            className={styles.thumbnail}
                          />
                        ) : (
                          <div className={styles.thumbnailPlaceholder} aria-hidden="true">
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="7 5 19 12 7 19 7 5" />
                            </svg>
                          </div>
                        )}
                      </Link>

                      <div className={styles.lessonBody}>
                        <div className={styles.lessonHeader}>
                          <div>
                            <Link
                              to={`/watch/${lesson.id}?playlist=${playlist.id}`}
                              className={styles.lessonTitle}
                            >
                              {truncate(lesson.title, 80)}
                            </Link>
                            <p className={styles.lessonMeta}>
                              {lesson.author_name} - {formatViewCount(lesson.views || 0)} views
                              {lesson.created_at ? ` - ${formatNumericDate(lesson.created_at)}` : ''}
                            </p>
                          </div>
                          <span className={styles.statusBadge}>
                            {progress.completed
                              ? 'Completed'
                              : progress.percent > 0
                                ? `${Math.round(progress.percent)}% watched`
                                : 'Not started'}
                          </span>
                        </div>

                        <p className={styles.lessonDescription}>
                          {lesson.description || 'No lesson description available yet.'}
                        </p>

                        <div className={styles.progressTrack} aria-hidden="true">
                          <span
                            className={styles.progressFill}
                            style={{ width: `${Math.round(progress.percent || 0)}%` }}
                          />
                        </div>

                        <div className={styles.lessonActions}>
                          <Link
                            to={`/watch/${lesson.id}?playlist=${playlist.id}`}
                            className={styles.inlineButton}
                          >
                            {progress.percent > 0 && !progress.completed ? 'Resume lesson' : 'Open lesson'}
                          </Link>
                          <button
                            type="button"
                            className={styles.dangerButton}
                            onClick={() => handleRemoveLesson(item.videoId)}
                            disabled={removingVideoId === item.videoId}
                          >
                            {removingVideoId === item.videoId ? 'Removing...' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <h3 className={styles.emptyTitle}>This playlist has no lessons yet</h3>
                  <p className={styles.emptyText}>
                    Save lessons from the watch page to turn this into a sequential course.
                  </p>
                  <Link to="/" className={styles.primaryButton}>
                    Explore lessons
                  </Link>
                </div>
              )}
            </article>

            <aside className={styles.sideColumn}>
              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Playback behavior</p>
                    <h2 className={styles.panelTitle}>What is backend-driven?</h2>
                  </div>
                </div>

                <div className={styles.infoList}>
                  <div className={styles.infoItem}>
                    <strong className={styles.infoLabel}>Backend lessons</strong>
                    <p className={styles.infoText}>
                      Video metadata and playback come from the existing video endpoints.
                    </p>
                  </div>
                  <div className={styles.infoItem}>
                    <strong className={styles.infoLabel}>Learning-path storage</strong>
                    <p className={styles.infoText}>
                      {playlistsSource === 'backend'
                        ? 'Playlist membership, course order, and sequential playback now come from the backend playlist system.'
                        : 'Playlist membership and order are using local fallback data because backend playlist loading is unavailable.'}
                    </p>
                  </div>
                  <div className={styles.infoItem}>
                    <strong className={styles.infoLabel}>Progress state</strong>
                    <p className={styles.infoText}>
                      Completion state prefers backend watch progress and falls back locally only when sync is unavailable.
                    </p>
                  </div>
                </div>
              </article>

              {!playlist.isDefault ? (
                <article className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <div>
                      <p className={styles.panelEyebrow}>Manage</p>
                      <h2 className={styles.panelTitle}>Delete this path</h2>
                    </div>
                  </div>

                  <p className={styles.infoText}>
                    Removing a custom playlist deletes only the learning path structure.
                    It does not affect the underlying lessons.
                  </p>

                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={handleDeletePlaylist}
                    disabled={deleteLoading}
                    aria-label={`Delete learning path ${playlist.title}`}
                  >
                    {deleteLoading ? 'Deleting...' : 'Delete playlist'}
                  </button>
                </article>
              ) : null}
            </aside>
          </section>
        </>
      )}
    </div>
  )
}
