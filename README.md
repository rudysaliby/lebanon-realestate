# Lebanon Real Estate Aggregator — MVP

A map-based property listing aggregator for Lebanon, pulling from OLX Lebanon and Property Finder LB.

## Project Structure

```
lb-realestate/
  db/           → Database schema (run in Supabase)
  scraper/      → Python scrapers + geocoding
  frontend/     → Next.js app with Mapbox map
```

## Setup

### 1. Database
- Go to Supabase → SQL Editor
- Paste and run the contents of `db/schema.sql`

### 2. Scraper
```bash
cd scraper
pip install -r requirements.txt
playwright install chromium
python runner.py
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:3000

## Deployment
- Frontend → Vercel (connect GitHub repo)
- Scraper → Render (cron job, daily)
- Database → Supabase (already hosted)

## Environment Variables

### frontend/.env.local
```
NEXT_PUBLIC_SUPABASE_URL=https://fgpszczrwudsxlskemnc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_JSdeAGE9LHLI0_Y9BK7S6g_5omlBmX5
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoicnVkeXNhbGlieSIsImEiOiJjbW41dGswZWgwMHc0MzJzOThyM2t2cGVkIn0.XVS8RqSodJYmFAlM2crVrQ
SUPABASE_SECRET_KEY=sb_secret_0jXgW2b8yr9cGQVwUSspnw_qHsLn90G
```

### scraper/.env
```
SUPABASE_URL=https://fgpszczrwudsxlskemnc.supabase.co
SUPABASE_SECRET_KEY=sb_secret_0jXgW2b8yr9cGQVwUSspnw_qHsLn90G
```
