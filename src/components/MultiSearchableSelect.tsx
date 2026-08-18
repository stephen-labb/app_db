import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, RefreshCw, Check, CheckSquare, Square, Plus, X, GitBranch, Building2, Trash2, AlertCircle } from 'lucide-react';
import { SearchableOption } from './SearchableSelect';

interface MultiSearchableSelectProps {
  label: string;
  values: string[];
  onChange: (values: string[], selectedOptions?: SearchableOption[]) => void;
  onSearchChange?: (term: string) => void;
  debounceMs?: number;
  options: SearchableOption[];
  placeholder?: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  required?: boolean;
  helpText?: string;
  badgeText?: string;
  allowCustom?: boolean;
  disabled?: boolean;
  iconType?: 'product' | 'repository' | 'generic';
  error?: string;
  selectAllLabel?: string;
}

export const MultiSearchableSelect: React.FC<MultiSearchableSelectProps> = ({
  label,
  values = [],
  onChange,
  onSearchChange,
  debounceMs = 250,
  options = [],
  placeholder = 'Select repositories or type to search...',
  isLoading = false,
  onRefresh,
  required = false,
  helpText,
  badgeText,
  allowCustom = true,
  disabled = false,
  iconType = 'repository',
  error,
  selectAllLabel = 'Select All Repositories'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter options based on user input
  const filteredOptions = options.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const matchesName = (opt.name || '').toLowerCase().includes(term);
    const matchesDesc = (opt.description || '').toLowerCase().includes(term);
    const matchesId = String(opt.id || '').toLowerCase().includes(term);
    return matchesName || matchesDesc || matchesId;
  });

  const isAllSelected = options.length > 0 && options.every(opt => values.includes(opt.name) || values.includes(String(opt.id)));
  const isSomeSelected = values.length > 0 && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all
      onChange([], []);
    } else {
      // Select all current options
      const allNames = options.map(opt => opt.name);
      // Merge with any custom values already selected that might not be in options
      const combined = Array.from(new Set([...values, ...allNames]));
      onChange(combined, options);
    }
  };

  const handleToggleOption = (option: SearchableOption) => {
    const optName = option.name;
    const isSelected = values.includes(optName) || values.includes(String(option.id));

    let updatedValues: string[];
    if (isSelected) {
      updatedValues = values.filter(v => v !== optName && v !== String(option.id));
    } else {
      updatedValues = [...values, optName];
    }

    const selectedOptionsList = options.filter(opt => updatedValues.includes(opt.name) || updatedValues.includes(String(opt.id)));
    onChange(updatedValues, selectedOptionsList);
  };

  const handleRemoveValue = (valToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedValues = values.filter(v => v !== valToRemove);
    const selectedOptionsList = options.filter(opt => updatedValues.includes(opt.name) || updatedValues.includes(String(opt.id)));
    onChange(updatedValues, selectedOptionsList);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([], []);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchTerm(query);
    if (!isOpen) setIsOpen(true);

    if (onSearchChange) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        onSearchChange(query);
      }, debounceMs);
    }
  };

  const handleAddCustom = () => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    if (!values.includes(trimmed)) {
      const updated = [...values, trimmed];
      onChange(updated, options.filter(opt => updated.includes(opt.name)));
    }
    setSearchTerm('');
  };

  const renderIcon = () => {
    if (iconType === 'product') {
      return <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />;
    }
    if (iconType === 'repository') {
      return <GitBranch className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
    return <Search className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  return (
    <div ref={containerRef} className="space-y-1.5 relative w-full">
      {/* Label and Badge Bar */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
        <div className="flex items-center gap-1.5">
          {values.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {values.length} Selected
            </span>
          )}
          {badgeText && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {badgeText}
            </span>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading || disabled}
              title="Re-fetch list from ArmorCode API"
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Main Trigger Box */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            inputRef.current?.focus();
          }
        }}
        className={`w-full min-h-[42px] px-3 py-1.5 rounded-xl border bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono flex items-center justify-between gap-2 cursor-pointer transition-all ${
          error
            ? 'border-rose-500 focus-within:ring-2 focus-within:ring-rose-500'
            : isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-900' : ''}`}
      >
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0 py-0.5">
          <div className="shrink-0">{renderIcon()}</div>

          {/* Selected Chips */}
          {values.map((val) => (
            <span
              key={val}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 text-xs font-mono font-medium border border-indigo-200 dark:border-indigo-800/80 shadow-xs"
            >
              <span className="truncate max-w-[160px]">{val}</span>
              <button
                type="button"
                onClick={(e) => handleRemoveValue(val, e)}
                className="p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-100 transition-colors cursor-pointer"
                title={`Remove ${val}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Inline Search Input */}
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustom();
              } else if (e.key === 'Backspace' && !searchTerm && values.length > 0) {
                // Remove last item
                const last = values[values.length - 1];
                handleRemoveValue(last, e as any);
              }
            }}
            placeholder={values.length === 0 ? placeholder : 'Add more...'}
            disabled={disabled}
            className="flex-1 min-w-[100px] bg-transparent outline-none border-none text-slate-900 dark:text-slate-100 text-xs font-mono placeholder:text-slate-400 py-1"
          />
        </div>

        {/* Action icons on right */}
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {values.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClearAll}
              title="Clear all selected repositories"
              className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`}
          />
        </div>
      </div>

      {/* Helper text / error */}
      {helpText && !error && (
        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight flex items-center gap-1">
          <span>{helpText}</span>
        </p>
      )}
      {error && (
        <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </p>
      )}

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header Action Bar: Select All / Clear All & Info */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              ) : isSomeSelected ? (
                <div className="w-4 h-4 rounded border border-indigo-600 bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 text-[10px] font-bold">
                  -
                </div>
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span className="font-semibold text-xs">
                {isAllSelected ? 'Deselect All' : `${selectAllLabel} (${options.length})`}
              </span>
            </button>

            <div className="flex items-center gap-2">
              {values.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] text-slate-500 hover:text-rose-500 font-medium transition-colors cursor-pointer"
                >
                  Clear ({values.length})
                </button>
              )}
              {isLoading && (
                <span className="flex items-center gap-1 text-[11px] text-indigo-500 font-mono">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Loading...
                </span>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
            {/* Custom addition if user typed something not matching */}
            {allowCustom && searchTerm.trim() && !options.some(opt => opt.name.toLowerCase() === searchTerm.trim().toLowerCase()) && (
              <div
                onClick={handleAddCustom}
                className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 cursor-pointer flex items-center justify-between text-xs transition-colors mb-1"
              >
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-medium">
                  <Plus className="w-4 h-4" />
                  <span>Add custom repository: <strong className="font-mono">"{searchTerm.trim()}"</strong></span>
                </div>
                <span className="text-[10px] font-mono bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded">
                  Press Enter
                </span>
              </div>
            )}

            {filteredOptions.length === 0 && !searchTerm.trim() && (
              <div className="py-6 px-4 text-center text-xs text-slate-600 dark:text-slate-400">
                No repositories found. Ensure an ArmorCode project is selected or type a custom repository.
              </div>
            )}

            {filteredOptions.length === 0 && searchTerm.trim() && !allowCustom && (
              <div className="py-6 px-4 text-center text-xs text-slate-600 dark:text-slate-400">
                No matching repositories for "{searchTerm}".
              </div>
            )}

            {filteredOptions.map((option) => {
              const isSelected = values.includes(option.name) || values.includes(String(option.id));
              return (
                <div
                  key={option.id || option.name}
                  onClick={() => handleToggleOption(option)}
                  className={`p-2.5 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-colors text-xs ${
                    isSelected
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-100'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="mt-0.5 shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono text-xs ${isSelected ? 'font-bold text-indigo-700 dark:text-indigo-300' : 'font-medium'}`}>
                          {option.name}
                        </span>
                        {option.id && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            ID: {option.id}
                          </span>
                        )}
                        {option.category && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {option.category}
                          </span>
                        )}
                      </div>
                      {option.description && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                          {option.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <span className="shrink-0 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer with summary */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {values.length === 0 ? (
                'No repositories selected (Queries all repos)'
              ) : isAllSelected ? (
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">All {options.length} repositories selected</span>
              ) : (
                <span>{values.length} of {options.length} repositories selected</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
