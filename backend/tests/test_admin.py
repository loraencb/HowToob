def test_report_submission_and_admin_moderation_flow(client):
    client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })

    create_video = client.post("/videos/", json={
        "title": "Moderation Video",
        "description": "Used for report testing",
        "file_path": "/videos/moderation.mp4"
    })
    video_id = create_video.get_json()["id"]

    create_comment = client.post("/social/comments", json={
        "content": "Spam comment",
        "video_id": video_id,
    })
    comment_id = create_comment.get_json()["id"]

    report_response = client.post("/social/reports", json={
        "target_type": "comment",
        "target_id": comment_id,
        "video_id": video_id,
        "reason": "spam",
        "details": "Repeated unrelated promotion",
    })

    assert report_response.status_code == 201
    report_id = report_response.get_json()["id"]

    client.post("/auth/logout")
    client.post("/auth/login", json={
        "email": "admin@example.com",
        "password": "password123"
    })

    list_response = client.get("/admin/reports?status=pending")
    assert list_response.status_code == 200
    list_data = list_response.get_json()
    assert list_data["total"] == 1
    assert list_data["results"][0]["id"] == report_id

    action_response = client.post(f"/admin/reports/{report_id}/actions", json={
        "action": "hide_comment",
        "notes": "Comment removed after review",
    })

    assert action_response.status_code == 200
    action_data = action_response.get_json()
    assert action_data["status"] == "resolved"
    assert action_data["latest_action"] == "hide_comment"
    assert action_data["logs"][-1]["moderator_name"] == "adminuser"

    comments_response = client.get(f"/social/comments/{video_id}")
    assert comments_response.status_code == 200
    assert comments_response.get_json()[0]["content"] == "[Removed by moderation]"


def test_non_admin_cannot_list_reports(auth_client):
    response = auth_client.get("/admin/reports")

    assert response.status_code == 403
    assert response.get_json()["error"] == "Admin access required"


def test_duplicate_reports_are_blocked_and_admin_filters_work(client):
    client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })
    created = client.post("/videos/", json={
        "title": "Report Target",
        "description": "For duplicate report checks",
        "file_path": "/videos/report-target.mp4"
    })
    video_id = created.get_json()["id"]

    first_report = client.post("/social/reports", json={
        "target_type": "video",
        "target_id": video_id,
        "reason": "spam",
    })
    assert first_report.status_code == 201
    report_id = first_report.get_json()["id"]

    duplicate_report = client.post("/social/reports", json={
        "target_type": "video",
        "target_id": video_id,
        "reason": "spam",
    })
    assert duplicate_report.status_code == 409
    assert duplicate_report.get_json()["code"] == "DUPLICATE_REPORT"

    client.post("/auth/logout")
    client.post("/auth/login", json={
        "email": "admin@example.com",
        "password": "password123"
    })

    review = client.post(f"/admin/reports/{report_id}/actions", json={
        "action": "review",
        "notes": "Queued for moderation",
    })
    assert review.status_code == 200
    assert review.get_json()["status"] == "reviewing"

    filtered = client.get("/admin/reports?status=reviewing&target_type=video&reason=spam")
    assert filtered.status_code == 200
    filtered_data = filtered.get_json()
    assert filtered_data["total"] == 1
    assert filtered_data["filters"]["status"] == "reviewing"
    assert filtered_data["results"][0]["id"] == report_id

    resolve = client.post(f"/admin/reports/{report_id}/actions", json={
        "action": "resolve",
        "notes": "Handled by admin",
    })
    assert resolve.status_code == 200
    assert resolve.get_json()["status"] == "resolved"

    invalid_transition = client.post(f"/admin/reports/{report_id}/actions", json={
        "action": "review",
        "notes": "Should not reopen",
    })
    assert invalid_transition.status_code == 400
    assert "Cannot transition report" in invalid_transition.get_json()["error"]
