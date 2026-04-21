type MemberSearchSuggestion = {
  user_id: string;
  label: string;
};

type MemberSearchDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSelect: (userId: string) => void;
  suggestions: MemberSearchSuggestion[];
  searching?: boolean;
  minChars?: number;
  placeholder?: string;
  emptyMessage?: string;
};

export function MemberSearchDialog({
  open,
  title,
  description,
  query,
  onQueryChange,
  onClose,
  onSelect,
  suggestions,
  searching = false,
  minChars = 2,
  placeholder = "Buscar por nombre o alias...",
  emptyMessage = "Sin resultados.",
}: MemberSearchDialogProps) {
  if (!open) return null;

  const trimmedQuery = query.trim();
  const isWaitingForQuery = trimmedQuery.length < minChars;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Cerrar"
      />

      <div className="relative w-full max-w-md rounded-3xl border border-gray-300 bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-bold text-gray-900">{title}</div>
            {description ? (
              <div className="mt-1 text-sm text-gray-600">{description}</div>
            ) : null}
          </div>

          <button
            onClick={onClose}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-gray-900 shadow-sm outline-none transition placeholder:text-gray-500 focus:border-gray-400 focus:ring-2 focus:ring-green-200"
          />

          {isWaitingForQuery ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              Escribe al menos {minChars} letras para buscar un socio.
            </div>
          ) : searching ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              Buscando...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              {emptyMessage}
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.user_id}
                  onClick={() => onSelect(suggestion.user_id)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-gray-50 active:scale-[0.99]"
                >
                  <div className="font-semibold text-gray-900">{suggestion.label}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
