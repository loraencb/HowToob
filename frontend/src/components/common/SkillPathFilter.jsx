import { useState } from 'react'
import { PRIMARY_CATEGORIES, SUB_CATEGORIES } from '../../utils/constants'
import styles from './SkillPathFilter.module.css'

export default function SkillPathFilter({ activeCategory, onCategoryChange }) {
  const [activePrimary, setActivePrimary] = useState(activeCategory || '')
  const [activeSubCategory, setActiveSubCategory] = useState('')

  const handlePrimaryClick = (value) => {
    setActivePrimary(value)
    setActiveSubCategory('')
    onCategoryChange(value)
  }

  const handleSubCategoryClick = (value) => {
    setActiveSubCategory(value)
    onCategoryChange(value)
  }

  const handleClearFilters = () => {
    setActivePrimary('')
    setActiveSubCategory('')
    onCategoryChange('')
  }

  const currentSubs = activePrimary ? SUB_CATEGORIES[activePrimary] : []

  return (
    <div className={styles.skillPathContainer}>
      {/* Tier 1: Primary Categories */}
      <div className={styles.tier1Container}>
        <button
          type="button"
          className={`${styles.primaryButton} ${!activePrimary ? styles.primaryButtonActive : ''}`}
          onClick={handleClearFilters}
        >
          <span>All</span>
          {!activePrimary && <div className={styles.indicatorDot} />}
        </button>

        {PRIMARY_CATEGORIES.map(cat => (
          <button
            key={cat.value}
            type="button"
            className={`${styles.primaryButton} ${activePrimary === cat.value ? styles.primaryButtonActive : ''}`}
            onClick={() => handlePrimaryClick(cat.value)}
          >
            <span>{cat.label}</span>
            {activePrimary === cat.value && <div className={styles.indicatorDot} />}
          </button>
        ))}
      </div>

      {/* Tier 2: Sub-Categories (appears when primary is selected) */}
      {currentSubs.length > 0 && (
        <div className={styles.tier2Container}>
          <div className={styles.tier2Scroll}>
            {currentSubs.map(sub => (
              <button
                key={sub.value}
                type="button"
                className={`${styles.subButton} ${activeSubCategory === sub.value ? styles.subButtonActive : ''}`}
                onClick={() => handleSubCategoryClick(sub.value)}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
