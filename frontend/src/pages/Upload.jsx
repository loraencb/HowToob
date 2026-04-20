import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from '../components/common/Button'
import ErrorMessage from '../components/common/ErrorMessage'
import { videosAPI } from '../utils/api'
import {
  PRIMARY_CATEGORIES,
  SUB_CATEGORIES,
  getCategoryMetadata,
} from '../utils/categoryTaxonomy'
import styles from './Upload.module.css'

const ACCEPTED_VIDEO_EXTENSIONS = ['mp4']
const ACCEPTED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg']

function getFileExtension(filename = '') {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

function formatBytes(bytes = 0) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

function validateFile(file, allowedExtensions, emptyMessage, invalidMessage) {
  if (!file) {
    return emptyMessage
  }

  const extension = getFileExtension(file.name)
  if (!allowedExtensions.includes(extension)) {
    return invalidMessage
  }

  return ''
}

function normalizeUploadedVideo(data) {
  const raw = data?.video ?? data?.data ?? data
  if (!raw) return null

  return {
    ...raw,
    id: raw.id,
    title: raw.title || 'Untitled video',
    description: raw.description || '',
    thumbnail_url: raw.thumbnail_url || '',
    quiz_generation: raw.quiz_generation || null,
  }
}

function getQuizGenerationUiState(quizGeneration) {
  if (!quizGeneration) {
    return { panel: null, hint: '' }
  }

  if (quizGeneration.status === 'generated') {
    const questionCount = quizGeneration.question_count
    return {
      panel: {
        tone: 'success',
        message: questionCount
          ? `An AI quiz was generated automatically with ${questionCount} questions.`
          : quizGeneration.message || 'An AI quiz was generated automatically for this lesson.',
      },
      hint: '',
    }
  }

  if (quizGeneration.status === 'failed') {
    return {
      panel: {
        tone: 'warning',
        message:
          quizGeneration.message ||
          'The lesson uploaded successfully, but AI quiz generation did not finish for this upload.',
      },
      hint: 'You can retry quiz generation later from the creator dashboard.',
    }
  }

  return {
    panel: null,
    hint: 'You can generate an AI quiz later from the creator dashboard whenever you are ready.',
  }
}

export default function Upload() {
  const { user } = useAuth()

  const videoInputRef = useRef(null)
  const thumbnailInputRef = useRef(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [primaryCategory, setPrimaryCategory] = useState('')
  const [category, setCategory] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [dragTarget, setDragTarget] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadedVideo, setUploadedVideo] = useState(null)

  const titleCharactersRemaining = useMemo(() => 150 - title.length, [title.length])
  const uploadedQuizState = useMemo(
    () => getQuizGenerationUiState(uploadedVideo?.quiz_generation),
    [uploadedVideo]
  )

  function resetForm() {
    setTitle('')
    setDescription('')
    setPrimaryCategory('')
    setCategory('')
    setVideoFile(null)
    setThumbnailFile(null)
    setFieldErrors({})
    setSubmitError('')
    setDragTarget('')

    if (videoInputRef.current) {
      videoInputRef.current.value = ''
    }

    if (thumbnailInputRef.current) {
      thumbnailInputRef.current.value = ''
    }
  }

  function assignFile(field, file) {
    if (field === 'video') {
      setVideoFile(file)
      setFieldErrors((prev) => ({ ...prev, video: '' }))
      return
    }

    setThumbnailFile(file)
    setFieldErrors((prev) => ({ ...prev, thumbnail: '' }))
  }

  function handleFileChange(field, event) {
    const file = event.target.files?.[0] || null
    assignFile(field, file)
  }

  function handleDrop(field, event) {
    event.preventDefault()
    setDragTarget('')

    const file = event.dataTransfer.files?.[0] || null
    if (!file) return

    assignFile(field, file)
  }

  function validateForm() {
    const nextErrors = {}

    if (!title.trim()) {
      nextErrors.title = 'A clear lesson title is required.'
    } else if (title.trim().length > 150) {
      nextErrors.title = 'Keep the title under 150 characters.'
    }

    const videoError = validateFile(
      videoFile,
      ACCEPTED_VIDEO_EXTENSIONS,
      'Choose a `.mp4` lesson video to upload.',
      'Only `.mp4` videos are supported right now.'
    )
    if (videoError) {
      nextErrors.video = videoError
    }

    if (thumbnailFile) {
      const thumbnailError = validateFile(
        thumbnailFile,
        ACCEPTED_IMAGE_EXTENSIONS,
        '',
        'Thumbnail must be a `.png`, `.jpg`, or `.jpeg` image.'
      )

      if (thumbnailError) {
        nextErrors.thumbnail = thumbnailError
      }
    }

    if (primaryCategory && !category) {
      nextErrors.category = 'Choose a topic under the selected category.'
    }

    return nextErrors
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = validateForm()
    setFieldErrors(nextErrors)
    setSubmitError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const payload = new FormData()
    payload.append('title', title.trim())
    payload.append('description', description.trim())
    payload.append('video', videoFile)

    if (category) {
      payload.append('category', category)
    }

    if (thumbnailFile) {
      payload.append('thumbnail', thumbnailFile)
    }

    try {
      setSubmitting(true)
      const data = await videosAPI.upload(payload)
      const createdVideo = normalizeUploadedVideo(data)

      setUploadedVideo(createdVideo)
      resetForm()
    } catch (error) {
      if (error?.code === 'NETWORK_ERROR') {
        setSubmitError(
          'Could not reach the upload service from this device. Check that the host machine is still running and both devices are connected correctly.'
        )
      } else if (error?.status === 401) {
        setSubmitError(
          'Your session could not be verified. Sign in again on this device and try the upload one more time.'
        )
      } else if (error?.status === 403) {
        setSubmitError(
          error.message || 'This account cannot upload lessons. Use a creator account on this device.'
        )
      } else {
        setSubmitError(error.message || 'Upload failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (uploadedVideo?.id) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Creator upload</p>
            <h1 className={styles.heroTitle}>Your lesson is live</h1>
            <p className={styles.heroSubtitle}>
              {uploadedVideo.title} has been uploaded successfully and is ready to watch.
            </p>
          </div>
        </section>

        <section className={styles.successPanel} aria-live="polite">
          <div className={styles.successBadge}>Upload complete</div>

          <div className={styles.successPreview}>
            <div className={styles.successArtwork}>
              {uploadedVideo.thumbnail_url ? (
                <img
                  src={uploadedVideo.thumbnail_url}
                  alt={`Thumbnail for ${uploadedVideo.title}`}
                  className={styles.successImage}
                />
              ) : (
                <div className={styles.successPlaceholder} aria-hidden="true">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="7 5 19 12 7 19 7 5" />
                  </svg>
                </div>
              )}
            </div>

            <div className={styles.successContent}>
              <h2 className={styles.successTitle}>{uploadedVideo.title}</h2>
              <p className={styles.successText}>
                Your creator workflow is ready for the next step. You can preview the
                new lesson, return to the feed, or keep publishing while momentum is
                high.
              </p>

              {uploadedQuizState.panel ? (
                <div
                  className={`${styles.quizStatus} ${
                    uploadedQuizState.panel.tone === 'success'
                      ? styles.quizStatusSuccess
                      : uploadedQuizState.panel.tone === 'warning'
                        ? styles.quizStatusWarning
                        : styles.quizStatusMuted
                  }`}
                >
                  <strong className={styles.quizStatusLabel}>AI quiz:</strong>{' '}
                  {uploadedQuizState.panel.message}
                </div>
              ) : null}

              {uploadedQuizState.hint ? (
                <p className={styles.quizHint}>{uploadedQuizState.hint}</p>
              ) : null}

              <div className={styles.successActions}>
                <Link to={`/watch/${uploadedVideo.id}`} className={styles.primaryLink}>
                  Open uploaded lesson
                </Link>
                <Link to="/creator-dashboard" className={styles.secondaryLink}>
                  Open creator dashboard
                </Link>
                <button
                  type="button"
                  className={styles.ghostLink}
                  onClick={() => setUploadedVideo(null)}
                >
                  Upload another
                </button>
                <Link to="/" className={styles.ghostLink}>
                  Back home
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Creator upload</p>
          <h1 className={styles.heroTitle}>
            Publish a new lesson{user?.username ? `, ${user.username}` : ''}
          </h1>
          <p className={styles.heroSubtitle}>
            Bring your next lesson into HowToob with a clean upload flow designed for creators.
          </p>
        </div>

        <div className={styles.heroMeta}>
          <div className={styles.metaCard}>
            <span className={styles.metaLabel}>Supported video</span>
            <strong className={styles.metaValue}>MP4 only</strong>
          </div>
          <div className={styles.metaCard}>
            <span className={styles.metaLabel}>Optional cover</span>
            <strong className={styles.metaValue}>PNG / JPG</strong>
          </div>
        </div>
      </section>

      <div className={styles.layout}>
        <section className={styles.formCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Upload details</h2>
              <p className={styles.sectionSubtitle}>
                Add your video file, write a strong title, and optionally set a
                thumbnail before publishing.
              </p>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.dropGrid}>
              <div>
                <label className={styles.inputLabel} htmlFor="video-upload">
                  Video file
                </label>
                <button
                  type="button"
                  className={`${styles.dropZone} ${
                    dragTarget === 'video' ? styles.dropZoneActive : ''
                  } ${videoFile ? styles.dropZoneFilled : ''}`}
                  onClick={() => videoInputRef.current?.click()}
                  onDragEnter={() => setDragTarget('video')}
                  onDragLeave={() => setDragTarget((prev) => (prev === 'video' ? '' : prev))}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragTarget('video')
                  }}
                  onDrop={(event) => handleDrop('video', event)}
                  aria-describedby="video-upload-hint"
                  aria-label={videoFile ? `Replace video file ${videoFile.name}` : 'Choose lesson video file'}
                >
                  <input
                    id="video-upload"
                    ref={videoInputRef}
                    type="file"
                    accept=".mp4,video/mp4"
                    className={styles.hiddenInput}
                    onChange={(event) => handleFileChange('video', event)}
                    disabled={submitting}
                  />

                  <div className={styles.dropIcon} aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>

                  <div className={styles.dropContent}>
                    <span className={styles.dropTitle}>
                      {videoFile ? 'Replace video file' : 'Drop your video here'}
                    </span>
                    <span id="video-upload-hint" className={styles.dropHint}>
                      {videoFile
                        ? `${videoFile.name} • ${formatBytes(videoFile.size)}`
                        : 'Drag an MP4 file here or click to browse'}
                    </span>
                  </div>
                </button>
                {fieldErrors.video ? (
                  <p className={styles.validationText}>{fieldErrors.video}</p>
                ) : null}
              </div>

              <div>
                <label className={styles.inputLabel} htmlFor="thumbnail-upload">
                  Thumbnail
                </label>
                <button
                  type="button"
                  className={`${styles.dropZone} ${
                    dragTarget === 'thumbnail' ? styles.dropZoneActive : ''
                  } ${thumbnailFile ? styles.dropZoneFilled : ''}`}
                  onClick={() => thumbnailInputRef.current?.click()}
                  onDragEnter={() => setDragTarget('thumbnail')}
                  onDragLeave={() =>
                    setDragTarget((prev) => (prev === 'thumbnail' ? '' : prev))
                  }
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragTarget('thumbnail')
                  }}
                  onDrop={(event) => handleDrop('thumbnail', event)}
                  aria-describedby="thumbnail-upload-hint"
                  aria-label={
                    thumbnailFile
                      ? `Replace thumbnail file ${thumbnailFile.name}`
                      : 'Choose optional thumbnail image'
                  }
                >
                  <input
                    id="thumbnail-upload"
                    ref={thumbnailInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    className={styles.hiddenInput}
                    onChange={(event) => handleFileChange('thumbnail', event)}
                    disabled={submitting}
                  />

                  <div className={styles.dropIcon} aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <circle cx="8.5" cy="9.5" r="1.5" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                  </div>

                  <div className={styles.dropContent}>
                    <span className={styles.dropTitle}>
                      {thumbnailFile ? 'Replace thumbnail' : 'Add cover art'}
                    </span>
                    <span id="thumbnail-upload-hint" className={styles.dropHint}>
                      {thumbnailFile
                        ? `${thumbnailFile.name} • ${formatBytes(thumbnailFile.size)}`
                        : 'Optional PNG or JPG image'}
                    </span>
                  </div>
                </button>
                {fieldErrors.thumbnail ? (
                  <p className={styles.validationText}>{fieldErrors.thumbnail}</p>
                ) : null}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.labelRow}>
                <label className={styles.inputLabel} htmlFor="upload-title">
                  Title
                </label>
                <span
                  className={`${styles.characterCount} ${
                    titleCharactersRemaining < 0 ? styles.characterCountError : ''
                  }`}
                >
                  {titleCharactersRemaining} left
                </span>
              </div>
              <input
                id="upload-title"
                type="text"
                className={styles.textInput}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Example: Build a REST API with Flask in 20 minutes"
                maxLength={150}
                disabled={submitting}
              />
              {fieldErrors.title ? (
                <p className={styles.validationText}>{fieldErrors.title}</p>
              ) : (
                <p className={styles.helperText}>
                  Strong titles help learners decide quickly what they will gain.
                </p>
              )}
            </div>

            <div className={styles.categoryGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.inputLabel} htmlFor="upload-primary-category">
                  Category
                </label>
                <select
                  id="upload-primary-category"
                  className={styles.selectInput}
                  value={primaryCategory}
                  onChange={(event) => {
                    setPrimaryCategory(event.target.value)
                    setCategory('')
                    setFieldErrors((prev) => ({ ...prev, category: '' }))
                  }}
                  disabled={submitting}
                >
                  <option value="">Select a category</option>
                  {PRIMARY_CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className={styles.helperText}>
                  Categories use predefined learning shelves so lessons are easier to browse.
                </p>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.inputLabel} htmlFor="upload-category">
                  Topic label
                </label>
                <select
                  id="upload-category"
                  className={styles.selectInput}
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value)
                    setFieldErrors((prev) => ({ ...prev, category: '' }))
                  }}
                  disabled={submitting || !primaryCategory}
                >
                  <option value="">
                    {primaryCategory ? 'Select a topic' : 'Choose a category first'}
                  </option>
                  {(SUB_CATEGORIES[primaryCategory] || []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.category ? (
                  <p className={styles.validationText}>{fieldErrors.category}</p>
                ) : (
                  <p className={styles.helperText}>
                    {category
                      ? `Selected label: ${getCategoryMetadata(category).pathLabel}.`
                      : 'Pick the most specific topic to help learners find the lesson.'}
                  </p>
                )}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.inputLabel} htmlFor="upload-description">
                Description
              </label>
              <textarea
                id="upload-description"
                className={styles.textArea}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Explain the lesson, who it is for, and what the learner should know before starting."
                rows={6}
                disabled={submitting}
              />
              <p className={styles.helperText}>
                Optional, but a short summary makes the lesson feel polished and
                searchable.
              </p>
            </div>

            {submitError ? (
              <ErrorMessage message={submitError} className={styles.submitError} />
            ) : null}

            <div className={styles.formActions}>
              <Button type="submit" size="lg" loading={submitting}>
                {submitting ? 'Publishing lesson...' : 'Publish lesson'}
              </Button>
              <button
                type="button"
                className={styles.resetButton}
                onClick={resetForm}
                disabled={submitting}
              >
                Clear form
              </button>
            </div>
          </form>
        </section>

        <aside className={styles.sideColumn}>
          <section className={styles.infoCard}>
            <h3 className={styles.infoTitle}>Before you publish</h3>
            <ul className={styles.checklist}>
              <li>Make sure the video file is final and exported as MP4.</li>
              <li>Use a title that states the skill or outcome clearly.</li>
              <li>Choose a category and topic label that match the lesson content.</li>
              <li>Add a thumbnail if you want the lesson to stand out in the feed.</li>
            </ul>
          </section>

          <section className={styles.infoCard}>
            <h3 className={styles.infoTitle}>Upload requirements</h3>
            <div className={styles.ruleList}>
              <div className={styles.ruleItem}>
                <span className={styles.ruleLabel}>Endpoint</span>
                <code className={styles.ruleValue}>POST /videos/upload</code>
              </div>
              <div className={styles.ruleItem}>
                <span className={styles.ruleLabel}>Required</span>
                <span className={styles.ruleValue}>title, video</span>
              </div>
              <div className={styles.ruleItem}>
                <span className={styles.ruleLabel}>Optional</span>
                <span className={styles.ruleValue}>description, thumbnail, predefined category tag</span>
              </div>
            </div>
          </section>

          <section className={styles.infoCard}>
            <h3 className={styles.infoTitle}>After upload</h3>
            <p className={styles.infoBody}>
              After your file is accepted, you will get a direct link to the new lesson and a fast path back to the home feed.
            </p>
            <Link to="/" className={styles.inlineLink}>
              Preview the current feed
            </Link>
          </section>
        </aside>
      </div>
    </div>
  )
}
