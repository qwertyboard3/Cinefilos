"""Add new movies from the configured Trakt list to the Cinefilos catalog."""

import json
import os
import re
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

SITE = Path(__file__).resolve().parents[1] / "Cinefilos"
CATALOG = SITE / "assets/trakt-movies.js"
PREFIX = "const traktMovies = "
LIST = "https://api.trakt.tv/users/qwertyboard2/lists/movies/items/movies"


def list_movies(client_id):
    page = 1
    while True:
        params = urlencode({"page": page, "limit": 100, "extended": "full,images"})
        request = Request(f"{LIST}?{params}", headers={
            "trakt-api-key": client_id,
            "trakt-api-version": "2",
            "Accept": "application/json",
        })
        try:
            with urlopen(request, timeout=30) as response:
                items = json.load(response)
                page_count = int(response.headers.get("X-Pagination-Page-Count", "1"))
        except HTTPError as error:
            content_type = error.headers.get_content_type()
            body = error.read(4096).decode("utf-8", errors="replace").lower()
            signals = {
                "Cloudflare challenge": error.headers.get("cf-mitigated") == "challenge"
                or "just a moment" in body,
                "limited access": "limited access" in body,
                "production access": "production access" in body,
                "private list": "private" in body,
                "OAuth required": "oauth" in body,
            }
            detail = ", ".join(label for label, present in signals.items() if present)
            if not detail and content_type == "application/json":
                try:
                    payload = json.loads(body)
                except ValueError:
                    payload = None
                if isinstance(payload, dict):
                    messages = [
                        value.replace(client_id.lower(), "[redacted]")
                        for key in ("error", "message", "error_description")
                        if isinstance(value := payload.get(key), str)
                    ]
                    detail = " ".join(" ".join(messages).split())[:240]
            raise SystemExit(
                f"Trakt list request returned HTTP {error.code} ({content_type})"
                + (f": {detail}" if detail else "")
            ) from None
        if not isinstance(items, list):
            raise ValueError("Unexpected Trakt list response")
        yield from (item["movie"] for item in items if item.get("type") == "movie")
        if page >= page_count:
            break
        page += 1


def cache_poster(movie, imdb_id):
    for image in (movie.get("images") or {}).get("poster") or []:
        url = image if image.startswith("https://") else f"https://{image}"
        parsed = urlsplit(url)
        if not parsed.hostname or not parsed.hostname.endswith(".trakt.tv") or parsed.username:
            continue
        with urlopen(url, timeout=30) as response:
            data = response.read(5_000_001)
        if len(data) > 5_000_000 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
            raise ValueError(f"Invalid Trakt poster for {imdb_id}")
        relative_path = f"posters/trakt/{imdb_id}.webp"
        path = SITE / relative_path
        path.parent.mkdir(exist_ok=True)
        path.write_bytes(data)
        return relative_path
    return "posters/fallback.jpg"


def sync(client_id):
    raw = CATALOG.read_text(encoding="utf-8").strip()
    if not raw.startswith(PREFIX) or not raw.endswith(";"):
        raise ValueError("Unexpected Cinefilos Trakt catalog format")
    saved = json.loads(raw[len(PREFIX):-1])
    existing_ids = {item["id"] for item in saved}
    primary_catalog = (SITE / "assets/entries.js").read_text(encoding="utf-8")
    existing_ids.update(re.findall(r'(?m)^\s*\{[^\n]*imdbID:\s*"(tt\d+)"', primary_catalog))
    added = []
    for movie in list_movies(client_id):
        imdb_id = (movie.get("ids") or {}).get("imdb")
        if not imdb_id or not re.fullmatch(r"tt\d{7,}", imdb_id):
            print("Skipped a Trakt movie without a valid IMDb ID.")
            continue
        if imdb_id in existing_ids:
            continue
        year = movie["year"]
        runtime = movie.get("runtime")
        if not isinstance(year, int) or not movie.get("title"):
            raise ValueError(f"Incomplete Trakt metadata for {imdb_id}")
        added.append({
            "id": imdb_id,
            "title": movie["title"],
            "year": year,
            "runtime": f"{runtime} min" if runtime else "",
            "posterUrl": cache_poster(movie, imdb_id),
        })
        existing_ids.add(imdb_id)
    if added:
        temporary = CATALOG.with_suffix(".tmp")
        temporary.write_text(PREFIX + json.dumps(saved + added, indent=2) + ";\n", encoding="utf-8")
        temporary.replace(CATALOG)
    print(f"Added {len(added)} movies from Trakt.")


if __name__ == "__main__":
    client_id = os.environ.get("TRAKT_CLIENT_ID")
    if not client_id:
        raise SystemExit("Configure TRAKT_CLIENT_ID in GitHub Actions secrets first.")
    sync(client_id)
