def test_profile_summary_by_stable_identifier(auth_client):
    auth_client.post("/videos/", json={
        "title": "Profile Lesson",
        "description": "Creator lesson",
        "file_path": "/videos/profile.mp4",
    })

    create_playlist = auth_client.post("/users/me/playlists", json={
        "title": "Creator Path",
        "description": "Profile should count this playlist",
    })
    assert create_playlist.status_code == 201

    auth_client.post("/auth/logout")
    auth_client.post("/auth/login", json={
        "email": "test2@example.com",
        "password": "password123"
    })
    auth_client.post("/social/subscribe", json={
        "creator_id": 1
    })

    profile_response = auth_client.get("/users/profile/testuser1")
    assert profile_response.status_code == 200
    data = profile_response.get_json()
    assert data["profile"]["username"] == "testuser1"
    assert data["profile"]["role_label"] == "Creator"
    assert data["summary"]["subscriber_count"] == 1
    assert data["summary"]["playlist_count"] == 1
    assert len(data["videos"]) >= 1
