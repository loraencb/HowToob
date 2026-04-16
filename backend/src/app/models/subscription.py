from ..extensions import db


class Subscription(db.Model):
    __tablename__ = "subscriptions"

    id = db.Column(db.Integer, primary_key=True)
    subscriber_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    creator_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    tier_level = db.Column(db.Integer, default=0, nullable=False)  # 0=Follow, 1=Tier 1, 2=Tier 2

    subscriber = db.relationship("User", foreign_keys=[subscriber_id])
    creator = db.relationship("User", foreign_keys=[creator_id])

    __table_args__ = (
        db.UniqueConstraint(
            "subscriber_id",
            "creator_id",
            name="unique_subscriber_creator",
        ),
    )
