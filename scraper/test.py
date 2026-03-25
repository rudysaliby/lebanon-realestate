import httpx

rows = [
    {'source':'olx','url':'https://olx.com.lb/test1','title':'Apartment in Hamra','price':1200,'currency':'USD','price_period':'monthly','property_type':'apartment','size_sqm':120,'location_raw':'Hamra, Beirut','area':'Hamra','city':'Beirut','lat':33.8980,'lng':35.4841},
    {'source':'olx','url':'https://olx.com.lb/test2','title':'Villa in Jounieh','price':450000,'currency':'USD','price_period':'sale','property_type':'villa','size_sqm':300,'location_raw':'Jounieh','area':'Jounieh','city':'Jounieh','lat':33.9806,'lng':35.6178},
    {'source':'olx','url':'https://olx.com.lb/test3','title':'Studio in Achrafieh','price':800,'currency':'USD','price_period':'monthly','property_type':'apartment','size_sqm':55,'location_raw':'Achrafieh, Beirut','area':'Achrafieh','city':'Beirut','lat':33.8880,'lng':35.5155},
]

r = httpx.post(
    'https://fgpszczrwudsxlskemnc.supabase.co/rest/v1/listings',
    headers={
        'apikey': 'sb_secret_0jXgW2b8yr9cGQVwUSspnw_qHsLn90G',
        'Authorization': 'Bearer sb_secret_0jXgW2b8yr9cGQVwUSspnw_qHsLn90G',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    },
    json=rows,
    params={'on_conflict': 'url'}
)
print('Status:', r.status_code)
print('Response:', r.text[:300])