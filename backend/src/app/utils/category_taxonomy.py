import re


CATEGORY_TAXONOMY = (
    {
        "value": "computer-science",
        "label": "Computer Science",
        "subcategories": (
            {"value": "frontend", "label": "Frontend"},
            {"value": "backend", "label": "Backend"},
            {"value": "ai-ml", "label": "AI/ML"},
            {"value": "cybersecurity", "label": "Cybersecurity"},
        ),
    },
    {
        "value": "science",
        "label": "Science",
        "subcategories": (
            {"value": "physics", "label": "Physics"},
            {"value": "chemistry", "label": "Chemistry"},
            {"value": "biology", "label": "Biology"},
            {"value": "astronomy", "label": "Astronomy"},
        ),
    },
    {
        "value": "fitness",
        "label": "Fitness",
        "subcategories": (
            {"value": "strength-training", "label": "Strength Training"},
            {"value": "cardio", "label": "Cardio"},
            {"value": "nutrition", "label": "Nutrition"},
            {"value": "yoga", "label": "Yoga"},
        ),
    },
    {
        "value": "business",
        "label": "Business",
        "subcategories": (
            {"value": "entrepreneurship", "label": "Entrepreneurship"},
            {"value": "marketing", "label": "Marketing"},
            {"value": "finance", "label": "Finance"},
            {"value": "leadership", "label": "Leadership"},
        ),
    },
    {
        "value": "arts",
        "label": "Arts",
        "subcategories": (
            {"value": "painting", "label": "Painting"},
            {"value": "digital-art", "label": "Digital Art"},
            {"value": "design", "label": "Design"},
            {"value": "photography", "label": "Photography"},
        ),
    },
)


PRIMARY_LOOKUP = {category["value"]: category for category in CATEGORY_TAXONOMY}
SUBCATEGORY_LOOKUP = {
    subcategory["value"]: {
        **subcategory,
        "primary_value": category["value"],
        "primary_label": category["label"],
    }
    for category in CATEGORY_TAXONOMY
    for subcategory in category["subcategories"]
}


LEGACY_CATEGORY_ALIASES = {
    "technology": "computer-science",
    "computer-science": "computer-science",
    "computer-science-general": "computer-science",
    "aiml": "ai-ml",
    "ai/ml": "ai-ml",
    "art": "arts",
    "arts-design": "arts",
    "arts-and-design": "arts",
    "fitness-wellness": "fitness",
    "finance-business": "business",
    "digital-illustration": "digital-art",
}


def slugify_category_value(value):
    normalized = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower()).strip("-")
    return normalized or ""


def normalize_category_value(value):
    normalized = slugify_category_value(value)
    if not normalized:
        return None

    if normalized in PRIMARY_LOOKUP or normalized in SUBCATEGORY_LOOKUP:
        return normalized

    aliased = LEGACY_CATEGORY_ALIASES.get(normalized)
    if aliased:
        return aliased

    for category in CATEGORY_TAXONOMY:
        if slugify_category_value(category["label"]) == normalized:
            return category["value"]

        for subcategory in category["subcategories"]:
            if slugify_category_value(subcategory["label"]) == normalized:
                return subcategory["value"]

    return None


def get_category_metadata(value):
    canonical = normalize_category_value(value)
    raw_value = str(value).strip() if value is not None else ""

    if not canonical:
        return {
            "value": raw_value or None,
            "label": raw_value or None,
            "primary_value": None,
            "primary_label": None,
            "path_label": raw_value or None,
            "is_valid": False,
        }

    if canonical in PRIMARY_LOOKUP:
        primary = PRIMARY_LOOKUP[canonical]
        return {
            "value": primary["value"],
            "label": primary["label"],
            "primary_value": primary["value"],
            "primary_label": primary["label"],
            "path_label": primary["label"],
            "is_valid": True,
        }

    subcategory = SUBCATEGORY_LOOKUP[canonical]
    return {
        "value": subcategory["value"],
        "label": subcategory["label"],
        "primary_value": subcategory["primary_value"],
        "primary_label": subcategory["primary_label"],
        "path_label": f"{subcategory['primary_label']} / {subcategory['label']}",
        "is_valid": True,
    }
