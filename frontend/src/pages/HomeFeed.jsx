import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { videosAPI } from '../utils/api'
import {
  formatNumericDate,
  formatRatingSummary,
  formatViewCount,
  truncate,
} from '../utils/formatters'
import { PAGE_SIZE, PRIMARY_CATEGORIES } from '../utils/constants'
import { getCategoryMetadata, matchesCategoryFilter } from '../utils/categoryTaxonomy'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorMessage from '../components/common/ErrorMessage'
import VideoCard from '../components/common/VideoCard'
import SkillPathFilter from '../components/common/SkillPathFilter'
import styles from './Home.module.css'

function groupVideosByCategory(videosList) {
  const grouped = new Map(
    PRIMARY_CATEGORIES.map((category) => [
      category.value,
      {
        value: category.value,
        label: category.label,
        videos: [],
      },
    ])
  )

  videosList.forEach((video) => {
    const category = getCategoryMetadata(video.category)
    if (!category.primaryValue || !grouped.has(category.primaryValue)) {
      return
    }

    grouped.get(category.primaryValue).videos.push(video)
  })

  return PRIMARY_CATEGORIES.map((category) => grouped.get(category.value)).filter(
    (section) => section.videos.length > 0
  )
}

function cleanTitle(title) {
  if (!title) return ''
  return title.replace(/^[^:]+:\s*/, '')
}

function normalizeFeedResponse(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.videos)) return data.videos
  if (Array.isArray(data?.items)) return data.items
  return []
}

function getLessonBadgeLabel(video) {
  const category = getCategoryMetadata(video.category)

  if (category.label && category.primaryLabel && category.label !== category.primaryLabel) {
    return category.label
  }

  if (category.primaryLabel) {
    return category.primaryLabel
  }

  return 'Lesson'
}

function PlayOverlay() {
  return (
    <div className={styles.playOverlay} aria-hidden="true">
      <div className={styles.playButton}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="8 6 19 12 8 18 8 6" />
        </svg>
      </div>
    </div>
  )
}

function ThumbnailFallback({ primary = false }) {
  return (
    <div className={styles.bentoPlaceholder} aria-hidden="true">
      <svg
        width={primary ? 48 : 32}
        height={primary ? 48 : 32}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    </div>
  )
}

function BentoLessonCard({ video, primary = false }) {
  const ratingCount = video.rating_count ?? video.like_count ?? 0

  return (
    <article
      className={`${styles.bentoCard} ${primary ? styles.bentoPrimary : styles.bentoSecondary}`}
    >
      <div className={styles.bentoLabel}>{getLessonBadgeLabel(video)}</div>
      <Link to={`/watch/${video.id}`} className={styles.bentoLink}>
        <div className={styles.bentoThumbnail}>
          {video.thumbnail_url ? (
            <>
              <img src={video.thumbnail_url} alt={video.title} />
              <PlayOverlay />
            </>
          ) : (
            <ThumbnailFallback primary={primary} />
          )}
        </div>

        <div className={styles.bentoTitle}>
          {truncate(cleanTitle(video.title || 'Untitled lesson'), primary ? 80 : 60)}
        </div>

        <div className={styles.bentoMeta}>
          <span>{formatViewCount(video.views || 0)} views</span>
          <span className={styles.bentoDot}>|</span>
          <span>{formatRatingSummary(video.average_rating, ratingCount)}</span>
          {video.created_at ? (
            <>
              <span className={styles.bentoDot}>|</span>
              <span>{formatNumericDate(video.created_at)}</span>
            </>
          ) : null}
        </div>
      </Link>
    </article>
  )
}

export default function HomeFeed() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeCategory, setActiveCategory] = useState('')

  const fetchVideos = useCallback(async (pageNum = 1, reset = false) => {
    if (pageNum === 1) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    setError('')

    try {
      const data = await videosAPI.getFeed(pageNum, PAGE_SIZE)
      const items = normalizeFeedResponse(data)

      setVideos((prev) => {
        if (reset || pageNum === 1) {
          return items
        }

        const seen = new Set(prev.map((video) => video.id))
        const uniqueNew = items.filter((video) => !seen.has(video.id))
        return [...prev, ...uniqueNew]
      })

      setHasMore(items.length === PAGE_SIZE)
      setPage(pageNum)
    } catch (requestError) {
      setError(requestError.message || 'Failed to load videos.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchVideos(1, true)
  }, [fetchVideos])

  const activeCategoryMeta = useMemo(
    () => getCategoryMetadata(activeCategory),
    [activeCategory]
  )

  const filteredVideos = useMemo(() => {
    if (!activeCategory) return videos
    return videos.filter((video) => matchesCategoryFilter(video.category, activeCategory))
  }, [videos, activeCategory])

  const featuredVideos = useMemo(() => filteredVideos.slice(0, 5), [filteredVideos])
  const remainingVideos = useMemo(() => filteredVideos.slice(5), [filteredVideos])

  const categorySections = useMemo(() => {
    if (activeCategory) {
      return []
    }

    return groupVideosByCategory(remainingVideos)
  }, [activeCategory, remainingVideos])

  const homeHeading = activeCategory
    ? activeCategoryMeta.pathLabel || activeCategoryMeta.label || 'Selected learning path'
    : 'Structured learning feed'

  const homeDescription = activeCategory
    ? `Showing ${filteredVideos.length} lesson${
        filteredVideos.length === 1 ? '' : 's'
      } in this selected path. Creators assign these labels directly when they publish.`
    : 'Browse the lesson library through creator-assigned categories and curated learning shelves.'

  function handleLoadMore() {
    if (!loadingMore && hasMore) {
      fetchVideos(page + 1)
    }
  }

  return (
    <div className={styles.page}>
      <SkillPathFilter
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      <section aria-label="Video feed" className={styles.bentoSection}>
        {loading ? (
          <div className={styles.spinnerWrapper}>
            <LoadingSpinner size="lg" label="Loading videos..." />
          </div>
        ) : error ? (
          <ErrorMessage message={error} onRetry={() => fetchVideos(1, true)} />
        ) : filteredVideos.length === 0 ? (
          <section className={styles.emptyPanel}>
            <h1 className={styles.sectionTitle}>
              {activeCategory ? `No lessons in ${homeHeading} yet` : 'No lessons yet'}
            </h1>
            <p className={styles.emptyText}>
              {activeCategory
                ? 'Try another learning path or wait for a creator to publish the first lesson in this category.'
                : 'New lessons will appear here as creators publish them.'}
            </p>
          </section>
        ) : (
          <>
            <section className={styles.introCard}>
              <div>
                <p className={styles.introEyebrow}>
                  {activeCategory ? 'Filtered learning path' : 'Discovery feed'}
                </p>
                <h1 className={styles.sectionTitle}>{homeHeading}</h1>
                <p className={styles.introText}>{homeDescription}</p>
              </div>
              <div className={styles.introStats}>
                <span className={styles.introCount}>
                  {filteredVideos.length} lesson{filteredVideos.length === 1 ? '' : 's'}
                </span>
                <span className={styles.introNote}>
                  {activeCategory ? 'Showing only matching lessons' : 'Fresh lesson picks'}
                </span>
              </div>
            </section>

            <div className={styles.bentoGrid}>
              {featuredVideos.map((video, index) => (
                <BentoLessonCard
                  key={video.id}
                  video={video}
                  primary={index === 0}
                />
              ))}
            </div>

            {!activeCategory &&
              categorySections.map((section, sectionIdx) => {
                const alternateLayout = (sectionIdx + 1) % 2 !== 0
                const topVideo = section.videos[0]
                const otherVideos = section.videos.slice(1, 5)

                return (
                  <section key={section.value} className={styles.categorySectionContainer}>
                    <div className={styles.categoryHeader}>
                      <div>
                        <h2 className={styles.categoryTitle}>{section.label}</h2>
                        <p className={styles.categorySubtitle}>
                          {section.videos.length} lesson{section.videos.length === 1 ? '' : 's'} in
                          this path
                        </p>
                      </div>
                      <Link
                        to={`/search?category=${encodeURIComponent(section.value)}`}
                        className={styles.categoryViewAll}
                      >
                        View all
                      </Link>
                    </div>

                    <div
                      className={`${styles.bentoGrid} ${
                        alternateLayout ? styles.miniBentoGridReverse : styles.miniBentoGrid
                      }`}
                    >
                      <BentoLessonCard video={topVideo} primary={true} />
                      {otherVideos.map((video) => (
                        <BentoLessonCard key={video.id} video={video} />
                      ))}
                    </div>
                  </section>
                )
              })}

            {activeCategory && remainingVideos.length > 0 ? (
              <section className={styles.bentoFooter}>
                <div className={styles.categoryHeader}>
                  <div>
                    <h2 className={styles.categoryTitle}>More in {homeHeading}</h2>
                    <p className={styles.categorySubtitle}>
                      Keep exploring this learning path with the remaining lessons.
                    </p>
                  </div>
                </div>
                <div className={styles.videoGrid}>
                  {remainingVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={{
                        ...video,
                        title: cleanTitle(video.title),
                      }}
                      textOnly={true}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {!activeCategory &&
            remainingVideos.length > 0 &&
            categorySections.length === 0 ? (
              <section className={styles.bentoFooter}>
                <div className={styles.categoryHeader}>
                  <div>
                    <h2 className={styles.categoryTitle}>More lessons</h2>
                    <p className={styles.categorySubtitle}>
                      These lessons are live in the feed but are not grouped into a visible shelf
                      yet.
                    </p>
                  </div>
                </div>
                <div className={styles.videoGrid}>
                  {remainingVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={{
                        ...video,
                        title: cleanTitle(video.title),
                      }}
                      textOnly={true}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {hasMore ? (
              <div className={styles.loadMoreWrapper}>
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className={styles.loadMoreBtn}
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
