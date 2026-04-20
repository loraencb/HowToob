import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  formatNumericDate,
  formatRatingSummary,
  formatViewCount,
  truncate,
} from '../../utils/formatters'
import {
  getAccessMetadata,
  getCreatorName,
  getCreatorProfileSlug,
  getTierLevel,
} from '../../utils/lessonMetadata'
import Badge from './Badge'
import ProgressBar from './ProgressBar'
import styles from './VideoCard.module.css'

export default function VideoCard({ video, textOnly = false, progress = null }) {
  const [isHovering, setIsHovering] = useState(false)
  const thumbnailUrl = video.thumbnail_url || null
  const tierLevel = getTierLevel(video)
  const isTiered = tierLevel > 0
  const creatorLabel = getCreatorName(video)
  const creatorSlug = getCreatorProfileSlug(video)
  const accessMetadata = getAccessMetadata(video)
  const ratingCount = Number(video.rating_count ?? video.like_count ?? 0) || 0
  const averageRating = Number(video.average_rating ?? 0) || 0
  const progressPercent = Number(progress?.percent ?? video.progress_percent ?? 0) || 0
  const progressCompleted = Boolean(progress?.completed ?? video.progress_completed)
  const hasProgress = progressCompleted || progressPercent > 0
  const tierVariant = tierLevel > 1 ? 'tier-premium' : tierLevel > 0 ? 'tier-mid' : 'tier-free'

  function handleMouseEnter() {
    setIsHovering(true)
  }

  function handleMouseLeave() {
    setIsHovering(false)
  }

  return (
    <article className={`${styles.videoCard} ${textOnly ? styles.textOnlyCard : ''}`}>
      {!textOnly && (
        <Link
          to={`/watch/${video.id}`}
          className={styles.thumbnailLink}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onFocus={handleMouseEnter}
          onBlur={handleMouseLeave}
          aria-label={`Open lesson: ${video.title}`}
        >
          <div className={styles.thumbnail}>
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={`Thumbnail for ${video.title}`}
                loading="lazy"
                className={styles.thumbnailImage}
              />
            ) : (
              <div className={styles.thumbnailPlaceholder} aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            )}

            {isTiered && (
              <div className={styles.lockOverlay}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
            )}

            {isTiered ? (
              <Badge variant={tierVariant} className={styles.tierBadge}>
                {accessMetadata.badgeLabel}
              </Badge>
            ) : null}

            {isHovering && (
              <div className={styles.previewOverlay}>
                <div className={styles.playIcon}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </Link>
      )}

      <div className={`${styles.cardInfo} ${textOnly ? styles.cardInfoTextOnly : ''}`}>
        {textOnly ? (
          <div className={styles.cardTitle}>{truncate(video.title, 60)}</div>
        ) : (
          <Link to={`/watch/${video.id}`} className={styles.cardTitle}>
            {truncate(video.title, 60)}
          </Link>
        )}

        {!textOnly && creatorSlug ? (
          <Link
            to={`/profile/${encodeURIComponent(creatorSlug)}`}
            className={styles.cardCreator}
            aria-label={`Open creator profile: ${creatorLabel}`}
          >
            {creatorLabel}
          </Link>
        ) : !textOnly ? (
          <span className={styles.cardCreator}>{creatorLabel}</span>
        ) : null}

        <div className={styles.cardMeta}>
          <span>{formatViewCount(video.views)} views</span>
          <span className={styles.metaDot} aria-hidden="true">|</span>
          <span>{formatRatingSummary(averageRating, ratingCount)}</span>
          <span className={styles.metaDot} aria-hidden="true">|</span>
          <span>{formatNumericDate(video.created_at)}</span>
        </div>

        {hasProgress && !textOnly ? (
          <ProgressBar
            value={progressPercent}
            label={`${video.title} progress`}
            detail={progressCompleted ? 'Completed' : `${Math.round(progressPercent)}% watched`}
            showLabel
            size="sm"
            variant={progressCompleted ? 'success' : 'primary'}
            className={styles.cardProgress}
          />
        ) : null}

        {!textOnly ? <p className={styles.tierMeta}>{accessMetadata.note}</p> : null}
      </div>
    </article>
  )
}
