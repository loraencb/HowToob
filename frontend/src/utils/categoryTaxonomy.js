const CATEGORY_TAXONOMY = [
  {
    value: 'computer-science',
    label: 'Computer Science',
    subcategories: [
      { value: 'frontend', label: 'Frontend' },
      { value: 'backend', label: 'Backend' },
      { value: 'ai-ml', label: 'AI/ML' },
      { value: 'cybersecurity', label: 'Cybersecurity' },
    ],
  },
  {
    value: 'science',
    label: 'Science',
    subcategories: [
      { value: 'physics', label: 'Physics' },
      { value: 'chemistry', label: 'Chemistry' },
      { value: 'biology', label: 'Biology' },
      { value: 'astronomy', label: 'Astronomy' },
    ],
  },
  {
    value: 'fitness',
    label: 'Fitness',
    subcategories: [
      { value: 'strength-training', label: 'Strength Training' },
      { value: 'cardio', label: 'Cardio' },
      { value: 'nutrition', label: 'Nutrition' },
      { value: 'yoga', label: 'Yoga' },
    ],
  },
  {
    value: 'business',
    label: 'Business',
    subcategories: [
      { value: 'entrepreneurship', label: 'Entrepreneurship' },
      { value: 'marketing', label: 'Marketing' },
      { value: 'finance', label: 'Finance' },
      { value: 'leadership', label: 'Leadership' },
    ],
  },
  {
    value: 'arts',
    label: 'Arts',
    subcategories: [
      { value: 'painting', label: 'Painting' },
      { value: 'digital-art', label: 'Digital Art' },
      { value: 'design', label: 'Design' },
      { value: 'photography', label: 'Photography' },
    ],
  },
]

const PRIMARY_CATEGORY_LOOKUP = Object.fromEntries(
  CATEGORY_TAXONOMY.map((category) => [category.value, category])
)

const SUBCATEGORY_LOOKUP = Object.fromEntries(
  CATEGORY_TAXONOMY.flatMap((category) =>
    category.subcategories.map((subcategory) => [
      subcategory.value,
      {
        ...subcategory,
        primaryValue: category.value,
        primaryLabel: category.label,
      },
    ])
  )
)

const LEGACY_CATEGORY_ALIASES = {
  technology: 'computer-science',
  aiml: 'ai-ml',
  'ai/ml': 'ai-ml',
  art: 'arts',
  'arts-and-design': 'arts',
  'arts-design': 'arts',
  'fitness-wellness': 'fitness',
  'finance-business': 'business',
  'digital-illustration': 'digital-art',
}

function slugifyCategoryValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeCategoryValue(value) {
  const normalized = slugifyCategoryValue(value)
  if (!normalized) return null

  if (PRIMARY_CATEGORY_LOOKUP[normalized] || SUBCATEGORY_LOOKUP[normalized]) {
    return normalized
  }

  if (LEGACY_CATEGORY_ALIASES[normalized]) {
    return LEGACY_CATEGORY_ALIASES[normalized]
  }

  const primaryMatch = CATEGORY_TAXONOMY.find(
    (category) => slugifyCategoryValue(category.label) === normalized
  )
  if (primaryMatch) return primaryMatch.value

  for (const category of CATEGORY_TAXONOMY) {
    const subcategoryMatch = category.subcategories.find(
      (subcategory) => slugifyCategoryValue(subcategory.label) === normalized
    )
    if (subcategoryMatch) {
      return subcategoryMatch.value
    }
  }

  return null
}

export function getPrimaryCategory(primaryOrSubcategory) {
  const normalized = normalizeCategoryValue(primaryOrSubcategory)
  if (!normalized) return null
  if (PRIMARY_CATEGORY_LOOKUP[normalized]) return PRIMARY_CATEGORY_LOOKUP[normalized]

  const subcategory = SUBCATEGORY_LOOKUP[normalized]
  return subcategory ? PRIMARY_CATEGORY_LOOKUP[subcategory.primaryValue] : null
}

export function getSubcategory(subcategoryValue) {
  const normalized = normalizeCategoryValue(subcategoryValue)
  if (!normalized) return null
  return SUBCATEGORY_LOOKUP[normalized] || null
}

export function getCategoryMetadata(value) {
  const normalized = normalizeCategoryValue(value)
  if (!normalized) {
    const raw = String(value || '').trim()
    return {
      value: raw || null,
      label: raw || null,
      primaryValue: null,
      primaryLabel: null,
      pathLabel: raw || null,
      isRecognized: false,
    }
  }

  if (PRIMARY_CATEGORY_LOOKUP[normalized]) {
    const primary = PRIMARY_CATEGORY_LOOKUP[normalized]
    return {
      value: primary.value,
      label: primary.label,
      primaryValue: primary.value,
      primaryLabel: primary.label,
      pathLabel: primary.label,
      isRecognized: true,
    }
  }

  const subcategory = SUBCATEGORY_LOOKUP[normalized]
  return {
    value: subcategory.value,
    label: subcategory.label,
    primaryValue: subcategory.primaryValue,
    primaryLabel: subcategory.primaryLabel,
    pathLabel: `${subcategory.primaryLabel} / ${subcategory.label}`,
    isRecognized: true,
  }
}

export function matchesCategoryFilter(categoryValue, filterValue) {
  if (!filterValue) return true

  const categoryMetadata = getCategoryMetadata(categoryValue)
  const normalizedFilter = normalizeCategoryValue(filterValue)
  if (!normalizedFilter) return false

  return (
    categoryMetadata.value === normalizedFilter ||
    categoryMetadata.primaryValue === normalizedFilter
  )
}

export const PRIMARY_CATEGORIES = CATEGORY_TAXONOMY.map((category) => ({
  value: category.value,
  label: category.label,
}))

export const SUB_CATEGORIES = Object.fromEntries(
  CATEGORY_TAXONOMY.map((category) => [
    category.value,
    category.subcategories.map((subcategory) => ({
      value: subcategory.value,
      label: subcategory.label,
    })),
  ])
)

export const CATEGORIES = PRIMARY_CATEGORIES
export const CATEGORY_OPTIONS = CATEGORY_TAXONOMY
