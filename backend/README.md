# HowToob Backend API

![Python](https://img.shields.io/badge/python-3.12-blue)
![Flask](https://img.shields.io/badge/framework-Flask-black)
![SQLAlchemy](https://img.shields.io/badge/ORM-SQLAlchemy-red)
![Pytest](https://img.shields.io/badge/tests-33%2F33%20passing-success)
![Status](https://img.shields.io/badge/status-Complete-success)

A fully functional **HowToob backend API** built with Flask,
featuring authentication, video management, social interactions, and
file uploads --- with **100% passing test coverage**.

------------------------------------------------------------------------

## Features

### Authentication

-   User registration & login
-   Password hashing (secure)
-   Session-based authentication (Flask-Login)
-   Logout & current user endpoint

### Video System

-   Upload videos & thumbnails
-   Create, update, delete videos
-   View video details (auto-increments views)
-   Creator-specific video listing

### Feed System

-   Paginated video feed
-   Search functionality
-   Input validation (page, limit)

### Social Features

-   Like / Unlike videos (toggle system)
-   Comment on videos
-   Subscribe to creators
-   View user subscriptions
-   Video stats (likes, comments, views)

### File Handling

-   Secure file uploads
-   Video & thumbnail storage
-   Static file serving endpoints

### Testing

-   **33/33 tests passing**
-   Built with `pytest`

------------------------------------------------------------------------

## roject Structure
```text
    src/
    ├── app/
    │   ├── models/
    │   ├── routes/
    │   ├── services/
    │   ├── utils/
    │   ├── extensions.py
    │   └── __init__.py
    tests/
```
------------------------------------------------------------------------

## API Endpoints (Highlights)

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Videos
- `GET /videos/`
- `POST /videos/`
- `PUT /videos/<id>`
- `DELETE /videos/<id>`
- `GET /videos/feed`

### Social
- `POST /social/comments`
- `POST /social/likes/toggle`
- `POST /social/subscribe`
- `GET /users/<id>/subscriptions`

## Setup & Installation

``` bash
git clone https://github.com/loraencb/OOP-Team-B_Youtube-lite.git
cd OOP-Team-B_Youtube-lite
```

``` bash
python -m venv venv
venv\Scripts\activate
```

``` bash
pip install -r requirements.txt
```

------------------------------------------------------------------------

## Run the App

``` bash
python run.py
```

------------------------------------------------------------------------

## Run Tests

``` bash
pytest -v
```

------------------------------------------------------------------------

## Author

**Braulio Lora Encarnacion**
