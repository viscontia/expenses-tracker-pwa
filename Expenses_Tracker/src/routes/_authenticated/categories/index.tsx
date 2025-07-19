import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { trpc } from "~/trpc/react";
import * as LucideIcons from "lucide-react";
import { useUnsavedChangesGuard, UnsavedChangesModal } from "~/components/UnsavedChangesGuard";
import { searchIcons, getIconKeywords, getIconCategory } from "~/utils/iconKeywords";

export const Route = createFileRoute("/_authenticated/categories/")({
  component: Categories,
});

type Category = {
  id: number;
  name: string;
  description?: string | null;
  icon: string;
  userId: number;
  createdAt: Date;
};

// Funzione per ottenere tutte le icone disponibili da Lucide React
const getAllAvailableIcons = () => {
  return Object.keys(LucideIcons).filter(key => {
    const component = (LucideIcons as any)[key];
    return typeof component === 'object' && 
           component !== null &&
           key.charAt(0) === key.charAt(0).toUpperCase() && 
           key !== 'createLucideIcon' &&
           !key.endsWith('Icon') && // Escludi i duplicati che finiscono con "Icon"
           !key.includes('lucide') && // Escludi utility lucide
           !key.startsWith('Lucide') && // Escludi componenti Lucide interni
           component.displayName !== undefined; // Solo componenti React validi
  }).sort(); // Ordina alfabeticamente
};

type IconName = string;

function Categories() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [iconSearch, setIconSearch] = useState("");
  const [availableIcons, setAvailableIcons] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    icon: "ShoppingCart" as IconName,
  });

  // Carica tutte le icone disponibili
  useEffect(() => {
    setAvailableIcons(getAllAvailableIcons());
  }, []);

  const utils = trpc.useUtils();
  const { data: categories, isLoading } = trpc.categories.getAll.useQuery();
  const createMutation = trpc.categories.create.useMutation({
    onSuccess: () => {
      utils.categories.getAll.invalidate();
      setIsModalOpen(false);
      resetForm();
    },
  });
  const updateMutation = trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.getAll.invalidate();
      setIsModalOpen(false);
      resetForm();
    },
  });
  const deleteMutation = trpc.categories.delete.useMutation({
    onSuccess: () => {
      utils.categories.getAll.invalidate();
      setDeletingCategoryId(null);
    },
    onError: () => {
      setDeletingCategoryId(null);
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", icon: "ShoppingCart" });
    setEditingCategory(null);
    setIconSearch("");
    setIsIconModalOpen(false);
  };

  // Initial form data for comparison (to detect changes)
  const initialFormData = useMemo(() => {
    if (editingCategory) {
      return {
        name: editingCategory.name,
        description: editingCategory.description || "",
        icon: editingCategory.icon
      };
    }
    return { name: "", description: "", icon: "ShoppingCart" };
  }, [editingCategory]);

  // Memoized current form data for unsaved changes detection
  const memoizedFormData = useMemo(() => formData, [formData]);

  // Handle save function for unsaved changes guard
  const handleSave = async (): Promise<void> => {
    if (!formData.name.trim()) {
      throw new Error('Il nome della categoria è obbligatorio');
    }

    if (editingCategory) {
      await updateMutation.mutateAsync({
        id: editingCategory.id,
        ...formData,
      });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  // Unsaved changes guard (for form protection)
  const {
    hasUnsavedChanges,
    resetChanges
  } = useUnsavedChangesGuard({
    formData: memoizedFormData,
    onSave: handleSave,
    isSaving: createMutation.isPending || updateMutation.isPending,
    disabled: !isModalOpen || isIconModalOpen, // Only active when main modal is open (not icon modal)
    message: "Hai modificato i dati della categoria. Vuoi salvarli prima di chiudere?"
  });

  // Local state for modal close confirmation
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Handle modal close with unsaved changes check
  const handleCloseModal = () => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
    } else {
      setIsModalOpen(false);
      resetForm();
    }
  };

  // Handle save and close
  const handleSaveAndClose = async () => {
    try {
      await handleSave();
      resetChanges();
      setShowCloseConfirm(false);
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      // Error already handled by mutation
    }
  };

  // Handle close without saving
  const handleCloseWithoutSaving = () => {
    setShowCloseConfirm(false);
    setIsModalOpen(false);
    resetForm();
  };

  // Cancel close action
  const handleCancelClose = () => {
    setShowCloseConfirm(false);
  };

  // Reset changes tracking when modal opens with data loaded
  useEffect(() => {
    if (isModalOpen && !isIconModalOpen) {
      // Reset the changes detection when modal is opened with fresh data
      setTimeout(() => resetChanges(), 100);
    }
  }, [isModalOpen, isIconModalOpen, editingCategory, resetChanges]);

  // Supporto per Ctrl+S / Cmd+S per salvare
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges && isModalOpen && !isIconModalOpen) {
          handleSubmit(e as any);
        }
      }
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, isModalOpen, isIconModalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateMutation.mutate({
        id: editingCategory.id,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      icon: category.icon as IconName,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Sei sicuro di voler eliminare questa categoria?")) {
      setDeletingCategoryId(id);
      deleteMutation.mutate({ id });
    }
  };

  // Funzione per ottenere il componente icona
  const getIconComponent = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent || (LucideIcons as any).ShoppingCart;
  };

  // Filtra le icone in base alla ricerca semantica
  const filteredIcons = useMemo(() => {
    return searchIcons(availableIcons, iconSearch);
  }, [availableIcons, iconSearch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Categorie</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <LucideIcons.Plus size={20} />
          Nuova Categoria
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories?.map((category) => {
          const IconComponent = getIconComponent(category.icon);
          return (
            <div
              key={category.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-50">
                    <IconComponent size={24} className="text-gray-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="text-sm text-gray-600">{category.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(category)}
                    className="text-blue-600 hover:text-blue-800 p-1"
                  >
                    <LucideIcons.Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    disabled={deletingCategoryId === category.id}
                    className="text-red-600 hover:text-red-800 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingCategoryId === category.id ? (
                      <LucideIcons.Loader2 size={16} className="animate-spin" />
                    ) : (
                      <LucideIcons.Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Principale */}
      {isModalOpen && !isIconModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
            {/* Indicatore visivo delle modifiche non salvate */}
            {hasUnsavedChanges && (
              <div className="absolute top-4 right-4 z-10">
                <div className="flex items-center space-x-2 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-3 py-1 rounded-full text-xs font-medium border border-amber-200 dark:border-amber-800 shadow-sm">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                  <span>Modifiche non salvate</span>
                </div>
              </div>
            )}
            
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingCategory ? "Modifica Categoria" : "Nuova Categoria"}
            </h2>

            {/* Protection Info Banner */}
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  <p className="font-medium mb-1">🛡️ Protezione dati attiva</p>
                  <p>Le tue modifiche sono protette automaticamente. Se tenti di chiudere con modifiche non salvate, ti verrà chiesto di confermare.</p>
                  <p className="mt-1">
                    <strong>Tip:</strong> Usa <kbd className="px-1 py-0.5 bg-blue-200 dark:bg-blue-800 rounded">Ctrl+S</kbd> per salvare rapidamente
                  </p>
                </div>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrizione
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Icona
                </label>
                <div className="flex items-center gap-3">
                  <div className="p-3 border border-gray-300 rounded-md bg-gray-50">
                    {(() => {
                      const IconComponent = getIconComponent(formData.icon);
                      return <IconComponent size={24} className="text-gray-700" />;
                    })()}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsIconModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Scegli Icona
                  </button>
                  <span className="text-sm text-gray-600">{formData.icon}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <LucideIcons.Loader2 size={16} className="animate-spin" />
                  )}
                  {(createMutation.isPending || updateMutation.isPending) 
                    ? "Salvando..." 
                    : editingCategory 
                      ? "Aggiorna" 
                      : "Crea"
                  }
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                >
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Selezione Icone */}
      {isIconModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Scegli un'Icona</h2>
              <button
                onClick={() => setIsIconModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <LucideIcons.X size={24} />
              </button>
            </div>
            
            <div className="mb-4">
              <input
                type="text"
                placeholder="Cerca icona (es: trolley, shopping, food, casa, macchina)..."
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 <strong>Suggerimento:</strong> Puoi cercare per nome tecnico (es: "ShoppingCart") o per keywords semantiche (es: "trolley", "carrello", "spesa")
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-6 gap-4">
                {filteredIcons.map((iconName) => {
                  const IconComponent = (LucideIcons as any)[iconName];
                  const keywords = getIconKeywords(iconName);
                  const category = getIconCategory(iconName);
                  const tooltipText = keywords.length > 0 
                    ? `${iconName}\nKeywords: ${keywords.slice(0, 5).join(", ")}${keywords.length > 5 ? "..." : ""}\nCategoria: ${category}`
                    : iconName;
                  
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, icon: iconName });
                        setIsIconModalOpen(false);
                        setIconSearch("");
                      }}
                      className={`p-3 border rounded-lg hover:bg-gray-100 flex flex-col items-center justify-center transition-colors min-h-[110px] w-full ${
                        formData.icon === iconName
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      title={tooltipText}
                    >
                      <IconComponent 
                        size={28} 
                        className={`mb-2 ${
                          formData.icon === iconName 
                            ? "text-blue-600" 
                            : "text-gray-700 hover:text-gray-900"
                        }`}
                      />
                      <span className="text-xs text-center break-words text-gray-700 font-medium leading-tight px-1 overflow-hidden max-h-8 relative">
                        {iconName}
                        {keywords.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" title="Ha keywords di ricerca"></span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {filteredIcons.length === 0 && iconSearch && (
                <div className="text-center py-8 text-gray-500">
                  Nessuna icona trovata per "{iconSearch}"
                </div>
              )}
            </div>
            
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {filteredIcons.length} icone trovate su {availableIcons.length} totali
                {iconSearch && (
                  <span className="ml-2 text-blue-600">
                    • Ricerca semantica attiva 🔍
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsIconModalOpen(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale di conferma per modifiche non salvate */}
      <UnsavedChangesModal
        isOpen={showCloseConfirm}
        onSaveAndExit={handleSaveAndClose}
        onExitWithoutSaving={handleCloseWithoutSaving}
        onCancel={handleCancelClose}
        isSaving={createMutation.isPending || updateMutation.isPending}
        message="Hai modificato i dati della categoria. Vuoi salvarli prima di chiudere?"
      />
    </div>
  );
}
