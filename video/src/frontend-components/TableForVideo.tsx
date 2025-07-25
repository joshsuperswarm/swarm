import * as React from "react"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ style, ...props }, ref) => (
  <div style={{ position: "relative", width: "100%", overflow: "auto" }}>
    <table
      ref={ref}
      style={{
        width: "100%",
        captionSide: "bottom",
        fontSize: "14px",
        ...style
      }}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ style, ...props }, ref) => (
  <thead ref={ref} style={{ display: "table-header-group", ...style }} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ style, ...props }, ref) => (
  <tbody
    ref={ref}
    style={{ display: "table-row-group", ...style }}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ style, ...props }, ref) => (
  <tfoot
    ref={ref}
    style={{
      borderTop: "1px solid #334155",
      background: "#0f172a",
      fontWeight: 500,
      ...style
    }}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ style, ...props }, ref) => (
  <tr
    ref={ref}
    style={{
      borderBottom: "1px solid #334155",
      transition: "colors 0.15s ease-in-out",
      ...style
    }}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ style, ...props }, ref) => (
  <th
    ref={ref}
    style={{
      height: "48px",
      padding: "0 12px",
      textAlign: "left",
      verticalAlign: "middle",
      fontWeight: 500,
      color: "#94a3b8",
      fontSize: "12px",
      ...style
    }}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ style, ...props }, ref) => (
  <td
    ref={ref}
    style={{
      padding: "12px",
      verticalAlign: "middle",
      fontSize: "12px",
      ...style
    }}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ style, ...props }, ref) => (
  <caption
    ref={ref}
    style={{
      marginTop: "16px",
      fontSize: "14px",
      color: "#64748b",
      ...style
    }}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table as TableForVideo,
  TableHeader as TableHeaderForVideo,
  TableBody as TableBodyForVideo,
  TableFooter as TableFooterForVideo,
  TableHead as TableHeadForVideo,
  TableRow as TableRowForVideo,
  TableCell as TableCellForVideo,
  TableCaption as TableCaptionForVideo,
}