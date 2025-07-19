# 🛡️ Sistema di Protezione Dati Non Salvati

Documentazione completa del sistema **UnsavedChangesGuard** per prevenire la perdita accidentale di dati nei form dell'applicazione.

## 📖 Panoramica

Il sistema di protezione dati non salvati è composto da:

- **Custom Hook** (`useUnsavedChangesGuard`) - Core logic per il tracciamento
- **Componenti Modali** (`UnsavedChangesModal`) - UI per la conferma utente
- **Wrapper Component** (`UnsavedChangesGuard`) - Integrazione semplificata

## 🎯 Funzionalità Principali

### ✅ **Tracciamento Intelligente**
- Memorizza snapshot JSON dei dati del form
- Confronta stato iniziale vs attuale in tempo reale
- Rileva modifiche automaticamente senza performance impact

### ✅ **Intercettazione Completa**
- **Browser Close/Reload**: Evento `beforeunload`
- **Navigazione Interna**: Click su link e navigation guards
- **Keyboard Shortcuts**: Supporto Ctrl+S / Cmd+S

### ✅ **Modale Personalizzato**
- **3 Opzioni Chiare**: Salva ed Esci | Esci senza Salvare | Annulla
- **Loading States**: Indicatori durante il salvataggio
- **Responsive Design**: Ottimizzato per mobile e desktop
- **Accessibilità**: Keyboard navigation e screen reader friendly

### ✅ **Developer Experience**
- **TypeScript Completo**: Tipizzazione generica per qualsiasi form data
- **API Semplice**: Hook facile da integrare
- **Configurabile**: Messaggi, comportamenti e stati personalizzabili
- **Esempi Pratici**: Documentazione con casi d'uso reali

## 🚀 Utilizzo Rapido

### **Metodo 1: Wrapper Component (Raccomandato)**

```tsx
import { UnsavedChangesGuard } from '~/components/UnsavedChangesGuard';

function MyForm() {
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    // Logica di salvataggio
    await saveToAPI(formData);
  };

  return (
    <UnsavedChangesGuard
      formData={formData}
      onSave={handleSave}
      isSaving={isSubmitting}
      showIndicator={true}
      message="Hai delle modifiche non salvate. Vuoi salvarle?"
    >
      <form>
        {/* Il tuo form qui */}
      </form>
    </UnsavedChangesGuard>
  );
}
```

### **Metodo 2: Hook Diretto**

```tsx
import { useUnsavedChangesGuard, UnsavedChangesModal } from '~/components/UnsavedChangesGuard';

function MyForm() {
  const [formData, setFormData] = useState({ name: '', email: '' });
  
  const {
    hasUnsavedChanges,
    isModalOpen,
    confirmNavigation,
    cancelNavigation,
    saveAndNavigate,
    resetChanges
  } = useUnsavedChangesGuard({
    formData,
    onSave: handleSave,
    isSaving: isSubmitting
  });

  return (
    <>
      <form>
        {/* Il tuo form qui */}
        {hasUnsavedChanges && <div>⚠️ Modifiche non salvate</div>}
      </form>
      
      <UnsavedChangesModal
        isOpen={isModalOpen}
        onSaveAndExit={saveAndNavigate}
        onExitWithoutSaving={confirmNavigation}
        onCancel={cancelNavigation}
        isSaving={isSubmitting}
      />
    </>
  );
}
```

## ⚙️ Configurazione Avanzata

### **Opzioni del Hook**

```tsx
interface UnsavedChangesGuardOptions<T> {
  /** Dati del form da monitorare */
  formData: T;
  /** Funzione per salvare i dati */
  onSave?: () => Promise<void> | void;
  /** Se il form è in stato di saving */
  isSaving?: boolean;
  /** Se disabilitare completamente il guard */
  disabled?: boolean;
  /** Messaggio personalizzato */
  message?: string;
}
```

### **Opzioni del Wrapper**

```tsx
interface UnsavedChangesGuardProps<T> extends UnsavedChangesGuardOptions<T> {
  children: ReactNode;
  /** Se mostrare l'indicatore visivo delle modifiche */
  showIndicator?: boolean;
  /** Classe CSS personalizzata per l'indicatore */
  indicatorClassName?: string;
}
```

## 🎨 Personalizzazione UI

### **Messaggi Personalizzati**

```tsx
<UnsavedChangesGuard
  formData={formData}
  onSave={handleSave}
  message="I tuoi dati della spesa non sono stati salvati. Vuoi salvarli prima di uscire?"
>
  {/* form content */}
</UnsavedChangesGuard>
```

### **Indicatore Visivo Custom**

```tsx
<UnsavedChangesGuard
  formData={formData}
  onSave={handleSave}
  showIndicator={true}
  indicatorClassName="custom-indicator-position"
>
  {/* form content */}
</UnsavedChangesGuard>
```

### **Modale Solo Conferma (Senza Salvataggio)**

```tsx
import { UnsavedChangesModalSimple } from '~/components/UnsavedChangesGuard';

<UnsavedChangesModalSimple
  isOpen={isModalOpen}
  onExitWithoutSaving={confirmNavigation}
  onCancel={cancelNavigation}
  message="Hai delle modifiche non salvate. Vuoi procedere comunque?"
/>
```

## 🔧 Integrazione nei Form Esistenti

### **Step 1: Import**

```tsx
import { UnsavedChangesGuard } from '~/components/UnsavedChangesGuard';
```

### **Step 2: Wrapper**

```tsx
// Prima
<form onSubmit={handleSubmit}>
  {/* form content */}
</form>

// Dopo
<UnsavedChangesGuard
  formData={formData}
  onSave={handleSave}
  isSaving={isSubmitting}
>
  <form onSubmit={handleSubmit}>
    {/* form content */}
  </form>
</UnsavedChangesGuard>
```

### **Step 3: Funzione di Salvataggio**

```tsx
const handleSave = async (): Promise<void> => {
  // Validazione
  if (!validateForm()) {
    throw new Error('Il form contiene errori');
  }

  // Salvataggio
  await submitForm();
};
```

## 🎯 Casi d'Uso Pratici

### **1. Form di Creazione Spesa**

```tsx
<UnsavedChangesGuard
  formData={{ amount, category, date, description }}
  onSave={handleSaveExpense}
  isSaving={isSubmitting}
  disabled={isSubmitted}
  showIndicator={true}
  message="Hai inserito dei dati per una nuova spesa. Vuoi salvarla prima di uscire?"
>
  <ExpenseForm />
</UnsavedChangesGuard>
```

### **2. Form di Settings**

```tsx
<UnsavedChangesGuard
  formData={userPreferences}
  onSave={handleSavePreferences}
  isSaving={isSaving}
  message="Le tue preferenze sono state modificate. Vuoi salvarle?"
>
  <SettingsForm />
</UnsavedChangesGuard>
```

### **3. Form Solo-Lettura (Senza Salvataggio)**

```tsx
<UnsavedChangesGuard
  formData={readonlyData}
  // onSave non specificato = modale semplificato
  message="Hai delle modifiche non salvate. Vuoi procedere comunque?"
>
  <ReadOnlyForm />
</UnsavedChangesGuard>
```

## 🎨 Keyboard Shortcuts

Il sistema supporta automaticamente:

- **Ctrl+S** (Windows/Linux) / **Cmd+S** (Mac): Salvataggio rapido
- **Escape**: Chiude il modale di conferma
- **Tab Navigation**: Navigazione accessibile nei bottoni del modale

## 🧪 Testing

### **Test dell'Hook**

```tsx
import { renderHook, act } from '@testing-library/react';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

test('rileva modifiche nei dati del form', () => {
  const { result, rerender } = renderHook(
    ({ formData }) => useUnsavedChangesGuard({ formData }),
    { initialProps: { formData: { name: 'test' } } }
  );

  expect(result.current.hasUnsavedChanges).toBe(false);

  rerender({ formData: { name: 'modified' } });
  
  expect(result.current.hasUnsavedChanges).toBe(true);
});
```

### **Test del Componente**

```tsx
import { render, screen } from '@testing-library/react';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';

test('mostra indicatore quando ci sono modifiche', () => {
  render(
    <UnsavedChangesGuard
      formData={{ modified: true }}
      showIndicator={true}
    >
      <div>Form content</div>
    </UnsavedChangesGuard>
  );

  expect(screen.getByText('Modifiche non salvate')).toBeInTheDocument();
});
```

## 🚨 Best Practices

### **✅ DO**

- Usa il wrapper component per la maggior parte dei casi
- Fornisci sempre una funzione `onSave` quando possibile
- Disabilita il guard dopo un salvataggio riuscito
- Testa il comportamento su diversi browser
- Usa messaggi chiari e specifici per il contesto

### **❌ DON'T**

- Non usare su form molto semplici (1-2 campi)
- Non dimenticare di gestire gli errori nella funzione `onSave`
- Non abilitare su ogni piccola modifica (es. auto-save forms)
- Non usare su form temporanei o wizard step-by-step

## 🔄 Lifecycle e Cleanup

Il sistema gestisce automaticamente:

- **Mount**: Inizializzazione snapshot dati
- **Update**: Confronto real-time dei cambiamenti  
- **Unmount**: Cleanup event listeners
- **Navigation**: Intercettazione e reset automatico

## 🌟 Vantaggi

1. **🛡️ Protezione Completa**: Browser close, navigation, accidental clicks
2. **⚡ Performance**: Comparison efficiente con JSON serialization
3. **🎨 UX Ottimale**: 3 opzioni chiare, loading states, responsive design
4. **🔧 Developer Friendly**: TypeScript, API semplice, esempi pratici
5. **♿ Accessibile**: Keyboard navigation, screen reader support
6. **📱 Mobile Ready**: Design responsive per tutti i dispositivi

## 📝 Roadmap Future

- [ ] Supporto per form multi-step/wizard
- [ ] Integrazione con react-hook-form
- [ ] Persistenza locale delle modifiche
- [ ] Analytics e tracking usage
- [ ] Plugin per editor di codice

---

## 💡 Tips & Tricks

### **Auto-Save Integration**

```tsx
// Combina protezione manuale + auto-save
const { resetChanges } = useUnsavedChangesGuard({
  formData,
  onSave: handleManualSave
});

// Auto-save ogni 30 secondi
useEffect(() => {
  const interval = setInterval(async () => {
    if (hasUnsavedChanges) {
      await handleAutoSave();
      resetChanges(); // Reset dopo auto-save
    }
  }, 30000);
  
  return () => clearInterval(interval);
}, [hasUnsavedChanges, resetChanges]);
```

### **Form Validation Integration**

```tsx
const handleSave = async (): Promise<void> => {
  // Valida prima di salvare
  const isValid = await validateForm();
  if (!isValid) {
    throw new Error('Correggi gli errori prima di salvare');
  }
  
  await saveToAPI(formData);
};
```

### **Debug Mode**

```tsx
// Aggiungi logging per debug
const guardData = useUnsavedChangesGuard({
  formData,
  onSave: handleSave
});

useEffect(() => {
  console.log('Guard status:', {
    hasChanges: guardData.hasUnsavedChanges,
    isModalOpen: guardData.isModalOpen
  });
}, [guardData.hasUnsavedChanges, guardData.isModalOpen]);
```

**🎉 Il sistema è ora completo e pronto per l'uso in tutta l'applicazione!** 