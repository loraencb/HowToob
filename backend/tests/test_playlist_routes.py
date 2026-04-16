def test_playlist_crud_and_reorder(auth_client):
    first_video = auth_client.post("/videos/", json={
        "title": "Lesson One",
        "description": "First lesson",
        "file_path": "/videos/lesson-one.mp4"
    }).get_json()

    second_video = auth_client.post("/videos/", json={
        "title": "Lesson Two",
        "description": "Second lesson",
        "file_path": "/videos/lesson-two.mp4"
    }).get_json()

    playlist_response = auth_client.post("/users/me/playlists", json={
        "title": "Backend Learning Path",
        "description": "Ordered lessons for testing",
    })
    assert playlist_response.status_code == 201
    playlist_id = playlist_response.get_json()["id"]

    add_first = auth_client.post(f"/users/me/playlists/{playlist_id}/videos", json={
        "video_id": second_video["id"],
    })
    assert add_first.status_code == 200

    add_second = auth_client.post(f"/users/me/playlists/{playlist_id}/videos", json={
        "video_id": first_video["id"],
        "position": 1,
    })
    assert add_second.status_code == 200
    ordered_items = add_second.get_json()["items"]
    assert [item["video_id"] for item in ordered_items] == [first_video["id"], second_video["id"]]

    reorder_response = auth_client.put(f"/users/me/playlists/{playlist_id}/videos/reorder", json={
        "video_ids": [second_video["id"], first_video["id"]],
    })
    assert reorder_response.status_code == 200
    assert [item["video_id"] for item in reorder_response.get_json()["items"]] == [
        second_video["id"],
        first_video["id"],
    ]

    remove_response = auth_client.delete(f"/users/me/playlists/{playlist_id}/videos/{first_video['id']}")
    assert remove_response.status_code == 200
    assert remove_response.get_json()["item_count"] == 1

    delete_response = auth_client.delete(f"/users/me/playlists/{playlist_id}")
    assert delete_response.status_code == 200
    assert delete_response.get_json()["message"] == "Playlist deleted"


def test_playlist_prevents_duplicate_entries_and_keeps_positions(auth_client):
    lesson = auth_client.post("/videos/", json={
        "title": "Saved Once",
        "description": "Duplicate guard",
        "file_path": "/videos/saved-once.mp4",
    }).get_json()

    playlist = auth_client.post("/users/me/playlists", json={
        "title": "Integrity Path",
        "description": "Check duplicate handling",
    }).get_json()
    playlist_id = playlist["id"]

    first_add = auth_client.post(f"/users/me/playlists/{playlist_id}/videos", json={
        "video_id": lesson["id"],
    })
    assert first_add.status_code == 200
    assert first_add.get_json()["item_count"] == 1

    second_add = auth_client.post(f"/users/me/playlists/{playlist_id}/videos", json={
        "video_id": lesson["id"],
    })
    assert second_add.status_code == 200
    detail = second_add.get_json()
    assert detail["item_count"] == 1
    assert len(detail["items"]) == 1
    assert detail["items"][0]["position"] == 1


def test_playlist_is_scoped_to_owner(client):
    client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })
    playlist = client.post("/users/me/playlists", json={
        "title": "Private Path",
        "description": "Only the owner should see this detail",
    }).get_json()
    playlist_id = playlist["id"]
    client.post("/auth/logout")

    client.post("/auth/login", json={
        "email": "test2@example.com",
        "password": "password123"
    })
    response = client.get(f"/users/me/playlists/{playlist_id}")
    assert response.status_code == 404
    assert response.get_json()["error"] == "Playlist not found"
