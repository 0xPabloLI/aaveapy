# Cursor Rules & Skills Configuration

This directory contains Cursor IDE configuration files that help the AI assistant understand your project's design patterns, coding standards, and best practices.

## File Structure

```
.cursor/
├── README.md (this file)
└── rules/
    └── frontend-design.mdc  # Frontend design and UX guidelines
```

## How Cursor Uses These Files

### Rules (`.mdc` files in `.cursor/rules/`)
- **Always-on context**: These rules are automatically loaded when working on relevant files
- **Scope-based**: Rules apply to files matching their scope (e.g., `src/components/`, `src/pages/`)
- **Project-wide**: Stored in Git so the whole team benefits

### AGENTS.md (in project root)
- **Global guidelines**: High-level project structure, conventions, and workflows
- **Always loaded**: Referenced by Cursor for all tasks

## Current Rules

### `frontend-design.mdc`
Comprehensive frontend design and UX guidelines covering:
- Mobile-first responsive design patterns
- Carousel/swiper implementation standards
- Visual design standards (spacing, typography, colors)
- Animation guidelines (Framer Motion)
- Accessibility requirements (WCAG AA)
- Component patterns and code examples
- Performance best practices
- Testing checklist

**Scope**: Applies to `src/components/`, `src/pages/`, and `src/index.css`

## Adding New Rules

1. Create a new `.mdc` file in `.cursor/rules/`
2. Define the scope at the top (which files/directories it applies to)
3. Write clear, actionable guidelines with examples
4. Keep rules focused and under ~500 lines (split large rules into multiple files)

## Best Practices

- **Be specific**: Include code examples and concrete patterns
- **Reference existing code**: Point to canonical examples in your codebase
- **Keep updated**: Update rules as your codebase evolves
- **Version control**: Commit rules to Git so the team stays aligned

## Resources

- [Cursor Rules Documentation](https://docs.cursor.com/context/rules)
- [Cursor Agent Best Practices](https://cursor.com/blog/agent-best-practices)
