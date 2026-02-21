import {
  useState, useMemo, useCallback, useEffect, useRef,
} from 'react';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/composed/empty-state';
import type { ColorPreset } from '@/components/composed/solid-button';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  minWidth?: number;
  maxWidth?: number;
  defaultHidden?: boolean;
  sticky?: 'left' | 'right';
  resizable?: boolean;
  reorderable?: boolean;
  type?: 'text' | 'badge' | 'date' | 'number';
  accessor?: (row: T) => unknown;
  exportValue?: (row: T) => unknown;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface DataTableFilter {
  value: string;
  label: string;
  icon?: string;
}

export interface DataTableAction<T> {
  label: string;
  icon?: string;
  onClick: (row: T) => void;
  variant?: 'default' | 'destructive';
  hidden?: (row: T) => boolean;
}

export interface FacetedFilterOption {
  value: string;
  label: string;
  icon?: string;
}

export interface FacetedFilterDef<T> {
  key: string;
  label: string;
  icon?: string;
  options: FacetedFilterOption[];
  accessor: (row: T) => string;
}

export interface BulkAction {
  label: string;
  icon?: string;
  onClick: (selectedKeys: string[]) => void;
  variant?: 'default' | 'destructive';
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;

  isLoading?: boolean;
  skeletonRows?: number;

  exportable?: boolean;
  exportFileName?: string;
  exportColumns?: string[];

  enableColumnReorder?: boolean;

  onRowClick?: (row: T) => void;
  getRowExpandedContent?: (row: T) => React.ReactNode;

  virtualize?: {
    enabled?: boolean;
    height?: number;
    rowHeight?: number;
    overscan?: number;
  };

  filters?: DataTableFilter[];
  filterAccessor?: (row: T) => string;

  facetedFilters?: FacetedFilterDef<T>[];

  searchPlaceholder?: string;
  searchAccessor?: (row: T) => string;

  actions?: DataTableAction<T>[] | ((row: T) => DataTableAction<T>[]);

  selectable?: boolean;
  bulkActions?: BulkAction[];

  emptyIcon?: string;
  emptyIllustration?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  emptyActionClick?: () => void;
  emptyActionColor?: ColorPreset;

  rowsPerPageOptions?: number[];
  defaultRowsPerPage?: number;

  className?: string;
  cardClassName?: string;
}

type SortDirection = 'asc' | 'desc';

/* ------------------------------------------------------------------ */
/*  DataTable                                                          */
/* ------------------------------------------------------------------ */

export function DataTable<T>({
  data, columns, rowKey,
  isLoading, skeletonRows,
  exportable, exportFileName = 'export.csv', exportColumns,
  enableColumnReorder = false,
  onRowClick, getRowExpandedContent,
  virtualize,
  filters, filterAccessor,
  facetedFilters,
  searchPlaceholder = 'Search...', searchAccessor,
  actions,
  selectable, bulkActions,
  emptyIcon = 'streamline-color:open-book', emptyIllustration,
  emptyTitle = '暂无数据', emptyDescription,
  emptyActionLabel, emptyActionClick, emptyActionColor,
  rowsPerPageOptions = [5, 10, 20, 50], defaultRowsPerPage = 10,
  className, cardClassName,
}: DataTableProps<T>) {
  const parsePx = (w?: string) => {
    if (!w) return undefined;
    const m = /^(\d+)\s*px$/.exec(w.trim());
    return m ? Number(m[1]) : undefined;
  };

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [facetedValues, setFacetedValues] = useState<Record<string, Set<string>>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [columnSearch, setColumnSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>(() => columns.map((c) => c.key));
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const next: Record<string, number> = {};
    for (const c of columns) {
      const px = parsePx(c.width);
      if (px != null) next[c.key] = px;
    }
    return next;
  });
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    const set = new Set<string>();
    columns.forEach((col) => { if (col.defaultHidden) set.add(col.key); });
    return set;
  });

  useEffect(() => {
    setColumnOrder((prev) => {
      const all = columns.map((c) => c.key);
      const set = new Set(all);
      const kept = prev.filter((k) => set.has(k));
      const missing = all.filter((k) => !kept.includes(k));
      return [...kept, ...missing];
    });

    setColumnWidths((prev) => {
      const next = { ...prev };
      for (const c of columns) {
        if (next[c.key] == null) {
          const px = parsePx(c.width);
          if (px != null) next[c.key] = px;
        }
      }
      return next;
    });
  }, [columns]);

  const orderedColumns = useMemo(() => {
    const map = new Map(columns.map((c) => [c.key, c]));
    return columnOrder.map((k) => map.get(k)).filter(Boolean) as DataTableColumn<T>[];
  }, [columns, columnOrder]);

  const visibleColumns = useMemo(
    () => orderedColumns.filter((col) => !hiddenColumns.has(col.key)),
    [orderedColumns, hiddenColumns],
  );

  const getColWidthPx = useCallback((col: DataTableColumn<T>) => {
    return columnWidths[col.key] ?? parsePx(col.width);
  }, [columnWidths]);

  const selectionColWidth = 40;
  const expanderColWidth = 36;
  const actionsColWidth = 56;
  const expandable = typeof getRowExpandedContent === 'function';

  const stickyLeftOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let left = (selectable ? selectionColWidth : 0) + (expandable ? expanderColWidth : 0);
    for (const col of visibleColumns) {
      const w = getColWidthPx(col) ?? 160;
      if (col.sticky === 'left') offsets[col.key] = left;
      left += w;
    }
    return offsets;
  }, [expandable, getColWidthPx, selectable, visibleColumns]);

  const stickyRightOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let right = actions ? actionsColWidth : 0;
    for (let i = visibleColumns.length - 1; i >= 0; i -= 1) {
      const col = visibleColumns[i];
      const w = getColWidthPx(col) ?? 160;
      if (col.sticky === 'right') offsets[col.key] = right;
      right += w;
    }
    return offsets;
  }, [actions, getColWidthPx, visibleColumns]);

  const resizingRef = useRef<{
    key: string;
    startX: number;
    startWidth: number;
    min?: number;
    max?: number;
  } | null>(null);

  const onResizePointerMove = useCallback((e: PointerEvent) => {
    const ctx = resizingRef.current;
    if (!ctx) return;
    const nextWidth = ctx.startWidth + (e.clientX - ctx.startX);
    const clamped = Math.max(ctx.min ?? 80, Math.min(ctx.max ?? 800, nextWidth));
    setColumnWidths((prev) => ({ ...prev, [ctx.key]: Math.round(clamped) }));
  }, []);

  const stopResizing = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener('pointermove', onResizePointerMove);
    document.removeEventListener('pointerup', stopResizing);
  }, [onResizePointerMove]);

  const startResizing = useCallback((e: React.PointerEvent, col: DataTableColumn<T>) => {
    e.preventDefault();
    e.stopPropagation();
    const current = getColWidthPx(col);
    const fallback = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect().width ?? 160;
    resizingRef.current = {
      key: col.key,
      startX: e.clientX,
      startWidth: current ?? fallback,
      min: col.minWidth,
      max: col.maxWidth,
    };
    document.addEventListener('pointermove', onResizePointerMove);
    document.addEventListener('pointerup', stopResizing);
  }, [getColWidthPx, onResizePointerMove, stopResizing]);

  const handleHeaderDragStart = useCallback((e: React.DragEvent, key: string) => {
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleHeaderDrop = useCallback((e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    const sourceKey = e.dataTransfer.getData('text/plain');
    if (!sourceKey || sourceKey === targetKey) return;
    setColumnOrder((prev) => {
      const next = prev.filter((k) => k !== sourceKey);
      const targetIndex = next.indexOf(targetKey);
      if (targetIndex < 0) return prev;
      next.splice(targetIndex, 0, sourceKey);
      return next;
    });
  }, []);

  // Faceted filter toggle
  const toggleFacet = useCallback((filterKey: string, value: string) => {
    setFacetedValues((prev) => {
      const next = { ...prev };
      const set = new Set(prev[filterKey] ?? []);
      if (set.has(value)) set.delete(value); else set.add(value);
      next[filterKey] = set;
      return next;
    });
    setCurrentPage(1);
  }, []);

  const clearFacet = useCallback((filterKey: string) => {
    setFacetedValues((prev) => {
      const next = { ...prev };
      delete next[filterKey];
      return next;
    });
    setCurrentPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearch('');
    setActiveFilter(null);
    setFacetedValues({});
    setCurrentPage(1);
  }, []);

  // Filter + Search + Faceted
  const filtered = useMemo(() => {
    let result = data;
    if (activeFilter && filterAccessor) {
      result = result.filter((row) => filterAccessor(row) === activeFilter);
    }
    if (facetedFilters) {
      for (const ff of facetedFilters) {
        const selected = facetedValues[ff.key];
        if (selected && selected.size > 0) {
          result = result.filter((row) => selected.has(ff.accessor(row)));
        }
      }
    }
    if (search && searchAccessor) {
      const q = search.toLowerCase();
      result = result.filter((row) => searchAccessor(row).toLowerCase().includes(q));
    }
    return result;
  }, [data, activeFilter, filterAccessor, facetedFilters, facetedValues, search, searchAccessor]);

  const getPrimitive = useCallback((val: unknown) => {
    if (val == null) return '';
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 1 : 0;
    return String(val);
  }, []);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = col.accessor ? getPrimitive(col.accessor(a)) : getPrimitive(col.render?.(a, 0));
      const bVal = col.accessor ? getPrimitive(col.accessor(b)) : getPrimitive(col.render?.(b, 0));
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), 'zh-CN', { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns, getPrimitive]);

  // Pagination
  const totalRows = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paged = sorted.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const virtualEnabled = !!virtualize?.enabled;
  const virtualHeight = virtualize?.height ?? 520;
  const virtualRowHeight = virtualize?.rowHeight ?? 56;
  const virtualOverscan = virtualize?.overscan ?? 6;
  const virtualScrollRef = useRef<HTMLDivElement | null>(null);
  const [virtualScrollTop, setVirtualScrollTop] = useState(0);
  const [virtualViewportHeight, setVirtualViewportHeight] = useState(virtualHeight);

  const handleVirtualScroll = useCallback(() => {
    const el = virtualScrollRef.current;
    if (!el) return;
    setVirtualScrollTop(el.scrollTop);
    setVirtualViewportHeight(el.clientHeight);
  }, []);

  useEffect(() => {
    if (!virtualEnabled) return;
    handleVirtualScroll();
  }, [handleVirtualScroll, paged.length, rowsPerPage, virtualEnabled]);

  const virtualWindow = useMemo(() => {
    if (!virtualEnabled) {
      return {
        start: 0,
        padTop: 0,
        padBottom: 0,
        rows: paged,
      };
    }

    const total = paged.length;
    const start = Math.max(0, Math.floor(virtualScrollTop / virtualRowHeight) - virtualOverscan);
    const end = Math.min(total, Math.ceil((virtualScrollTop + virtualViewportHeight) / virtualRowHeight) + virtualOverscan);
    const padTop = start * virtualRowHeight;
    const padBottom = Math.max(0, (total - end) * virtualRowHeight);
    return {
      start,
      padTop,
      padBottom,
      rows: paged.slice(start, end),
    };
  }, [paged, virtualEnabled, virtualOverscan, virtualRowHeight, virtualScrollTop, virtualViewportHeight]);

  // Selection helpers
  const pagedKeys = useMemo(() => paged.map((r) => rowKey(r)), [paged, rowKey]);
  const allPageSelected = pagedKeys.length > 0 && pagedKeys.every((k) => selectedKeys.has(k));
  const somePageSelected = pagedKeys.some((k) => selectedKeys.has(k));

  const toggleSelectAll = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allPageSelected) { pagedKeys.forEach((k) => next.delete(k)); }
      else { pagedKeys.forEach((k) => next.add(k)); }
      return next;
    });
  }, [allPageSelected, pagedKeys]);

  const toggleSelectRow = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleExpandRow = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedKeys(new Set()), []);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value); setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((value: string | null) => {
    setActiveFilter(value); setCurrentPage(1);
  }, []);

  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return key; }
      setSortDir('asc'); return key;
    });
  }, []);

  const toggleColumn = useCallback((key: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const activeFacetCount = Object.values(facetedValues).reduce((n, s) => n + s.size, 0);
  const hasActiveFilters = !!search || !!activeFilter || activeFacetCount > 0;

  const filteredColumnList = useMemo(() => {
    if (!columnSearch) return columns;
    const q = columnSearch.toLowerCase();
    return columns.filter((c) => c.header.toLowerCase().includes(q) || c.key.toLowerCase().includes(q));
  }, [columns, columnSearch]);

  const showBulkBar = selectable && selectedKeys.size > 0 && bulkActions && bulkActions.length > 0;
  const showSkeleton = !!isLoading && data.length === 0;

  const activeChips = useMemo(() => {
    const chips: Array<{
      key: string;
      label: string;
      icon?: string;
      onRemove: () => void;
    }> = [];

    if (search.trim()) {
      chips.push({
        key: 'search',
        label: `搜索：${search.trim()}`,
        icon: 'lucide:search',
        onRemove: () => { setSearch(''); setCurrentPage(1); },
      });
    }

    if (activeFilter && filters && filters.length > 0) {
      const f = filters.find((x) => x.value === activeFilter);
      chips.push({
        key: `filter:${activeFilter}`,
        label: f ? f.label : activeFilter,
        icon: f?.icon,
        onRemove: () => { setActiveFilter(null); setCurrentPage(1); },
      });
    }

    if (facetedFilters) {
      for (const ff of facetedFilters) {
        const selected = facetedValues[ff.key];
        if (!selected || selected.size === 0) continue;
        for (const val of selected) {
          const opt = ff.options.find((o) => o.value === val);
          chips.push({
            key: `facet:${ff.key}:${val}`,
            label: `${ff.label}：${opt?.label ?? val}`,
            icon: opt?.icon ?? ff.icon,
            onRemove: () => toggleFacet(ff.key, val),
          });
        }
      }
    }

    return chips;
  }, [search, activeFilter, filters, facetedFilters, facetedValues, toggleFacet]);

  const getCellContent = useCallback((col: DataTableColumn<T>, row: T, index: number) => {
    if (col.render) return col.render(row, index);
    const raw = col.accessor ? col.accessor(row) : undefined;
    if (raw == null) return <span className="text-muted-foreground/60">—</span>;

    if (col.type === 'number') return new Intl.NumberFormat('zh-CN').format(Number(raw));
    if (col.type === 'date') {
      const d = raw instanceof Date ? raw : new Date(String(raw));
      return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleString('zh-CN');
    }
    if (col.type === 'badge') return <Badge variant="outline" className="text-[10px]">{String(raw)}</Badge>;
    return String(raw);
  }, []);

  const exportCsv = useCallback((rows: T[], mode: 'page' | 'filtered' | 'all') => {
    const exportableCols = exportColumns
      ? exportColumns.map((k) => orderedColumns.find((c) => c.key === k)).filter(Boolean) as DataTableColumn<T>[]
      : visibleColumns;

    const escape = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

    const lines: string[] = [];
    lines.push(exportableCols.map((c) => escape(c.header)).join(','));

    for (const row of rows) {
      const values = exportableCols.map((c) => {
        const v = c.exportValue ? c.exportValue(row) : c.accessor ? c.accessor(row) : c.render ? c.render(row, 0) : '';
        return escape(String(getPrimitive(v)));
      });
      lines.push(values.join(','));
    }

    const name = (exportFileName || 'export.csv').includes('{mode}')
      ? (exportFileName || 'export.csv').replace('{mode}', mode)
      : (exportFileName || 'export.csv');

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [exportColumns, exportFileName, getPrimitive, orderedColumns, visibleColumns]);

  return (
    <div className={cn('flex flex-col', className)}>
      <Card className={cn('flex-1 gap-0 py-0 overflow-hidden', cardClassName)}>
        {/* ==================== Bulk Action Bar ==================== */}
        {showBulkBar && (
          <div className="flex items-center gap-3 border-b bg-primary/5 px-6 py-2.5">
            <span className="text-xs font-medium text-primary">已选 {selectedKeys.size} 项</span>
            <div className="flex items-center gap-1.5">
              {bulkActions!.map((ba, i) => (
                <Button
                  key={i}
                  variant={ba.variant === 'destructive' ? 'destructive' : 'outline'}
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => ba.onClick([...selectedKeys])}
                >
                  {ba.icon && <Icon icon={ba.icon} width={13} height={13} />}
                  {ba.label}
                </Button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={clearSelection}>
              取消选择
            </Button>
          </div>
        )}

        {/* ==================== Toolbar ==================== */}
        <div className="flex items-center gap-3 border-b px-6 py-3.5">
          <div className="relative w-52">
            <Icon icon="lucide:search" width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={handleSearch} placeholder={searchPlaceholder} className="h-8 pl-9 text-sm" />
          </div>

          {/* Simple filter chips */}
          {filters && filters.length > 0 && (
            <div className="flex items-center gap-1.5">
              {filters.map((f) => (
                <Button key={f.value} variant={activeFilter === f.value ? 'default' : 'outline'} size="sm" className="h-8 text-xs px-3 gap-1.5" onClick={() => handleFilterChange(activeFilter === f.value ? null : f.value)}>
                  {f.icon && <Icon icon={f.icon} width={12} height={12} />}
                  {f.label}
                </Button>
              ))}
            </div>
          )}

          {/* Faceted filters */}
          {facetedFilters && facetedFilters.map((ff) => {
            const selected = facetedValues[ff.key];
            const count = selected?.size ?? 0;
            return (
              <DropdownMenu key={ff.key}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 text-xs gap-1.5', count > 0 && 'border-primary/50')}>
                    {ff.icon && <Icon icon={ff.icon} width={13} height={13} />}
                    {ff.label}
                    {count > 0 && <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px]">{count}</Badge>}
                    <Icon icon="lucide:chevron-down" width={12} height={12} className="text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  {ff.options.map((opt) => (
                    <DropdownMenuCheckboxItem key={opt.value} checked={selected?.has(opt.value) ?? false} onCheckedChange={() => toggleFacet(ff.key, opt.value)} className="text-xs gap-2">
                      {opt.icon && <Icon icon={opt.icon} width={13} height={13} />}
                      {opt.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {count > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-xs justify-center text-muted-foreground" onClick={() => clearFacet(ff.key)}>
                        清除筛选
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground" onClick={clearAllFilters}>
              <Icon icon="lucide:x" width={13} height={13} />
              重置
            </Button>
          )}

          <div className="flex-1" />

          {exportable && !showSkeleton && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Icon icon="lucide:download" width={14} height={14} />
                  导出
                  <Icon icon="lucide:chevron-down" width={12} height={12} className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem className="text-xs" onClick={() => exportCsv(paged, 'page')}>导出当前页</DropdownMenuItem>
                <DropdownMenuItem className="text-xs" onClick={() => exportCsv(sorted, 'filtered')}>导出当前筛选</DropdownMenuItem>
                <DropdownMenuItem className="text-xs" onClick={() => exportCsv(data, 'all')}>导出全部</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* View column toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Icon icon="lucide:settings-2" width={14} height={14} />
                View
                <Icon icon="lucide:chevron-down" width={12} height={12} className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-2">
              <div className="relative mb-2">
                <Icon icon="lucide:search" width={12} height={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={columnSearch} onChange={(e) => setColumnSearch(e.target.value)} placeholder="Search columns..." className="h-7 pl-7 text-xs" />
              </div>
              {filteredColumnList.map((col) => (
                <DropdownMenuCheckboxItem key={col.key} checked={!hiddenColumns.has(col.key)} onCheckedChange={() => toggleColumn(col.key)} className="text-xs">
                  {col.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ==================== Active Chips ==================== */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b bg-muted/20 px-6 py-2">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={chip.onRemove}
              >
                {chip.icon && <Icon icon={chip.icon} width={12} height={12} />}
                <span className="max-w-[220px] truncate">{chip.label}</span>
                <Icon icon="lucide:x" width={12} height={12} className="opacity-70" />
              </button>
            ))}

            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={clearAllFilters}
            >
              <Icon icon="lucide:trash-2" width={12} height={12} />
              清空全部
            </button>
          </div>
        )}

        {/* ==================== Table / Empty ==================== */}
        {showSkeleton ? (
          <div className="px-6 py-5">
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: skeletonRows ?? Math.min(8, defaultRowsPerPage) }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        ) : totalRows === 0 ? (
          <EmptyState
            icon={emptyIcon}
            illustration={hasActiveFilters ? undefined : emptyIllustration}
            title={hasActiveFilters ? '没有匹配的结果' : emptyTitle}
            description={hasActiveFilters ? '试试调整搜索或筛选条件' : emptyDescription}
            action={
              !hasActiveFilters && emptyActionClick
                ? { label: emptyActionLabel ?? '新建', onClick: emptyActionClick, color: emptyActionColor }
                : undefined
            }
          />
        ) : (
          <>
            <div
              ref={virtualEnabled ? virtualScrollRef : undefined}
              onScroll={virtualEnabled ? handleVirtualScroll : undefined}
              style={virtualEnabled ? { maxHeight: `${virtualHeight}px` } : undefined}
              className={virtualEnabled ? 'overflow-y-auto' : undefined}
            >
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/50">
                    {selectable && (
                      <TableHead
                        style={{
                          width: `${selectionColWidth}px`,
                          position: 'sticky',
                          left: 0,
                          top: virtualEnabled ? 0 : undefined,
                          zIndex: 30,
                        }}
                        className="h-11 pl-6 pr-0 bg-muted/50"
                      >
                        <Checkbox
                          checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                          onCheckedChange={toggleSelectAll}
                          className="translate-y-[1px]"
                        />
                      </TableHead>
                    )}

                    {expandable && (
                      <TableHead
                        style={{
                          width: `${expanderColWidth}px`,
                          position: 'sticky',
                          left: selectable ? selectionColWidth : 0,
                          top: virtualEnabled ? 0 : undefined,
                          zIndex: 30,
                        }}
                        className="h-11 px-0 bg-muted/50"
                      />
                    )}

                    {visibleColumns.map((col, ci) => {
                      const widthPx = getColWidthPx(col);
                      const left = stickyLeftOffsets[col.key];
                      const right = stickyRightOffsets[col.key];
                      const canReorder = enableColumnReorder && col.reorderable !== false;
                      const canResize = col.resizable === true;
                      const top = virtualEnabled ? 0 : undefined;
                      const isSticky = virtualEnabled || left != null || right != null;
                      return (
                        <TableHead
                          key={col.key}
                          draggable={canReorder}
                          onDragStart={canReorder ? (e) => handleHeaderDragStart(e, col.key) : undefined}
                          onDragOver={canReorder ? (e) => e.preventDefault() : undefined}
                          onDrop={canReorder ? (e) => handleHeaderDrop(e, col.key) : undefined}
                          style={{
                            width: widthPx != null ? `${widthPx}px` : col.width,
                            minWidth: col.minWidth != null ? `${col.minWidth}px` : undefined,
                            maxWidth: col.maxWidth != null ? `${col.maxWidth}px` : undefined,
                            position: isSticky ? 'sticky' : undefined,
                            left,
                            right,
                            top,
                            zIndex: isSticky ? (left != null || right != null ? 30 : 20) : undefined,
                          }}
                          className={cn(
                            'relative h-11 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                            isSticky && 'bg-muted/50',
                            ci === 0 && !selectable && !expandable && 'pl-6',
                            col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors',
                            canReorder && 'cursor-move',
                          )}
                          onClick={col.sortable ? () => handleSort(col.key) : undefined}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.header}
                            {col.sortable && (
                              <Icon icon="lucide:chevrons-up-down" width={12} height={12} className={cn('text-muted-foreground/40', sortKey === col.key && 'text-foreground')} />
                            )}
                          </span>
                          {canResize && (
                            <button
                              type="button"
                              className="absolute right-0 top-0 h-full w-2 cursor-col-resize opacity-0 hover:opacity-100"
                              onPointerDown={(e) => startResizing(e, col)}
                              aria-label="Resize column"
                            />
                          )}
                        </TableHead>
                      );
                    })}

                    {actions && (
                      <TableHead
                        style={{
                          width: `${actionsColWidth}px`,
                          position: 'sticky',
                          right: 0,
                          top: virtualEnabled ? 0 : undefined,
                          zIndex: 30,
                        }}
                        className="bg-muted/50"
                      />
                    )}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {virtualEnabled && virtualWindow.padTop > 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0) + (actions ? 1 : 0)}
                        style={{ height: `${virtualWindow.padTop}px` }}
                      />
                    </TableRow>
                  )}

                  {virtualWindow.rows.map((row, i) => {
                    const idx = i + virtualWindow.start;
                    const key = rowKey(row);
                    const isSelected = selectedKeys.has(key);
                    const isExpanded = expandedKeys.has(key);
                    const rowActions = typeof actions === 'function' ? actions(row) : actions;
                    const visibleActions = rowActions?.filter((a) => !a.hidden?.(row));

                    return ([
                      <TableRow
                        key={key}
                        className={cn('group', isSelected && 'bg-primary/5', onRowClick && 'cursor-pointer')}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                      >
                        {selectable && (
                          <TableCell
                            style={{
                              width: `${selectionColWidth}px`,
                              position: 'sticky',
                              left: 0,
                              zIndex: 20,
                              background: 'hsl(var(--background))',
                            }}
                            className="pl-6 pr-0 py-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectRow(key)} className="translate-y-[1px]" />
                          </TableCell>
                        )}

                        {expandable && (
                          <TableCell
                            style={{
                              width: `${expanderColWidth}px`,
                              position: 'sticky',
                              left: selectable ? selectionColWidth : 0,
                              zIndex: 20,
                              background: 'hsl(var(--background))',
                            }}
                            className="px-0 py-4"
                            onClick={(e) => { e.stopPropagation(); toggleExpandRow(key); }}
                          >
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Icon icon="lucide:chevron-right" width={16} height={16} className={cn('transition-transform', isExpanded && 'rotate-90')} />
                            </Button>
                          </TableCell>
                        )}

                        {visibleColumns.map((col, ci) => {
                          const widthPx = getColWidthPx(col);
                          const left = stickyLeftOffsets[col.key];
                          const right = stickyRightOffsets[col.key];
                          return (
                            <TableCell
                              key={col.key}
                              style={{
                                width: widthPx != null ? `${widthPx}px` : col.width,
                                minWidth: col.minWidth != null ? `${col.minWidth}px` : undefined,
                                maxWidth: col.maxWidth != null ? `${col.maxWidth}px` : undefined,
                                position: left != null || right != null ? 'sticky' : undefined,
                                left,
                                right,
                                zIndex: left != null || right != null ? 15 : undefined,
                                background: left != null || right != null ? 'hsl(var(--background))' : undefined,
                              }}
                              className={cn('px-4 py-4', ci === 0 && !selectable && !expandable && 'pl-6')}
                            >
                              {getCellContent(col, row, (safePage - 1) * rowsPerPage + idx)}
                            </TableCell>
                          );
                        })}

                        {actions && (
                          <TableCell
                            style={{
                              width: `${actionsColWidth}px`,
                              position: 'sticky',
                              right: 0,
                              zIndex: 20,
                              background: 'hsl(var(--background))',
                            }}
                            className="px-4 py-4 pr-5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {visibleActions && visibleActions.length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Icon icon="lucide:ellipsis-vertical" width={16} height={16} />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36">
                                  {visibleActions.map((action, ai) => (
                                    <DropdownMenuItem key={ai} onClick={() => action.onClick(row)} variant={action.variant} className="text-xs gap-2">
                                      {action.icon && <Icon icon={action.icon} width={14} height={14} />}
                                      {action.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        )}
                      </TableRow>,
                      expandable && isExpanded ? (
                        <TableRow key={`${key}:expanded`} className="bg-muted/20">
                          <TableCell
                            colSpan={visibleColumns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0) + (actions ? 1 : 0)}
                            className="px-6 py-4"
                          >
                            {getRowExpandedContent!(row)}
                          </TableCell>
                        </TableRow>
                      ) : null,
                    ]);
                  })}

                  {virtualEnabled && virtualWindow.padBottom > 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0) + (actions ? 1 : 0)}
                        style={{ height: `${virtualWindow.padBottom}px` }}
                      />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ==================== Pagination ==================== */}
            <div className="flex items-center justify-between border-t px-6 py-3">
              <span className="text-xs text-muted-foreground">
                {selectedKeys.size > 0 ? `已选 ${selectedKeys.size} / ` : ''}{totalRows} row(s) total.
              </span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Rows per page</span>
                  <Select value={String(rowsPerPage)} onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="h-7 w-[56px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {rowsPerPageOptions.map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  Page {safePage} of {totalPages}
                </span>
                <div className="flex items-center gap-0.5">
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}>
                    <Icon icon="lucide:chevrons-left" width={14} height={14} />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                    <Icon icon="lucide:chevron-left" width={14} height={14} />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                    <Icon icon="lucide:chevron-right" width={14} height={14} />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
                    <Icon icon="lucide:chevrons-right" width={14} height={14} />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
