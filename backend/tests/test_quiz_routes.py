def test_quiz_is_unavailable_without_definition(auth_client):
    create_video = auth_client.post("/videos/", json={
        "title": "Quiz Lesson",
        "description": "Lesson with quiz metadata",
        "file_path": "/videos/quiz.mp4",
        "category": "backend",
        "learning_level": "intermediate",
        "access_tier": 2,
    })
    video_id = create_video.get_json()["id"]

    auth_client.post("/users/me/progress", json={
        "video_id": video_id,
        "watched_seconds": 45,
        "duration_seconds": 100,
    })

    get_quiz = auth_client.get(f"/videos/{video_id}/quiz")
    assert get_quiz.status_code == 404
    assert get_quiz.get_json()["error"] == "Quiz unavailable for this lesson"

    submit_quiz = auth_client.post(f"/videos/{video_id}/quiz/submissions", json={
        "answers": []
    })
    assert submit_quiz.status_code == 404
    assert submit_quiz.get_json()["error"] == "Quiz unavailable for this lesson"


def test_static_quiz_definition_is_used_and_submission_is_structured(client):
    client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })
    created = client.post("/videos/", json={
        "title": "Static Quiz Lesson",
        "description": "Lesson with a stored quiz",
        "file_path": "/videos/static-quiz.mp4",
    })
    video_id = created.get_json()["id"]

    defined = client.put(f"/videos/{video_id}/quiz", json={
        "title": "Static backend quiz",
        "description": "Stored question set",
        "questions": [
            {
                "id": "q1",
                "question": "What kind of quiz is this?",
                "options": ["A static quiz", "A hidden billing prompt"],
                "correct_index": 0,
                "explanation": "This definition is stored on the backend per video.",
            },
            {
                "id": "q2",
                "question": "Who can manage quiz definitions for this lesson?",
                "options": ["The video owner or an admin", "Any anonymous viewer"],
                "correct_index": 0,
            },
        ],
    })
    assert defined.status_code == 200
    assert defined.get_json()["quiz"]["mode"] == "static"

    fetched = client.get(f"/videos/{video_id}/quiz")
    assert fetched.status_code == 200
    fetched_data = fetched.get_json()
    assert fetched_data["quiz"]["mode"] == "static"
    assert fetched_data["quiz"]["question_count"] == 2

    invalid_submission = client.post(f"/videos/{video_id}/quiz/submissions", json={
        "answers": [{"question_id": "q1", "selected_index": 0}]
    })
    assert invalid_submission.status_code == 400
    assert invalid_submission.get_json()["error"] == "answers must include every question exactly once"

    valid_submission = client.post(f"/videos/{video_id}/quiz/submissions", json={
        "answers": [
            {"question_id": "q1", "selected_index": 0},
            {"question_id": "q2", "selected_index": 0},
        ]
    })
    assert valid_submission.status_code == 201
    result = valid_submission.get_json()["result"]
    assert result["summary"]["passed"] is True
    assert len(result["question_results"]) == 2
    assert result["question_results"][0]["correct"] is True


def test_creator_can_generate_ai_quiz_definition(auth_client, monkeypatch):
    create_video = auth_client.post("/videos/", json={
        "title": "AI Quiz Lesson",
        "description": "Lesson prepared for AI quiz generation",
        "file_path": "/videos/ai-quiz.mp4",
        "category": "science",
    })
    video_id = create_video.get_json()["id"]

    def fake_generate(video, question_count=None, config=None):
        return {
            "title": "AI Quiz Lesson check",
            "description": "Generated from transcript",
            "questions": [
                {
                    "id": "lesson_topic_1",
                    "question": "What topic does the lesson focus on?",
                    "options": ["science", "billing", "moderation", "gaming"],
                    "correct_index": 0,
                    "explanation": "The transcript repeatedly focused on science concepts.",
                },
                {
                    "id": "lesson_topic_2",
                    "question": "How many stars are in the generated quiz demo?",
                    "options": ["One", "Two", "Three", "Four"],
                    "correct_index": 2,
                    "explanation": "This deterministic test fixture asks for the third option.",
                },
                {
                    "id": "lesson_topic_3",
                    "question": "Who can trigger AI generation here?",
                    "options": ["The lesson owner", "Anonymous users", "Any viewer", "Nobody"],
                    "correct_index": 0,
                    "explanation": "The backend route is creator/admin only.",
                },
            ],
            "provider": "openai",
            "source": "ai_generated_from_transcript",
            "question_count_requested": question_count or 10,
            "transcript_char_count": 420,
            "transcript_excerpt": "A short transcript excerpt",
            "transcription_model": "gpt-4o-mini-transcribe",
            "quiz_model": "gpt-4o-mini",
        }

    monkeypatch.setattr(
        "backend.src.app.services.quiz.service.OpenAIQuizGenerator.generate_quiz_definition",
        fake_generate,
    )

    generated = auth_client.post(f"/videos/{video_id}/quiz/generate", json={
        "question_count": 3,
    })
    assert generated.status_code == 200
    payload = generated.get_json()
    assert payload["quiz"]["source"] == "ai_generated_from_transcript"
    assert payload["quiz"]["question_count"] == 3
    assert payload["generation"]["provider"] == "openai"
    assert payload["generation"]["question_count_saved"] == 3

    fetched = auth_client.get(f"/videos/{video_id}/quiz")
    assert fetched.status_code == 200
    assert fetched.get_json()["quiz"]["mode"] == "static"
    assert fetched.get_json()["quiz"]["question_count"] == 3


def test_generate_ai_quiz_requires_overwrite_for_existing_definition(auth_client, monkeypatch):
    create_video = auth_client.post("/videos/", json={
        "title": "Existing Quiz Lesson",
        "description": "Lesson with stored quiz definition",
        "file_path": "/videos/existing-ai-quiz.mp4",
    })
    video_id = create_video.get_json()["id"]

    auth_client.put(f"/videos/{video_id}/quiz", json={
        "title": "Existing quiz",
        "questions": [
            {
                "id": "q1",
                "question": "Existing question?",
                "options": ["Yes", "No"],
                "correct_index": 0,
            }
        ],
    })

    generated = auth_client.post(f"/videos/{video_id}/quiz/generate", json={
        "question_count": 4,
    })
    assert generated.status_code == 409
    assert "overwrite=true" in generated.get_json()["error"]


def test_non_owner_cannot_generate_ai_quiz(client, monkeypatch):
    client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })
    created = client.post("/videos/", json={
        "title": "Owner Lesson",
        "description": "Only the owner should generate quizzes",
        "file_path": "/videos/owner-ai-quiz.mp4",
    })
    video_id = created.get_json()["id"]
    client.post("/auth/logout")

    client.post("/auth/login", json={
        "email": "test2@example.com",
        "password": "password123"
    })

    generated = client.post(f"/videos/{video_id}/quiz/generate", json={
        "question_count": 10,
    })
    assert generated.status_code == 403
    assert generated.get_json()["error"] == "You can only manage quizzes for your own videos"


def test_generate_ai_quiz_reports_missing_backend_configuration(auth_client):
    auth_client.application.config["OPENAI_API_KEY"] = ""
    create_video = auth_client.post("/videos/", json={
        "title": "No Key Quiz Lesson",
        "description": "Missing API key should surface cleanly",
        "file_path": "/videos/no-key-ai-quiz.mp4",
    })
    video_id = create_video.get_json()["id"]

    generated = auth_client.post(f"/videos/{video_id}/quiz/generate", json={
        "question_count": 10,
    })
    assert generated.status_code == 503
    assert "OPENAI_API_KEY" in generated.get_json()["error"]
