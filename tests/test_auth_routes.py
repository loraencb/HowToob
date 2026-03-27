def test_register_user(client):
    response = client.post("/auth/register", json={
        "username": "newuser",
        "email": "newuser@example.com",
        "password": "securepass123"
    })

    assert response.status_code == 201
    data = response.get_json()
    assert data["message"] == "User registered successfully"
    assert data["user"]["username"] == "newuser"


def test_register_duplicate_email(client):
    response = client.post("/auth/register", json={
        "username": "anotheruser",
        "email": "test1@example.com",
        "password": "securepass123"
    })

    assert response.status_code == 400
    assert response.get_json()["error"] == "Email already exists"


def test_login_user(client):
    response = client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })

    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Login successful"
    assert data["user"]["email"] == "test1@example.com"


def test_login_invalid_password(client):
    response = client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "wrongpassword"
    })

    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid email or password"


def test_me_authenticated(client):
    client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })

    response = client.get("/auth/me")
    assert response.status_code == 200
    data = response.get_json()
    assert data["authenticated"] is True
    assert data["user"]["email"] == "test1@example.com"


def test_logout_user(client):
    client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })

    response = client.post("/auth/logout")
    assert response.status_code == 200
    assert response.get_json()["message"] == "Logout successful"

def test_register_user(client):
    response = client.post(
        "/auth/register",
        json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "securepass123",
        },
    )

    assert response.status_code == 201
    data = response.get_json()
    assert data["message"] == "User registered successfully"
    assert data["user"]["username"] == "newuser"
    assert data["user"]["email"] == "newuser@example.com"


def test_register_duplicate_email(client):
    response = client.post(
        "/auth/register",
        json={
            "username": "anotheruser",
            "email": "test1@example.com",
            "password": "securepass123",
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "Email already exists"


def test_login_user(client):
    response = client.post(
        "/auth/login",
        json={
            "email": "test1@example.com",
            "password": "password123",
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Login successful"
    assert data["user"]["email"] == "test1@example.com"


def test_login_invalid_password(client):
    response = client.post(
        "/auth/login",
        json={
            "email": "test1@example.com",
            "password": "wrongpassword",
        },
    )

    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid email or password"


def test_me_authenticated(client):
    login_response = client.post(
        "/auth/login",
        json={
            "email": "test1@example.com",
            "password": "password123",
        },
    )
    assert login_response.status_code == 200

    response = client.get("/auth/me")
    assert response.status_code == 200
    data = response.get_json()
    assert data["authenticated"] is True
    assert data["user"]["email"] == "test1@example.com"


def test_me_unauthenticated(client):
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert response.get_json()["authenticated"] is False


def test_logout_user(client):
    login_response = client.post(
        "/auth/login",
        json={
            "email": "test1@example.com",
            "password": "password123",
        },
    )
    assert login_response.status_code == 200

    response = client.post("/auth/logout")
    assert response.status_code == 200
    assert response.get_json()["message"] == "Logout successful"