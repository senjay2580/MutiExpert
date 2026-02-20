import { useState, useMemo, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;

  filters?: DataTableFilter[];
  filterAccessor?: (row: T) => string;

  searchPlaceholder?: string;
  searchAccessor?: (row: T) => string;

  actions?: DataTableAction<T>[] | ((row: T) => DataTableAction<T>[]);

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
  data,
  columns,
  rowKey,
  filters,
  filterAccessor,
  searchPlaceholder = 'Search...',
  searchAccessor,
  actions,
  emptyIcon = 'streamline-color:open-book',
  emptyIllustration,
  emptyTitle = '暂无数据',
  emptyDescription,
  emptyActionLabel,
  emptyActionClick,
  emptyActionColor,
  rowsPerPageOptions = [5, 10, 20, 50],
  defaultRowsPerPage = 10,
  className,
  cardClassName,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [columnSearch, setColumnSearch] = useState('');
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    const set = new Set<string>();
    columns.forEach((col) => { if (col.defaultHidden) set.add(col.key); });
    return set;
  });

  const visibleColumns = useMemo(
    () => columns.filter((col) => !hiddenColumns.has(col.key)),
    [columns, hiddenColumns],
  );

  // Filter + Search
  const filtered = useMemo(() => {
    let result = data;
    if (activeFilter && filterAccessor) {
      result = result.filter((row) => filterAccessor(row) === activeFilter);
    }
    if (search && searchAccessor) {
      const q = search.toLowerCase();
      result = result.filter((row) => searchAccessor(row).toLowerCase().includes(q));
    }
    return result;
  }, [data, activeFilter, filterAccessor, search, searchAccessor]);

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

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((value: string | null) => {
    setActiveFilter(value);
    setCurrentPage(1);
  }, []);

  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const toggleColumn = useCallback((key: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const hasActiveFilters = !!search || !!activeFilter;

  // Column list filtered by dropdown search
  const filteredColumnList = useMemo(() => {
    if (!columnSearch) return columns;
    const q = columnSearch.toLowerCase();
    return columns.filter((c) => c.header.toLowerCase().includes(q) || c.key.toLowerCase().includes(q));
  }, [columns, columnSearch]);

  return (
    <div className={cn('flex flex-col', className)}>
      <Card className={cn('flex-1 gap-0 py-0 overflow-hidden', cardClassName)}>
        {/* ==================== Toolbar ==================== */}
        <div className="flex items-center gap-3 border-b px-6 py-3.5">
          {/* Search */}
          <div className="relative w-52">
            <Icon
              icon="lucide:search"
              width={14}
              height={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={handleSearch}
              placeholder={searchPlaceholder}
              className="h-8 pl-9 text-sm"
            />
          </div>

          {/* Filter chips */}
          {filters && filters.length > 0 && (
            <div className="flex items-center gap-1.5">
              {filters.map((f) => (
                <Button
                  key={f.value}
                  variant={activeFilter === f.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs px-3 gap-1.5"
                  onClick={() => handleFilterChange(activeFilter === f.value ? null : f.value)}
                >
                  {f.icon && <Icon icon={f.icon} width={12} height={12} />}
                  {f.label}
                </Button>
              ))}
            </div>
          )}

          <div className="flex-1" />

          {/* View — column toggle dropdown (matches screenshot) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Icon icon="lucide:settings-2" width={14} height={14} />
                View
                <Icon icon="lucide:chevron-down" width={12} height={12} className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-2">
              {/* Column search */}
              <div className="relative mb-2">
                <Icon
                  icon="lucide:search"
                  width={12}
                  height={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={columnSearch}
                  onChange={(e) => setColumnSearch(e.target.value)}
                  placeholder="Search columns..."
                  className="h-7 pl-7 text-xs"
                />
              </div>
              {filteredColumnList.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={!hiddenColumns.has(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                  className="text-xs"
                >
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
                  {visibleColumns.map((col, ci) => (
                    <TableHead
                      key={col.key}
                      style={col.width ? { width: col.width } : undefined}
                      className={cn(
                        'h-11 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                        ci === 0 && 'pl-6',
                        col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors',
                      )}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {col.sortable && (
                          <Icon
                            icon="lucide:chevrons-up-down"
                            width={12}
                            height={12}
                            className={cn(
                              'text-muted-foreground/40',
                              sortKey === col.key && 'text-foreground',
                            )}
                          />
                        )}
                      </span>
                    </TableHead>
                  ))}
                  {actions && <TableHead style={{ width: '56px' }} />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((row, idx) => {
                  const rowActions = typeof actions === 'function' ? actions(row) : actions;
                  const visibleActions = rowActions?.filter((a) => !a.hidden?.(row));

                  return (
                    <TableRow key={rowKey(row)} className="group">
                      {visibleColumns.map((col, ci) => (
                        <TableCell
                          key={col.key}
                          className={cn('px-4 py-4', ci === 0 && 'pl-6')}
                        >
                          {col.render(row, (safePage - 1) * rowsPerPage + idx)}
                        </TableCell>
                      ))}
                      {actions && (
                        <TableCell className="px-4 py-4 pr-5">
                          {visibleActions && visibleActions.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Icon icon="lucide:ellipsis-vertical" width={16} height={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36">
                                {visibleActions.map((action, i) => (
                                  <DropdownMenuItem
                                    key={i}
                                    onClick={() => action.onClick(row)}
                                    variant={action.variant}
                                    className="text-xs gap-2"
                                  >
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
                {totalRows} row(s) total.
              </span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Rows per page</span>
                  <Select
                    value={String(rowsPerPage)}
                    onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1); }}
                  >
                    <SelectTrigger className="h-7 w-[56px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
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
