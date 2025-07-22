"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Zap, FileText, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { statuses } from "@/data/data"
import type { Task } from "@/types"

export const createColumns = (): ColumnDef<Task>[] => [
  {
    accessorKey: "task_id",
    header: "Task",
    cell: ({ row }) => <div className="w-[80px] text-xs font-mono">{row.getValue("task_id")}</div>,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "mode",
    header: "Mode",
    cell: ({ row }) => {
      const mode = row.getValue("mode") as string | null;
      if (!mode) return <span className="text-xs text-muted-foreground">-</span>;
      
      const getModeConfig = (mode: string) => {
        switch (mode) {
          case 'execute':
            return { icon: Zap, label: 'Execute', color: 'text-green-600' };
          case 'plan':
            return { icon: FileText, label: 'Plan', color: 'text-blue-600' };
          case 'review':
            return { icon: Search, label: 'Review', color: 'text-purple-600' };
          default:
            return { icon: Zap, label: mode, color: 'text-gray-600' };
        }
      };

      const config = getModeConfig(mode);
      const Icon = config.icon;

      return (
        <div className="flex w-[80px] items-center gap-1">
          <Icon className={`h-3 w-3 ${config.color}`} />
          <span className={`text-xs ${config.color}`}>{config.label}</span>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      return (
        <div className="flex space-x-1 items-center">
          <span className="max-w-[500px] truncate font-medium text-xs">
            {row.getValue("title")}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = statuses.find(
        (status) => status.value === row.getValue("status")
      )

      if (!status) {
        return null
      }

      return (
        <div className="flex w-[100px] items-center">
          {status.icon && (
            <status.icon className="mr-1 h-3 w-3 text-muted-foreground" />
          )}
          <span className="text-xs">{status.label}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => {
      const createdAt = row.getValue("created_at") as string | null
      if (!createdAt) return <span className="text-xs text-muted-foreground">-</span>
      
      const date = new Date(createdAt)
      return (
        <span className="text-xs text-muted-foreground">
          {date.toLocaleDateString()}
        </span>
      )
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const task = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(task.task_id.toString())}
            >
              Copy task ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.location.href = `/tasks/${task.task_id}`}>
              View task
            </DropdownMenuItem>
            <DropdownMenuItem>Edit task</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export const columns = createColumns()