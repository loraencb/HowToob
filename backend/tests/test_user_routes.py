import io


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


def test_user_can_update_profile_picture(auth_client):
    response = auth_client.put(
        "/users/me/profile-picture",
        data={
            "profile_picture": (
                io.BytesIO(b"fake image bytes"),
                "avatar.jpg",
            ),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["user"]["profile_image_url"].startswith("/users/files/profile-pictures/")
    assert data["user"]["avatar_url"] == data["user"]["profile_image_url"]

    me_response = auth_client.get("/auth/me")
    assert me_response.status_code == 200
    me_data = me_response.get_json()
    assert me_data["user"]["profile_image_url"] == data["user"]["profile_image_url"]
    auth_client.delete("/users/me/profile-picture")


def test_profile_picture_is_exposed_on_public_profile(auth_client):
    auth_client.put(
        "/users/me/profile-picture",
        data={
            "profile_picture": (
                io.BytesIO(b"fake image bytes"),
                "avatar.png",
            ),
        },
        content_type="multipart/form-data",
    )

    profile_response = auth_client.get("/users/profile/testuser1")

    assert profile_response.status_code == 200
    data = profile_response.get_json()
    assert data["profile"]["profile_image_url"].startswith("/users/files/profile-pictures/")
    assert data["profile"]["avatar_url"] == data["profile"]["profile_image_url"]
    auth_client.delete("/users/me/profile-picture")


def test_user_can_remove_profile_picture(auth_client):
    upload_response = auth_client.put(
        "/users/me/profile-picture",
        data={
            "profile_picture": (
                io.BytesIO(b"fake image bytes"),
                "avatar.jpeg",
            ),
        },
        content_type="multipart/form-data",
    )
    assert upload_response.status_code == 200

    delete_response = auth_client.delete("/users/me/profile-picture")

    assert delete_response.status_code == 200
    data = delete_response.get_json()
    assert data["user"]["profile_image_url"] is None
    assert data["user"]["avatar_url"] is None
