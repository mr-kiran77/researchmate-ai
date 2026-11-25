import re
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.config import Settings
from app.database import _convert_placeholders_to_pg


def test_convert_placeholders_to_pg():
    # Test simple single placeholder
    assert _convert_placeholders_to_pg("SELECT * FROM users WHERE id = ?") == "SELECT * FROM users WHERE id = %s"
    
    # Test multiple placeholders
    q = "INSERT INTO users (id, username, gmail) VALUES (?, ?, ?)"
    assert _convert_placeholders_to_pg(q) == "INSERT INTO users (id, username, gmail) VALUES (%s, %s, %s)"
    
    # Test question mark inside string literal is preserved
    literal_q = "SELECT 'Is this valid?' as prompt, ? as val"
    assert _convert_placeholders_to_pg(literal_q) == "SELECT 'Is this valid?' as prompt, %s as val"


def test_supabase_schema_sql_has_all_tables():
    root_sql = Path(__file__).resolve().parent.parent.parent / "supabase_schema.sql"
    backend_sql = Path(__file__).resolve().parent.parent / "supabase_schema.sql"
    
    assert root_sql.exists(), "Root supabase_schema.sql must exist"
    assert backend_sql.exists(), "Backend supabase_schema.sql must exist"
    
    content = root_sql.read_text(encoding="utf-8")
    
    required_tables = [
        "users",
        "user_profiles",
        "user_preferences",
        "research_reports",
        "chat_messages",
        "uploaded_pdfs",
        "knowledge_base_docs",
        "profile_posts",
        "item_reactions",
        "scheduled_content",
        "problem_reports",
        "activity_daily_usage",
        "saved_images",
    ]
    
    for table in required_tables:
        pattern = rf"CREATE TABLE IF NOT EXISTS {table}\b"
        assert re.search(pattern, content, re.IGNORECASE), f"Missing CREATE TABLE for {table}"


def test_settings_is_postgres_detection():
    sqlite_settings = Settings(database_url="")
    assert not sqlite_settings.is_postgres
    
    pg_settings_1 = Settings(database_url="postgresql://postgres:secret@db.xyz.supabase.co:5432/postgres")
    assert pg_settings_1.is_postgres
    
    pg_settings_2 = Settings(database_url="postgres://postgres:secret@db.xyz.supabase.co:5432/postgres")
    assert pg_settings_2.is_postgres
