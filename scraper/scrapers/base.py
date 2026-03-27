from dataclasses import dataclass, field
from typing import Optional
import re

@dataclass
class RawListing:
    source: str
    url: str
    title: Optional[str] = None
    price: Optional[float] = None
    currency: str = "USD"
    price_period: Optional[str] = None
    location_raw: Optional[str] = None
    area: Optional[str] = None
    subregion: Optional[str] = None
    region: Optional[str] = None
    description: Optional[str] = None
    property_type: Optional[str] = None
    size_sqm: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    image_url: Optional[str] = None
    # Extra tag fields (realestate.com.lb pre-scraped)
    _furnished: Optional[str] = None
    _bedrooms: Optional[int] = None
    _bathrooms: Optional[int] = None
    _amenities: Optional[list] = None
    _floor: Optional[str] = None

class BaseScraper:
    SOURCE = ""

    async def scrape(self, max_pages: int = 1) -> list:
        raise NotImplementedError

    def parse_price(self, raw: str | None) -> float | None:
        if not raw:
            return None
        digits = re.sub(r"[^\d.]", "", raw.replace(",", ""))
        try:
            return float(digits) if digits else None
        except ValueError:
            return None

    def parse_size(self, raw: str | None) -> float | None:
        if not raw:
            return None
        match = re.search(r"(\d+[\.,]?\d*)\s*(?:m²|sqm|sq\.?\s*m|متر)", raw, re.IGNORECASE)
        if match:
            return float(match.group(1).replace(",", "."))
        return None

    def guess_property_type(self, title: str | None, type_name: str | None = None) -> str | None:
        if type_name:
            t = type_name.lower()
            if any(w in t for w in ["apartment", "flat", "loft"]): return "apartment"
            if any(w in t for w in ["villa", "house", "townhouse", "chalet"]): return "villa"
            if any(w in t for w in ["land", "plot"]): return "land"
            if any(w in t for w in ["commercial", "office", "shop"]): return "commercial"
        text = (title or "").lower()
        if any(w in text for w in ["apartment", "flat", "شقة", "appt", "loft"]): return "apartment"
        if any(w in text for w in ["villa", "house", "townhouse", "فيلا", "chalet"]): return "villa"
        if any(w in text for w in ["land", "plot", "أرض"]): return "land"
        if any(w in text for w in ["office", "commercial", "مكتب"]): return "commercial"
        if any(w in text for w in ["shop", "store", "محل"]): return "shop"
        return None
