import { useState } from 'react'
import styles from './Quiz.module.css'

export default function Watch() {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div style={{ padding: '2rem' }}>
      {/* Main player container with layout: player left, curriculum right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem', marginBottom: '3rem' }}>
        
        {/* Left: Video Player Section */}
        <div>
          {/* Video Player Placeholder */}
          <div style={{
            width: '100%',
            aspectRatio: '16 / 6',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
            color: 'var(--color-text-muted)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <p style={{ marginTop: '1rem' }}>Video Player Coming Soon</p>
            </div>
          </div>

          {/* Quiz Button with Tooltip */}
          <div style={{ position: 'relative', marginBottom: '3rem' }}>
            <button
              type="button"
              disabled
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              style={{
                padding: '10px 20px',
                backgroundColor: 'rgba(186, 25, 11, 0.2)',
                color: 'var(--color-text-muted)',
                border: '1px solid rgba(186, 25, 11, 0.3)',
                borderRadius: 'var(--radius-md)',
                cursor: 'not-allowed',
                opacity: 0.6,
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                transition: 'all var(--transition-fast)'
              }}
            >
              📝 Take Quiz
            </button>

            {/* Tooltip */}
            {showTooltip && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '0.5rem',
                padding: '8px 12px',
                backgroundColor: 'rgba(19, 9, 10, 0.95)',
                border: '1px solid var(--color-primary)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-light)',
                fontSize: 'var(--font-size-sm)',
                whiteSpace: 'nowrap',
                zIndex: 10,
                boxShadow: '0 4px 12px rgba(186, 25, 11, 0.2)'
              }}>
                🧠 Brain Gains Coming Soon! This feature is currently in development.
              </div>
            )}
          </div>

          {/* Recommended Videos - Horizontal Scroll */}
          <div>
            <h3 style={{
              fontFamily: 'var(--font-family-heading)',
              fontSize: 'var(--font-size-lg)',
              marginBottom: '1.5rem',
              color: 'var(--color-text-light)'
            }}>
              Recommended Videos
            </h3>
            <div style={{
              display: 'flex',
              gap: '1.5rem',
              overflowX: 'auto',
              paddingBottom: '1rem',
              scrollBehavior: 'smooth',
              marginRight: '-2rem',
              paddingRight: '2rem'
            }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  style={{
                    flex: '0 0 200px',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    overflow: 'hidden',
                    transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
                    boxShadow: '0 2px 8px rgba(186, 25, 11, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(186, 25, 11, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(186, 25, 11, 0.1)';
                  }}
                >
                  <div style={{
                    width: '100%',
                    paddingTop: '56.25%',
                    backgroundColor: 'var(--color-bg-elevated)',
                    position: 'relative'
                  }} />
                  <div style={{ padding: '0.75rem' }}>
                    <p style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-light)',
                      margin: '0 0 0.5rem 0',
                      fontWeight: 'var(--font-weight-medium)'
                    }}>
                      Recommended Video {i}
                    </p>
                    <p style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-muted)',
                      margin: 0
                    }}>
                      Creator Name
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Curriculum/Playlist Accordion */}
        <div>
          <div style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--color-border)',
              backgroundColor: 'rgba(186, 25, 11, 0.05)'
            }}>
              <h4 style={{
                margin: 0,
                fontFamily: 'var(--font-family-heading)',
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-primary)'
              }}>
                📚 Curriculum
              </h4>
            </div>
            {[1, 2, 3].map(lesson => (
              <button
                key={lesson}
                type="button"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: lesson === 1 ? 'rgba(186, 25, 11, 0.1)' : 'transparent',
                  color: lesson === 1 ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  border: 'none',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-sm)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all var(--transition-fast)',
                  ':hover': { backgroundColor: 'rgba(186, 25, 11, 0.1)' }
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(186, 25, 11, 0.1)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = lesson === 1 ? 'rgba(56, 189, 248, 0.1)' : 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{lesson === 1 ? '▶️' : '○'}</span>
                  <span>Lesson {lesson}: Introduction</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
