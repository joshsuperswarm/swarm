/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      fontSize: {
        'xs': ['0.75rem', '1.1'],     // tiny
        'sm': ['0.8125rem', '1.25'],  // chat default
        'base': ['0.875rem', '1.4'],  // app default
        'lg': ['1rem', { lineHeight: '1.3' }],      // 16px - headings
        'xl': ['1.125rem', { lineHeight: '1.3' }],  // 18px - larger headings
        '2xl': ['1.25rem', { lineHeight: '1.3' }],  // 20px - page titles
      },
      letterSpacing: {
        'tight': '-0.01em', // -1% for headings
      },
      spacing: {
        '1': '0.25rem', // 4px - grid unit
        '1.5': '0.375rem',
        '2': '0.5rem', // 8px - base unit  
        '2.5': '0.625rem',
      },
      borderRadius: {
        'sm': '0.25rem', // 4px for buttons
        'md': '0.375rem', // 6px for cards/panels
        'lg': '0.5rem',
      },
      colors: {
        // Linear-inspired color system
        'linear': {
          'bg': '#FAFAFA', // Low-contrast background
          'bg-subtle': '#F8F9FA', // Subtle background variation
          'border': '#E5E7EB', // Border color
          'text': 'hsl(240 5% 10%)', // Primary text
          'text-muted': '#6B7280', // Muted text/icons
          'accent': 'hsl(222 90% 55%)', // Subtle blue accent
        },
        // Keep existing shadcn colors for compatibility
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      boxShadow: {
        'linear-active': '0 1px 2px rgba(0,0,0,.05)',
        'linear-card': 'none', // Remove default shadows
      },
      transitionDuration: {
        '150': '150ms',
      },
      transitionTimingFunction: {
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}