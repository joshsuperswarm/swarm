"use client"

import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { DataTableToolbar } from "./data-table-toolbar"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  onTaskClick?: (task: TData) => void
  highlightedRow?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  onTaskClick,
  highlightedRow,
}: DataTableProps<TData, TValue>) {
  // console.log('🔄 DataTable render - data length:', data.length, 'columns:', columns.length)
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])

  React.useEffect(() => {
    // console.log('🔄 DataTable mounted')
    return () => {
      // console.log('🔄 DataTable unmounted!')
    }
  }, [])

  // Track if this is the first render
  const isFirstRender = React.useRef(true)
  
  // Log when table instance is created
  React.useEffect(() => {
    if (isFirstRender.current) {
      console.log('🔄 Creating Table Instance... (should only happen once)')
      isFirstRender.current = false
    }
  }, [])

  // Create table with initial configuration
  const table = useReactTable({
    data,
    columns,
    getRowId: row => String((row as { id: number }).id),
    state: {
      sorting,
      columnVisibility,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: false, // Turn off TanStack debug logs
  })

  return (
    <div className="space-y-1 w-full">
      <DataTableToolbar table={table} />
      <div className="rounded-md overflow-hidden flex flex-col w-full">
        <div className="overflow-auto flex-1">
          <Table className="w-full">
            <TableHeader className="shadow-[0_1px_0_0_theme(colors.border)] sticky top-0 z-20 bg-white">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                /* ─── skeleton rows ─── */
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {columns.map((_, idx) => (
                      <TableCell key={idx}>
                        <div className="h-3 w-full bg-muted rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "cursor-pointer",
                      highlightedRow === row.id && "bg-blue-50"
                    )}
                    onClick={() => onTaskClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !loading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}