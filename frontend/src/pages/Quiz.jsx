import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Badge from '../components/common/Badge'
import Button from '../components/common/Button'
import ErrorMessage from '../components/common/ErrorMessage'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { usePlaylists } from '../context/PlaylistContext'
import { useProgress } from '../context/ProgressContext'
import { quizAPI } from '../utils/api'
import { QUIZ_PASS_SCORE } from '../utils/constants'
import { getAccessMetadata, getCategoryLabel, getCreatorName } from '../utils/lessonMetadata'
import {
  formatNumericDate,
  formatRatingSummary,
  formatViewCount,
  truncate,
} from '../utils/formatters'
import styles from './Quiz.module.css'

function normalizeVideoResponse(data) {
  const raw = data?.video ?? data?.data ?? data ?? null
  if (!raw) return null

  return {
    ...raw,
    id: Number(raw.id),
    title: raw.title || 'Untitled lesson',
    description: raw.description || '',
    thumbnail_url: raw.thumbnail_url || raw.thumbnail || '',
    created_at: raw.created_at || null,
    views: raw.views || 0,
    like_count: raw.like_count || 0,
    rating_count: raw.rating_count ?? raw.like_count ?? 0,
    average_rating: raw.average_rating ?? 0,
    category: raw.category || raw.subject || raw.topic || '',
    creator_id: raw.creator_id ?? raw.creator?.id ?? null,
    author_name:
      raw.author_name ||
      raw.creator_name ||
      raw.creator?.username ||
      (raw.creator_id ? `Creator #${raw.creator_id}` : 'HowToob creator'),
    subscription: raw.subscription || null,
  }
}

export default function Quiz() {
  const navigate = useNavigate()
  const { videoId } = useParams()
  const [searchParams] = useSearchParams()
  const { playlists, loading: playlistsLoading, getPlaylistDetail } = usePlaylists()
  const { saveQuizScore, getQuizScore, getVideoProgress } = useProgress()

  const [video, setVideo] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [latestAttempt, setLatestAttempt] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accessDenied, setAccessDenied] = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const activePlaylistId = searchParams.get('playlist')
  const activePlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === activePlaylistId) || null,
    [activePlaylistId, playlists]
  )
  const playlistContextUnavailable = Boolean(
    activePlaylistId && !activePlaylist && !playlistsLoading
  )
  const currentPlaylistIndex =
    activePlaylist?.items.findIndex((item) => Number(item.videoId) === Number(videoId)) ?? -1
  const nextPlaylistItem =
    activePlaylist && currentPlaylistIndex > -1
      ? activePlaylist.items[currentPlaylistIndex + 1] || null
      : null

  const storedAttempt = getQuizScore(videoId)
  const previousAttempt = latestAttempt || storedAttempt
  const lessonProgress = getVideoProgress(videoId)

  useEffect(() => {
    if (!activePlaylistId) return

    getPlaylistDetail(activePlaylistId).catch(() => {
      // Missing playlist context is handled in the UI.
    })
  }, [activePlaylistId, getPlaylistDetail])

  useEffect(() => {
    let active = true

    async function loadLesson() {
      setLoading(true)
      setError('')
      setAccessDenied(null)
      setSubmitted(false)
      setSubmitting(false)
      setSubmitError('')
      setCurrentIdx(0)
      setSelectedAnswers({})
      setResult(null)

      try {
        const data = await quizAPI.getByVideoId(videoId)
        if (!active) return

        const normalized = normalizeVideoResponse(data?.video)
        if (!normalized) {
          throw new Error('Could not load this lesson for quiz context.')
        }

        setVideo(normalized)
        setQuiz(data?.quiz || null)
        setLatestAttempt(data?.latest_attempt || null)

        if (data?.latest_attempt) {
          saveQuizScore(videoId, data.latest_attempt.score, {
            submittedAt: data.latest_attempt.submitted_at,
            source: 'backend',
            passed: data.latest_attempt.passed,
          })
        }
      } catch (requestError) {
        if (!active) return

        if (requestError?.code === 'ACCESS_DENIED') {
          setVideo(null)
          setQuiz(null)
          setLatestAttempt(null)
          setAccessDenied(requestError)
          setError('')
          setLoading(false)
          return
        }
        setError(requestError.message || 'Quiz context could not be loaded.')
        setVideo(null)
        setQuiz(null)
        setLatestAttempt(null)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadLesson()

    return () => {
      active = false
    }
  }, [
    activePlaylist?.id,
    activePlaylist?.updatedAt,
    saveQuizScore,
    videoId,
  ])

  const questions = useMemo(
    () =>
      (Array.isArray(quiz?.questions) ? quiz.questions : []).map((question, index) => ({
        ...question,
        id: question.id || `q-${index + 1}`,
      })),
    [quiz]
  )

  const lessonHref = activePlaylist
    ? `/watch/${videoId}?playlist=${activePlaylist.id}`
    : `/watch/${videoId}`
  const continueHref = nextPlaylistItem
    ? `/watch/${nextPlaylistItem.videoId}?playlist=${activePlaylist.id}`
    : activePlaylist
      ? `/playlist/${activePlaylist.id}`
      : lessonHref

  const passScore = Number(quiz?.pass_score || QUIZ_PASS_SCORE)
  const accessMetadata = getAccessMetadata(video)
  const activeResult = result
  const score = Math.round(activeResult?.summary?.score || 0)
  const passed = Boolean(activeResult?.summary?.passed)
  const reviewItems = useMemo(
    () =>
      (activeResult?.question_results || []).map((item, index) => {
        const matchingQuestion =
          questions.find((question) => question.id === item.question_id) || questions[index]
        const options = matchingQuestion?.options || []

        return {
          ...item,
          index,
          selectedLabel:
            item.selected_index != null
              ? options[item.selected_index] || 'No answer selected'
              : 'No answer selected',
          correctLabel:
            item.correct_index != null
              ? options[item.correct_index] || 'Correct answer unavailable'
              : 'Correct answer unavailable',
        }
      }),
    [activeResult?.question_results, questions]
  )
  const currentQuestion = questions[currentIdx] || null

  function handleSelect(optionIdx) {
    if (submitted || !currentQuestion) return

    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionIdx,
    }))
  }

  function handleNext() {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((prev) => prev + 1)
    }
  }

  function handleReset() {
    setSubmitted(false)
    setSubmitting(false)
    setSubmitError('')
    setCurrentIdx(0)
    setSelectedAnswers({})
    setResult(null)
  }

  async function handleSubmit() {
    if (!currentQuestion) return

    setSubmitError('')

    setSubmitting(true)

    try {
      const payload = await quizAPI.submit(videoId, selectedAnswers)
      const submittedResult = payload?.result || null

      if (!submittedResult) {
        throw new Error('Quiz submission did not return a result summary.')
      }

      setResult(submittedResult)
      setLatestAttempt(submittedResult)
      setSubmitted(true)
      saveQuizScore(videoId, submittedResult.summary?.score || 0, {
        submittedAt: submittedResult.submitted_at,
        source: 'backend',
        passed: submittedResult.summary?.passed,
      })
    } catch (requestError) {
      if (requestError?.code === 'ACCESS_DENIED') {
        setAccessDenied(requestError)
      } else {
        setSubmitError(requestError.message || 'Could not submit this quiz.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <LoadingSpinner size="lg" label="Loading lesson quiz..." />
        </div>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className={styles.page}>
        <section className={styles.emptyState}>
          <Badge variant="warning" size="md">
            Access required
          </Badge>
          <h1 className={styles.emptyTitle}>Quiz locked for this lesson</h1>
          <p className={styles.emptyText}>
            {accessDenied.message ||
              'This quiz follows the same subscription access rules as the lesson watch page.'}
          </p>
          <div className={styles.emptyActions}>
            <Button variant="primary" onClick={() => navigate('/subscription')}>
              Open subscriptions
            </Button>
            <Button variant="secondary" onClick={() => navigate(lessonHref)}>
              Back to lesson
            </Button>
          </div>
        </section>
      </div>
    )
  }

  if (error || !video || !quiz) {
    return (
      <div className={styles.page}>
        {error ? <ErrorMessage message={error} /> : null}

        <section className={styles.emptyState}>
          <Badge variant="info" size="md">
            Quiz unavailable
          </Badge>
          <h1 className={styles.emptyTitle}>Quiz unavailable for this lesson</h1>
          <p className={styles.emptyText}>
            This lesson could not be loaded well enough to show a quiz right now.
          </p>
          <div className={styles.emptyActions}>
            <Button variant="primary" onClick={() => navigate(lessonHref)}>
              Back to lesson
            </Button>
            <Button variant="secondary" onClick={() => navigate('/dashboard')}>
              Go to dashboard
            </Button>
          </div>
        </section>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <Badge variant="info" size="md">
              Quiz result
            </Badge>
            <h1 className={styles.title}>Quiz summary for {video.title}</h1>
            <p className={styles.subtitle}>Your score has been saved so you can review it later.</p>
          </div>

          <div className={styles.scorePanel}>
            <span className={styles.scoreLabel}>Score</span>
            <strong
              className={`${styles.scoreValue} ${
                passed ? styles.scorePassed : styles.scoreFailed
              }`}
            >
              {score}%
            </strong>
            <span className={styles.scoreText}>
              {activeResult.summary?.correct_count || 0} of {activeResult.summary?.question_count || questions.length} correct
            </span>
          </div>
        </section>

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Result</span>
            <strong className={styles.summaryValue}>
              {passed ? 'Passed' : 'Keep studying'}
            </strong>
            <span className={styles.summaryText}>
              {passed
                ? 'You reached the passing threshold for this quiz.'
                : `A score of ${passScore}% is needed to pass.`}
            </span>
          </article>
          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Saved attempt</span>
            <strong className={styles.summaryValue}>
              {previousAttempt ? `${previousAttempt.score}%` : 'None yet'}
            </strong>
            <span className={styles.summaryText}>
              {previousAttempt
                ? `Last saved ${new Date(previousAttempt.submitted_at || previousAttempt.takenAt).toLocaleDateString()}`
                : 'This result becomes your first saved quiz attempt.'}
            </span>
          </article>
          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Next step</span>
            <strong className={styles.summaryValue}>
              {nextPlaylistItem ? 'Continue path' : 'Return to lesson'}
            </strong>
            <span className={styles.summaryText}>
              {nextPlaylistItem
                ? `Move to lesson ${currentPlaylistIndex + 2} in ${activePlaylist?.title}.`
                : 'Review the lesson, keep exploring, or retake this quiz.'}
            </span>
          </article>
        </section>

        <section className={styles.reviewPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Answer review</p>
              <h2 className={styles.panelTitle}>Question breakdown</h2>
            </div>
          </div>

          <div className={styles.reviewList}>
            {reviewItems.map((item) => (
              <article key={item.question_id} className={styles.reviewCard}>
                  <div className={styles.reviewHeader}>
                    <span className={styles.reviewNumber}>Q{item.index + 1}</span>
                    <Badge variant={item.correct ? 'success' : 'warning'} size="sm">
                      {item.correct ? 'Correct' : 'Review'}
                    </Badge>
                  </div>
                  <h3 className={styles.reviewQuestion}>{item.question}</h3>
                  <p className={styles.reviewAnswer}>
                    Your answer: <strong>{item.selectedLabel}</strong>
                  </p>
                  <p className={styles.reviewAnswer}>
                    Correct answer: <strong>{item.correctLabel}</strong>
                  </p>
                  {item.explanation ? (
                    <p className={styles.reviewExplanation}>{item.explanation}</p>
                  ) : null}
                </article>
            ))}
          </div>

          <div className={styles.resultActions}>
            <Button variant="secondary" onClick={handleReset}>
              Retake quiz
            </Button>
            <Button variant="primary" onClick={() => navigate(lessonHref)}>
              Back to lesson
            </Button>
            {activePlaylist ? (
              <Button variant="primary" onClick={() => navigate(continueHref)}>
                {nextPlaylistItem ? 'Continue learning path' : 'Return to playlist'}
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.badgeRow}>
            <Badge variant="info" size="md">
              {quiz.mode === 'static' ? 'Lesson quiz' : 'Knowledge check'}
            </Badge>
            {accessMetadata.tierLevel > 0 ? (
              <Badge variant="warning" size="md">
                {accessMetadata.badgeLabel}
              </Badge>
            ) : (
              <Badge variant="default" size="md">
                {accessMetadata.badgeLabel}
              </Badge>
            )}
            {activePlaylist ? (
              <Badge variant="primary" size="md">
                From learning path
              </Badge>
            ) : null}
          </div>
          <h1 className={styles.title}>
            {truncate(quiz.title || `Quiz for ${video.title}`, 72)}
          </h1>
            <p className={styles.subtitle}>
              {quiz.description || 'Check what you understood before moving on.'}
            </p>
        </div>

        <div className={styles.heroActions}>
          <Button variant="secondary" onClick={() => navigate(lessonHref)}>
            Back to lesson
          </Button>
        </div>
      </section>

      <section className={styles.contextGrid}>
        <article className={styles.contextCard}>
          <div className={styles.lessonThumb}>
            {video.thumbnail_url ? (
              <img
                src={video.thumbnail_url}
                alt={`Thumbnail for ${video.title}`}
                className={styles.lessonImage}
              />
            ) : (
              <div className={styles.lessonPlaceholder} aria-hidden="true">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="7 5 19 12 7 19 7 5" />
                </svg>
              </div>
            )}
          </div>
          <div className={styles.lessonBody}>
            <span className={styles.contextLabel}>Lesson context</span>
            <strong className={styles.contextTitle}>{video.title}</strong>
            <p className={styles.contextText}>
              {video.description
                ? truncate(video.description, 150)
                : 'No lesson description is available yet.'}
            </p>
            <div className={styles.contextMeta}>
              <span>{getCategoryLabel(video)}</span>
              <span>{getCreatorName(video)}</span>
              <span>{formatViewCount(video.views)} views</span>
              <span>{formatRatingSummary(video.average_rating, video.rating_count)}</span>
              {video.created_at ? <span>{formatNumericDate(video.created_at)}</span> : null}
            </div>
            <p className={styles.contextNote}>{accessMetadata.note}</p>
          </div>
        </article>

        <article className={styles.contextCard}>
          <span className={styles.contextLabel}>Learning status</span>
          <div className={styles.summaryMiniList}>
            <div className={styles.summaryMiniItem}>
              <strong className={styles.summaryMiniValue}>
                {Math.round(lessonProgress.percent || 0)}%
              </strong>
              <span className={styles.summaryMiniText}>Lesson progress</span>
            </div>
            <div className={styles.summaryMiniItem}>
              <strong className={styles.summaryMiniValue}>
                {previousAttempt ? `${previousAttempt.score}%` : '--'}
              </strong>
              <span className={styles.summaryMiniText}>Latest saved result</span>
            </div>
            <div className={styles.summaryMiniItem}>
              <strong className={styles.summaryMiniValue}>
                {activePlaylist
                  ? activePlaylist.title
                  : playlistContextUnavailable
                    ? 'Playlist unavailable'
                    : 'Standalone lesson'}
              </strong>
              <span className={styles.summaryMiniText}>Launch context</span>
            </div>
          </div>
          {playlistContextUnavailable ? (
            <p className={styles.contextNote}>
              The requested playlist context is not available in your current learning
              paths, so this quiz is continuing as a standalone lesson.
            </p>
          ) : null}
        </article>
      </section>

      <section className={styles.quizCard}>
        <div className={styles.progressHeader}>
          <div>
            <p className={styles.panelEyebrow}>
              Quiz questions
            </p>
            <h2 className={styles.panelTitle}>
              Question {questions.length > 0 ? currentIdx + 1 : 0} of {questions.length}
            </h2>
          </div>
          <span className={styles.progressCopy}>
            {questions.length > 0
              ? `${Math.round(((currentIdx + 1) / questions.length) * 100)}% through quiz`
              : 'No questions available'}
          </span>
        </div>

        <div className={styles.progressBar} aria-hidden="true">
          <span
            className={styles.progressFill}
            style={{
              width: `${questions.length > 0 ? ((currentIdx + 1) / questions.length) * 100 : 0}%`,
            }}
          />
        </div>

        {currentQuestion ? (
          <article className={styles.questionCard}>
            <h3 className={styles.question}>{currentQuestion.question}</h3>
            <p className={styles.questionText}>{currentQuestion.explanation}</p>

            <ul className={styles.options}>
              {currentQuestion.options.map((option, index) => (
                <li key={option}>
                  <button
                    type="button"
                    className={`${styles.option} ${
                      selectedAnswers[currentQuestion.id] === index
                        ? styles.optionSelected
                        : ''
                    }`}
                    onClick={() => handleSelect(index)}
                  >
                    <span className={styles.optionLetter}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span>{option}</span>
                  </button>
                </li>
              ))}
            </ul>
          </article>
        ) : (
          <article className={styles.questionCard}>
            <h3 className={styles.question}>Quiz unavailable for this lesson</h3>
            <p className={styles.questionText}>
              This lesson does not have enough quiz content to continue right now.
            </p>
          </article>
        )}

        {submitError ? <ErrorMessage message={submitError} /> : null}

        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => navigate(lessonHref)}>
            Pause quiz
          </Button>

          {currentIdx < questions.length - 1 ? (
            <Button
              variant="primary"
              disabled={selectedAnswers[currentQuestion?.id] == null}
              onClick={handleNext}
            >
              Next question
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={
                selectedAnswers[currentQuestion?.id] == null || submitting || !currentQuestion
              }
              onClick={handleSubmit}
            >
              {submitting ? 'Submitting...' : 'Submit quiz'}
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}
