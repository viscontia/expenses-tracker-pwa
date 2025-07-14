# Expenses Tracker PWA

Progressive Web App per il tracciamento delle spese con database Supabase.

## Configurazione Database

### Supabase Connection String
```
postgresql://postgres.bkwkqlbcoltlpttmyrdl:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

## Configurazione Variabili d'Ambiente

Crea un file `.env` nella root del progetto con le seguenti variabili:

```env
# Database Supabase (Session Pooler - Configurazione Funzionante)
DATABASE_URL="postgresql://postgres.bkwkqlbcoltlpttmyrdl:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=10&pool_timeout=10"

# JWT Secret for authentication (change this in production)
JWT_SECRET="your-super-secret-jwt-key-here-make-it-long-and-secure"

# MinIO Admin Password (if using file storage)
ADMIN_PASSWORD="Moscy83Blendy92!!"

# Base URL configuration for development
BASE_URL="http://localhost:3000"
BASE_URL_OTHER_PORT="http://localhost:[PORT]"

# Node Environment
NODE_ENV="development"
```

### Configurazioni Alternative Database

**Session Pooler (Consigliato per sviluppo):**
```
postgresql://postgres.bkwkqlbcoltlpttmyrdl:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=10&pool_timeout=10
```

**Connessione Diretta:**
```
postgresql://postgres:[YOUR-PASSWORD]@db.bkwkqlbcoltlpttmyrdl.supabase.co:5432/postgres?sslmode=require
```

**Transaction Pooler:**
```
postgresql://postgres.bkwkqlbcoltlpttmyrdl:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
```

**IMPORTANTE**: Sostituisci `[YOUR-PASSWORD]` con la tua password reale di Supabase.

## Setup e Avvio

1. Installa le dipendenze:
```bash
pnpm install
```

2. Configura il database:
```bash
pnpm db:push
```

3. Avvia il server di sviluppo:
```bash
pnpm dev
```

## Scripts Disponibili

- `pnpm dev` - Avvia il server di sviluppo
- `pnpm build` - Build per produzione
- `pnpm db:push` - Sincronizza lo schema del database
- `pnpm db:studio` - Apre Prisma Studio
- `pnpm lint` - Controllo del codice con ESLint
- `pnpm format` - Formattazione del codice con Prettier

## Tecnologie Utilizzate

- **Frontend**: React + TanStack Router + Tailwind CSS
- **Backend**: tRPC + Prisma
- **Database**: PostgreSQL (Supabase)
- **Auth**: JWT
- **Build Tool**: Vinxi
- **Icons**: Lucide React 