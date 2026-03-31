import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatViewCount, formatRelativeTime, truncate } from '../../utils/formatters'
import styles from './VideoCard.module.css'

/**
 * VideoCard component with interactive thumbnail preview and tier badge
 * Supports subscription tiers (0=Free, 1=Tier 1, 2=Tier 2)
 */
export default function VideoCard({ video }) {
  const [isHovering, setIsHovering] = useState(false)
  const [previewTimer, setPreviewTimer] = useState(null)
  const thumbnailUrl = video.thumbnail_url || null
  
  // Determine tier information from subscription data
  const tierLevel = video.subscription?.tier_level || 0
  const isTiered = tierLevel > 0
  
  const tierConfig = {
    1: { label: 'Tier 1', color: '#2EC4B6' }, // teal/cyan
    2: { label: 'Tier 2', color: '#FFD700' }  // gold/premium
  }
  
  const currentTier = tierConfig[tierLevel]

  function handleMouseEnter() {
    setIsHovering(true)
    // Start video preview after 1 second delay
    const timer = setTimeout(() => {
      // Video preview would play here with audio enabled
      // Placeholder for audio preview functionality
      console.log('Playing preview for:', video.title)
    }, 1000)
    setPreviewTimer(timer)
  }

  function handleMouseLeave() {
    setIsHovering(false)
    if (previewTimer) {
      clearTimeout(previewTimer)
      setPreviewTimer(null)
    }
  }

  return (
    <article className={styles.videoCard}>
      <Link
        to={`/watch/${video.id}`}
        className={styles.thumbnailLink}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          )}

          {/* Lock Icon Overlay for Tiered Content */}
          {isTiered && (
            <div className={styles.lockOverlay}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
          )}

          {/* Tier Badge */}
          {isTiered && currentTier && (
            <div className={styles.tierBadge} style={{ backgroundColor: currentTier.color }}>
              {currentTier.label}
            </div>
          )}

          {/* Preview Overlay (when hovering) */}
          {isHovering && (
            <div className={styles.previewOverlay}>
              <div className={styles.playIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </div>
            </div>
          )}
        </div>
      </Link>

      <div className={styles.cardInfo}>
        <Link to={`/watch/${video.id}`} className={styles.cardTitle}>
          {truncate(video.title, 60)}
        </Link>

        <Link to={`/profile/${video.creator?.username || video.creator_id}`} className={styles.cardCreator}>
          {video.creator?.username || `Creator #${video.creator_id}`}
        </Link>

        <div className={styles.cardMeta}>
          <span>{formatViewCount(video.views)} views</span>
          <span className={styles.metaDot} aria-hidden="true">·</span>
          <span>{formatRelativeTime(video.created_at)}</span>
        </div>
      </div>
    </article>
  )
}
