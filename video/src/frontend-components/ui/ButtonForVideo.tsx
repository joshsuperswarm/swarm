import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'default' | 'ghost';
  size?: 'default' | 'sm';
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function ButtonForVideo({ 
  children, 
  variant = 'default', 
  size = 'default',
  className,
  onClick,
  style
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    fontSize: size === 'sm' ? '14px' : '16px',
    fontWeight: '500',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    cursor: 'pointer',
    border: 'none',
    padding: size === 'sm' ? '4px 8px' : '8px 16px',
    ...style
  };

  const variantStyle: React.CSSProperties = variant === 'ghost' 
    ? {
        backgroundColor: 'transparent',
        color: '#6B7280',
      }
    : {
        backgroundColor: 'hsl(222, 90%, 55%)',
        color: 'white',
      };

  return (
    <button
      style={{ ...baseStyle, ...variantStyle }}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}