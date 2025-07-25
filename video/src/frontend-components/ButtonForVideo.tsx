import * as React from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ style, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const getVariantStyles = (variant: string) => {
      switch (variant) {
        case "ghost":
          return {
            background: "transparent",
            color: "#e2e8f0",
            border: "none"
          }
        case "outline":
          return {
            border: "1px solid #334155",
            background: "transparent",
            color: "#e2e8f0"
          }
        default:
          return {
            background: "#0f172a",
            color: "#e2e8f0",
            border: "none"
          }
      }
    }

    const getSizeStyles = (size: string) => {
      switch (size) {
        case "sm":
          return {
            height: "36px",
            borderRadius: "6px",
            padding: "0 12px",
            fontSize: "14px"
          }
        case "lg":
          return {
            height: "44px",
            borderRadius: "8px",
            padding: "0 32px",
            fontSize: "16px"
          }
        case "icon":
          return {
            height: "40px",
            width: "40px",
            borderRadius: "6px"
          }
        default:
          return {
            height: "40px",
            padding: "0 16px",
            borderRadius: "6px",
            fontSize: "14px"
          }
      }
    }

    if (asChild) {
      // For asChild, just return the children without wrapping
      return <>{props.children}</>
    }

    return (
      <button
        ref={ref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "nowrap",
          fontWeight: 500,
          transition: "colors 0.15s ease-in-out",
          cursor: "pointer",
          ...getVariantStyles(variant),
          ...getSizeStyles(size),
          ...style
        }}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button as ButtonForVideo }