def test_add_comment(auth_client):
    create_video = auth_client.post("/videos/", json={
        "title": "Comment Video",
        "description": "Video for comments",
        "file_path": "/videos/comment.mp4"
    })

    video_id = create_video.get_json()["id"]

    response = auth_client.post("/social/comments", json={
        "content": "Nice video!",
        "video_id": video_id
    })

    assert response.status_code == 201
    data = response.get_json()
    assert data["content"] == "Nice video!"
    assert data["user_id"] == 1
    assert data["video_id"] == video_id


def test_toggle_like(auth_client):
    create_video = auth_client.post("/videos/", json={
        "title": "Like Video",
        "description": "Video for likes",
        "file_path": "/videos/like.mp4"
    })

    video_id = create_video.get_json()["id"]

    response1 = auth_client.post("/social/likes/toggle", json={
        "video_id": video_id
    })
    assert response1.status_code == 200
    assert response1.get_json()["liked"] is True

    response2 = auth_client.post("/social/likes/toggle", json={
        "video_id": video_id
    })
    assert response2.status_code == 200
    assert response2.get_json()["liked"] is False


def test_subscribe(auth_client):
    response = auth_client.post("/social/subscribe", json={
        "creator_id": 2
    })

    assert response.status_code == 201
    data = response.get_json()
    assert data["subscriber_id"] == 1
    assert data["creator_id"] == 2


def test_subscribe_can_upgrade_tier(auth_client):
    first = auth_client.post("/social/subscribe", json={
        "creator_id": 2
    })
    assert first.status_code == 201
    assert first.get_json()["tier_level"] == 0

    upgraded = auth_client.post("/social/subscribe", json={
        "creator_id": 2,
        "tier_level": 2,
    })
    assert upgraded.status_code == 201
    assert upgraded.get_json()["tier_level"] == 2


def test_get_comments_for_video(auth_client):
    create_video = auth_client.post("/videos/", json={
        "title": "Comment List Video",
        "description": "Video for comment list",
        "file_path": "/videos/comment-list.mp4"
    })

    video_id = create_video.get_json()["id"]

    auth_client.post("/social/comments", json={
        "content": "First comment",
        "video_id": video_id
    })

    response = auth_client.get(f"/social/comments/{video_id}")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["content"] == "First comment"


def test_add_comment_invalid_video(auth_client):
    response = auth_client.post("/social/comments", json={
        "content": "Bad comment",
        "video_id": 999
    })

    assert response.status_code == 404
    assert response.get_json()["error"] == "Video not found"


def test_toggle_like_invalid_video(auth_client):
    response = auth_client.post("/social/likes/toggle", json={
        "video_id": 999
    })

    assert response.status_code == 404
    assert response.get_json()["error"] == "Video not found"


def test_subscribe_to_self_fails(auth_client):
    response = auth_client.post("/social/subscribe", json={
        "creator_id": 1
    })

    assert response.status_code == 400
    assert response.get_json()["error"] == "Users cannot subscribe to themselves"


def test_get_user_subscriptions(auth_client):
    auth_client.post("/social/subscribe", json={
        "creator_id": 2
    })

    response = auth_client.get("/users/1/subscriptions")
    assert response.status_code == 200

    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["subscriber_id"] == 1
    assert data[0]["creator_id"] == 2


def test_like_requires_login(client):
    response = client.post("/social/likes/toggle", json={
        "video_id": 1
    })

    assert response.status_code == 401
    assert response.get_json()["error"] == "Authentication required"
