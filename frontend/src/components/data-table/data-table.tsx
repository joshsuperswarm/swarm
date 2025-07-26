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

  return (
    <div className="space-y-1 w-full">
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
                          isSelected && "ring-2 ring-indigo-500 bg-blue-50"
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
    </div>
  )
}