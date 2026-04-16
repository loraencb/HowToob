def test_progress_upsert_and_list(auth_client):
    create_video = auth_client.post("/videos/", json={
        "title": "Progress Video",
        "description": "Watch me",
        "file_path": "/videos/progress.mp4"
    })
    video_id = create_video.get_json()["id"]

    upsert_response = auth_client.post("/users/me/progress", json={
        "video_id": video_id,
        "watched_seconds": 90,
        "duration_seconds": 100,
    })

    assert upsert_response.status_code == 200
    progress_data = upsert_response.get_json()
    assert progress_data["video_id"] == video_id
    assert progress_data["percent_complete"] == 90.0
    assert progress_data["completed"] is True

    list_response = auth_client.get("/users/me/progress?status=completed")
    assert list_response.status_code == 200
    list_data = list_response.get_json()
    assert list_data["summary"]["completed_count"] == 1
    assert list_data["results"][0]["video"]["title"] == "Progress Video"


def test_watch_events_update_progress_idempotently(auth_client):
    created = auth_client.post("/videos/", json={
        "title": "Watch Event Lesson",
        "description": "Track progress from player events",
        "file_path": "/videos/watch-events.mp4",
    })
    video_id = created.get_json()["id"]

    first = auth_client.post(f"/videos/{video_id}/watch-events", json={
        "watched_seconds": 30,
        "duration_seconds": 100,
    })
    assert first.status_code == 200
    first_progress = first.get_json()["progress"]
    assert first_progress["percent_complete"] == 30.0
    progress_id = first_progress["id"]

    repeated = auth_client.post(f"/videos/{video_id}/watch-events", json={
        "watched_seconds": 30,
        "duration_seconds": 100,
    })
    assert repeated.status_code == 200
    assert repeated.get_json()["progress"]["id"] == progress_id
    assert repeated.get_json()["progress"]["percent_complete"] == 30.0

    lower = auth_client.post(f"/videos/{video_id}/watch-events", json={
        "watched_seconds": 10,
        "duration_seconds": 100,
    })
    assert lower.status_code == 200
    assert lower.get_json()["progress"]["percent_complete"] == 30.0

    completed = auth_client.post(f"/videos/{video_id}/watch-events", json={
        "watched_seconds": 95,
        "duration_seconds": 100,
    })
    assert completed.status_code == 200
    completed_progress = completed.get_json()["progress"]
    assert completed_progress["completed"] is True
    assert completed_progress["percent_complete"] == 95.0

    listing = auth_client.get("/users/me/progress")
    assert listing.status_code == 200
    list_data = listing.get_json()
    assert list_data["summary"]["total_entries"] == 1
    assert list_data["summary"]["completed_count"] == 1
