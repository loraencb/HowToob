from ...extensions import db
from ...models.progress import Progress
from ...models.quiz_attempt import QuizAttempt
from ...models.quiz_definition import QuizDefinition
from ...models.user import User
from ...utils.category_taxonomy import get_category_metadata
from ..video import VideoService
from .ai_generation import OpenAIQuizGenerator, QuizGenerationError

QUIZ_PASS_SCORE = 70.0


class QuizService:
    @staticmethod
    def _normalize_question(question, index):
        question_text = str(question.get("question", "")).strip()
        if not question_text:
            return None, "Each question must include question text"

        options = question.get("options")
        if not isinstance(options, list) or len(options) < 2:
            return None, "Each question must include at least two options"

        normalized_options = []
        for option in options:
            option_text = str(option).strip()
            if not option_text:
                return None, "Quiz options cannot be empty"
            normalized_options.append(option_text)

        try:
            correct_index = int(question.get("correct_index"))
        except (TypeError, ValueError):
            return None, "Each question must include a valid correct_index"

        if correct_index < 0 or correct_index >= len(normalized_options):
            return None, "correct_index must point to a valid option"

        question_id = str(question.get("id") or f"q{index}").strip()
        if not question_id:
            return None, "Each question needs a stable id"

        explanation = question.get("explanation")
        return {
            "id": question_id,
            "question": question_text,
            "options": normalized_options,
            "correct_index": correct_index,
            "explanation": str(explanation).strip() if explanation is not None else None,
        }, None

    @staticmethod
    def _normalize_questions(questions):
        if not isinstance(questions, list) or not questions:
            return None, "questions must be a non-empty list"

        normalized_questions = []
        seen_ids = set()

        for index, question in enumerate(questions, start=1):
            if not isinstance(question, dict):
                return None, "Each question must be an object"

            normalized_question, error = QuizService._normalize_question(question, index)
            if error:
                return None, error

            if normalized_question["id"] in seen_ids:
                return None, "Question ids must be unique"

            seen_ids.add(normalized_question["id"])
            normalized_questions.append(normalized_question)

        return normalized_questions, None

    @staticmethod
    def _get_question_set(video, progress_entry=None):
        definition = QuizDefinition.query.filter_by(video_id=video.id).first()
        if definition and definition.questions:
            return {
                "mode": "static",
                "title": definition.title or f"{video.title} quiz",
                "description": definition.description or "Static quiz definition for this lesson.",
                "questions": definition.questions,
            }

        return None

    @staticmethod
    def _serialize_public_questions(questions):
        return [
            {
                "id": question["id"],
                "question": question["question"],
                "options": question["options"],
                "explanation": question.get("explanation"),
            }
            for question in questions
        ]

    @staticmethod
    def _normalize_answers(answers, questions):
        if answers is None:
            return None, "answers are required"

        if isinstance(answers, dict):
            raw_answers = [
                {"question_id": key, "selected_index": value}
                for key, value in answers.items()
            ]
        elif isinstance(answers, list):
            raw_answers = answers
        else:
            return None, "answers must be a list or an object keyed by question id"

        question_lookup = {question["id"]: question for question in questions}
        normalized_answers = []
        seen_question_ids = set()

        for answer in raw_answers:
            if not isinstance(answer, dict):
                return None, "Each answer must be an object"

            question_id = str(answer.get("question_id", "")).strip()
            if question_id not in question_lookup:
                return None, "answers include an unknown question_id"
            if question_id in seen_question_ids:
                return None, "Each question may only be answered once"

            try:
                selected_index = int(answer.get("selected_index"))
            except (TypeError, ValueError):
                return None, "selected_index must be an integer"

            if selected_index < 0 or selected_index >= len(question_lookup[question_id]["options"]):
                return None, "selected_index must point to a valid option"

            seen_question_ids.add(question_id)
            normalized_answers.append({
                "question_id": question_id,
                "selected_index": selected_index,
            })

        if seen_question_ids != set(question_lookup):
            return None, "answers must include every question exactly once"

        return normalized_answers, None

    @staticmethod
    def upsert_quiz_definition(actor_id, video_id, title=None, description=None, questions=None):
        user = db.session.get(User, actor_id)
        if not user:
            return None, "User not found"

        video = VideoService.get_video_by_id(video_id)
        if not video:
            return None, "Video not found"

        if user.role != "admin" and video.creator_id != actor_id:
            return None, "You can only manage quizzes for your own videos"

        normalized_questions, error = QuizService._normalize_questions(questions)
        if error:
            return None, error

        definition = QuizDefinition.query.filter_by(video_id=video.id).first()
        if not definition:
            definition = QuizDefinition(video_id=video.id, questions=[])
            db.session.add(definition)

        definition.title = str(title).strip() if title is not None else definition.title
        definition.description = str(description).strip() if description is not None else definition.description
        definition.questions = normalized_questions
        db.session.commit()

        return {
            "video": video.to_dict(),
            "quiz": {
                "mode": "static",
                "source": "static_definition",
                "title": definition.title or f"{video.title} quiz",
                "description": definition.description or "Static quiz definition for this lesson.",
                "question_count": len(normalized_questions),
                "questions": QuizService._serialize_public_questions(normalized_questions),
            },
        }, None

    @staticmethod
    def generate_ai_quiz(actor_id, video_id, question_count=None, overwrite=False):
        user = db.session.get(User, actor_id)
        if not user:
            return None, "User not found", 404

        video = VideoService.get_video_by_id(video_id)
        if not video:
            return None, "Video not found", 404

        if user.role != "admin" and video.creator_id != actor_id:
            return None, "You can only manage quizzes for your own videos", 403

        existing_definition = QuizDefinition.query.filter_by(video_id=video.id).first()
        if existing_definition and existing_definition.questions and not overwrite:
            return (
                None,
                "Quiz definition already exists for this lesson. Pass overwrite=true to replace it.",
                409,
            )

        try:
            generated_payload = OpenAIQuizGenerator.generate_quiz_definition(
                video=video,
                question_count=question_count,
            )
        except QuizGenerationError as exc:
            return None, str(exc), exc.status_code

        normalized_questions, error = QuizService._normalize_questions(
            generated_payload.get("questions")
        )
        if error:
            return None, error, 502

        requested_count = generated_payload.get("question_count_requested")
        if requested_count and len(normalized_questions) != int(requested_count):
            return (
                None,
                f"AI quiz generation returned {len(normalized_questions)} questions instead of the requested {requested_count}.",
                502,
            )

        definition = existing_definition
        if not definition:
            definition = QuizDefinition(video_id=video.id, questions=[])
            db.session.add(definition)

        definition.title = str(generated_payload.get("title") or f"{video.title} quiz").strip()
        definition.description = str(
            generated_payload.get("description")
            or "AI-generated quiz definition based on the lesson transcript."
        ).strip()
        definition.questions = normalized_questions
        db.session.commit()

        return {
            "video": video.to_dict(viewer_id=actor_id),
            "quiz": {
                "mode": "static",
                "source": generated_payload.get("source", "ai_generated_from_transcript"),
                "title": definition.title,
                "description": definition.description,
                "question_count": len(normalized_questions),
                "questions": QuizService._serialize_public_questions(normalized_questions),
            },
            "generation": {
                "provider": generated_payload.get("provider", "openai"),
                "question_count_requested": generated_payload.get("question_count_requested"),
                "question_count_saved": len(normalized_questions),
                "transcript_char_count": generated_payload.get("transcript_char_count", 0),
                "transcript_chunk_count": generated_payload.get("transcript_chunk_count", 1),
                "transcript_cache_status": generated_payload.get("transcript_cache_status"),
                "video_frame_count": generated_payload.get("video_frame_count", 0),
                "transcript_excerpt": generated_payload.get("transcript_excerpt"),
                "transcription_model": generated_payload.get("transcription_model"),
                "quiz_model": generated_payload.get("quiz_model"),
            },
        }, None, 200

    @staticmethod
    def get_quiz(user_id, video_id, video=None):
        try:
            normalized_video_id = int(video_id)
        except (TypeError, ValueError):
            return None, "video_id must be an integer"

        user = db.session.get(User, user_id)
        if not user:
            return None, "User not found"

        video = video or VideoService.get_video_by_id(normalized_video_id)
        if not video:
            return None, "Video not found"

        progress_entry = Progress.query.filter_by(user_id=user_id, video_id=normalized_video_id).first()
        question_set = QuizService._get_question_set(video, progress_entry)
        if not question_set:
            return None, "Quiz unavailable for this lesson"
        questions = question_set["questions"]

        latest_attempt = (
            QuizAttempt.query.filter_by(user_id=user_id, video_id=normalized_video_id)
            .order_by(QuizAttempt.submitted_at.desc())
            .first()
        )

        public_questions = QuizService._serialize_public_questions(questions)

        return {
            "video": video.to_dict(access_context=VideoService.get_access_context(video, user)),
            "quiz": {
                "mode": question_set["mode"],
                "source": "static_definition",
                "title": question_set["title"],
                "description": question_set["description"],
                "question_count": len(public_questions),
                "pass_score": QUIZ_PASS_SCORE,
                "questions": public_questions,
            },
            "latest_attempt": latest_attempt.to_dict(include_answers=True) if latest_attempt else None,
        }, None

    @staticmethod
    def submit_quiz(user_id, video_id, answers, video=None):
        try:
            normalized_video_id = int(video_id)
        except (TypeError, ValueError):
            return None, "video_id must be an integer"

        user = db.session.get(User, user_id)
        if not user:
            return None, "User not found"

        video = video or VideoService.get_video_by_id(normalized_video_id)
        if not video:
            return None, "Video not found"

        progress_entry = Progress.query.filter_by(user_id=user_id, video_id=normalized_video_id).first()
        question_set = QuizService._get_question_set(video, progress_entry)
        if not question_set:
            return None, "Quiz unavailable for this lesson"
        questions = question_set["questions"]

        normalized_answers, error = QuizService._normalize_answers(answers, questions)
        if error:
            return None, error

        answer_lookup = {answer["question_id"]: answer["selected_index"] for answer in normalized_answers}
        correct_count = sum(
            1 for question in questions if answer_lookup.get(question["id"], -1) == question["correct_index"]
        )
        question_count = len(questions)
        score = round((correct_count / question_count) * 100, 2) if question_count else 0.0
        passed = score >= QUIZ_PASS_SCORE

        question_results = []
        for question in questions:
            selected_index = answer_lookup[question["id"]]
            is_correct = selected_index == question["correct_index"]
            question_results.append({
                "question_id": question["id"],
                "question": question["question"],
                "selected_index": selected_index,
                "correct_index": question["correct_index"],
                "correct": is_correct,
                "explanation": question.get("explanation"),
            })

        attempt = QuizAttempt(
            user_id=user_id,
            video_id=normalized_video_id,
            mode=question_set["mode"],
            score=score,
            passed=passed,
            question_count=question_count,
            correct_count=correct_count,
            answers=normalized_answers,
        )
        db.session.add(attempt)
        db.session.commit()

        result_payload = attempt.to_dict(include_answers=True)
        result_payload["summary"] = {
            "score": score,
            "passed": passed,
            "question_count": question_count,
            "correct_count": correct_count,
            "incorrect_count": question_count - correct_count,
            "pass_score": QUIZ_PASS_SCORE,
        }
        result_payload["question_results"] = question_results

        return {
            "video": video.to_dict(access_context=VideoService.get_access_context(video, user)),
            "quiz": {
                "mode": question_set["mode"],
                "source": "static_definition",
                "question_count": question_count,
                "pass_score": QUIZ_PASS_SCORE,
            },
            "result": result_payload,
        }, None
