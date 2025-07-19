# Requirements Document

## Introduction

Il sistema attuale di conversione valutaria presenta un grave bug di accuratezza storica: quando si visualizzano spese registrate in passato convertite in valute diverse da quelle originali, il sistema utilizza i tassi di cambio più recenti invece di quelli validi al momento della spesa. Questo compromette completamente l'accuratezza delle analisi finanziarie storiche, rendendo inaffidabili i confronti temporali e le valutazioni di trend.

La soluzione proposta prevede di "congelare" tutti i tassi di cambio rilevanti al momento della registrazione di ogni spesa, garantendo che le conversioni future siano sempre storicamente accurate e riflettano il vero valore economico della spesa al momento in cui è stata sostenuta.

## Requirements

### Requirement 1

**User Story:** Come utente dell'app di expense tracking, voglio che le mie spese storiche vengano convertite usando i tassi di cambio validi al momento della spesa, così che le analisi finanziarie siano storicamente accurate e affidabili.

#### Acceptance Criteria

1. WHEN una nuova spesa viene registrata THEN il sistema SHALL salvare tutti i tassi di cambio disponibili validi per quella data
2. WHEN vengono visualizzate spese storiche convertite in valute diverse THEN il sistema SHALL utilizzare i tassi di cambio storici salvati al momento della spesa
3. WHEN non sono disponibili tassi storici per una conversione specifica THEN il sistema SHALL utilizzare il tasso più recente disponibile come fallback
4. WHEN una spesa viene aggiornata THEN i tassi di cambio storici SHALL rimanere invariati per mantenere l'accuratezza storica

### Requirement 2

**User Story:** Come sviluppatore del sistema, voglio una struttura dati efficiente per memorizzare i tassi di cambio storici, così che le performance rimangano ottimali anche con grandi volumi di dati.

#### Acceptance Criteria

1. WHEN viene creata una nuova spesa THEN il sistema SHALL salvare i tassi di cambio in una tabella dedicata collegata alla spesa
2. WHEN vengono richiesti tassi storici THEN il sistema SHALL utilizzare indici ottimizzati per garantire query veloci
3. WHEN si accede ai tassi storici THEN il sistema SHALL evitare duplicazioni di dati attraverso constraint di unicità
4. WHEN vengono eliminate spese THEN i relativi tassi storici SHALL essere eliminati automaticamente (cascade delete)

### Requirement 3

**User Story:** Come amministratore del sistema, dichiaro che NON SERVE migrare le spese esistenti al nuovo sistema di tassi storici, in quanto il DB è attualmente pulito, senza nessun movimento. LA MIGRAZIONE NON è NECESSARIA.

### Requirement 4

**User Story:** Come utente dell'app, voglio che le funzionalità esistenti continuino a funzionare normalmente durante e dopo l'implementazione, così che non ci siano interruzioni nel servizio.
E' molto importante non toccare, manomettere o rendere instabili le attuali funzionalità.

#### Acceptance Criteria

1. WHEN vengono visualizzate spese nella valuta originale THEN il comportamento SHALL rimanere identico a prima
2. WHEN vengono utilizzate API esistenti per la conversione valutaria THEN il sistema SHALL mantenere la compatibilità retroattiva
3. WHEN si verificano errori nel recupero tassi storici THEN il sistema SHALL utilizzare il meccanismo di fallback esistente
4. WHEN vengono create nuove spese THEN il processo SHALL rimanere fluido senza rallentamenti percettibili

### Requirement 5

**User Story:** Come utente dell'app, voglio visualizzare informazioni sui tassi di cambio utilizzati per le conversioni, così che possa verificare l'accuratezza dei calcoli e comprendere le variazioni storiche.

#### Acceptance Criteria

1. WHEN visualizzo una spesa convertita THEN il sistema SHALL mostrare il tasso di cambio utilizzato e la data di riferimento
2. WHEN accedo ai dettagli di una spesa THEN il sistema SHALL indicare se sta usando tassi storici o tassi correnti
3. WHEN vengono mostrati totali aggregati THEN il sistema SHALL fornire informazioni sui tassi utilizzati per le conversioni
4. WHEN si verificano discrepanze nei tassi THEN il sistema SHALL fornire spiegazioni chiare all'utente

### Requirement 6

**User Story:** Come sviluppatore del sistema, voglio strumenti di monitoraggio e debug per i tassi di cambio storici, così che possa identificare e risolvere rapidamente eventuali problemi.

#### Acceptance Criteria

1. WHEN vengono salvati tassi storici THEN il sistema SHALL loggare le operazioni per audit e debug
2. WHEN si verificano errori nella conversione THEN il sistema SHALL fornire messaggi di errore dettagliati
3. WHEN vengono richiesti tassi storici mancanti THEN il sistema SHALL registrare questi eventi per analisi
4. WHEN viene eseguita la migrazione THEN il sistema SHALL fornire report dettagliati sui risultati

### Requirement 7

**User Story:** Come utente dell'app, voglio che il sistema gestisca automaticamente tutti i tassi di cambio necessari, così che non debba preoccuparmi di configurazioni manuali o limitazioni nelle conversioni. Dovrebbe già esistere ed essere funzionante un task in background che parte automaticamente ogni volta che l'APP viene lanciata. Elemento che va verificato.

#### Acceptance Criteria

1. WHEN registro una spesa THEN il sistema SHALL automaticamente salvare tutti i tassi di cambio supportati per quella data. Dovrebbe già esistere ed essere funzionante un task in background che parte automaticamente ogni volta che l'APP viene lanciata. Elemento che va verificato.
2. WHEN vengono aggiunte nuove valute al sistema THEN le spese future SHALL includere automaticamente i nuovi tassi
3. WHEN si verificano errori nel recupero di alcuni tassi THEN il sistema SHALL continuare a salvare i tassi disponibili, ma utente DEVE SAPERE che c'è stato un errore o una non disponibilità nel recuperare i dati aggiornati.
4. WHEN vengono richieste conversioni per coppie di valute non comuni THEN il sistema SHALL utilizzare conversioni indirette quando possibile

