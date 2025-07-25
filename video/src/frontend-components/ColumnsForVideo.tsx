import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Zap, FileText, Search } from "lucide-react"

import { ButtonForVideo } from "./ButtonForVideo"
import { DropdownMenuForVideo, DropdownMenuContentForVideo, DropdownMenuItemForVideo, DropdownMenuLabelForVideo, DropdownMenuSeparatorForVideo, DropdownMenuTriggerForVideo } from "./DropdownMenuForVideo"

import { statuses } from "../data/data"
import type { TaskWithRun } from "../types/TaskWithRun"

export const createColumnsForVideo = (): ColumnDef<TaskWithRun>[] => [
  {
    accessorKey: "task_id",
    header: "Task",
    cell: ({ row }) => <div style={{ width: "80px", fontSize: "12px", fontFamily: "monospace", color: "#e2e8f0" }}>{row.getValue("task_id")}</div>,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "mode",
    header: "Mode",
    cell: ({ row }) => {
      const mode = row.getValue("mode") as string | null;
      if (!mode) return <span style={{ fontSize: "12px", color: "#64748b" }}>-</span>;
      
      const getModeConfig = (mode: string) => {
        switch (mode) {
          case 'execute':
            return { icon: Zap, label: 'Execute', color: '#059669' };
          case 'plan':
            return { icon: FileText, label: 'Plan', color: '#2563eb' };
          case 'review':
            return { icon: Search, label: 'Review', color: '#9333ea' };
          default:
            return { icon: Zap, label: mode, color: '#6b7280' };
        }
      };

      const config = getModeConfig(mode);
      const Icon = config.icon;

      return (
        <div style={{ display: "flex", width: "80px", alignItems: "center", gap: "4px" }}>
          <Icon style={{ height: "12px", width: "12px", color: config.color }} />
          <span style={{ fontSize: "12px", color: config.color }}>{config.label}</span>
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
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <span style={{ 
            maxWidth: "500px", 
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: 500,
            fontSize: "12px",
            color: "#e2e8f0"
          }}>
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
      const task = row.original

      if (!status) {
        return null
      }

      // If status is "pr_opened" and we have a PR URL, make it clickable
      if (status.value === "pr_opened" && task.github_pr_url) {
        return (
          <div style={{ display: "flex", width: "100px", alignItems: "center" }}>
            {status.icon && (
              <status.icon style={{ marginRight: "4px", height: "12px", width: "12px", color: "#64748b" }} />
            )}
            <span style={{ fontSize: "12px", color: "#3b82f6", textDecoration: "underline" }}>
              {status.label}
            </span>
          </div>
        )
      }

      return (
        <div style={{ display: "flex", width: "100px", alignItems: "center" }}>
          {status.icon && (
            <status.icon style={{ marginRight: "4px", height: "12px", width: "12px", color: "#64748b" }} />
          )}
          <span style={{ fontSize: "12px", color: "#e2e8f0" }}>{status.label}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => {
      const createdAt = row.getValue("created_at") as string | null
      if (!createdAt) return <span style={{ fontSize: "12px", color: "#64748b" }}>-</span>
      
      const date = new Date(createdAt)
      return (
        <span style={{ fontSize: "12px", color: "#64748b" }}>
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
        <DropdownMenuForVideo>
          <DropdownMenuTriggerForVideo asChild>
            <ButtonForVideo variant="ghost" style={{ height: "32px", width: "32px", padding: 0 }}>
              <span style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>Open menu</span>
              <MoreHorizontal style={{ height: "16px", width: "16px" }} />
            </ButtonForVideo>
          </DropdownMenuTriggerForVideo>
          <DropdownMenuContentForVideo align="end">
            <DropdownMenuLabelForVideo>Actions</DropdownMenuLabelForVideo>
            <DropdownMenuItemForVideo>
              Copy task ID
            </DropdownMenuItemForVideo>
            <DropdownMenuSeparatorForVideo />
            <DropdownMenuItemForVideo>
              View task
            </DropdownMenuItemForVideo>
            <DropdownMenuItemForVideo>Edit task</DropdownMenuItemForVideo>
          </DropdownMenuContentForVideo>
        </DropdownMenuForVideo>
      )
    },
  },
]

export const columns = createColumnsForVideo()