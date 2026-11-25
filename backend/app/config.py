"""Application configuration loaded strictly from environment variables."""

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime settings for ResearchMate AI."""

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), str(ROOT_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "ResearchMate AI"
    app_tagline: str = "Research Smarter. Discover Faster. Make Better Decisions."

    # AI Provider configuration ("auto" | "gemini" | "openai")
    llm_provider: str = "auto"
    gemini_api_key: str = ""
    google_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Web Search API
    tavily_api_key: str = ""

    # Optional Image Search APIs (swap in your own keys anytime in backend/.env;
    # free no-key Wikimedia Commons, Wikipedia & Openverse providers work out of the box)
    unsplash_access_key: str = ""
    pexels_api_key: str = ""
    pixabay_api_key: str = ""

    # Storage & Supabase
    database_path: str = "data/researchmate.db"
    database_url: str = ""
    supabase_url: str = ""
    supabase_key: str = ""
    upload_dir: str = "data/uploads"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def is_postgres(self) -> bool:
        db_url = (self.database_url or "").strip().lower()
        return db_url.startswith("postgresql://") or db_url.startswith("postgres://")

    @property
    def effective_gemini_key(self) -> str:
        return (self.gemini_api_key or self.google_api_key or "").strip()

    @property
    def effective_openai_key(self) -> str:
        return (self.openai_api_key or "").strip()

    @property
    def effective_tavily_key(self) -> str:
        return (self.tavily_api_key or "").strip()

    @property
    def effective_unsplash_key(self) -> str:
        return (self.unsplash_access_key or "").strip()

    @property
    def effective_pexels_key(self) -> str:
        return (self.pexels_api_key or "").strip()

    @property
    def effective_pixabay_key(self) -> str:
        return (self.pixabay_api_key or "").strip()

    @property
    def resolved_database_path(self) -> Path:
        p = Path(self.database_path)
        return p if p.is_absolute() else (BACKEND_DIR / p)

    @property
    def resolved_upload_dir(self) -> Path:
        p = Path(self.upload_dir)
        return p if p.is_absolute() else (BACKEND_DIR / p)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def active_llm_mode(self) -> str:
        pref = self.llm_provider.lower().strip()
        has_gemini = bool(self.effective_gemini_key)
        has_openai = bool(self.effective_openai_key)
        if pref == "gemini" and has_gemini:
            return "gemini"
        if pref == "openai" and has_openai:
            return "openai"
        if has_gemini:
            return "gemini"
        if has_openai:
            return "openai"
        return "extractive_fallback"

    def public_capabilities(self) -> dict:
        """Return safe capability flags without ever exposing secret keys."""
        mode = self.active_llm_mode()
        search_engines = ["OpenAlex Academic", "arXiv Preprints", "Wikipedia", "DuckDuckGo Web", "Knowledge Base", "PyMuPDF Uploads"]
        if self.effective_tavily_key:
            search_engines.insert(0, "Tavily Web Search")
        return {
            "gemini_configured": bool(self.effective_gemini_key),
            "openai_configured": bool(self.effective_openai_key),
            "tavily_configured": bool(self.effective_tavily_key),
            "unsplash_configured": bool(self.effective_unsplash_key),
            "pexels_configured": bool(self.effective_pexels_key),
            "pixabay_configured": bool(self.effective_pixabay_key),
            "active_llm_provider": mode,
            "active_llm_model": (
                self.gemini_model if mode == "gemini"
                else self.openai_model if mode == "openai"
                else "Evidence-Grounded Extractive Synthesizer"
            ),
            "active_search_engines": search_engines,
            "database_engine": "supabase_postgres" if self.is_postgres else "sqlite",
            "supabase_configured": bool(self.is_postgres or (self.supabase_url and self.supabase_key)),
        }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
