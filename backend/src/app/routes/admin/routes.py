from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from ...services.admin import AdminService

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


def _ensure_admin():
    if current_user.role != "admin":
        return jsonify({"error": "Admin access required"}), 403
    return None


@admin_bp.route("/reports", methods=["GET"])
@login_required
def list_reports():
    rejection = _ensure_admin()
    if rejection:
        return rejection

    status = request.args.get("status")
    target_type = request.args.get("target_type")
    reason = request.args.get("reason")
    reporter_id = request.args.get("reporter_id", type=int)
    payload = AdminService.list_reports(
        status=status,
        target_type=target_type,
        reason=reason,
        reporter_id=reporter_id,
    )
    return jsonify(payload), 200


@admin_bp.route("/reports/<int:report_id>/actions", methods=["POST"])
@login_required
def apply_report_action(report_id):
    rejection = _ensure_admin()
    if rejection:
        return rejection

    data = request.get_json() or {}
    action = data.get("action")
    if not action:
        return jsonify({"error": "action is required"}), 400

    report, error = AdminService.apply_report_action(
        report_id=report_id,
        moderator_id=current_user.id,
        action=action,
        notes=data.get("notes"),
    )

    if error:
        status = 404 if "not found" in error.lower() else 400
        return jsonify({"error": error}), status

    return jsonify(report.to_dict(include_logs=True)), 200
