#!/usr/bin/env python3
"""Seed database with test videos and users."""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.app import create_app, db
from src.app.models.user import User
from src.app.models.video import Video
from datetime import datetime, timedelta

def seed_database():
    """Populate database with test data."""
    app = create_app()
    
    with app.app_context():
        # Clear existing data
        print("Clearing existing data...")
        Video.query.delete()
        User.query.delete()
        db.session.commit()
        
        # Create test users
        print("Creating test users...")
        creator1 = User(
            username="tech_guru",
            email="tech@example.com",
            password_hash="hashed_password_1",
            role="creator"
        )
        creator2 = User(
            username="art_master",
            email="art@example.com",
            password_hash="hashed_password_2",
            role="creator"
        )
        creator3 = User(
            username="fitness_coach",
            email="fitness@example.com",
            password_hash="hashed_password_3",
            role="creator"
        )
        learner = User(
            username="john_learner",
            email="learner@example.com",
            password_hash="hashed_password_4",
            role="viewer"
        )
        
        db.session.add_all([creator1, creator2, creator3, learner])
        db.session.commit()
        print(f"✓ Created 4 users")
        
        # Create test videos
        print("Creating test videos...")
        videos = [
            Video(
                title="Introduction to Python Programming",
                description="Learn the basics of Python from scratch",
                creator_id=creator1.id,
                file_path="/videos/python_basics.mp4",
                views=1250,
                is_published=True
            ),
            Video(
                title="Advanced Web Development with React",
                description="Master React hooks and state management",
                creator_id=creator1.id,
                file_path="/videos/react_advanced.mp4",
                views=3420,
                is_published=True
            ),
            Video(
                title="Digital Painting Fundamentals",
                description="Learn digital painting techniques and tools",
                creator_id=creator2.id,
                file_path="/videos/digital_painting.mp4",
                views=892,
                is_published=True
            ),
            Video(
                title="UI/UX Design Principles",
                description="Create beautiful and user-friendly interfaces",
                creator_id=creator2.id,
                file_path="/videos/ux_design.mp4",
                views=2156,
                is_published=True
            ),
            Video(
                title="Full Body Workout - No Equipment",
                description="30-minute workout routine using no equipment",
                creator_id=creator3.id,
                file_path="/videos/full_body_workout.mp4",
                views=5640,
                is_published=True
            ),
            Video(
                title="HIIT Training for Beginners",
                description="High-intensity interval training guide for newcomers",
                creator_id=creator3.id,
                file_path="/videos/hiit_training.mp4",
                views=3210,
                is_published=True
            ),
            Video(
                title="Machine Learning Basics",
                description="Introduction to machine learning concepts and algorithms",
                creator_id=creator1.id,
                file_path="/videos/ml_basics.mp4",
                views=2890,
                is_published=True
            ),
            Video(
                title="3D Modeling Essentials",
                description="Learn 3D modeling techniques with Blender",
                creator_id=creator2.id,
                file_path="/videos/3d_modeling.mp4",
                views=1567,
                is_published=True
            ),
            Video(
                title="Nutrition Guide for Fitness",
                description="Complete nutrition guide to support your fitness journey",
                creator_id=creator3.id,
                file_path="/videos/nutrition_guide.mp4",
                views=4230,
                is_published=True
            ),
            Video(
                title="TypeScript for JavaScript Developers",
                description="Add type safety to your JavaScript projects",
                creator_id=creator1.id,
                file_path="/videos/typescript.mp4",
                views=1895,
                is_published=True
            ),
            # Additional Technology videos
            Video(
                title="Frontend Performance Optimization",
                description="Techniques to speed up your web applications",
                creator_id=creator1.id,
                file_path="/videos/frontend_perf.mp4",
                views=2340,
                is_published=True
            ),
            Video(
                title="Backend API Design Patterns",
                description="Best practices for building scalable APIs",
                creator_id=creator1.id,
                file_path="/videos/backend_api.mp4",
                views=1876,
                is_published=True
            ),
            # Additional Arts & Design videos
            Video(
                title="Color Theory and Design",
                description="Master color combinations and design principles",
                creator_id=creator2.id,
                file_path="/videos/color_theory.mp4",
                views=1450,
                is_published=True
            ),
            Video(
                title="Web Design Fundamentals",
                description="Create stunning web layouts from scratch",
                creator_id=creator2.id,
                file_path="/videos/web_design.mp4",
                views=2780,
                is_published=True
            ),
            # Additional Fitness videos
            Video(
                title="Yoga for Beginners",
                description="Start your yoga journey with basics",
                creator_id=creator3.id,
                file_path="/videos/yoga_basics.mp4",
                views=3560,
                is_published=True
            ),
            Video(
                title="Advanced Cardio Workouts",
                description="High-energy cardio routines for athletes",
                creator_id=creator3.id,
                file_path="/videos/cardio_advanced.mp4",
                views=2890,
                is_published=True
            ),
            # More Technology videos (6 total)
            Video(
                title="Web Design Masterclass",
                description="Create stunning web layouts from scratch",
                creator_id=creator1.id,
                file_path="/videos/web_design_master.mp4",
                views=2580,
                is_published=True
            ),
            # More Arts & Design videos (6 total)
            Video(
                title="Digital Art Techniques",
                description="Learn professional digital art techniques",
                creator_id=creator2.id,
                file_path="/videos/digital_art_tech.mp4",
                views=1690,
                is_published=True
            ),
            # More Fitness videos (6 total)
            Video(
                title="Strength Training Basics",
                description="Build muscle with proper form and technique",
                creator_id=creator3.id,
                file_path="/videos/strength_training.mp4",
                views=2950,
                is_published=True
            ),
        ]
        
        db.session.add_all(videos)
        db.session.commit()
        print(f"✓ Created {len(videos)} test videos")
        
        print("\n✅ Database seeded successfully!")
        print(f"   - 4 users created")
        print(f"   - {len(videos)} videos created")
        print(f"   - Technology: 6 videos")
        print(f"   - Arts & Design: 6 videos")
        print(f"   - Fitness & Wellness: 6 videos")

if __name__ == "__main__":
    seed_database()
