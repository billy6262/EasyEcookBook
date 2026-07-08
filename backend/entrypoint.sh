#!/bin/sh
set -e

# ── Wait for PostgreSQL ────────────────────────────────────────────────────────
echo "Waiting for PostgreSQL..."
python << 'PYEOF'
import os, sys, time, psycopg2
from urllib.parse import urlparse

url = urlparse(os.environ["DATABASE_URL"])
for attempt in range(30):
    try:
        conn = psycopg2.connect(
            dbname=url.path[1:],
            user=url.username,
            password=url.password,
            host=url.hostname,
            port=url.port or 5432,
        )
        conn.close()
        print("PostgreSQL is ready.")
        sys.exit(0)
    except psycopg2.OperationalError:
        print(f"  attempt {attempt + 1}/30 — not ready yet, retrying...")
        time.sleep(2)
print("PostgreSQL did not become ready in time. Exiting.")
sys.exit(1)
PYEOF

# ── Run migrations ─────────────────────────────────────────────────────────────
echo "Running database migrations..."
python manage.py migrate --noinput

# ── Collect static files ───────────────────────────────────────────────────────
echo "Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "Starting application..."
exec "$@"
