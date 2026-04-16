import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { useProgress } from '../context/ProgressContext'
import { usePlaylists } from '../context/PlaylistContext'
import { videosAPI } from '../utils/api'
import { formatRelativeTime, truncate } from '../utils/formatters'
import styles from './MyPlaylists.module.css'

function normalizeFeedResponse(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.videos)) return data.videos
  if (Array.isArray(data?.items)) return data.items
  return []
}

export default function MyPlaylists() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { getPlaylistProgress } = useProgress()
  const {
    playlists,
    loading: playlistsLoading,
    error: playlistsError,
    source: playlistsSource,
    createPlaylist,
  } = usePlaylists()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [suggestionsError, setSuggestionsError] = useState('')

  useEffect(() => {
    let active = true

    async function loadSuggestions() {
      setSuggestionsLoading(true)
      setSuggestionsError('')

      try {
        const data = await videosAPI.getFeed(1, 6)
        if (!active) return
        setSuggestions(normalizeFeedResponse(data))
      } catch (error) {
        if (!active) return
        setSuggestions([])
        setSuggestionsError(error.message || 'Could not load lesson suggestions.')
      } finally {
        if (active) {
          setSuggestionsLoading(false)
        }
      }
    }

    loadSuggestions()

    return () => {
      active = false
    }
  }, [])

  const playlistCards = useMemo(
    () =>
      playlists.map((playlist) => {
        const videoIds = playlist.items.map((item) => item.videoId)
        const progress = getPlaylistProgress(videoIds)

        return {
          ...playlist,
          lessonCount: playlist.items.length,
          progress,
        }
      }),
    [getPlaylistProgress, playlists]
  )
  const hasMeaningfulPlaylists = useMemo(
    () => playlistCards.some((playlist) => !playlist.isDefault || playlist.lessonCount > 0),
    [playlistCards]
  )

  async function handleCreatePlaylist(event) {
    event.preventDefault()
    const nextTitle = title.trim()

    if (nextTitle.length < 3) {
      setFormError('Give your learning path a title with at least 3 characters.')
      return
    }

    setSubmitting(true)
    setFormError('')

    try {
      const created = await createPlaylist({
        title: nextTitle,
        description,
      })

      setTitle('')
      setDescription('')
      navigate(`/playlist/${created.id}`)
    } catch (requestError) {
      setFormError(requestError.message || 'Could not create this learning path.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Learning paths</p>
          <h1 className={styles.title}>
            {user?.username ? `${user.username}'s playlists` : 'My playlists'}
          </h1>
          <p className={styles.subtitle}>
            Build structured lesson sequences, pick up where you left off, and keep
            the order of your course plan under your control.
          </p>
        </div>

        <div className={styles.heroNote}>
          <span className={styles.localBadge}>
            {playlistsSource === 'backend' ? 'Backend sync' : 'Local fallback'}
          </span>
          <p className={styles.noteText}>
            {playlistsSource === 'backend'
              ? 'Learning paths now use backend playlist storage and ordering.'
              : 'Backend playlists are unavailable right now, so this page is using local fallback data from this browser.'}
          </p>
        </div>
      </section>

      <section className={styles.layout}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Create a path</p>
              <h2 className={styles.panelTitle}>Start a structured course</h2>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleCreatePlaylist}>
            <label className={styles.field}>
              <span className={styles.label}>Learning path title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Frontend interview prep"
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>What is this path for?</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Outline the skill goal, study rhythm, or creator mix for this path."
                rows={4}
                className={styles.textarea}
              />
            </label>

            {formError ? <p className={styles.formError}>{formError}</p> : null}

            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryButton} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create learning path'}
              </button>
              <Link to="/" className={styles.secondaryButton}>
                Browse lessons
              </Link>
            </div>
          </form>
        </article>

        <aside className={styles.sideColumn}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelEyebrow}>How it works</p>
                <h2 className={styles.panelTitle}>Sequential by design</h2>
              </div>
            </div>

            <div className={styles.tipList}>
              <div className={styles.tipItem}>
                <strong className={styles.tipLabel}>1. Save lessons</strong>
                <p className={styles.tipText}>
                  The watch page can save lessons directly into your default learning
                  path for later using the current playlist backend.
                </p>
              </div>
              <div className={styles.tipItem}>
                <strong className={styles.tipLabel}>2. Open the playlist</strong>
                <p className={styles.tipText}>
                  Each path preserves lesson order so it behaves like a lightweight course.
                </p>
              </div>
              <div className={styles.tipItem}>
                <strong className={styles.tipLabel}>3. Play in sequence</strong>
                <p className={styles.tipText}>
                  The watch page uses playlist context to show the next lesson instead
                  of dropping you back into a generic feed.
                </p>
              </div>
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelEyebrow}>Suggested lessons</p>
                <h2 className={styles.panelTitle}>Use the live backend feed</h2>
              </div>
            </div>

            {suggestionsLoading ? (
              <div className={styles.loadingWrap}>
                <LoadingSpinner size="md" label="Loading lessons..." />
              </div>
            ) : suggestions.length > 0 ? (
              <div className={styles.suggestionList}>
                {suggestions.slice(0, 4).map((video) => (
                  <article key={video.id} className={styles.suggestionCard}>
                    <div>
                      <Link to={`/watch/${video.id}`} className={styles.suggestionTitle}>
                        {truncate(video.title, 60)}
                      </Link>
                      <p className={styles.suggestionMeta}>
                        Open from the backend feed, then save it into a path from the watch page.
                      </p>
                    </div>
                    <Link to={`/watch/${video.id}`} className={styles.inlineLink}>
                      Open lesson
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyCard}>
                <h3 className={styles.emptyTitle}>Suggestions are waiting on feed data</h3>
                <p className={styles.emptyText}>
                  {suggestionsError ||
                    'Once `/videos/feed` returns lessons, this panel becomes a quick way to start a path from live content.'}
                </p>
              </div>
            )}
          </article>
        </aside>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.panelEyebrow}>Your paths</p>
            <h2 className={styles.sectionTitle}>Structured playlists</h2>
          </div>
        </div>

        {playlistsError ? <p className={styles.formError}>{playlistsError}</p> : null}

        {playlistsLoading ? (
          <div className={styles.loadingWrap}>
            <LoadingSpinner size="md" label="Loading learning paths..." />
          </div>
        ) : null}

        {!playlistsLoading && hasMeaningfulPlaylists ? (
          <div className={styles.playlistGrid}>
            {playlistCards.map((playlist) => (
              <article key={playlist.id} className={styles.playlistCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardTopRow}>
                      <h3 className={styles.cardTitle}>{playlist.title}</h3>
                      {playlist.isDefault ? (
                        <span className={styles.defaultBadge}>Default</span>
                      ) : null}
                    </div>
                    <p className={styles.cardDescription}>
                      {playlist.description ||
                        'A lightweight course path you can keep refining locally.'}
                    </p>
                  </div>
                </div>

                <div className={styles.statRow}>
                  <div className={styles.statBlock}>
                    <span className={styles.statLabel}>Lessons</span>
                    <strong className={styles.statValue}>{playlist.lessonCount}</strong>
                  </div>
                  <div className={styles.statBlock}>
                    <span className={styles.statLabel}>Completed</span>
                    <strong className={styles.statValue}>
                      {playlist.progress.completed}/{playlist.progress.total}
                    </strong>
                  </div>
                  <div className={styles.statBlock}>
                    <span className={styles.statLabel}>Progress</span>
                    <strong className={styles.statValue}>{playlist.progress.percent}%</strong>
                  </div>
                </div>

                <div className={styles.progressTrack} aria-hidden="true">
                  <span
                    className={styles.progressFill}
                    style={{ width: `${playlist.progress.percent}%` }}
                  />
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.updatedText}>
                    Updated {formatRelativeTime(playlist.updatedAt)}
                  </span>
                  <Link to={`/playlist/${playlist.id}`} className={styles.secondaryButton}>
                    Open path
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : !playlistsLoading ? (
          <article className={styles.emptyCard}>
            <h3 className={styles.emptyTitle}>No learning paths yet</h3>
            <p className={styles.emptyText}>
              Create your first learning path or save lessons from the watch page to
              start building a structured course.
            </p>
          </article>
        ) : null}
      </section>
    </div>
  )
}
