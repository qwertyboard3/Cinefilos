"""Mirror the configured Trakt list in the main Cinefilos gallery."""

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
    seen = set()
    while True:
        params = urlencode({"page": page, "limit": 100, "extended": "full,images"})
        request = Request(f"{LIST}?{params}", headers={
            "trakt-api-key": client_id,
            "trakt-api-version": "2",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Cinefilos/1.0",
        })
        try:
            with urlopen(request, timeout=30) as response:
                items = json.load(response)
                page_count = int(response.headers.get("X-Pagination-Page-Count", "1"))
                item_count = response.headers.get("X-Pagination-Item-Count")
        except HTTPError as error:
            probe = ""
            if error.code == 403:
                public_request = Request(
                    "https://api.trakt.tv/movies/trending?limit=1",
                    headers=request.headers,
                )
                try:
                    with urlopen(public_request, timeout=15) as response:
                        probe = f"; public trending endpoint returned HTTP {response.status}"
                except HTTPError as public_error:
                    probe = f"; public trending endpoint returned HTTP {public_error.code}"
                except OSError:
                    probe = "; public trending endpoint could not be reached"
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
                + probe
            ) from None
        if not isinstance(items, list) or any(
            not isinstance(item, dict) or item.get("type") != "movie"
            or not isinstance(item.get("movie"), dict)
            or not (item["movie"].get("ids") or {}).get("trakt")
            for item in items
        ):
            raise ValueError("Unexpected Trakt list response")
        for item in items:
            movie = item["movie"]
            trakt_id = movie["ids"]["trakt"]
            if trakt_id in seen:
                raise ValueError("Trakt list changed during pagination; retrying next run.")
            seen.add(trakt_id)
            yield movie
        if page >= page_count:
            if item_count is not None and len(seen) != int(item_count):
                raise ValueError("Incomplete Trakt list response; keeping the published catalog.")
            break
        page += 1


def cache_poster(movie, imdb_id):
    for image in (movie.get("images") or {}).get("poster") or []:
        url = image if image.startswith("https://") else f"https://{image}"
        parsed = urlsplit(url)
        if not parsed.hostname or not parsed.hostname.endswith(".trakt.tv") or parsed.username:
            continue
        try:
            request = Request(url, headers={"User-Agent": "Cinefilos/1.0", "Accept": "image/webp"})
            with urlopen(request, timeout=30) as response:
                data = response.read(5_000_001)
        except OSError:
            print(f"Could not download a Trakt poster for {imdb_id}.")
            continue
        if len(data) > 5_000_000 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
            print(f"Invalid Trakt poster for {imdb_id}.")
            continue
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
    previous_movies = saved if isinstance(saved, list) else saved["movies"]
    previous_by_id = {movie["id"]: movie for movie in previous_movies}
    primary_catalog = (SITE / "assets/entries.js").read_text(encoding="utf-8")
    primary_ids = set(re.findall(r'(?m)^\s*\{[^\n]*imdbID:\s*"(tt\d+)"', primary_catalog))
    active_ids = set()
    imports = {}
    for movie in list(list_movies(client_id)):
        imdb_id = (movie.get("ids") or {}).get("imdb")
        if not imdb_id or not re.fullmatch(r"tt\d{7,}", imdb_id):
            print("Skipped a Trakt movie without a valid IMDb ID.")
            continue
        if imdb_id in active_ids:
            continue
        active_ids.add(imdb_id)
        if imdb_id in primary_ids:
            continue
        if imdb_id in previous_by_id:
            imports[imdb_id] = previous_by_id[imdb_id]
            continue
        year = movie["year"]
        runtime = movie.get("runtime")
        if not isinstance(year, int) or not movie.get("title"):
            raise ValueError(f"Incomplete Trakt metadata for {imdb_id}")
        imports[imdb_id] = {
            "id": imdb_id,
            "title": movie["title"],
            "year": year,
            "runtime": f"{runtime} min" if runtime else "",
            "posterUrl": cache_poster(movie, imdb_id),
        }
    snapshot = {"activeIds": sorted(active_ids), "movies": [imports[id] for id in sorted(imports)]}
    if snapshot != saved:
        temporary = CATALOG.with_suffix(".tmp")
        temporary.write_text(PREFIX + json.dumps(snapshot, indent=2) + ";\n", encoding="utf-8")
        temporary.replace(CATALOG)
    print(f"Synced {len(active_ids)} main-gallery movies from Trakt.")


if __name__ == "__main__":
    client_id = os.environ.get("TRAKT_CLIENT_ID", "").strip()
    if not client_id:
        raise SystemExit("Configure TRAKT_CLIENT_ID in GitHub Actions secrets first.")
    sync(client_id)
