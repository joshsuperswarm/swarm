import * as React from "react"

interface DropdownMenuProps {
  children: React.ReactNode
}

const DropdownMenu = ({ children }: DropdownMenuProps) => {
  return <div>{children}</div>
}

interface DropdownMenuTriggerProps {
  asChild?: boolean
  children: React.ReactNode
}

const DropdownMenuTrigger = ({ children }: DropdownMenuTriggerProps) => {
  return <div>{children}</div>
}

interface DropdownMenuContentProps {
  align?: "start" | "center" | "end"
  children: React.ReactNode
}

const DropdownMenuContent = ({ children }: DropdownMenuContentProps) => {
  return (
    <div style={{
      minWidth: "160px",
      overflow: "hidden",
      borderRadius: "6px",
      border: "1px solid #334155",
      background: "#1e293b",
      padding: "4px",
      color: "#e2e8f0",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      zIndex: 50
    }}>
      {children}
    </div>
  )
}

interface DropdownMenuItemProps {
  children: React.ReactNode
  onClick?: () => void
}

const DropdownMenuItem = ({ children, onClick }: DropdownMenuItemProps) => {
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex",
        cursor: "pointer",
        userSelect: "none",
        alignItems: "center",
        borderRadius: "2px",
        padding: "6px 8px",
        fontSize: "14px",
        outline: "none",
        transition: "colors 0.15s ease-in-out"
      }}
    >
      {children}
    </div>
  )
}

interface DropdownMenuLabelProps {
  children: React.ReactNode
}

const DropdownMenuLabel = ({ children }: DropdownMenuLabelProps) => {
  return (
    <div style={{
      padding: "6px 8px",
      fontSize: "14px",
      fontWeight: 600,
      color: "#e2e8f0"
    }}>
      {children}
    </div>
  )
}

const DropdownMenuSeparator = () => {
  return (
    <div style={{
      margin: "4px -4px",
      height: "1px",
      background: "#334155"
    }} />
  )
}

export {
  DropdownMenu as DropdownMenuForVideo,
  DropdownMenuTrigger as DropdownMenuTriggerForVideo,
  DropdownMenuContent as DropdownMenuContentForVideo,
  DropdownMenuItem as DropdownMenuItemForVideo,
  DropdownMenuLabel as DropdownMenuLabelForVideo,
  DropdownMenuSeparator as DropdownMenuSeparatorForVideo,
}