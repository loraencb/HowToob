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


def test_add_comment_reply(auth_client):
    create_video = auth_client.post("/videos/", json={
        "title": "Reply Video",
        "description": "Video for replies",
        "file_path": "/videos/reply.mp4"
    })

    video_id = create_video.get_json()["id"]

    parent_response = auth_client.post("/social/comments", json={
        "content": "Parent comment",
        "video_id": video_id
    })
    parent_id = parent_response.get_json()["id"]

    reply_response = auth_client.post("/social/comments", json={
        "content": "Reply comment",
        "video_id": video_id,
        "parent_id": parent_id,
    })

    assert reply_response.status_code == 201
    reply_data = reply_response.get_json()
    assert reply_data["content"] == "Reply comment"
    assert reply_data["parent_id"] == parent_id

    comments_response = auth_client.get(f"/social/comments/{video_id}")
    assert comments_response.status_code == 200
    comments = comments_response.get_json()
    assert len(comments) == 2
    assert comments[0]["parent_id"] is None
    assert comments[1]["parent_id"] == parent_id


def test_add_comment_reply_accepts_string_ids(auth_client):
    create_video = auth_client.post("/videos/", json={
        "title": "Reply String Video",
        "description": "Video for string-id replies",
        "file_path": "/videos/reply-string.mp4"
    })

    video_id = create_video.get_json()["id"]

    parent_response = auth_client.post("/social/comments", json={
        "content": "Parent comment",
        "video_id": video_id
    })
    parent_id = parent_response.get_json()["id"]

    reply_response = auth_client.post("/social/comments", json={
        "content": "Reply from frontend payload",
        "video_id": str(video_id),
        "parent_id": str(parent_id),
    })

    assert reply_response.status_code == 201
    reply_data = reply_response.get_json()
    assert reply_data["parent_id"] == parent_id
    assert reply_data["video_id"] == video_id


def test_add_comment_reply_requires_valid_parent(auth_client):
    create_video = auth_client.post("/videos/", json={
        "title": "Reply Guard Video",
        "description": "Video for invalid parent replies",
        "file_path": "/videos/reply-guard.mp4"
    })
    video_id = create_video.get_json()["id"]

    response = auth_client.post("/social/comments", json={
        "content": "Reply comment",
        "video_id": video_id,
        "parent_id": 999,
    })

    assert response.status_code == 404
    assert response.get_json()["error"] == "Parent comment not found"


def test_add_comment_reply_rejects_parent_from_other_video(auth_client):
    first_video = auth_client.post("/videos/", json={
        "title": "First Video",
        "description": "Parent lives here",
        "file_path": "/videos/first.mp4"
    })
    second_video = auth_client.post("/videos/", json={
        "title": "Second Video",
        "description": "Reply should not attach here",
        "file_path": "/videos/second.mp4"
    })

    parent = auth_client.post("/social/comments", json={
        "content": "Cross-video parent",
        "video_id": first_video.get_json()["id"]
    })

    response = auth_client.post("/social/comments", json={
        "content": "Invalid reply",
        "video_id": second_video.get_json()["id"],
        "parent_id": parent.get_json()["id"],
    })

    assert response.status_code == 400
    assert response.get_json()["error"] == "Reply must belong to the same video"


def test_add_comment_rejects_blank_content(auth_client):
    create_video = auth_client.post("/videos/", json={
        "title": "Blank Comment Video",
        "description": "Video for blank comment validation",
        "file_path": "/videos/blank-comment.mp4"
    })

    response = auth_client.post("/social/comments", json={
        "content": "   ",
        "video_id": create_video.get_json()["id"]
    })

    assert response.status_code == 400
    assert response.get_json()["error"] == "Comment content is required"


def test_set_video_rating(auth_client):
    create_video = auth_client.post("/videos/", json={
        "title": "Rated Video",
        "description": "Video for ratings",
        "file_path": "/videos/rated.mp4"
    })

    video_id = create_video.get_json()["id"]

    response1 = auth_client.post("/social/ratings", json={
        "video_id": video_id,
        "rating": 4,
    })
    assert response1.status_code == 200
    first_payload = response1.get_json()
    assert first_payload["video_id"] == video_id
    assert first_payload["rating_count"] == 1
    assert first_payload["average_rating"] == 4.0
    assert first_payload["viewer_rating"] == 4

    response2 = auth_client.post("/social/ratings", json={
        "video_id": video_id,
        "rating": 2,
    })
    assert response2.status_code == 200
    second_payload = response2.get_json()
    assert second_payload["rating_count"] == 1
    assert second_payload["average_rating"] == 2.0
    assert second_payload["viewer_rating"] == 2


def test_toggle_like_compatibility_endpoint_sets_five_star_rating(auth_client):
    create_video = auth_client.post("/videos/", json={
        "title": "Compatibility Video",
        "description": "Legacy like route still works",
        "file_path": "/videos/compat.mp4"
    })

    video_id = create_video.get_json()["id"]

    response1 = auth_client.post("/social/likes/toggle", json={
        "video_id": video_id
    })
    assert response1.status_code == 200
    assert response1.get_json()["liked"] is True
    assert response1.get_json()["rating"] == 5
    assert response1.get_json()["viewer_rating"] == 5

    response2 = auth_client.post("/social/likes/toggle", json={
        "video_id": video_id
    })
    assert response2.status_code == 200
    assert response2.get_json()["liked"] is False
    assert response2.get_json()["rating"] == 0
    assert response2.get_json()["viewer_rating"] == 0


def test_toggle_comment_like(auth_client):
    create_video = auth_client.post("/videos/", json={
        "title": "Comment Like Video",
        "description": "Video for comment likes",
        "file_path": "/videos/comment-like.mp4"
    })

    comment = auth_client.post("/social/comments", json={
        "content": "Like this comment",
        "video_id": create_video.get_json()["id"]
    })
    comment_id = comment.get_json()["id"]

    first = auth_client.post(f"/social/comments/{comment_id}/likes/toggle")
    assert first.status_code == 200
    assert first.get_json()["liked"] is True
    assert first.get_json()["like_count"] == 1

    second = auth_client.post(f"/social/comments/{comment_id}/likes/toggle")
    assert second.status_code == 200
    assert second.get_json()["liked"] is False
    assert second.get_json()["like_count"] == 0


def test_toggle_reply_like_and_comment_payload_state(auth_client):
    create_video = auth_client.post("/videos/", json={
        "title": "Reply Like Video",
        "description": "Video for reply likes",
        "file_path": "/videos/reply-like.mp4"
    })
    video_id = create_video.get_json()["id"]

    parent = auth_client.post("/social/comments", json={
        "content": "Parent",
        "video_id": video_id
    })
    reply = auth_client.post("/social/comments", json={
        "content": "Reply",
        "video_id": video_id,
        "parent_id": parent.get_json()["id"],
    })
    reply_id = reply.get_json()["id"]

    like_response = auth_client.post(f"/social/comments/{reply_id}/likes/toggle")
    assert like_response.status_code == 200
    assert like_response.get_json()["liked"] is True
    assert like_response.get_json()["like_count"] == 1

    comments_response = auth_client.get(f"/social/comments/{video_id}")
    comments = comments_response.get_json()
    reply_payload = next(item for item in comments if item["id"] == reply_id)
    assert reply_payload["like_count"] == 1
    assert reply_payload["viewer_liked"] is True


def test_toggle_comment_like_invalid_comment(auth_client):
    response = auth_client.post("/social/comments/999/likes/toggle")

    assert response.status_code == 404
    assert response.get_json()["error"] == "Comment not found"


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


def test_set_video_rating_rejects_invalid_rating(auth_client):
    create_video = auth_client.post("/videos/", json={
        "title": "Invalid Rating Video",
        "description": "Video for bad ratings",
        "file_path": "/videos/invalid-rating.mp4"
    })

    response = auth_client.post("/social/ratings", json={
        "video_id": create_video.get_json()["id"],
        "rating": 6,
    })

    assert response.status_code == 400
    assert response.get_json()["error"] == "rating must be an integer between 1 and 5"


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


def test_get_my_rated_videos(auth_client):
    first_video = auth_client.post("/videos/", json={
        "title": "Rated History One",
        "description": "First rated history lesson",
        "file_path": "/videos/rated-history-1.mp4"
    })
    second_video = auth_client.post("/videos/", json={
        "title": "Rated History Two",
        "description": "Second rated history lesson",
        "file_path": "/videos/rated-history-2.mp4"
    })

    auth_client.post("/social/ratings", json={
        "video_id": first_video.get_json()["id"],
        "rating": 4,
    })
    auth_client.post("/social/ratings", json={
        "video_id": second_video.get_json()["id"],
        "rating": 5,
    })

    response = auth_client.get("/users/me/ratings")
    assert response.status_code == 200

    payload = response.get_json()
    assert payload["summary"]["total_ratings"] == 2
    assert payload["summary"]["average_rating_given"] == 4.5
    assert len(payload["results"]) == 2
    assert payload["results"][0]["rating"] == 5
    assert payload["results"][0]["video"]["viewer_rating"] == 5
    assert payload["results"][1]["rating"] == 4


def test_like_requires_login(client):
    response = client.post("/social/likes/toggle", json={
        "video_id": 1
    })

    assert response.status_code == 401
    assert response.get_json()["error"] == "Authentication required"


def test_rating_requires_login(client):
    response = client.post("/social/ratings", json={
        "video_id": 1,
        "rating": 5,
    })

    assert response.status_code == 401
    assert response.get_json()["error"] == "Authentication required"


def test_comment_like_requires_login(client):
    response = client.post("/social/comments/1/likes/toggle")

    assert response.status_code == 401
    assert response.get_json()["error"] == "Authentication required"
