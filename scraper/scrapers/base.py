"""
Base scraper classes with clear mandatory/optional field tracking.

Mandatory fields (listing dropped if missing after enrichment):
- price, currency, price_period (sale/monthly)
- property_type
- size_sqm
- lat, lng OR area (area used for coord lookup)
- region

Optional fields (listing kept even if missing):
- bedrooms, bathrooms, furnished
- condition, floor_type, building_age
- payment_type, view_type, lifestyle, features
"""
from dataclasses import dataclass, field
from typing import Optional
import re

@dataclass
class RawListing:
    # Identity
    source: str
    url: str

    # Mandatory fields
    title: Optional[str] = None
    price: Optional[float] = None
    currency: str = "USD"
    price_period: Optional[str] = None        # "sale" or "monthly"
    property_type: Optional[str] = None       # apartment/villa/land/commercial
    size_sqm: Optional[float] = None

    # Location (need lat/lng OR area for coord lookup)
    location_raw: Optional[str] = None
    area: Optional[str] = None
    subregion: Optional[str] = None
    region: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

    # Optional fields
    description: Optional[str] = None
    image_url: Optional[str] = None

    # Pre-scraped tags
    _furnished: Optional[str] = None
    _bedrooms: Optional[int] = None
    _bathrooms: Optional[int] = None
    _amenities: Optional[list] = None
    _floor: Optional[str] = None
    _condition: Optional[str] = None
    _payment: Optional[str] = None
    _building_age: Optional[str] = None
    _view_type: Optional[list] = None
    _lifestyle: Optional[list] = None

    # Price quality flag
    _price_suspect: bool = False  # True if price might be per-sqm

class BaseScraper:
    SOURCE = ""

    async def scrape(self, max_pages: int = 1, progress=None) -> list:
        raise NotImplementedError

    def parse_price(self, raw: str | None) -> float | None:
        if not raw: return None
        digits = re.sub(r"[^\d.]", "", raw.replace(",", ""))
        try: return float(digits) if digits else None
        except: return None

    def parse_size(self, raw: str | None) -> float | None:
        if not raw: return None
        m = re.search(r"(\d[\d,]*\.?\d*)\s*(?:m²|sqm|sq\.?\s*m)", raw, re.IGNORECASE)
        if m: return float(m.group(1).replace(",", ""))
        return None

    def guess_property_type(self, title: str | None, type_name: str | None = None) -> str | None:
        if type_name:
            t = type_name.lower()
            if any(w in t for w in ["apartment","flat","loft","studio"]): return "apartment"
            if any(w in t for w in ["villa","house","townhouse","chalet","duplex","triplex"]): return "villa"
            if any(w in t for w in ["land","plot","terrain"]): return "land"
            if any(w in t for w in ["commercial","office","shop","store","warehouse","restaurant","clinic","showroom","factory","gym","hotel","salon"]): return "commercial"
            if any(w in t for w in ["chalet","cabin"]): return "chalet"
            if any(w in t for w in ["building","multiple unit"]): return "building"
        text = (title or "").lower()
        if any(w in text for w in ["apartment","flat","شقة","appt","loft","studio"]): return "apartment"
        if any(w in text for w in ["villa","house","townhouse","فيلا","chalet","duplex","triplex"]): return "villa"
        if any(w in text for w in ["land","plot","أرض","terrain"]): return "land"
        if any(w in text for w in ["office","commercial","مكتب","warehouse"]): return "commercial"
        if any(w in text for w in ["shop","store","محل"]): return "shop"
        return None
