
set -e

echo "⏳ Starting 3mMile API Initialization..."

if [ "$RUN_DB_SEED" = "true" ]; then
  echo "🌱 Seeding initial data (roles + admin user)..."
  node scripts/seed.js
else
  echo "⏭️  Skipping db seed (set RUN_DB_SEED=true to enable)."
fi

echo "🚀 Starting the server..."
if [ "$NODE_ENV" = "development" ]; then
  exec npm run dev
else
  exec npm start
fi