#!/bin/bash
export NODE_ENV=development
export ADMIN_PASSWORD=admin123
export JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
export DATABASE_URL="postgresql://postgres.bkwkqlbcoltlpttmyrdl:Moscy83Blendy92!!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require"

echo "✅ Variabili d'ambiente esportate:"
echo "NODE_ENV=$NODE_ENV"
echo "ADMIN_PASSWORD=$ADMIN_PASSWORD"
echo "JWT_SECRET=$JWT_SECRET"
echo "DATABASE_URL=$DATABASE_URL"

echo "🚀 Avvio del server..."
pnpm dev 