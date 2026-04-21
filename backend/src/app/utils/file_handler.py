import os
import tempfile
import uuid
from contextlib import contextmanager
from pathlib import Path

from flask import current_app
from werkzeug.utils import secure_filename

ALLOWED_VIDEO_EXTENSIONS = {"mp4"}
ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg"}
REMOTE_STORAGE_PREFIX = "spaces://"


class StorageError(Exception):
    pass


def allowed_file(filename, allowed_extensions):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_extensions


def get_storage_backend():
    return str(current_app.config.get("FILE_STORAGE_BACKEND") or "local").strip().lower()


def is_remote_storage_path(path):
    return str(path or "").startswith(REMOTE_STORAGE_PREFIX)


def parse_spaces_uri(path):
    raw = str(path or "")
    if not is_remote_storage_path(raw):
        raise StorageError("Storage path is not a DigitalOcean Spaces URI.")

    without_scheme = raw[len(REMOTE_STORAGE_PREFIX):]
    bucket, separator, key = without_scheme.partition("/")
    if not bucket or not separator or not key:
        raise StorageError("DigitalOcean Spaces URI is malformed.")

    return bucket, key


def _get_spaces_client():
    try:
        import boto3
    except ImportError as exc:
        raise StorageError("boto3 is required for DigitalOcean Spaces storage.") from exc

    bucket = str(current_app.config.get("SPACES_BUCKET") or "").strip()
    endpoint_url = str(current_app.config.get("SPACES_ENDPOINT_URL") or "").strip()
    region = str(current_app.config.get("SPACES_REGION") or "").strip() or None
    access_key = str(current_app.config.get("SPACES_ACCESS_KEY_ID") or "").strip()
    secret_key = str(current_app.config.get("SPACES_SECRET_ACCESS_KEY") or "").strip()

    missing = [
        name for name, value in {
            "SPACES_BUCKET": bucket,
            "SPACES_ENDPOINT_URL": endpoint_url,
            "SPACES_ACCESS_KEY_ID": access_key,
            "SPACES_SECRET_ACCESS_KEY": secret_key,
        }.items()
        if not value
    ]
    if missing:
        raise StorageError(
            "DigitalOcean Spaces storage is enabled but missing: "
            + ", ".join(missing)
        )

    client = boto3.client(
        "s3",
        region_name=region,
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )
    return client, bucket


def _build_spaces_key(media_type, unique_name):
    prefix = str(current_app.config.get("SPACES_KEY_PREFIX") or "").strip().strip("/")
    normalized_media_type = str(media_type or "files").strip("/").strip() or "files"
    parts = [part for part in [prefix, normalized_media_type, unique_name] if part]
    return "/".join(parts)


def _save_file_to_spaces(file, unique_name, media_type):
    client, bucket = _get_spaces_client()
    key = _build_spaces_key(media_type=media_type, unique_name=unique_name)
    content_type = getattr(file, "mimetype", None) or "application/octet-stream"

    try:
        file.stream.seek(0)
    except (AttributeError, OSError):
        pass

    try:
        client.upload_fileobj(
            file.stream,
            bucket,
            key,
            ExtraArgs={"ContentType": content_type},
        )
    except Exception as exc:
        raise StorageError(f"Could not upload file to DigitalOcean Spaces: {exc}") from exc

    return f"{REMOTE_STORAGE_PREFIX}{bucket}/{key}"


def save_file(file, folder):
    if not file:
        return None, "No file provided"

    filename = secure_filename(file.filename)
    ext = filename.rsplit(".", 1)[1].lower()

    unique_name = f"{uuid.uuid4().hex}.{ext}"
    if get_storage_backend() == "spaces":
        normalized_folder = str(folder).replace("\\", "/").lower()
        if "video" in normalized_folder:
            media_type = "videos"
        elif "profile" in normalized_folder or "avatar" in normalized_folder:
            media_type = "profile-pictures"
        else:
            media_type = "thumbnails"
        try:
            return _save_file_to_spaces(file, unique_name, media_type), None
        except StorageError as exc:
            return None, str(exc)

    file_path = os.path.join(folder, unique_name)
    os.makedirs(folder, exist_ok=True)
    file.save(file_path)

    return file_path, None


def build_storage_access_url(storage_path):
    if not is_remote_storage_path(storage_path):
        return None

    bucket, key = parse_spaces_uri(storage_path)
    client, _configured_bucket = _get_spaces_client()
    expires_in = int(current_app.config.get("SPACES_PRESIGNED_URL_SECONDS") or 900)
    try:
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires_in,
        )
    except Exception as exc:
        raise StorageError(f"Could not create a temporary media URL: {exc}") from exc


def delete_stored_file(storage_path):
    if not storage_path:
        return

    if is_remote_storage_path(storage_path):
        bucket, key = parse_spaces_uri(storage_path)
        client, _configured_bucket = _get_spaces_client()
        try:
            client.delete_object(Bucket=bucket, Key=key)
        except Exception as exc:
            raise StorageError(f"Could not delete media from DigitalOcean Spaces: {exc}") from exc
        return

    local_path = Path(str(storage_path)).expanduser()
    if local_path.exists() and local_path.is_file():
        try:
            local_path.unlink()
        except OSError as exc:
            raise StorageError(f"Could not delete local media file: {exc}") from exc


@contextmanager
def readable_file_path(storage_path):
    if not is_remote_storage_path(storage_path):
        yield Path(str(storage_path or "")).expanduser()
        return

    bucket, key = parse_spaces_uri(storage_path)
    client, _configured_bucket = _get_spaces_client()
    suffix = Path(key).suffix
    temp_file = tempfile.NamedTemporaryFile(prefix="howtoob-media-", suffix=suffix, delete=False)
    temp_path = Path(temp_file.name)
    temp_file.close()

    try:
        client.download_file(bucket, key, str(temp_path))
        yield temp_path
    except Exception as exc:
        raise StorageError(f"Could not download media from DigitalOcean Spaces: {exc}") from exc
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except OSError:
            pass
