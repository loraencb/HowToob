import os
import uuid
from werkzeug.utils import secure_filename

ALLOWED_VIDEO_EXTENSIONS = {"mp4"}
ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg"}


def allowed_file(filename, allowed_extensions):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_extensions


def save_file(file, folder):
    if not file:
        return None, "No file provided"

    filename = secure_filename(file.filename)
    ext = filename.rsplit(".", 1)[1].lower()

    unique_name = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(folder, unique_name)

    os.makedirs(folder, exist_ok=True)
    file.save(file_path)

    return file_path, None