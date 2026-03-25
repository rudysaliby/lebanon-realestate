import asyncio
import random
from typing import Optional

_cache: dict[str, tuple[float, float] | None] = {}

LEBANON_COORDS = {
    "beirut": (33.8938, 35.5018), "hamra": (33.8980, 35.4841),
    "verdun": (33.8847, 35.4925), "achrafieh": (33.8880, 35.5155),
    "ashrafieh": (33.8880, 35.5155), "gemmayzeh": (33.8922, 35.5139),
    "mar mikhael": (33.8910, 35.5180), "badaro": (33.8833, 35.5100),
    "sodeco": (33.8867, 35.5067), "kantari": (33.8900, 35.4967),
    "downtown": (33.8950, 35.5050), "saifi": (33.8978, 35.5128),
    "jounieh": (33.9806, 35.6178), "jdeideh": (33.8997, 35.5614),
    "dbayeh": (33.9297, 35.5892), "dbaye": (33.9297, 35.5892),
    "kaslik": (33.9742, 35.6064), "baabda": (33.8353, 35.5481),
    "hazmieh": (33.8586, 35.5481), "broummana": (33.8803, 35.6469),
    "broumana": (33.8803, 35.6469), "beit mery": (33.8736, 35.6358),
    "dekwaneh": (33.8875, 35.5528), "sin el fil": (33.8858, 35.5378),
    "metn": (33.8900, 35.5700), "antelias": (33.9100, 35.5850),
    "zalka": (33.9028, 35.5708), "dora": (33.9008, 35.5597),
    "naccache": (33.9017, 35.5614), "naccash": (33.9017, 35.5614),
    "rabieh": (33.8961, 35.5806), "rabweh": (33.8736, 35.6122),
    "mansourieh": (33.8747, 35.5806), "baouchrieh": (33.8900, 35.5450),
    "jal el dib": (33.9100, 35.5683), "sabtieh": (33.9000, 35.5500),
    "fanar": (33.8908, 35.5736), "bsalim": (33.8572, 35.6022),
    "kfarhbab": (34.0300, 35.6500), "adma": (33.9636, 35.6483),
    "ajaltoun": (33.9578, 35.6194), "ballouneh": (33.9411, 35.6406),
    "sheileh": (33.9544, 35.6411), "jeita": (33.9500, 35.6333),
    "zouk mikael": (33.9872, 35.6133), "zouk mosbeh": (33.9783, 35.6167),
    "kesrouan": (33.9700, 35.6500), "keserwan": (33.9700, 35.6500),
    "tripoli": (34.4369, 35.8497), "saida": (33.5631, 35.3711),
    "sidon": (33.5631, 35.3711), "tyre": (33.2705, 35.2038),
    "sour": (33.2705, 35.2038), "zahle": (33.8467, 35.9019),
    "jbeil": (34.1236, 35.6517), "byblos": (34.1236, 35.6517),
    "batroun": (34.2553, 35.6583), "koura": (34.3167, 35.6833),
    "zgharta": (34.3969, 35.8931), "aley": (33.8100, 35.5975),
    "chouf": (33.6500, 35.5500), "bhamdoun": (33.8000, 35.6667),
    "sawfar": (33.7833, 35.6833), "faraya": (34.0000, 35.9167),
    "faqra": (33.9833, 35.8833), "mzaar": (34.0667, 35.9833),
    "yarzeh": (33.8378, 35.5378), "mtayleb": (33.9300, 35.6200),
    "dik el mehdi": (33.8972, 35.5931),
}

async def geocode_location(location_raw: str) -> tuple[Optional[float], Optional[float]]:
    if not location_raw:
        return None, None

    key = location_raw.lower().strip()

    if key in _cache:
        r = _cache[key]
        return r if r else (None, None)

    for place, coords in LEBANON_COORDS.items():
        if place in key:
            jitter = (random.random() - 0.5) * 0.008
            jitter2 = (random.random() - 0.5) * 0.008
            result = (coords[0] + jitter, coords[1] + jitter2)
            _cache[key] = result
            return result

    _cache[key] = None
    return None, None