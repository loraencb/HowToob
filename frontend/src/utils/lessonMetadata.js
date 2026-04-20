import { getCategoryMetadata } from './categoryTaxonomy'

export function getCreatorName(video, fallback = 'HowToob creator') {
  return (
    video?.creator?.display_name ||
    video?.author_name ||
    video?.creator_name ||
    video?.creator?.username ||
    video?.username ||
    (video?.creator_id ? `Creator #${video.creator_id}` : fallback)
  )
}

export function getCreatorProfileSlug(video) {
  const username =
    video?.creator?.username ||
    video?.creator_name ||
    video?.author_name ||
    video?.username
  if (username) return String(username)

  const creatorId = video?.creator_id ?? video?.creator?.id ?? null
  return creatorId != null ? String(creatorId) : null
}

export function getCategoryLabel(video, fallback = 'Not tagged yet') {
  const metadata = getCategoryMetadata(
    video?.category ||
      video?.category_label ||
      video?.subject ||
      video?.topic ||
      null
  )

  return metadata.label || fallback
}

export function getCategoryPrimaryLabel(video, fallback = 'General learning') {
  const metadata = getCategoryMetadata(
    video?.category ||
      video?.category_primary ||
      video?.category_label ||
      null
  )

  return metadata.primaryLabel || metadata.label || fallback
}

export function getCategoryPathLabel(video, fallback = 'Not tagged yet') {
  const metadata = getCategoryMetadata(
    video?.category ||
      video?.category_path ||
      video?.category_label ||
      null
  )

  return metadata.pathLabel || fallback
}

export function getTierLevel(video) {
  return Number(
    video?.subscription?.tier_level ?? video?.tier_level ?? video?.subscription_tier ?? 0
  )
}

export function getAccessMetadata(video) {
  const tierLevel = getTierLevel(video)
  const subscription = video?.subscription || {}
  const backendLabel =
    subscription?.label || (tierLevel > 0 ? `Tier ${tierLevel} access` : 'Standard access')
  const backendNote =
    subscription?.note ||
    (tierLevel > 0
      ? 'Requires a creator subscription at this tier or higher.'
      : 'Included with standard lesson access.')

  return {
    tierLevel: Math.max(0, tierLevel),
    badgeLabel: backendLabel,
    note: backendNote,
    isPremium: Boolean(subscription?.is_premium ?? tierLevel > 0),
    accessStatus: video?.access_status || null,
  }
}
