import base64
import json
import mimetypes
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import current_app

from ...extensions import db
from ...models.video_transcript import VideoTranscript
from ...utils.category_taxonomy import get_category_metadata


TRANSCRIPTION_FILE_LIMIT_BYTES = 25 * 1024 * 1024
INSUFFICIENT_TRANSCRIPT_PREFIX = "insufficient_transcript:"
OPENAI_API_KEY_PLACEHOLDERS = {
    "replace-this-in-digitalocean",
    "replace-me",
    "your-openai-api-key",
    "your_openai_api_key",
    "set-in-digitalocean",
    "__set_in_digitalocean__",
}


def is_placeholder_openai_api_key(api_key):
    normalized = str(api_key or "").strip().lower()
    if not normalized:
        return False

    return (
        normalized in OPENAI_API_KEY_PLACEHOLDERS
        or normalized.startswith("replace-")
        or normalized.startswith("your-")
        or normalized.startswith("${")
        or normalized.startswith("<")
    )


class QuizGenerationError(Exception):
    def __init__(self, message, status_code=400, details=None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class OpenAIQuizGenerator:
    @staticmethod
    def _mark_transcript_limitation(video_id, message):
        cache_entry = VideoTranscript.query.filter_by(video_id=video_id).first()
        if not cache_entry:
            cache_entry = VideoTranscript(video_id=video_id, status="completed")
            db.session.add(cache_entry)

        cache_entry.error_message = f"{INSUFFICIENT_TRANSCRIPT_PREFIX} {message}"
        db.session.commit()

    @staticmethod
    def generate_quiz_definition(video, question_count=None, config=None):
        config = config or current_app.config
        api_key = str(config.get("OPENAI_API_KEY") or "").strip()
        if not api_key:
            raise QuizGenerationError(
                "AI quiz generation is not configured on the backend. Set OPENAI_API_KEY first.",
                status_code=503,
            )
        if is_placeholder_openai_api_key(api_key):
            raise QuizGenerationError(
                "AI quiz generation is configured with a placeholder OPENAI_API_KEY. "
                "Set the real OpenAI API key as a secret in DigitalOcean and redeploy.",
                status_code=503,
            )

        requested_question_count = question_count
        if requested_question_count is None:
            requested_question_count = config.get("QUIZ_AI_DEFAULT_QUESTION_COUNT", 10)

        try:
            normalized_question_count = int(requested_question_count)
        except (TypeError, ValueError) as exc:
            raise QuizGenerationError("question_count must be an integer between 3 and 10") from exc

        if normalized_question_count < 3 or normalized_question_count > 10:
            raise QuizGenerationError("question_count must be an integer between 3 and 10")

        lesson_file = Path(str(video.file_path or "")).expanduser()
        if not lesson_file.exists() or not lesson_file.is_file():
            raise QuizGenerationError(
                "The uploaded lesson file is not available on this server, so AI quiz generation cannot read it. "
                "If this happened after a DigitalOcean redeploy or restart, re-upload the lesson or move uploads "
                "to durable storage such as DigitalOcean Spaces.",
                status_code=400,
            )

        transcript_bundle = OpenAIQuizGenerator._get_or_create_transcript(video, config)
        cleaned_transcript = str(transcript_bundle.get("text") or "").strip()
        transcript_char_count = len(cleaned_transcript)
        min_transcript_chars = max(
            10,
            int(config.get("QUIZ_AI_MIN_TRANSCRIPT_CHARS", 30) or 30),
        )
        if transcript_char_count < min_transcript_chars:
            limitation_message = (
                "The lesson did not produce enough spoken transcript to generate a reliable AI quiz. "
                "Try a lesson with clearer narration or add more spoken guidance."
            )
            OpenAIQuizGenerator._mark_transcript_limitation(video.id, limitation_message)
            raise QuizGenerationError(limitation_message, status_code=400)

        max_transcript_chars = max(1000, int(config.get("QUIZ_AI_MAX_TRANSCRIPT_CHARS", 12000) or 12000))
        prompt_transcript = cleaned_transcript[:max_transcript_chars]
        generated = OpenAIQuizGenerator._generate_quiz_from_transcript(
            video=video,
            transcript=prompt_transcript,
            question_count=normalized_question_count,
            config=config,
            transcript_is_brief=False,
        )

        generated["provider"] = "openai"
        generated["source"] = "ai_generated_from_transcript"
        generated["question_count_requested"] = normalized_question_count
        generated["transcript_char_count"] = transcript_char_count
        generated["transcript_excerpt"] = transcript_bundle.get("excerpt") or cleaned_transcript[:600]
        generated["transcription_model"] = transcript_bundle.get("model_name") or config.get("OPENAI_TRANSCRIPTION_MODEL")
        generated["quiz_model"] = config.get("OPENAI_QUIZ_MODEL")
        generated["transcript_chunk_count"] = transcript_bundle.get("chunk_count", 1)
        generated["transcript_cache_status"] = transcript_bundle.get("status", "completed")
        generated["transcript_quality"] = "full"
        generated["video_frame_count"] = generated.get("video_frame_count", 0)
        return generated

    @staticmethod
    def _get_or_create_transcript(video, config):
        lesson_file = Path(str(video.file_path or "")).expanduser()
        file_size = lesson_file.stat().st_size
        cache_entry = VideoTranscript.query.filter_by(video_id=video.id).first()
        if not cache_entry:
            cache_entry = VideoTranscript(video_id=video.id)
            db.session.add(cache_entry)
            db.session.commit()

        cache_valid = (
            cache_entry.status == "completed"
            and cache_entry.transcript_text
            and cache_entry.source_file_path == str(lesson_file)
            and int(cache_entry.source_file_size_bytes or 0) == int(file_size)
        )
        if cache_valid:
            return {
                "text": cache_entry.transcript_text,
                "excerpt": cache_entry.transcript_excerpt,
                "model_name": cache_entry.model_name,
                "chunk_count": cache_entry.chunk_count,
                "status": cache_entry.status,
                "cache_hit": True,
            }

        cache_entry.status = "processing"
        cache_entry.error_message = None
        cache_entry.provider = "openai"
        cache_entry.model_name = str(config.get("OPENAI_TRANSCRIPTION_MODEL") or "").strip() or None
        cache_entry.source_file_path = str(lesson_file)
        cache_entry.source_file_size_bytes = int(file_size)
        db.session.commit()

        try:
            transcript_text, chunk_count = OpenAIQuizGenerator._transcribe_lesson(
                lesson_file=lesson_file,
                config=config,
            )
        except QuizGenerationError as exc:
            cache_entry.status = "failed"
            cache_entry.error_message = str(exc)
            cache_entry.chunk_count = 0
            db.session.commit()
            raise

        cache_entry.status = "completed"
        cache_entry.transcript_text = transcript_text
        cache_entry.transcript_excerpt = transcript_text[:600]
        cache_entry.chunk_count = chunk_count
        cache_entry.error_message = None
        db.session.commit()

        return {
            "text": transcript_text,
            "excerpt": cache_entry.transcript_excerpt,
            "model_name": cache_entry.model_name,
            "chunk_count": chunk_count,
            "status": cache_entry.status,
            "cache_hit": False,
        }

    @staticmethod
    def _transcribe_lesson(lesson_file, config):
        lesson_file = Path(lesson_file)
        file_size = lesson_file.stat().st_size
        if file_size <= TRANSCRIPTION_FILE_LIMIT_BYTES:
            transcript_text = OpenAIQuizGenerator._transcribe_source_file(lesson_file, config)
            return str(transcript_text or "").strip(), 1

        ffmpeg_binary = shutil.which(str(config.get("QUIZ_AI_FFMPEG_BINARY") or "ffmpeg"))
        if not ffmpeg_binary:
            raise QuizGenerationError(
                "This lesson is too large for direct transcription and ffmpeg is not available for automatic chunking. Install ffmpeg on the host machine or upload a smaller file.",
                status_code=400,
            )

        with tempfile.TemporaryDirectory(prefix="howtoob-audio-chunks-") as temp_dir:
            chunk_paths = OpenAIQuizGenerator._extract_audio_chunks(
                lesson_file=lesson_file,
                temp_dir=Path(temp_dir),
                ffmpeg_binary=ffmpeg_binary,
                config=config,
            )
            transcripts = [
                OpenAIQuizGenerator._transcribe_source_file(source_path, config)
                for source_path in chunk_paths
            ]
            transcript_text = "\n\n".join(
                str(item or "").strip() for item in transcripts if str(item or "").strip()
            )
            return transcript_text, len(chunk_paths)

    @staticmethod
    def _extract_audio_chunks(lesson_file, temp_dir, ffmpeg_binary, config):
        chunk_seconds = max(60, int(config.get("QUIZ_AI_CHUNK_SECONDS", 600) or 600))
        bitrate_kbps = max(32, int(config.get("QUIZ_AI_AUDIO_BITRATE_KBPS", 64) or 64))
        output_pattern = str(Path(temp_dir) / "chunk_%03d.mp3")
        command = [
            ffmpeg_binary,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(lesson_file),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-b:a",
            f"{bitrate_kbps}k",
            "-f",
            "segment",
            "-segment_time",
            str(chunk_seconds),
            "-reset_timestamps",
            "1",
            output_pattern,
        ]

        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            stderr = str(completed.stderr or "").strip()
            raise QuizGenerationError(
                f"ffmpeg could not split this lesson into transcription chunks. {stderr or 'No stderr output was returned.'}",
                status_code=500,
            )

        chunk_paths = sorted(Path(temp_dir).glob("chunk_*.mp3"))
        if not chunk_paths:
            raise QuizGenerationError(
                "ffmpeg completed, but no audio chunks were produced for transcription.",
                status_code=500,
            )

        return chunk_paths

    @staticmethod
    def _transcribe_source_file(file_path, config):
        response_body = OpenAIQuizGenerator._post_multipart(
            f"{config['OPENAI_API_BASE_URL']}/audio/transcriptions",
            api_key=config["OPENAI_API_KEY"],
            fields={
                "model": config["OPENAI_TRANSCRIPTION_MODEL"],
                "response_format": "text",
            },
            file_field_name="file",
            file_path=file_path,
        )
        return response_body.decode("utf-8", errors="replace")

    @staticmethod
    def _generate_quiz_from_transcript(video, transcript, question_count, config, transcript_is_brief=False):
        creator_name = video.creator.username if getattr(video, "creator", None) else "HowToob creator"
        category = get_category_metadata(video.category)["path_label"] or "General learning"
        level = video.learning_level or "Not specified"
        frame_inputs = OpenAIQuizGenerator._build_video_frame_inputs(
            lesson_file=Path(str(video.file_path or "")).expanduser(),
            config=config,
        )

        schema = {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "questions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "question": {"type": "string"},
                            "options": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                            "correct_index": {"type": "integer"},
                            "explanation": {"type": "string"},
                        },
                        "required": [
                            "id",
                            "question",
                            "options",
                            "correct_index",
                            "explanation",
                        ],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["title", "description", "questions"],
            "additionalProperties": False,
        }

        system_prompt = (
            "You create concise, fair multiple-choice quizzes for a structured learning platform. "
            "Use only evidence that appears in the transcript and lesson metadata. "
            "Do not invent details that the lesson does not support. "
            "Return exactly the requested number of questions. "
            "Each question must have exactly four options, one correct answer, and a short explanation grounded in the transcript."
        )
        if transcript_is_brief:
            system_prompt += (
                " The transcript for this lesson is brief, so keep questions conservative and anchored to what is clearly supported by the transcript and lesson metadata."
            )
        if frame_inputs:
            system_prompt += (
                " You will also receive sampled video frames from the lesson. Use them as supporting visual evidence for on-screen text, diagrams, demonstrations, or code, but do not invent details that are not visible."
            )

        user_prompt = (
            f"Create a {question_count}-question quiz for this HowToob lesson.\n\n"
            f"Lesson title: {video.title}\n"
            f"Lesson description: {video.description or 'No description provided.'}\n"
            f"Category: {category}\n"
            f"Learning level: {level}\n"
            f"Creator: {creator_name}\n\n"
            "Transcript:\n"
            f"{transcript}\n\n"
            "Requirements:\n"
            f"- Return exactly {question_count} questions.\n"
            "- Keep the quiz useful for learners who actually watched the lesson.\n"
            "- Prefer concept understanding over trivial wording.\n"
            "- Use stable snake_case ids like lesson_topic_1.\n"
        )
        if frame_inputs:
            user_prompt += (
                f"- You have {len(frame_inputs)} sampled lesson frames after this text. Use them to reinforce what appears on screen.\n"
            )

        user_content = [{"type": "input_text", "text": user_prompt}]
        user_content.extend(frame_inputs)

        response_payload = OpenAIQuizGenerator._post_json(
            f"{config['OPENAI_API_BASE_URL']}/responses",
            api_key=config["OPENAI_API_KEY"],
            payload={
                "model": config["OPENAI_QUIZ_MODEL"],
                "input": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                "max_output_tokens": 2000,
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "lesson_quiz",
                        "strict": True,
                        "schema": schema,
                    }
                },
            },
        )

        output_text = OpenAIQuizGenerator._extract_output_text(response_payload)
        try:
            generated = json.loads(output_text)
        except json.JSONDecodeError as exc:
            raise QuizGenerationError(
                "The AI quiz generator returned malformed JSON, so the quiz could not be saved.",
                status_code=502,
            ) from exc

        generated["video_frame_count"] = len(frame_inputs)
        return generated

    @staticmethod
    def _build_video_frame_inputs(lesson_file, config):
        if not bool(config.get("QUIZ_AI_INCLUDE_VIDEO_FRAMES", True)):
            return []

        ffmpeg_binary = shutil.which(str(config.get("QUIZ_AI_FFMPEG_BINARY") or "ffmpeg"))
        ffprobe_binary = OpenAIQuizGenerator._resolve_ffprobe_binary(config)
        if not ffmpeg_binary or not ffprobe_binary:
            return []

        lesson_file = Path(lesson_file)
        if not lesson_file.exists() or not lesson_file.is_file():
            return []

        timestamps = OpenAIQuizGenerator._build_frame_timestamps(
            lesson_file=lesson_file,
            ffprobe_binary=ffprobe_binary,
            config=config,
        )
        if not timestamps:
            return []

        with tempfile.TemporaryDirectory(prefix="howtoob-quiz-frames-") as temp_dir:
            frame_paths = OpenAIQuizGenerator._extract_video_frames(
                lesson_file=lesson_file,
                temp_dir=Path(temp_dir),
                ffmpeg_binary=ffmpeg_binary,
                timestamps=timestamps,
                config=config,
            )

            frame_inputs = []
            for frame_path in frame_paths:
                try:
                    frame_inputs.append(OpenAIQuizGenerator._build_input_image(frame_path))
                except OSError:
                    continue

            return frame_inputs

    @staticmethod
    def _resolve_ffprobe_binary(config):
        configured_binary = str(config.get("QUIZ_AI_FFMPEG_BINARY") or "ffmpeg")
        configured_path = Path(configured_binary)
        sibling_ffprobe = configured_path.with_name("ffprobe.exe" if configured_path.suffix.lower() == ".exe" else "ffprobe")
        if configured_path.parent and sibling_ffprobe.exists():
            return str(sibling_ffprobe)

        return shutil.which("ffprobe")

    @staticmethod
    def _build_frame_timestamps(lesson_file, ffprobe_binary, config):
        sample_count = max(1, int(config.get("QUIZ_AI_FRAME_SAMPLE_COUNT", 4) or 4))
        duration_seconds = OpenAIQuizGenerator._probe_video_duration(lesson_file, ffprobe_binary)
        if duration_seconds is None or duration_seconds <= 1:
            return [0.0]

        if sample_count == 1:
            return [max(0.0, duration_seconds / 2)]

        step = duration_seconds / (sample_count + 1)
        timestamps = []
        for index in range(1, sample_count + 1):
            timestamp = max(0.0, min(duration_seconds - 0.1, step * index))
            timestamps.append(round(timestamp, 2))

        return timestamps

    @staticmethod
    def _probe_video_duration(lesson_file, ffprobe_binary):
        command = [
            ffprobe_binary,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(lesson_file),
        ]
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            return None

        try:
            return float(str(completed.stdout or "").strip())
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _extract_video_frames(lesson_file, temp_dir, ffmpeg_binary, timestamps, config):
        frame_width = max(320, int(config.get("QUIZ_AI_FRAME_WIDTH", 768) or 768))
        frame_paths = []

        for index, timestamp in enumerate(timestamps, start=1):
            output_path = Path(temp_dir) / f"frame_{index:02d}.jpg"
            command = [
                ffmpeg_binary,
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-ss",
                str(timestamp),
                "-i",
                str(lesson_file),
                "-frames:v",
                "1",
                "-vf",
                f"scale='min({frame_width},iw)':-2",
                str(output_path),
            ]
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
            )
            if completed.returncode == 0 and output_path.exists():
                frame_paths.append(output_path)

        return frame_paths

    @staticmethod
    def _build_input_image(file_path):
        frame_bytes = Path(file_path).read_bytes()
        encoded = base64.b64encode(frame_bytes).decode("ascii")
        mime_type = mimetypes.guess_type(str(file_path))[0] or "image/jpeg"
        return {
            "type": "input_image",
            "image_url": f"data:{mime_type};base64,{encoded}",
            "detail": "low",
        }

    @staticmethod
    def _extract_output_text(response_payload):
        direct_output_text = response_payload.get("output_text")
        if isinstance(direct_output_text, str) and direct_output_text.strip():
            return direct_output_text

        output_chunks = []
        for item in response_payload.get("output", []):
            if item.get("type") != "message":
                continue

            for content in item.get("content", []):
                content_type = content.get("type")
                if content_type == "output_text" and content.get("text"):
                    output_chunks.append(content["text"])
                elif content_type == "refusal" and content.get("refusal"):
                    raise QuizGenerationError(
                        f"OpenAI refused to generate a quiz for this lesson: {content['refusal']}",
                        status_code=502,
                    )

        if output_chunks:
            return "".join(output_chunks)

        error_message = (
            response_payload.get("error", {}) or {}
        ).get("message")
        raise QuizGenerationError(
            error_message or "OpenAI did not return any quiz content for this lesson.",
            status_code=502,
        )

    @staticmethod
    def _post_json(url, api_key, payload):
        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            raise OpenAIQuizGenerator._normalize_http_error(exc) from exc
        except URLError as exc:
            raise QuizGenerationError(
                "Could not reach the OpenAI API for AI quiz generation.",
                status_code=502,
            ) from exc

    @staticmethod
    def _post_multipart(url, api_key, fields, file_field_name, file_path):
        boundary = f"----HowToobBoundary{uuid.uuid4().hex}"
        body = OpenAIQuizGenerator._build_multipart_body(
            boundary=boundary,
            fields=fields,
            file_field_name=file_field_name,
            file_path=file_path,
        )

        request = Request(
            url,
            data=body,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Content-Length": str(len(body)),
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=180) as response:
                return response.read()
        except HTTPError as exc:
            raise OpenAIQuizGenerator._normalize_http_error(exc) from exc
        except URLError as exc:
            raise QuizGenerationError(
                "Could not reach the OpenAI transcription API for this lesson.",
                status_code=502,
            ) from exc

    @staticmethod
    def _build_multipart_body(boundary, fields, file_field_name, file_path):
        lines = []
        for field_name, field_value in fields.items():
            lines.extend(
                [
                    f"--{boundary}".encode("utf-8"),
                    f'Content-Disposition: form-data; name="{field_name}"'.encode("utf-8"),
                    b"",
                    str(field_value).encode("utf-8"),
                ]
            )

        mime_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        filename = os.path.basename(str(file_path))
        file_bytes = Path(file_path).read_bytes()
        lines.extend(
            [
                f"--{boundary}".encode("utf-8"),
                (
                    f'Content-Disposition: form-data; name="{file_field_name}"; filename="{filename}"'
                ).encode("utf-8"),
                f"Content-Type: {mime_type}".encode("utf-8"),
                b"",
                file_bytes,
            ]
        )
        lines.append(f"--{boundary}--".encode("utf-8"))
        lines.append(b"")
        return b"\r\n".join(lines)

    @staticmethod
    def _normalize_http_error(exc):
        status_code = getattr(exc, "code", 502) or 502
        raw_body = exc.read().decode("utf-8", errors="replace")
        message = raw_body
        normalized_message = raw_body

        try:
            payload = json.loads(raw_body)
            message = (
                (payload.get("error") or {}).get("message")
                or payload.get("message")
                or raw_body
            )
            normalized_message = str(message or "").lower()
        except json.JSONDecodeError:
            normalized_message = str(raw_body or "").lower()

        if status_code == 401:
            return QuizGenerationError(
                "OpenAI rejected the API key for AI quiz generation.",
                status_code=502,
            )

        if "quota" in normalized_message or "billing" in normalized_message or "insufficient_quota" in normalized_message:
            return QuizGenerationError(
                "OpenAI rejected AI quiz generation because this API project does not currently have available quota or billing. Add API credits or enable billing in the OpenAI Platform project, then try again.",
                status_code=503,
            )

        if status_code == 413:
            return QuizGenerationError(
                "OpenAI rejected this lesson file because it is too large to transcribe directly.",
                status_code=400,
            )

        return QuizGenerationError(
            f"OpenAI quiz generation failed: {message}",
            status_code=502 if status_code >= 500 else 400,
        )
