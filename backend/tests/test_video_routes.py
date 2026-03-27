import io

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

    auth_client.post("/social/likes/toggle", json={
        "video_id": video_id
    })

    auth_client.get(f"/videos/{video_id}")
    auth_client.get(f"/videos/{video_id}")

    response = auth_client.get(f"/videos/{video_id}/stats")
    assert response.status_code == 200

    data = response.get_json()
    assert data["video_id"] == video_id
    assert data["views"] == 2
    assert data["likes"] == 1
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
    video_data = io.BytesIO(b"fake video content")
    thumb_data = io.BytesIO(b"fake image content")

    response = auth_client.post(
        "/videos/upload",
        data={
            "title": "Upload Test",
            "description": "Testing file upload",
            "video": (video_data, "test.mp4"),
            "thumbnail": (thumb_data, "thumb.jpg"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 201
    data = response.get_json()
    assert data["title"] == "Upload Test"
    assert data["video_url"] is not None
    assert data["thumbnail_url"] is not None

def test_cannot_update_other_users_video(auth_client, create_second_user):
    create_response = auth_client.post(
        "/videos/",
        json={
            "title": "Owner Video",
            "description": "Owned by user1",
            "file_path": "/videos/owner.mp4",
        },
    )

    assert create_response.status_code == 201, create_response.get_json()
    video_id = create_response.get_json()["id"]

    auth_client.post("/auth/logout")

    second_login = auth_client.post(
        "/auth/login",
        json={
            "email": f"test2_",  # placeholder to show structure only
            "password": "password123",
        },
    )