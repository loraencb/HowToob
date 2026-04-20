import shutil
import uuid
from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError

from backend.src.app.extensions import db
from backend.src.app.models import Video, VideoTranscript
from backend.src.app.services.quiz.ai_generation import (
    OpenAIQuizGenerator,
    QuizGenerationError,
    TRANSCRIPTION_FILE_LIMIT_BYTES,
    is_placeholder_openai_api_key,
)


TEST_VIDEO_DIR = Path("uploads/videos")


def test_openai_key_placeholder_detection():
    assert is_placeholder_openai_api_key("replace-this-in-digitalocean")
    assert is_placeholder_openai_api_key("your-openai-api-key")
    assert is_placeholder_openai_api_key("${OPENAI_API_KEY}")
    assert not is_placeholder_openai_api_key("")
    assert not is_placeholder_openai_api_key("sk-test-real-looking-key")


def test_generate_quiz_definition_rejects_placeholder_api_key(app):
    with app.app_context():
        app.config["OPENAI_API_KEY"] = "replace-this-in-digitalocean"
        video = Video(
            title="Placeholder Key Lesson",
            description="The key should fail before file access.",
            file_path="/missing/lesson.mp4",
            creator_id=1,
        )

        try:
            OpenAIQuizGenerator.generate_quiz_definition(video, question_count=10, config=app.config)
            assert False, "Expected QuizGenerationError for placeholder OPENAI_API_KEY"
        except QuizGenerationError as exc:
            assert exc.status_code == 503
            assert "placeholder OPENAI_API_KEY" in str(exc)


def test_generate_quiz_definition_reuses_cached_transcript(app, monkeypatch):
    transcript_calls = {"count": 0}

    def fake_transcribe_lesson(lesson_file, config):
        transcript_calls["count"] += 1
        assert Path(lesson_file) == test_lesson_file
        return ("Transcript " * 30).strip(), 1

    def fake_generate_from_transcript(video, transcript, question_count, config, transcript_is_brief=False):
        return {
            "title": f"{video.title} quiz",
            "description": "Generated from cached transcript",
            "questions": [
                {
                    "id": "lesson_topic_1",
                    "question": "What is the first concept?",
                    "options": ["Caching", "Billing", "Moderation", "Gaming"],
                    "correct_index": 0,
                    "explanation": "The cached transcript mentions caching first.",
                },
                {
                    "id": "lesson_topic_2",
                    "question": "How many questions were requested?",
                    "options": ["One", "Two", "Three", "Four"],
                    "correct_index": 2,
                    "explanation": "This fixture matches the requested count in the test.",
                },
                {
                    "id": "lesson_topic_3",
                    "question": "Where did the text come from?",
                    "options": ["The transcript cache", "A spreadsheet", "A PDF", "A comment thread"],
                    "correct_index": 0,
                    "explanation": "The generator reused the stored transcript cache entry.",
                },
            ],
        }

    monkeypatch.setattr(OpenAIQuizGenerator, "_transcribe_lesson", fake_transcribe_lesson)
    monkeypatch.setattr(OpenAIQuizGenerator, "_generate_quiz_from_transcript", fake_generate_from_transcript)

    TEST_VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    test_lesson_file = TEST_VIDEO_DIR / f"quiz-cache-{uuid.uuid4().hex}.mp4"
    test_lesson_file.write_bytes(b"lesson-bytes")

    try:
        with app.app_context():
            app.config["OPENAI_API_KEY"] = "test-key"

            video = Video(
                title="Cached Transcript Lesson",
                description="A lesson with transcript caching",
                file_path=str(test_lesson_file),
                creator_id=1,
            )
            db.session.add(video)
            db.session.commit()

            first_generation = OpenAIQuizGenerator.generate_quiz_definition(video, question_count=3, config=app.config)
            second_generation = OpenAIQuizGenerator.generate_quiz_definition(video, question_count=3, config=app.config)

            cache_entry = VideoTranscript.query.filter_by(video_id=video.id).first()
            assert cache_entry is not None
            assert cache_entry.status == "completed"
            assert cache_entry.chunk_count == 1
            assert transcript_calls["count"] == 1
            assert first_generation["transcript_cache_status"] == "completed"
            assert second_generation["transcript_cache_status"] == "completed"
            assert second_generation["transcript_chunk_count"] == 1
    finally:
        if test_lesson_file.exists():
            try:
                test_lesson_file.unlink()
            except PermissionError:
                pass


def test_large_lesson_transcription_uses_chunking(app, monkeypatch):
    TEST_VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    lesson_file = TEST_VIDEO_DIR / f"large-lesson-{uuid.uuid4().hex}.mp4"
    with lesson_file.open("wb") as stream:
        stream.truncate(TRANSCRIPTION_FILE_LIMIT_BYTES + 1)

    observed = {"extract_calls": 0, "transcribed": []}

    class LocalTempDir:
        def __init__(self, prefix=""):
            self.path = TEST_VIDEO_DIR / f"{prefix}{uuid.uuid4().hex}"

        def __enter__(self):
            self.path.mkdir(parents=True, exist_ok=True)
            return str(self.path)

        def __exit__(self, exc_type, exc, tb):
            if self.path.exists():
                shutil.rmtree(self.path, ignore_errors=True)

    def fake_extract_audio_chunks(lesson_file, temp_dir, ffmpeg_binary, config):
        observed["extract_calls"] += 1
        chunk_one = Path(temp_dir) / "chunk_000.mp3"
        chunk_two = Path(temp_dir) / "chunk_001.mp3"
        chunk_one.write_bytes(b"chunk-one")
        chunk_two.write_bytes(b"chunk-two")
        return [chunk_one, chunk_two]

    def fake_transcribe_source_file(file_path, config):
        path = Path(file_path)
        assert path.exists()
        observed["transcribed"].append(path.name)
        return f"transcript for {path.stem}"

    monkeypatch.setattr(
        "backend.src.app.services.quiz.ai_generation.shutil.which",
        lambda binary: "ffmpeg",
    )
    monkeypatch.setattr(
        "backend.src.app.services.quiz.ai_generation.tempfile.TemporaryDirectory",
        LocalTempDir,
    )
    monkeypatch.setattr(OpenAIQuizGenerator, "_extract_audio_chunks", fake_extract_audio_chunks)
    monkeypatch.setattr(OpenAIQuizGenerator, "_transcribe_source_file", fake_transcribe_source_file)

    try:
        transcript_text, chunk_count = OpenAIQuizGenerator._transcribe_lesson(lesson_file, app.config)
    finally:
        if lesson_file.exists():
            try:
                lesson_file.unlink()
            except PermissionError:
                pass

    assert observed["extract_calls"] == 1
    assert observed["transcribed"] == ["chunk_000.mp3", "chunk_001.mp3"]
    assert chunk_count == 2
    assert "transcript for chunk_000" in transcript_text
    assert "transcript for chunk_001" in transcript_text


def test_openai_quota_error_is_reported_clearly():
    error_body = (
        b'{"error":{"message":"You exceeded your current quota, please check your plan and billing details.",'
        b'"type":"insufficient_quota","code":"insufficient_quota"}}'
    )
    http_error = HTTPError(
        url="https://api.openai.com/v1/audio/transcriptions",
        code=429,
        msg="Too Many Requests",
        hdrs=None,
        fp=BytesIO(error_body),
    )

    normalized = OpenAIQuizGenerator._normalize_http_error(http_error)

    assert normalized.status_code == 503
    assert "available quota or billing" in str(normalized)


def test_transcript_below_minimum_is_rejected_and_marked(app, monkeypatch):
    def fake_get_or_create_transcript(video, config, **_kwargs):
        return {
            "text": "Earth rotates daily.",
            "excerpt": "Earth rotates daily.",
            "model_name": "gpt-4o-mini-transcribe",
            "chunk_count": 1,
            "status": "completed",
        }

    monkeypatch.setattr(OpenAIQuizGenerator, "_get_or_create_transcript", fake_get_or_create_transcript)

    TEST_VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    lesson_file = TEST_VIDEO_DIR / f"brief-transcript-{uuid.uuid4().hex}.mp4"
    lesson_file.write_bytes(b"brief")

    with app.app_context():
        app.config["OPENAI_API_KEY"] = "test-key"
        app.config["QUIZ_AI_MIN_TRANSCRIPT_CHARS"] = 30

        video = Video(
            title="Short Lesson",
            description="A short narrated lesson",
            file_path=str(lesson_file),
            creator_id=1,
        )
        db.session.add(video)
        db.session.commit()

        try:
            OpenAIQuizGenerator.generate_quiz_definition(video, question_count=3, config=app.config)
            assert False, "Expected QuizGenerationError for transcript below minimum threshold"
        except QuizGenerationError as exc:
            assert "reliable AI quiz" in str(exc)

        transcript_cache = VideoTranscript.query.filter_by(video_id=video.id).first()
        assert transcript_cache is not None
        assert str(transcript_cache.error_message or "").startswith("insufficient_transcript:")

    if lesson_file.exists():
        try:
            lesson_file.unlink()
        except PermissionError:
            pass


def test_tiny_transcript_is_rejected_clearly(app, monkeypatch):
    def fake_get_or_create_transcript(video, config, **_kwargs):
        return {
            "text": "Hi",
            "excerpt": "Hi",
            "model_name": "gpt-4o-mini-transcribe",
            "chunk_count": 1,
            "status": "completed",
        }

    monkeypatch.setattr(OpenAIQuizGenerator, "_get_or_create_transcript", fake_get_or_create_transcript)

    TEST_VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    lesson_file = TEST_VIDEO_DIR / f"tiny-transcript-{uuid.uuid4().hex}.mp4"
    lesson_file.write_bytes(b"tiny")

    with app.app_context():
        app.config["OPENAI_API_KEY"] = "test-key"

        video = Video(
            title="Silent Lesson",
            description="Almost no narration",
            file_path=str(lesson_file),
            creator_id=1,
        )
        db.session.add(video)
        db.session.commit()

        try:
            OpenAIQuizGenerator.generate_quiz_definition(video, question_count=3, config=app.config)
            assert False, "Expected QuizGenerationError for tiny transcript"
        except QuizGenerationError as exc:
            assert "did not produce enough spoken transcript" in str(exc)

    if lesson_file.exists():
        try:
            lesson_file.unlink()
        except PermissionError:
            pass


def test_quiz_generation_can_include_sampled_video_frames(app, monkeypatch):
    captured = {}

    def fake_build_video_frame_inputs(lesson_file, config):
        return [
            {
                "type": "input_image",
                "image_url": "data:image/jpeg;base64,AAA",
                "detail": "low",
            },
            {
                "type": "input_image",
                "image_url": "data:image/jpeg;base64,BBB",
                "detail": "low",
            },
        ]

    def fake_post_json(url, api_key, payload):
        captured["url"] = url
        captured["payload"] = payload
        return {
            "output_text": (
                '{"title":"Visual quiz","description":"Uses transcript and frames","questions":['
                '{"id":"q1","question":"What appears on screen?","options":["A diagram","Nothing","Billing","Spam"],'
                '"correct_index":0,"explanation":"The sampled frame showed a diagram."},'
                '{"id":"q2","question":"What supports the quiz?","options":["Transcript and frames","Only billing","Only comments","Nothing"],'
                '"correct_index":0,"explanation":"The request included both transcript text and frame images."},'
                '{"id":"q3","question":"How many frame inputs were attached?","options":["Two","Zero","One","Five"],'
                '"correct_index":0,"explanation":"The test attached two sampled frames."}'
                ']}'
            )
        }

    monkeypatch.setattr(OpenAIQuizGenerator, "_build_video_frame_inputs", fake_build_video_frame_inputs)
    monkeypatch.setattr(OpenAIQuizGenerator, "_post_json", fake_post_json)

    with app.app_context():
        app.config["OPENAI_API_KEY"] = "test-key"

        video = Video(
            title="Visual Lesson",
            description="Lesson with diagrams",
            file_path="uploads/videos/visual-lesson.mp4",
            creator_id=1,
            category="science",
        )
        payload = OpenAIQuizGenerator._generate_quiz_from_transcript(
            video=video,
            transcript="The lesson explains the diagram in detail.",
            question_count=3,
            config=app.config,
            transcript_is_brief=False,
        )

    user_content = captured["payload"]["input"][1]["content"]
    assert user_content[0]["type"] == "input_text"
    assert user_content[1]["type"] == "input_image"
    assert user_content[2]["type"] == "input_image"
    assert payload["video_frame_count"] == 2
