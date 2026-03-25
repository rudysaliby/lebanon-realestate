import asyncio
import httpx
from typing import Optional

# Cache to avoid re-geocoding same locations
_cache: dict[str, tuple[float, float] | None] = {}

LEBANON_COORDS = {
    "beirut": (33.8938, 35.5018),
    "hamra": (33.8980, 35.4841),
    "verdun": (33.8847, 35.4925),
    "achrafieh": (33.8880, 35.5155),
    "gemmayzeh": (33.8922, 35.5139),
    "mar mikhael": (33.8910, 35.5180),
    "jounieh": (33.9806, 35.6178),
    "jdeideh": (33.8997, 35.5614),
    "dbayeh": (33.9297, 35.5892),
    "kaslik": (33.9742, 35.6064),
    "baabda": (33.8353, 35.5481),
    "hazmieh": (33.8586, 35.5481),
    "broummana": (33.8803, 35.6469),
    "beit mery": (33.8736, 35.6358),
    "dekwaneh": (33.8875, 35.5528),
    "sin el fil": (33.8858, 35.5378),
    "tripoli": (34.4369, 35.8497),
    "saida": (33.5631, 35.3711),
    "sidon": (33.5631, 35.3711),
    "tyre": (33.2705, 35.2038),
    "sour": (33.2705, 35.2038),
    "zahle": (33.8467, 35.9019),
    "jbeil": (34.1236, 35.6517),
    "byblos": (34.1236, 35.6517),
    "batroun": (34.2553, 35.6583),
    "koura": (34.3167, 35.6833),
    "zgharta": (34.3969, 35.8931),
    "aley": (33.8100, 35.5975),
    "chouf": (33.6500, 35.5500),
    "bhamdoun": (33.8000, 35.6667),
}

async def geocode_location(location_raw: str) -> tuple[Optional[float], Optional[float]]:
    if not location_raw:
        return None, None

    key = location_raw.lower().strip()

    if key in _cache:
        result = _cache[key]
        return result if result else (None, None)

    # Try local lookup first (fast, no API call)
    for place, coords in LEBANON_COORDS.items():
        if place in key:
            _cache[key] = coords
            return coords

    # Try Nominatim (free, no API key needed)
    try:
        query = f"{location_raw}, Lebanon"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "json", "limit": 1, "countrycodes": "lb"},
                headers={"User-Agent": "LBRealEstate-MVP/1.0"}
            )
            data = resp.json()
            if data:
                lat = float(data[0]["lat"])
                lng = float(data[0]["lon"])
                _cache[key] = (lat, lng)
                await asyncio.sleep(1.1)  # Nominatim rate limit: 1 req/sec
                return lat, lng
    except Exception as e:
        print(f"[Geocode] Error for '{location_raw}': {e}")

    _cache[key] = None
    return None, None
