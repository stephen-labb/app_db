import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, RefreshCw, Check, Plus, AlertCircle, Building2, GitBranch } from 'lucide-react';

export interface SearchableOption {
  id: string | number;
  name: string;
  description?: string;
  category?: string;
  meta?: Record<string, any>;
}

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string, selectedOption?: SearchableOption) => void;
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
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  onChange,
  onSearchChange,
  debounceMs = 250,
  options = [],
  placeholder = 'Type to search or select...',
  isLoading = false,
  onRefresh,
  required = false,
  helpText,
  badgeText,
  allowCustom = true,
  disabled = false,
  iconType = 'generic',
  error
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize internal search term when external value prop changes
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

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

  // Filter options based on user input (or display all options returned by server if onSearchChange is used)
  const filteredOptions = options.filter((opt) => {
    if (!searchTerm.trim()) return true;
    // If onSearchChange is enabled and options already came from backend search, allow all returned items
    if (onSearchChange && options.length > 0) return true;
    const term = searchTerm.toLowerCase().trim();
    const matchesName = (opt.name || '').toLowerCase().includes(term);
    const matchesDesc = (opt.description || '').toLowerCase().includes(term);
    const matchesId = String(opt.id || '').toLowerCase().includes(term);
    return matchesName || matchesDesc || matchesId;
  });

  const isExactMatch = options.some(
    (opt) => opt.name.toLowerCase() === searchTerm.trim().toLowerCase()
  );

  const handleSelect = (option: SearchableOption) => {
    setSearchTerm(option.name);
    onChange(option.name, option);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);
    if (!isOpen) setIsOpen(true);

    // Real-time debounced trigger for external search (e.g. ArmorCode elastic endpoint)
    if (onSearchChange) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        onSearchChange(newValue);
      }, debounceMs);
    }
  };

  const handleSelectCustom = () => {
    if (!searchTerm.trim()) return;
    onChange(searchTerm.trim());
    setIsOpen(false);
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

      {/* Input Control Container */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {renderIcon()}
        </div>

        <input
          type="text"
          disabled={disabled}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full pl-9 pr-10 py-2.5 rounded-xl border text-sm font-mono transition-all outline-none ${
            error
              ? 'border-rose-400 dark:border-rose-600 bg-rose-50/30 dark:bg-rose-950/20 text-slate-900 dark:text-slate-100'
              : isOpen
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        />

        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
          {isLoading ? (
            <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-[11px] text-rose-500 flex items-center gap-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </p>
      )}

      {/* Help / Maintenance Description */}
      {helpText && !error && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
          {helpText}
        </p>
      )}

      {/* Floating Dropdown List */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-h-60 overflow-y-auto py-1.5 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header info in dropdown */}
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>Select or type search query ({filteredOptions.length} available)</span>
            {isLoading && <span className="text-indigo-500 animate-pulse font-mono">Fetching...</span>}
          </div>

          {/* List of Options */}
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isSelected = value.toLowerCase() === option.name.toLowerCase();
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`w-full text-left px-3.5 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected ? 'bg-indigo-50/80 dark:bg-indigo-950/80 font-bold text-indigo-900 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs truncate">{option.name}</span>
                      {option.category && (
                        <span className="px-1.5 py-0.2 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {option.category}
                        </span>
                      )}
                    </div>
                    {option.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {option.description}
                      </p>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                </button>
              );
            })
          ) : (
            <div className="px-3.5 py-3 text-xs text-slate-500 dark:text-slate-400 text-center">
              No matching options found.
            </div>
          )}

          {/* Manual / Custom Entry Option */}
          {allowCustom && searchTerm.trim() && !isExactMatch && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-1 mt-1">
              <button
                type="button"
                onClick={handleSelectCustom}
                className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium text-xs flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Use manual custom value: <strong className="font-mono text-slate-900 dark:text-slate-100">"{searchTerm.trim()}"</strong></span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
