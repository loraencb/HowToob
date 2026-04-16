def test_lesson_quiz_contract_and_submission(auth_client):
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
    assert get_quiz.status_code == 200
    quiz_payload = get_quiz.get_json()
    assert quiz_payload["video"]["title"] == "Quiz Lesson"
    assert quiz_payload["quiz"]["mode"] == "prototype"
    assert quiz_payload["quiz"]["question_count"] == len(quiz_payload["quiz"]["questions"])

    answers = [
        {"question_id": question["id"], "selected_index": 0}
        for question in quiz_payload["quiz"]["questions"]
    ]

    submit_quiz = auth_client.post(f"/videos/{video_id}/quiz/submissions", json={
        "answers": answers
    })
    assert submit_quiz.status_code == 201
    result = submit_quiz.get_json()["result"]
    assert result["passed"] is True
    assert result["score"] == 100.0

    get_quiz_again = auth_client.get(f"/videos/{video_id}/quiz")
    assert get_quiz_again.status_code == 200
    assert get_quiz_again.get_json()["latest_attempt"]["score"] == 100.0


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
