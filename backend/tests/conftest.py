"""Test config: force the offline AI stub and a throwaway sqlite DB before app import."""
import os
import tempfile

os.environ["AI_MOCK"] = "true"
os.environ["AI_PROVIDER"] = "ollama"
_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
