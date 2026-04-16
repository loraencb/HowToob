import { getAccessMetadata, getCategoryLabel, getCreatorName } from './lessonMetadata'

export function buildPrototypeQuiz(video, { activePlaylist, lessonProgress }) {
  if (!video) return []

  const accessMetadata = getAccessMetadata(video)
  const topicLabel = getCategoryLabel(video, 'Creator focus')
  const identityAnswer = video.category
    ? getCategoryLabel(video)
    : getCreatorName(video)

  const questions = [
    {
      id: 'context',
      question: video.category
        ? 'Which topic label best matches this lesson?'
        : 'Which creator is associated with this lesson?',
      options: video.category
        ? [identityAnswer, 'Live streaming', 'Moderation policy', 'Profile settings']
        : [identityAnswer, 'Anonymous learner', 'Community moderator', 'Playlist bot'],
      correctIndex: 0,
      explanation: `This prototype quiz uses the lesson metadata currently available for ${video.title}.`,
    },
    {
      id: 'storage',
      question: 'Where does quiz scoring live in the current build?',
      options: [
        'On a dedicated backend quiz API',
        'As a local MVP result saved in this browser session',
        'Inside creator analytics only',
        'It is not tracked at all',
      ],
      correctIndex: 1,
      explanation:
        'Quiz scoring is intentionally stored locally right now because backend quiz endpoints are not available yet.',
    },
    activePlaylist
      ? {
          id: 'playlist',
          question: 'What should happen after you finish this playlist-launched quiz?',
          options: [
            'Jump to the home feed',
            'Continue to the next lesson in the current learning path when available',
            'Delete the playlist progress',
            'Unlock a backend certificate',
          ],
          correctIndex: 1,
          explanation:
            'The quiz keeps the learning-path context so you can move back into sequential study.',
        }
      : {
          id: 'progress',
          question: 'How does lesson progress work for this quiz flow today?',
          options: [
            'Progress is currently stored locally and can later swap to a backend flow',
            'Only creators can track progress',
            'Progress is tied to subscription payments only',
            'Lessons do not track progress at all',
          ],
          correctIndex: 0,
          explanation:
            'Watch progress, quiz scores, and playlist completion remain local MVP features in this build.',
        },
    {
      id: 'access',
      question: 'What access signal is currently shown for this lesson?',
      options: [
        accessMetadata.badgeLabel,
        'A fully enforced premium lock',
        'Admin-only access',
        'No access information at all',
      ],
      correctIndex: 0,
      explanation: accessMetadata.tierLevel
        ? 'The backend currently exposes tier metadata for this lesson, but full gating is still limited.'
        : 'No tiered flag is present, so the lesson uses the standard MVP access treatment.',
    },
  ]

  if (lessonProgress?.percent > 0) {
    questions.push({
      id: 'resume',
      question: 'What learning state already exists for this lesson?',
      options: [
        `${Math.round(lessonProgress.percent)}% watched`,
        'No progress has been started',
        'Backend quiz completed',
        `${topicLabel} certificate unlocked`,
      ],
      correctIndex: 0,
      explanation:
        'The quiz can reflect the local progress you already built up on the watch page.',
    })
  }

  return questions
}
