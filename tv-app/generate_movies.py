import urllib.request
import json
import time

TMDB_KEY = "8265bd1679663a7ea12ac168da84d2e8"
BASE_URL = "https://api.themoviedb.org/3"

def fetch_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"  Error: {e}")
        return None

def pages(base, n):
    """Generate page URLs from 1..n"""
    return [f"{base}&page={p}" for p in range(1, n + 1)]

def main():
    movies = []
    seen = set()

    # ── Build a massive list of endpoints across genres & types ──
    endpoints = []

    # Trending (all media, week)
    for p in range(1, 11):
        endpoints.append(f"/trending/all/week?language=en-US&page={p}")

    # Popular movies (pages 1-30 = ~600 movies)
    endpoints += pages("/movie/popular?language=en-US", 30)

    # Top Rated movies
    endpoints += pages("/movie/top_rated?language=en-US", 20)

    # Now Playing
    endpoints += pages("/movie/now_playing?language=en-US", 10)

    # ── Genre-specific movies ──
    genre_map = {
        "Action":    28,
        "Horror":    27,
        "Sci-Fi":    878,
        "Comedy":    35,
        "Drama":     18,
        "Thriller":  53,
        "Romance":   10749,
        "Animation": 16,
        "Crime":     80,
    }
    for name, gid in genre_map.items():
        endpoints += pages(f"/discover/movie?language=en-US&with_genres={gid}&sort_by=popularity.desc&vote_count.gte=50", 15)

    # ── Asian Cinema (Korean, Japanese, Chinese) ──
    for lang in ["ko", "ja", "zh"]:
        endpoints += pages(f"/discover/movie?language=en-US&with_original_language={lang}&sort_by=vote_average.desc&vote_count.gte=100", 10)

    # ── Anime (Japanese Animation TV) ──
    endpoints += pages("/discover/tv?language=en-US&with_genres=16&with_original_language=ja&sort_by=popularity.desc", 20)

    # ── Popular TV Series ──
    endpoints += pages("/tv/popular?language=en-US", 20)

    # ── Top Rated TV ──
    endpoints += pages("/tv/top_rated?language=en-US", 15)

    # ── Action & Adventure TV ──
    endpoints += pages("/discover/tv?language=en-US&with_genres=10759&sort_by=popularity.desc", 15)

    # ── Korean Dramas ──
    endpoints += pages("/discover/tv?language=en-US&with_original_language=ko&sort_by=popularity.desc&vote_count.gte=50", 15)

    print(f"Total list endpoints to fetch: {len(endpoints)}")

    # Specific requests
    specific_ids = [
        "/tv/100088?language=en-US", # The Last of Us
        "/tv/93405?language=en-US",  # Squid Game
        "/tv/119051?language=en-US", # Wednesday
        "/movie/76600?language=en-US", # Avatar 2
        "/movie/575264?language=en-US", # M:I Dead Reckoning
    ]

    for ep in specific_ids:
        sep = "&" if "?" in ep else "?"
        url = f"{BASE_URL}{ep}{sep}api_key={TMDB_KEY}"
        data = fetch_json(url)
        if data:
            # Format single detail response to mimic list element
            if not "media_type" in data:
                data["media_type"] = "tv" if "/tv/" in ep else "movie"
            movies.append(data)
            seen.add(data["id"])
            try: print(f"Added specific target: {data.get('title') or data.get('name')}")
            except: print(f"Added specific target ID: {data.get('id')}")

    for i, ep in enumerate(endpoints):
        sep = "&" if "?" in ep else "?"
        url = f"{BASE_URL}{ep}{sep}api_key={TMDB_KEY}"
        data = fetch_json(url)
        if data and "results" in data:
            added = 0
            for item in data["results"]:
                uid = item.get("id")
                if uid and uid not in seen and item.get("poster_path"):
                    seen.add(uid)
                    # Ensure media_type is set
                    if "media_type" not in item:
                        if "/tv" in ep:
                            item["media_type"] = "tv"
                        else:
                            item["media_type"] = "movie"
                    movies.append(item)
                    added += 1
            print(f"[{i+1}/{len(endpoints)}] {ep[:60]}... +{added} (total: {len(movies)})")
        else:
            print(f"[{i+1}/{len(endpoints)}] {ep[:60]}... FAILED")
        time.sleep(0.25)  # Respect rate limits

    print(f"\nTotal unique items collected: {len(movies)}")

    # Keep only essential fields to minimize JSON size
    slim = []
    keep_keys = [
        "id", "title", "name", "overview", "poster_path", "backdrop_path",
        "media_type", "genre_ids", "vote_average", "vote_count",
        "release_date", "first_air_date", "original_language", "popularity"
    ]
    for m in movies:
        slim.append({k: m[k] for k in keep_keys if k in m})

    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(slim, f, ensure_ascii=False, separators=(',', ':'))
    
    size_kb = len(json.dumps(slim, ensure_ascii=False, separators=(',', ':'))) / 1024
    print(f"Saved {len(slim)} items to data.json ({size_kb:.0f} KB)")

if __name__ == "__main__":
    main()
