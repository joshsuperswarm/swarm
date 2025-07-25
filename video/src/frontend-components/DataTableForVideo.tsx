import * as React from "react"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { TableForVideo, TableBodyForVideo, TableCellForVideo, TableHeadForVideo, TableHeaderForVideo, TableRowForVideo } from "./TableForVideo"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  highlightedRow?: string
}

export function DataTableForVideo<TData, TValue>({
  columns,
  data,
  loading = false,
  highlightedRow,
}: DataTableProps<TData, TValue>) {
  // Create table with initial configuration
  const table = useReactTable({
    data,
    columns,
    getRowId: row => String((row as { task_id: number }).task_id),
    getCoreRowModel: getCoreRowModel(),
    debugTable: false, // Turn off TanStack debug logs
  })

  return (
    <div style={{ 
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      width: "100%"
    }}>
      <div style={{ 
        borderRadius: "6px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        width: "100%"
      }}>
        <div style={{ 
          overflow: "auto",
          flex: 1
        }}>
          <TableForVideo style={{ width: "100%" }}>
            <TableHeaderForVideo style={{ 
              boxShadow: "0 1px 0 0 #334155",
              position: "sticky",
              top: 0,
              zIndex: 20,
              background: "#1e293b"
            }}>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRowForVideo key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHeadForVideo key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHeadForVideo>
                    )
                  })}
                </TableRowForVideo>
              ))}
            </TableHeaderForVideo>
            <TableBodyForVideo>
              {loading ? (
                /* ─── skeleton rows ─── */
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRowForVideo key={`skeleton-${i}`}>
                    {columns.map((_, idx) => (
                      <TableCellForVideo key={idx}>
                        <div style={{ 
                          height: "12px",
                          width: "100%",
                          background: "#334155",
                          borderRadius: "2px",
                          animation: "pulse 2s infinite"
                        }} />
                      </TableCellForVideo>
                    ))}
                  </TableRowForVideo>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRowForVideo
                    key={row.id}
                    style={{
                      cursor: "pointer",
                      ...(highlightedRow === row.id && { background: "#1e3a8a20" })
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCellForVideo key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCellForVideo>
                    ))}
                  </TableRowForVideo>
                ))
              ) : !loading ? (
                <TableRowForVideo>
                  <TableCellForVideo
                    colSpan={columns.length}
                    style={{
                      height: "96px",
                      textAlign: "center"
                    }}
                  >
                    No results.
                  </TableCellForVideo>
                </TableRowForVideo>
              ) : null}
            </TableBodyForVideo>
          </TableForVideo>
        </div>
      </div>
    </div>
  )
}