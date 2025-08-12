"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Zap, FileText, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { AnimatedTitle } from "@/components/AnimatedTitle"
import { isTitlePending } from "@/lib/titleState"

export const createColumns = (
  selectedTaskIds?: Set<number>,
  onSelectionChange?: (taskId: number, selected: boolean) => void
): ColumnDef<Task>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => {
          table.toggleAllPageRowsSelected(!!value);
          const allTaskIds = table.getRowModel().rows.map(row => row.original.task_id);
          allTaskIds.forEach(taskId => {
            onSelectionChange?.(taskId, !!value);
          });
        }}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={selectedTaskIds?.has(row.original.task_id) || false}
        onCheckedChange={(value) => {
          row.toggleSelected(!!value);
          onSelectionChange?.(row.original.task_id, !!value);
        }}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "task_id",
    header: "Task",
    cell: ({ row }) => <div className="w-[64px] md:w-[80px] text-[11px] md:text-xs font-mono">{row.getValue("task_id")}</div>,
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
        <div className="flex w-[64px] md:w-[80px] items-center gap-1">
          <Icon className={`h-3 w-3 ${config.color}`} />
          <span className={`text-[11px] md:text-xs ${config.color}`}>{config.label}</span>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      const t = row.original
      const pending = isTitlePending({
        title: t.title,
        status: t.status,
        description: t.description ?? null,
      })
      return (
        <div className="flex space-x-1 items-center">
          <AnimatedTitle
            title={t.title || ""}
            pending={pending}
            status={t.status}
            className="max-w-[60vw] md:max-w-[500px] truncate font-medium text-sm md:text-xs"
          />
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
      const task = row.original

      if (!status) {
        return null
      }

      // If status is "pr_opened" and we have a PR URL, make it clickable
      if (status.value === "pr_opened" && task.github_pr_url) {
        return (
          <div className="flex w-[80px] md:w-[100px] items-center">
            {status.icon && (
              <status.icon className="mr-1 h-3 w-3 text-muted-foreground" />
            )}
            <a 
              href={task.github_pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] md:text-xs text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()} // Prevent row click
            >
              {status.label}
            </a>
          </div>
        )
      }

      // If status is "pr_merged" and we have a PR URL, make it clickable with green styling
      if (status.value === "pr_merged" && task.github_pr_url) {
        return (
          <div className="flex w-[80px] md:w-[100px] items-center">
            {status.icon && (
              <status.icon className="mr-1 h-3 w-3 text-green-600" />
            )}
            <a 
              href={task.github_pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] md:text-xs text-green-600 hover:underline"
              onClick={(e) => e.stopPropagation()} // Prevent row click
              title="PR was merged on GitHub"
            >
              {status.label}
            </a>
          </div>
        )
      }

      return (
        <div className="flex w-[80px] md:w-[100px] items-center">
          {status.icon && (
            <status.icon className="mr-1 h-3 w-3 text-muted-foreground" />
          )}
          <span className="text-[11px] md:text-xs">{status.label}</span>
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
        <span className="text-[11px] md:text-xs text-muted-foreground">
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