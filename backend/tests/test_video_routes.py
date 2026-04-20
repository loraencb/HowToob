import io
from datetime import UTC, datetime

from backend.src.app.extensions import db
from backend.src.app.models import Playlist, PlaylistVideo, QuizAttempt, QuizDefinition, VideoTranscript

def test_home_route(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.get_json()["message"] == "HowTube backend is running"


def test_create_video(auth_client):
    response = auth_client.post("/videos/", json={
        "title": "Backend Test Video",
        "description": "Testing create route",
        "file_path": "/videos/test.mp4"
    })

    assert response.status_code == 201
    data = response.get_json()
    assert data["title"] == "Backend Test Video"
    assert data["creator_id"] == 1
    assert data["views"] == 0


def test_get_all_videos(auth_client):
    auth_client.post("/videos/", json={
        "title": "Video A",
        "description": "First",
        "file_path": "/videos/a.mp4"
    })

    response = auth_client.get("/videos/")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_get_single_video_increments_views(auth_client):
    create_response = auth_client.post("/videos/", json={
        "title": "View Test",
        "description": "Testing views",
        "file_path": "/videos/view.mp4"
    })

    video_id = create_response.get_json()["id"]

    response1 = auth_client.get(f"/videos/{video_id}")
    assert response1.status_code == 200
    assert response1.get_json()["views"] == 1

    response2 = auth_client.get(f"/videos/{video_id}")
    assert response2.status_code == 200
    assert response2.get_json()["views"] == 2


def test_remote_video_file_route_redirects_to_temporary_storage_url(auth_client, monkeypatch):
    monkeypatch.setattr(
        "backend.src.app.routes.video.routes.build_storage_access_url",
        lambda storage_path: "https://cdn.example.test/signed-lesson.mp4",
    )

    create_response = auth_client.post("/videos/", json={
        "title": "Stored In Spaces",
        "description": "Remote media should be served through a signed URL",
        "file_path": "spaces://howtoob/howtoob/videos/signed-lesson.mp4",
    })

    video_url = create_response.get_json()["video_url"]
    response = auth_client.get(video_url)

    assert response.status_code == 302
    assert response.headers["Location"] == "https://cdn.example.test/signed-lesson.mp4"


def test_update_video(auth_client):
    create_response = auth_client.post("/videos/", json={
        "title": "Old Title",
        "description": "Old description",
        "file_path": "/videos/update.mp4"
    })

    video_id = create_response.get_json()["id"]

    update_response = auth_client.put(f"/videos/{video_id}", json={
        "title": "New Title",
        "description": "New description"
    })

    assert update_response.status_code == 200
    data = update_response.get_json()
    assert data["title"] == "New Title"
    assert data["description"] == "New description"


def test_delete_video(auth_client):
    create_response = auth_client.post("/videos/", json={
        "title": "Delete Me",
        "description": "To be deleted",
        "file_path": "/videos/delete.mp4"
    })

    video_id = create_response.get_json()["id"]

    delete_response = auth_client.delete(f"/videos/{video_id}")
    assert delete_response.status_code == 200

    get_response = auth_client.get(f"/videos/{video_id}")
    assert get_response.status_code == 404


def test_delete_video_removes_transcript_cache(auth_client):
    create_response = auth_client.post("/videos/", json={
        "title": "Delete With Transcript",
        "description": "Video with cached transcript",
        "file_path": "/videos/delete-transcript.mp4"
    })

    video_id = create_response.get_json()["id"]

    with auth_client.application.app_context():
        transcript = VideoTranscript(
            video_id=video_id,
            provider="openai",
            model_name="gpt-4o-mini-transcribe",
            status="completed",
            transcript_text="A cached transcript for delete coverage.",
            transcript_excerpt="A cached transcript for delete coverage.",
            source_file_path="/videos/delete-transcript.mp4",
            source_file_size_bytes=1234,
            chunk_count=1,
        )
        db.session.add(transcript)
        db.session.commit()
        transcript_id = transcript.id

    delete_response = auth_client.delete(f"/videos/{video_id}")
    assert delete_response.status_code == 200

    with auth_client.application.app_context():
        assert db.session.get(VideoTranscript, transcript_id) is None


def test_delete_video_removes_quiz_and_playlist_related_records(auth_client):
    create_response = auth_client.post("/videos/", json={
        "title": "Delete With Learning Data",
        "description": "Video with quiz and playlist data",
        "file_path": "/videos/delete-learning-data.mp4"
    })

    video_id = create_response.get_json()["id"]

    with auth_client.application.app_context():
        playlist = Playlist(
            user_id=1,
            title="Delete coverage path",
            description="Playlist attached to video delete coverage",
            is_default=False,
        )
        db.session.add(playlist)
        db.session.flush()

        playlist_item = PlaylistVideo(
            playlist_id=playlist.id,
            video_id=video_id,
            position=1,
        )
        quiz_definition = QuizDefinition(
            video_id=video_id,
            title="Delete coverage quiz",
            description="Quiz attached to a lesson that will be deleted",
            questions=[
                {
                    "id": "q1",
                    "question": "What is being tested?",
                    "options": ["Deletion", "Search", "Upload"],
                    "correct_index": 0,
                    "explanation": "This verifies cascade cleanup.",
                }
            ],
        )
        quiz_attempt = QuizAttempt(
            user_id=1,
            video_id=video_id,
            mode="static",
            score=100,
            passed=True,
            question_count=1,
            correct_count=1,
            answers=[{"question_id": "q1", "selected_index": 0}],
            submitted_at=datetime.now(UTC),
        )

        db.session.add_all([playlist_item, quiz_definition, quiz_attempt])
        db.session.commit()

        playlist_item_id = playlist_item.id
        quiz_definition_id = quiz_definition.id
        quiz_attempt_id = quiz_attempt.id

    delete_response = auth_client.delete(f"/videos/{video_id}")
    assert delete_response.status_code == 200

    with auth_client.application.app_context():
        assert db.session.get(QuizDefinition, quiz_definition_id) is None
        assert db.session.get(QuizAttempt, quiz_attempt_id) is None
        assert db.session.get(PlaylistVideo, playlist_item_id) is None


def test_feed_endpoint(auth_client):
    auth_client.post("/videos/", json={
        "title": "Feed Video",
        "description": "For feed",
        "file_path": "/videos/feed.mp4"
    })

    response = auth_client.get("/videos/feed")
    assert response.status_code == 200

    data = response.get_json()
    assert "page" in data
    assert "limit" in data
    assert "total" in data
    assert "pages" in data
    assert "results" in data

    assert isinstance(data["results"], list)
    assert len(data["results"]) >= 1
    assert "like_count" in data["results"][0]
    assert "rating_count" in data["results"][0]
    assert "average_rating" in data["results"][0]
    assert "comment_count" in data["results"][0]


def test_get_video_stats(auth_client):
    create_response = auth_client.post("/videos/", json={
        "title": "Stats Video",
        "description": "Stats test",
        "file_path": "/videos/stats.mp4"
    })

    video_id = create_response.get_json()["id"]

    auth_client.post("/social/comments", json={
        "content": "Nice stats",
        "video_id": video_id
    })

    auth_client.post("/social/ratings", json={
        "video_id": video_id,
        "rating": 4,
    })

    auth_client.get(f"/videos/{video_id}")
    auth_client.get(f"/videos/{video_id}")

    response = auth_client.get(f"/videos/{video_id}/stats")
    assert response.status_code == 200

    data = response.get_json()
    assert data["video_id"] == video_id
    assert data["views"] == 2
    assert data["likes"] == 1
    assert data["rating_count"] == 1
    assert data["average_rating"] == 4.0
    assert data["comments"] == 1


def test_get_creator_videos(auth_client):
    auth_client.post("/videos/", json={
        "title": "Creator Video 1",
        "description": "One",
        "file_path": "/videos/one.mp4"
    })

    auth_client.post("/videos/", json={
        "title": "Creator Video 2",
        "description": "Two",
        "file_path": "/videos/two.mp4"
    })

    response = auth_client.get("/videos/creator/1")
    assert response.status_code == 200

    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 2


def test_create_video_requires_login(client):
    response = client.post("/videos/", json={
        "title": "Blocked Video",
        "description": "Should fail",
        "file_path": "/videos/blocked.mp4"
    })

    assert response.status_code == 401
    assert response.get_json()["error"] == "Authentication required"


def test_cannot_update_other_users_video(client):
    client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })

    create_response = client.post("/videos/", json={
        "title": "Owner Video",
        "description": "Owned by user1",
        "file_path": "/videos/owner.mp4"
    })

    video_id = create_response.get_json()["id"]

    client.post("/auth/logout")

    client.post("/auth/login", json={
        "email": "test2@example.com",
        "password": "password123"
    })

    response = client.put(f"/videos/{video_id}", json={
        "title": "Hacked Title"
    })

    assert response.status_code == 403
    assert response.get_json()["error"] == "You can only update your own videos"


def test_cannot_delete_other_users_video(client):
    client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })

    create_response = client.post("/videos/", json={
        "title": "Delete Owner Video",
        "description": "Owned by user1",
        "file_path": "/videos/delete-owner.mp4"
    })

    video_id = create_response.get_json()["id"]

    client.post("/auth/logout")

    client.post("/auth/login", json={
        "email": "test2@example.com",
        "password": "password123"
    })

    response = client.delete(f"/videos/{video_id}")
    assert response.status_code == 403
    assert response.get_json()["error"] == "You can only delete your own videos"

def test_feed_pagination(auth_client):
    for i in range(15):
        auth_client.post("/videos/", json={
            "title": f"Video {i}",
            "description": f"Description {i}",
            "file_path": f"/videos/{i}.mp4"
        })

    response = auth_client.get("/videos/feed?page=1&limit=5")
    assert response.status_code == 200

    data = response.get_json()
    assert data["page"] == 1
    assert data["limit"] == 5
    assert data["total"] >= 15
    assert len(data["results"]) == 5


def test_feed_search(auth_client):
    auth_client.post("/videos/", json={
        "title": "Python Tutorial",
        "description": "Learn Flask backend",
        "file_path": "/videos/python.mp4"
    })

    auth_client.post("/videos/", json={
        "title": "Cooking Video",
        "description": "Make pasta",
        "file_path": "/videos/cooking.mp4"
    })

    response = auth_client.get("/videos/feed?search=Python")
    assert response.status_code == 200

    data = response.get_json()
    assert data["total"] >= 1
    assert any("Python" in video["title"] for video in data["results"])


def test_feed_invalid_page(client):
    response = client.get("/videos/feed?page=0&limit=10")
    assert response.status_code == 400
    assert response.get_json()["error"] == "Page must be at least 1"


def test_feed_invalid_limit(client):
    response = client.get("/videos/feed?page=1&limit=101")
    assert response.status_code == 400
    assert response.get_json()["error"] == "Limit must be between 1 and 100"


def test_upload_video(auth_client):
    auth_client.application.config["QUIZ_AI_AUTO_GENERATE_ON_UPLOAD"] = False
    auth_client.application.config["OPENAI_API_KEY"] = ""
    video_data = io.BytesIO(b"fake video content")
    thumb_data = io.BytesIO(b"fake image content")

    response = auth_client.post(
        "/videos/upload",
        data={
            "title": "Upload Test",
            "description": "Testing file upload",
            "category": "frontend",
            "video": (video_data, "test.mp4"),
            "thumbnail": (thumb_data, "thumb.jpg"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 201
    data = response.get_json()
    assert data["title"] == "Upload Test"
    assert data["category"] == "frontend"
    assert data["category_primary"] == "computer-science"
    assert data["video_url"] is not None
    assert data["thumbnail_url"] is not None
    assert data["quiz_generation"]["status"] == "skipped"


def test_upload_video_can_auto_generate_ai_quiz(auth_client, monkeypatch):
    auth_client.application.config["QUIZ_AI_AUTO_GENERATE_ON_UPLOAD"] = True
    auth_client.application.config["OPENAI_API_KEY"] = "test-key"
    auth_client.application.config["QUIZ_AI_AUTO_GENERATE_QUESTION_COUNT"] = 4

    calls = {}

    def fake_generate_ai_quiz(actor_id, video_id, question_count=None, overwrite=False):
        calls["actor_id"] = actor_id
        calls["video_id"] = video_id
        calls["question_count"] = question_count
        calls["overwrite"] = overwrite
        return {
            "generation": {
                "provider": "openai",
                "question_count_saved": 4,
                "transcript_char_count": 1440,
            }
        }, None, 200

    monkeypatch.setattr(
        "backend.src.app.routes.video.routes.QuizService.generate_ai_quiz",
        fake_generate_ai_quiz,
    )

    video_data = io.BytesIO(b"quiz upload content")
    response = auth_client.post(
        "/videos/upload",
        data={
            "title": "Upload With AI Quiz",
            "description": "Upload should trigger quiz generation",
            "video": (video_data, "quiz-upload.mp4"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["quiz_generation"]["attempted"] is True
    assert payload["quiz_generation"]["status"] == "generated"
    assert payload["quiz_generation"]["question_count"] == 4
    assert calls["actor_id"] == 1
    assert calls["video_id"] == payload["id"]
    assert calls["question_count"] == 4
    assert calls["overwrite"] is False


def test_upload_video_skips_auto_quiz_when_openai_key_is_placeholder(auth_client, monkeypatch):
    auth_client.application.config["QUIZ_AI_AUTO_GENERATE_ON_UPLOAD"] = True
    auth_client.application.config["OPENAI_API_KEY"] = "replace-this-in-digitalocean"

    def fake_generate_ai_quiz(actor_id, video_id, question_count=None, overwrite=False):
        assert False, "Placeholder OpenAI keys should skip generation before service call"

    monkeypatch.setattr(
        "backend.src.app.routes.video.routes.QuizService.generate_ai_quiz",
        fake_generate_ai_quiz,
    )

    video_data = io.BytesIO(b"placeholder key upload content")
    response = auth_client.post(
        "/videos/upload",
        data={
            "title": "Upload With Placeholder AI Key",
            "description": "Upload should not call OpenAI with a placeholder",
            "video": (video_data, "placeholder-key-upload.mp4"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["quiz_generation"]["attempted"] is False
    assert payload["quiz_generation"]["status"] == "skipped"
    assert "placeholder" in payload["quiz_generation"]["message"]


def test_upload_video_still_succeeds_when_auto_quiz_generation_fails(auth_client, monkeypatch):
    auth_client.application.config["QUIZ_AI_AUTO_GENERATE_ON_UPLOAD"] = True
    auth_client.application.config["OPENAI_API_KEY"] = "test-key"

    def fake_generate_ai_quiz(actor_id, video_id, question_count=None, overwrite=False):
        return None, "Transcription failed for this lesson", 502

    monkeypatch.setattr(
        "backend.src.app.routes.video.routes.QuizService.generate_ai_quiz",
        fake_generate_ai_quiz,
    )

    video_data = io.BytesIO(b"quiz upload failure content")
    response = auth_client.post(
        "/videos/upload",
        data={
            "title": "Upload With Failed AI Quiz",
            "description": "Upload should stay successful",
            "video": (video_data, "quiz-upload-failure.mp4"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["title"] == "Upload With Failed AI Quiz"
    assert payload["quiz_generation"]["attempted"] is True
    assert payload["quiz_generation"]["status"] == "failed"
    assert payload["quiz_generation"]["http_status"] == 502


def test_video_responses_include_learning_metadata(auth_client):
    response = auth_client.post("/videos/", json={
        "title": "Metadata Lesson",
        "description": "Learning metadata",
        "file_path": "/videos/metadata.mp4",
        "category": "Technology",
        "learning_level": "beginner",
        "access_tier": 2,
    })

    assert response.status_code == 201
    data = response.get_json()
    assert data["category"] == "computer-science"
    assert data["category_label"] == "Computer Science"
    assert data["category_primary"] == "computer-science"
    assert data["category_primary_label"] == "Computer Science"
    assert data["learning_level"] == "beginner"
    assert data["subscription"]["tier_level"] == 2
    assert data["creator"]["username"] == "testuser1"
    assert data["quiz"]["available"] is False


def test_video_response_marks_quiz_unavailable_for_insufficient_transcript(auth_client):
    response = auth_client.post("/videos/", json={
        "title": "Transcript-limited Lesson",
        "description": "Should not expose a quiz option",
        "file_path": "/videos/transcript-limited.mp4",
    })

    assert response.status_code == 201
    video_id = response.get_json()["id"]

    with auth_client.application.app_context():
        transcript = VideoTranscript(
            video_id=video_id,
            provider="openai",
            model_name="gpt-4o-mini-transcribe",
            status="completed",
            transcript_text="Hello",
            transcript_excerpt="Hello",
            source_file_path="/videos/transcript-limited.mp4",
            source_file_size_bytes=5,
            chunk_count=1,
            error_message=(
                "insufficient_transcript: The lesson did not produce enough spoken transcript to generate a reliable AI quiz."
            ),
        )
        db.session.add(transcript)
        db.session.commit()

    detail = auth_client.get(f"/videos/{video_id}")
    assert detail.status_code == 200
    payload = detail.get_json()
    assert payload["quiz"]["available"] is False
    assert payload["quiz"]["reason"] == "insufficient_transcript"


def test_create_video_rejects_unknown_category(auth_client):
    response = auth_client.post("/videos/", json={
        "title": "Invalid Category Lesson",
        "description": "Should not save",
        "file_path": "/videos/invalid-category.mp4",
        "category": "cooking",
    })

    assert response.status_code == 400
    assert response.get_json()["error"] == "Category must use one of the predefined learning labels"


def test_update_video_can_change_to_predefined_subcategory(auth_client):
    created = auth_client.post("/videos/", json={
        "title": "Category Update Lesson",
        "description": "Update category",
        "file_path": "/videos/category-update.mp4",
    })
    video_id = created.get_json()["id"]

    updated = auth_client.put(f"/videos/{video_id}", json={
        "category": "AI/ML",
    })

    assert updated.status_code == 200
    payload = updated.get_json()
    assert payload["category"] == "ai-ml"
    assert payload["category_label"] == "AI/ML"
    assert payload["category_primary"] == "computer-science"


def test_update_video_rejects_unknown_category(auth_client):
    created = auth_client.post("/videos/", json={
        "title": "Bad Category Update Lesson",
        "description": "Should reject invalid category changes",
        "file_path": "/videos/bad-category-update.mp4",
    })
    video_id = created.get_json()["id"]

    updated = auth_client.put(f"/videos/{video_id}", json={
        "category": "language",
    })

    assert updated.status_code == 400
    assert updated.get_json()["error"] == "Category must use one of the predefined learning labels"


def test_authenticated_video_detail_includes_viewer_rating(auth_client):
    response = auth_client.post("/videos/", json={
        "title": "Viewer Rating Lesson",
        "description": "Check viewer rating payload",
        "file_path": "/videos/viewer-rating.mp4",
    })

    video_id = response.get_json()["id"]

    rating_response = auth_client.post("/social/ratings", json={
        "video_id": video_id,
        "rating": 3,
    })
    assert rating_response.status_code == 200

    detail = auth_client.get(f"/videos/{video_id}")
    assert detail.status_code == 200
    payload = detail.get_json()
    assert payload["viewer_rating"] == 3
    assert payload["rating_count"] == 1
    assert payload["average_rating"] == 3.0


def test_access_denied_for_premium_video_without_subscription(client):
    client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })
    created = client.post("/videos/", json={
        "title": "Premium Lesson",
        "description": "Restricted lesson",
        "file_path": "/videos/premium.mp4",
        "access_tier": 2,
    })
    video_id = created.get_json()["id"]
    client.post("/auth/logout")

    client.post("/auth/login", json={
        "email": "test2@example.com",
        "password": "password123"
    })
    denied = client.get(f"/videos/{video_id}")
    assert denied.status_code == 403
    denied_data = denied.get_json()
    assert denied_data["code"] == "ACCESS_DENIED"
    assert denied_data["details"]["required_tier"] == 2

    stats = client.get(f"/videos/{video_id}/stats")
    assert stats.status_code == 200
    assert stats.get_json()["views"] == 0


def test_matching_subscription_tier_unlocks_premium_video(client):
    client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })
    created = client.post("/videos/", json={
        "title": "Tier Lesson",
        "description": "Premium learning path lesson",
        "file_path": "/videos/tier.mp4",
        "access_tier": 2,
    })
    video_id = created.get_json()["id"]
    client.post("/auth/logout")

    client.post("/auth/login", json={
        "email": "test2@example.com",
        "password": "password123"
    })
    client.post("/social/subscribe", json={
        "creator_id": 1,
        "tier_level": 2,
    })

    response = client.get(f"/videos/{video_id}")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["access_status"]["has_access"] is True
    assert payload["access_status"]["current_tier"] == 2
    assert payload["views"] == 1


def test_premium_video_file_stream_is_protected(client):
    client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })

    video_data = io.BytesIO(b"premium video content")
    response = client.post(
        "/videos/upload",
        data={
            "title": "Premium Upload",
            "description": "Protected file streaming",
            "access_tier": "1",
            "video": (video_data, "premium-upload.mp4"),
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 201
    video_url = response.get_json()["video_url"]
    client.post("/auth/logout")

    denied = client.get(video_url)
    assert denied.status_code == 403
    assert denied.get_json()["code"] == "ACCESS_DENIED"
