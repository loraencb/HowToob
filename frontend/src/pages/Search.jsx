import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorMessage from '../components/common/ErrorMessage'
import { useProgress } from '../context/ProgressContext'
import useLocalPreferences from '../hooks/useLocalPreferences'
import { CATEGORIES } from '../utils/constants'
import { videosAPI } from '../utils/api'
import {
  getAccessMetadata,
  getCategoryLabel,
  getCreatorName,
  getCreatorProfileSlug,
} from '../utils/lessonMetadata'
import {
  formatNumericDate,
  formatViewCount,
  getProgressLabel,
  truncate,
} from '../utils/formatters'
import styles from './Search.module.css'

const LEVEL_OPTIONS = [
  { value: 'all', label: 'All levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

function normalizeFeedResponse(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.videos)) return data.videos
  if (Array.isArray(data?.items)) return data.items
  return []
}

function normalizeVideo(video) {
  return {
    ...video,
    id: Number(video.id),
    title: video.title || 'Untitled lesson',
    description: video.description || '',
    thumbnail_url: video.thumbnail_url || video.thumbnail || '',
    created_at: video.created_at || null,
    views: video.views || 0,
    category: video.category || video.subject || video.topic || '',
    creator_id: video.creator_id ?? video.creator?.id ?? null,
    creator_name: getCreatorName(video),
  }
}

function getCategoryOption(video) {
  const rawCategory = (video.category || '').toLowerCase().trim()
  const matched = CATEGORIES.find(
    (option) =>
      rawCategory === option.value ||
      rawCategory.includes(option.value) ||
      rawCategory.includes(option.label.toLowerCase())
  )

  return matched || null
}

function inferLearningLevel(video) {
  const haystack = `${video.title} ${video.description} ${video.category}`.toLowerCase()

  if (
    /(advanced|expert|deep dive|internals|optimization|architecture|production|masterclass)/.test(
      haystack
    )
  ) {
    return 'advanced'
  }

  if (/(intermediate|project|workflow|series|real-world|build)/.test(haystack)) {
    return 'intermediate'
  }

  return 'beginner'
}

function getCreatorKey(video) {
  if (video.creator_id) {
    return `id:${video.creator_id}`
  }

  return `name:${video.creator_name.toLowerCase()}`
}

function matchesCategory(video, selectedCategory) {
  if (selectedCategory === 'all') return true

  const categoryOption = getCategoryOption(video)
  if (categoryOption) {
    return categoryOption.value === selectedCategory
  }

  return (video.category || '').toLowerCase().includes(selectedCategory)
}

export default function Search() {
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') || '').trim()
  const { progress } = useProgress()
  const [preferences] = useLocalPreferences()

  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  const [creatorFilter, setCreatorFilter] = useState('all')

  useEffect(() => {
    let active = true

    async function loadResults() {
      setLoading(true)
      setError('')

      try {
        const data = await videosAPI.getFeed(1, 24, query || null)
        if (!active) return
        setVideos(normalizeFeedResponse(data).map(normalizeVideo))
      } catch (requestError) {
        if (!active) return
        setVideos([])
        setError(requestError.message || 'Search failed.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadResults()

    return () => {
      active = false
    }
  }, [query])

  const creatorOptions = useMemo(() => {
    const seen = new Set()

    return videos
      .map((video) => ({
        value: getCreatorKey(video),
        label: video.creator_name,
      }))
      .filter((option) => {
        if (!option.label || seen.has(option.value)) {
          return false
        }

        seen.add(option.value)
        return true
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [videos])

  useEffect(() => {
    if (
      creatorFilter !== 'all' &&
      !creatorOptions.some((option) => option.value === creatorFilter)
    ) {
      setCreatorFilter('all')
    }
  }, [creatorFilter, creatorOptions])

  const filteredVideos = useMemo(
    () =>
      videos.filter((video) => {
        const matchesLevel =
          levelFilter === 'all' || inferLearningLevel(video) === levelFilter
        const matchesCreator =
          creatorFilter === 'all' || getCreatorKey(video) === creatorFilter

        return matchesCategory(video, categoryFilter) && matchesLevel && matchesCreator
      }),
    [categoryFilter, creatorFilter, levelFilter, videos]
  )

  const activeFilterCount =
    Number(categoryFilter !== 'all') +
    Number(levelFilter !== 'all') +
    Number(creatorFilter !== 'all')

  const isDiscoveryMode = !query

  function clearFilters() {
    setCategoryFilter('all')
    setLevelFilter('all')
    setCreatorFilter('all')
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            {isDiscoveryMode ? 'Discovery library' : 'Search results'}
          </p>
          <h1 className={styles.heading}>
            {isDiscoveryMode ? (
              'Browse structured lessons'
            ) : (
              <>
                Results for <span className={styles.queryText}>"{query}"</span>
              </>
            )}
          </h1>
          <p className={styles.subtitle}>
            {isDiscoveryMode
              ? 'Explore the current backend feed, then narrow it with frontend learning filters for category, level, and creator.'
              : 'Keyword matching comes from the backend search query. Category, creator, and learning level are layered transparently in the frontend.'}
          </p>
        </div>

        <div className={styles.heroMeta}>
          <article className={styles.metaCard}>
            <span className={styles.metaLabel}>Backend source</span>
            <strong className={styles.metaValue}>
              {isDiscoveryMode ? '/videos/feed' : '/videos/feed?search='}
            </strong>
          </article>
          <article className={styles.metaCard}>
            <span className={styles.metaLabel}>Frontend filters</span>
            <strong className={styles.metaValue}>
              {activeFilterCount > 0 ? `${activeFilterCount} active` : 'Ready'}
            </strong>
          </article>
        </div>
      </section>

      <section className={styles.filtersPanel} aria-label="Search filters">
        <div className={styles.filtersHeader}>
          <div>
            <h2 className={styles.filtersTitle}>Refine the lesson list</h2>
            <p className={styles.filtersText}>
              Category and creator filters use the videos already returned from the
              backend. Learning level is a frontend-only MVP label in this build.
            </p>
          </div>
          {activeFilterCount > 0 ? (
            <button type="button" className={styles.clearButton} onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>

        <div className={styles.filterGrid}>
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Category</span>
            <select
              className={styles.select}
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Learning level</span>
            <select
              className={styles.select}
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value)}
            >
              {LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Creator</span>
            <select
              className={styles.select}
              value={creatorFilter}
              onChange={(event) => setCreatorFilter(event.target.value)}
            >
              <option value="all">All creators</option>
              {creatorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <div className={styles.spinnerWrapper}>
          <LoadingSpinner
            size="lg"
            label={isDiscoveryMode ? 'Loading discovery feed...' : 'Searching lessons...'}
          />
        </div>
      ) : null}

      {error ? <ErrorMessage message={error} /> : null}

      {!loading && !error ? (
        <>
          <section className={styles.summaryBar} aria-live="polite">
            <div>
              <h2 className={styles.summaryTitle}>
                {isDiscoveryMode ? 'Discovery picks' : 'Matching lessons'}
              </h2>
              <p className={styles.summaryText}>
                Showing {filteredVideos.length} lesson{filteredVideos.length === 1 ? '' : 's'}
                {activeFilterCount > 0
                  ? ` from ${videos.length} backend result${videos.length === 1 ? '' : 's'}`
                  : ''}
                .
              </p>
            </div>
            <span className={styles.summaryBadge}>
              {isDiscoveryMode ? 'Browse mode' : 'Search mode'}
            </span>
          </section>

          {filteredVideos.length === 0 ? (
            <section className={styles.emptyState}>
              <h2 className={styles.emptyTitle}>No lessons match these filters</h2>
              <p className={styles.emptyText}>
                {videos.length === 0
                  ? isDiscoveryMode
                    ? 'The backend feed has not returned any lessons yet, so discovery shelves are still empty.'
                    : `The backend did not return search matches for "${query}".`
                  : 'Try broadening the category, level, or creator filters to reopen the current result set.'}
              </p>
              <div className={styles.emptyActions}>
                {activeFilterCount > 0 ? (
                  <button type="button" className={styles.primaryButton} onClick={clearFilters}>
                    Reset filters
                  </button>
                ) : null}
                <Link to="/" className={styles.secondaryButton}>
                  Go to home feed
                </Link>
              </div>
            </section>
          ) : (
            <div
              className={`${styles.resultsGrid} ${
                preferences.compactCardLayout ? styles.resultsGridCompact : ''
              }`}
            >
              {filteredVideos.map((video) => {
                const progressEntry = progress[String(video.id)]
                const categoryOption = getCategoryOption(video)
                const level = inferLearningLevel(video)
                const accessMetadata = getAccessMetadata(video)
                const profileSlug = getCreatorProfileSlug(video)

                return (
                  <article key={video.id} className={styles.resultCard}>
                    <Link
                      to={`/watch/${video.id}`}
                      className={styles.thumb}
                      aria-label={`Open lesson: ${video.title}`}
                    >
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={`Thumbnail for ${video.title}`}
                          className={styles.thumbImage}
                        />
                      ) : (
                        <div className={styles.thumbPlaceholder} aria-hidden="true">
                          <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="7 5 19 12 7 19 7 5" />
                          </svg>
                        </div>
                      )}

                      <div className={styles.badgeRow}>
                        <span className={styles.resultBadge}>
                          {categoryOption?.label || getCategoryLabel(video)}
                        </span>
                        <span className={styles.resultBadge}>{level}</span>
                        <span className={styles.resultBadge}>{accessMetadata.badgeLabel}</span>
                        {preferences.showProgressBadges && progressEntry ? (
                          <span className={`${styles.resultBadge} ${styles.progressBadge}`}>
                            {getProgressLabel(progressEntry.percent)}
                          </span>
                        ) : null}
                      </div>
                    </Link>

                    <div className={styles.info}>
                      <div className={styles.titleBlock}>
                        <Link to={`/watch/${video.id}`} className={styles.title}>
                          {truncate(video.title, 90)}
                        </Link>
                        {profileSlug ? (
                          <Link
                            to={`/profile/${encodeURIComponent(profileSlug)}`}
                            className={styles.creatorLink}
                          >
                            {video.creator_name}
                          </Link>
                        ) : (
                          <span className={styles.creatorLink}>{video.creator_name}</span>
                        )}
                      </div>

                      <p className={styles.meta}>
                        {formatViewCount(video.views)} views | {formatNumericDate(video.created_at)}
                      </p>

                      <p className={styles.desc}>
                        {video.description
                          ? truncate(
                              video.description,
                              preferences.compactCardLayout ? 90 : 150
                            )
                          : 'No lesson description was provided for this video yet.'}
                      </p>

                      <p className={styles.footerNote}>{accessMetadata.note}</p>

                      <div className={styles.cardFooter}>
                        <span className={styles.footerNote}>
                          {isDiscoveryMode
                            ? 'Browse result from the live backend feed'
                            : 'Keyword match from backend, refined in the frontend'}
                        </span>
                        <Link to={`/watch/${video.id}`} className={styles.inlineAction}>
                          Open lesson
                        </Link>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
