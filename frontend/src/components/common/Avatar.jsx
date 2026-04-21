import { getInitials } from '../../utils/formatters'
import styles from './Avatar.module.css'

/**
 * User avatar. Shows profile image if available, otherwise colored initials.
 * size: 'xs', 'sm', 'md', 'lg', or 'xl'
 * tier: 'free', 'mid', or 'premium' - adds a colored ring
 */
export default function Avatar({ user, size = 'md', tier, className = '' }) {
  const name = user?.username || user?.name || 'User'
  const initials = getInitials(name)
  const imageUrl = user?.avatar_url || user?.profile_image_url || ''

  return (
    <div
      className={[
        styles.avatar,
        styles[size],
        tier && tier !== 'free' ? styles[`tier_${tier}`] : '',
        className,
      ].join(' ')}
      aria-label={`${name}'s avatar`}
      title={name}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={`${name}'s profile picture`} />
      ) : (
        <span className={styles.initials} aria-hidden="true">
          {initials}
        </span>
      )}
    </div>
  )
}
