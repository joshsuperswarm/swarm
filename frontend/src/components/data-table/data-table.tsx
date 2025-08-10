"use client"

import * as React from "react"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  highlightedRow?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  highlightedRow,
}: DataTableProps<TData, TValue>) {
  // console.log('🔄 DataTable render - data length:', data.length, 'columns:', columns.length)
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

  const navigate = useNavigate()

  // Create table with initial configuration
  const table = useReactTable({
    data,
    columns,
    getRowId: row => String((row as { task_id: number }).task_id),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: false, // Turn off TanStack debug logs
  })

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  return (
    <div className="space-y-1 w-full">
      {/* Mobile cards */}
      {isMobile ? (
        <div className="md:hidden space-y-2">
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-white p-3">
              <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
              <div className="mt-2 h-3 w-2/3 bg-muted rounded animate-pulse" />
            </div>
          ))}
          {!loading && table.getRowModel().rows.map((row) => {
            const r: any = row.original;
            return (
              <button
                key={row.id}
                className="w-full text-left rounded-lg border bg-white p-3 active:bg-gray-50"
                onClick={() => navigate(`/tasks/${r.task_id}`)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-gray-500">#{r.task_id}</span>
                  <span className="text-[11px] text-gray-500">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
                <div className="mt-1 text-sm font-medium">
                  {r.title || 'Untitled'}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-600">
                  {r.mode && <span className="capitalize">{String(r.mode)}</span>}
                  {r.status && <span className="capitalize">• {String(r.status).replace('_', ' ')}</span>}
                </div>
              </button>
            )
          })}
          {!loading && table.getRowModel().rows.length === 0 && (
            <div className="rounded-lg border bg-white p-4 text-center text-sm text-muted-foreground">No results.</div>
          )}
        </div>
      ) : (
        /* Existing table (desktop) */
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
                <AnimatePresence initial={false}>
                  {table.getRowModel().rows.map((row, index) => {
                    const isSelected = highlightedRow === row.id
                    const selectedIndex = table.getRowModel().rows.findIndex(r => r.id === highlightedRow)
                    
                    return (
                      <motion.tr
                        key={row.id}
                        layout
                        initial={{ 
                          y: index > selectedIndex ? 50 : -50, 
                          opacity: 0 
                        }}
                        animate={{ 
                          y: 0, 
                          opacity: 1 
                        }}
                        exit={{ 
                          y: index > selectedIndex ? -50 : 50, 
                          opacity: 0 
                        }}
                        transition={{ 
                          type: 'tween', 
                          duration: 0.15 
                        }}
                        className={cn(
                          "cursor-pointer border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
                          isSelected && "bg-gradient-to-r from-slate-50 to-slate-100 border-l-2 border-l-slate-400 border-r-2 border-r-slate-400"
                        )}
                        onClick={() => {
                          const task = row.original as { task_id: number }
                          if (task?.task_id) {
                            navigate(`/tasks/${task.task_id}`)
                          }
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
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
      )}
    </div>
  )
}