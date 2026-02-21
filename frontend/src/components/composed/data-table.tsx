import { useState, useMemo, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
  defaultHidden?: boolean;
  render: (row: T, index: number) => React.ReactNode;
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
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [facetedValues, setFacetedValues] = useState<Record<string, Set<string>>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [columnSearch, setColumnSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    const set = new Set<string>();
    columns.forEach((col) => { if (col.defaultHidden) set.add(col.key); });
    return set;
  });

  const visibleColumns = useMemo(
    () => columns.filter((col) => !hiddenColumns.has(col.key)),
    [columns, hiddenColumns],
  );

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

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = String(col.render(a, 0) ?? '');
      const bVal = String(col.render(b, 0) ?? '');
      const cmp = aVal.localeCompare(bVal, 'zh-CN');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  // Pagination
  const totalRows = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paged = sorted.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

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

        {/* ==================== Table / Empty ==================== */}
        {totalRows === 0 ? (
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
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/50">
                  {selectable && (
                    <TableHead style={{ width: '40px' }} className="h-11 pl-6 pr-0">
                      <Checkbox
                        checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        className="translate-y-[1px]"
                      />
                    </TableHead>
                  )}
                  {visibleColumns.map((col, ci) => (
                    <TableHead
                      key={col.key}
                      style={col.width ? { width: col.width } : undefined}
                      className={cn(
                        'h-11 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                        ci === 0 && !selectable && 'pl-6',
                        col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors',
                      )}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {col.sortable && (
                          <Icon icon="lucide:chevrons-up-down" width={12} height={12} className={cn('text-muted-foreground/40', sortKey === col.key && 'text-foreground')} />
                        )}
                      </span>
                    </TableHead>
                  ))}
                  {actions && <TableHead style={{ width: '56px' }} />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((row, idx) => {
                  const key = rowKey(row);
                  const isSelected = selectedKeys.has(key);
                  const rowActions = typeof actions === 'function' ? actions(row) : actions;
                  const visibleActions = rowActions?.filter((a) => !a.hidden?.(row));
                  return (
                    <TableRow key={key} className={cn('group', isSelected && 'bg-primary/5')}>
                      {selectable && (
                        <TableCell className="pl-6 pr-0 py-4">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectRow(key)} className="translate-y-[1px]" />
                        </TableCell>
                      )}
                      {visibleColumns.map((col, ci) => (
                        <TableCell key={col.key} className={cn('px-4 py-4', ci === 0 && !selectable && 'pl-6')}>
                          {col.render(row, (safePage - 1) * rowsPerPage + idx)}
                        </TableCell>
                      ))}
                      {actions && (
                        <TableCell className="px-4 py-4 pr-5">
                          {visibleActions && visibleActions.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Icon icon="lucide:ellipsis-vertical" width={16} height={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36">
                                {visibleActions.map((action, i) => (
                                  <DropdownMenuItem key={i} onClick={() => action.onClick(row)} variant={action.variant} className="text-xs gap-2">
                                    {action.icon && <Icon icon={action.icon} width={14} height={14} />}
                                    {action.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

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
