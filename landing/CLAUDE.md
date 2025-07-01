# Commands

## Build & Development
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npx next lint` - Run Next.js linting
- `npx tsc --noEmit` - Type check without emitting files

## Code Style Guidelines

### Import conventions
- Group imports by source (React/Next, third-party, internal)
- No specific sorting order requirement

### Component styling
- Use function declarations for components (not arrow functions)
- Export named components or use default exports when appropriate
- PascalCase for component names
- Use Tailwind CSS for styling with descriptive class names

### TypeScript
- Strict null checks are enabled
- Let TypeScript infer types when obvious
- Use explicit type definitions for complex structures
- No `any` type unless absolutely necessary

### Formatting
- 2-space indentation
- Semicolons at end of statements
- Single quotes for strings
- JSX attributes on new lines for readability
- Consistent spacing around operators