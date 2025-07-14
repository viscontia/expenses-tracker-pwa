# Sistema di Aggiornamento Automatico Cambi Valutari

## Panoramica

Il sistema di aggiornamento automatico dei cambi valutari è stato implementato per garantire che l'app abbia sempre i tassi di cambio più aggiornati, migliorando l'accuratezza dei calcoli di conversione per le spese.

## Caratteristiche Principali

### ✅ Aggiornamento Automatico Quotidiano
- Si attiva automaticamente ad ogni apertura dell'app
- Esegue l'aggiornamento **una sola volta al giorno**
- Se l'app viene aperta più volte nella stessa giornata, l'aggiornamento viene saltato

### ✅ Esecuzione in Background
- Non blocca l'interfaccia utente
- Timeout di 2 secondi dopo il caricamento completo dell'app
- Logging dettagliato nella console del browser

### ✅ API Pubblica Affidabile
- Utilizza `exchangerate-api.com` (servizio gratuito)
- Supporta 163+ valute internazionali
- Aggiorna le principali valute del progetto: EUR, ZAR, USD, GBP, JPY, AUD, CAD, CHF, CNY, SEK, NZD, MXN, INR

## Architettura Tecnica

### Componenti Coinvolti

1. **Hook: `useExchangeRateUpdater`**
   - Gestisce la logica di attivazione automatica
   - Previene esecuzioni multiple nella stessa sessione
   - Fornisce stato di loading e errori

2. **Procedura tRPC: `updateDailyExchangeRates`**
   - Verifica se l'aggiornamento è già stato fatto oggi
   - Fetcha i dati dalle API pubbliche
   - Salva i nuovi tassi nel database Supabase

3. **Database: Tabella `exchange_rates`**
   - Schema: `fromCurrency`, `toCurrency`, `rate`, `date`
   - Unique constraint per evitare duplicati giornalieri
   - Upsert automatico per aggiornare valori esistenti

### Flusso di Esecuzione

```
App Start → useExchangeRateUpdater → 2s Delay → Check Today's Update → API Call → Database Update
```

## Valute Supportate

### Valute Base (del progetto)
- **EUR** - Euro
- **ZAR** - South African Rand

### Valute Target (aggiornate quotidianamente)
- USD, GBP, JPY, AUD, CAD, CHF, CNY, SEK, NZD, MXN, INR

## Controlli e Debug

### Pannello Debug (Settings)
- Visualizza stato del sistema di aggiornamento
- Pulsante per aggiornamento manuale
- Informazioni sull'API utilizzata

### Script di Test
```bash
pnpm test-exchange
```

### Logging
```javascript
// Console messages:
💱 Exchange rates already updated today          // Skip message
💱 Exchange rates updated: 24 rates             // Success message  
💱 Error updating exchange rates: [error]       // Error message
```

## Gestione Errori

### Scenari Gestiti
1. **API non disponibile**: Fallback ai tassi precedenti
2. **Valuta non trovata**: Skip della specifica valuta
3. **Errore database**: Logging dell'errore, l'app continua a funzionare
4. **Connessione lenta**: Timeout configurabile

### Comportamento di Fallback
- In caso di errore, l'app utilizza i tassi più recenti disponibili nel database
- Il sistema ritenterà l'aggiornamento al prossimo avvio dell'app

## Configurazione

### Personalizzazione Valute
Per aggiungere nuove valute, modificare:
```typescript
// src/server/trpc/procedures/currency.ts
const baseCurrencies = ['EUR', 'ZAR'];
const targetCurrencies = ['USD', 'GBP', 'JPY', /* ADD HERE */];
```

### Modifica API Provider
Per cambiare provider API, aggiornare:
```typescript
const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
```

### Frequenza Aggiornamento
Per modificare la frequenza, cambiare la logica di controllo data in:
```typescript
// Attualmente: una volta al giorno
const today = new Date();
today.setHours(0, 0, 0, 0);
```

## Monitoraggio

### Metriche Disponibili
- Numero di tassi aggiornati per sessione
- Timestamp ultimo aggiornamento
- Status success/error per ogni esecuzione

### Database Queries Utili
```sql
-- Verifica aggiornamenti di oggi
SELECT COUNT(*) FROM exchange_rates WHERE DATE(date) = CURRENT_DATE;

-- Ultimi tassi per valuta
SELECT * FROM exchange_rates WHERE fromCurrency = 'EUR' ORDER BY date DESC LIMIT 10;

-- Statistiche aggiornamenti
SELECT DATE(date) as update_date, COUNT(*) as rates_count 
FROM exchange_rates 
GROUP BY DATE(date) 
ORDER BY update_date DESC 
LIMIT 7;
```

## Sicurezza e Performance

### Considerazioni di Sicurezza
- API pubblica senza autenticazione richiesta
- Nessun dato sensibile trasmesso
- Rate limiting gestito dall'API provider

### Performance
- Esecuzione asincrona non bloccante
- Upsert efficiente per evitare duplicati
- Minimal impact su startup time (2s delay)

## Troubleshooting

### Problemi Comuni

**L'aggiornamento non viene eseguito:**
- Controllare console browser per messaggi 💱
- Verificare connessione internet
- Controllare se è già stato eseguito oggi

**Tassi non aggiornati:**
- Usare il pulsante "Aggiorna Cambi Manualmente" nelle Impostazioni
- Verificare log errori nella console

**Errori di database:**
- Controllare connessione Supabase
- Verificare schema tabella `exchange_rates`

### Comandi Utili
```bash
# Test connessione API
curl "https://api.exchangerate-api.com/v4/latest/EUR"

# Test aggiornamento
pnpm test-exchange

# Avvio app con logging
pnpm dev
```

## Prossimi Miglioramenti

### Funzionalità Future
- [ ] Notifiche di aggiornamento riuscito
- [ ] Storico tassi per grafici trend
- [ ] Configurazione utente per valute preferite
- [ ] Backup API provider per resilienza
- [ ] Aggiornamento real-time per operazioni critiche 