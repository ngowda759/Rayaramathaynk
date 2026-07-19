# UI Guidelines

**Project:** Sri Raghavendra Swamy Matha Website
**Last Updated:** 2026-07-19

---

## Overview

This document defines the visual design standards, component patterns, and UI conventions. It answers: "How should the UI look and behave?"

---

## Design Tokens

### Colors

#### Primary Palette (Amber)

| Token | Hex | Usage |
|-------|-----|-------|
| `amber-50` | #fffbeb | Lightest backgrounds |
| `amber-100` | #fef3c7 | Subtle backgrounds |
| `amber-200` | #fde68a | Borders, dividers |
| `amber-400` | #fbbf24 | Hover states |
| `amber-500` | #f59e0b | Primary actions |
| `amber-600` | #d97706 | Active states |
| `amber-700` | #b45309 | Dark accents |
| `amber-800` | #92400e | Darkest accents |
| `amber-900` | #78350f | Text on light |

#### Secondary Palette (Stone)

| Token | Hex | Usage |
|-------|-----|-------|
| `stone-50` | #fafaf9 | Page backgrounds |
| `stone-100` | #f5f5f4 | Card backgrounds |
| `stone-200` | #e7e5e4 | Borders |
| `stone-400` | #a8a29e | Placeholder text |
| `stone-600` | #57534e | Secondary text |
| `stone-800` | #292524 | Primary text |
| `stone-900` | #1c1917 | Darkest text |

#### Semantic Colors

| Token | Usage |
|-------|-------|
| `success` | Green-500 - Success states |
| `warning` | Yellow-500 - Warning states |
| `error` | Red-500 - Error states |
| `info` | Blue-500 - Info states |

### Typography

#### Font Family

```css
font-family: var(--font-sans) /* Inter from next/font */
```

#### Scale

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| `h1` | 3rem (48px) | 700 | 1.2 |
| `h2` | 2.25rem (36px) | 600 | 1.25 |
| `h3` | 1.5rem (24px) | 600 | 1.3 |
| `h4` | 1.25rem (20px) | 600 | 1.4 |
| `h5` | 1rem (16px) | 600 | 1.5 |
| `h6` | 0.875rem (14px) | 600 | 1.5 |
| `body` | 1rem (16px) | 400 | 1.6 |
| `small` | 0.875rem (14px) | 400 | 1.5 |
| `caption` | 0.75rem (12px) | 400 | 1.4 |

### Spacing

Using an 8pt grid system:

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight spacing |
| `space-2` | 8px | Icon gaps |
| `space-3` | 12px | Input padding |
| `space-4` | 16px | Component padding |
| `space-5` | 20px | Card padding |
| `space-6` | 24px | Section gaps |
| `space-8` | 32px | Large gaps |
| `space-10` | 40px | Section margins |
| `space-12` | 48px | Major sections |
| `space-16` | 64px | Page sections |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 6px | Small elements |
| `radius-md` | 8px | Buttons, inputs |
| `radius-lg` | 12px | Cards |
| `radius-xl` | 16px | Modals |
| `radius-2xl` | 20px | Primary buttons |
| `radius-3xl` | 32px | Feature cards |

### Shadows

| Token | Usage |
|-------|-------|
| `shadow-sm` | Subtle elevation |
| `shadow-md` | Cards, dropdowns |
| `shadow-lg` | Modals, dialogs |
| `shadow-xl` | Large overlays |

---

## Responsive Breakpoints

```css
/* Mobile First */
sm:  640px   /* Large phones */
md:  768px   /* Tablets */
lg:  1024px  /* Small laptops */
xl:  1280px  /* Desktops */
2xl: 1536px  /* Large screens */
```

### Grid System

| Breakpoint | Columns | Gutter |
|------------|---------|--------|
| Mobile (< sm) | 4 | 16px |
| Tablet (sm - md) | 8 | 24px |
| Desktop (lg+) | 12 | 32px |

---

## Component Patterns

### Buttons

#### Variants

| Variant | Usage |
|---------|-------|
| `primary` | Main actions (Amber-500 bg) |
| `secondary` | Secondary actions (Stone-200 bg) |
| `outline` | Tertiary actions (Border only) |
| `ghost` | Subtle actions (No background) |
| `destructive` | Destructive actions (Red-500 bg) |

#### Sizes

| Size | Height | Padding | Font Size |
|------|--------|---------|-----------|
| `sm` | 32px | 8px 12px | 14px |
| `md` | 40px | 12px 16px | 14px |
| `lg` | 48px | 16px 24px | 16px |
| `icon` | 40px | 8px | 16px |

#### Button Radius

```css
border-radius: 20px; /* radius-2xl */
```

### Cards

#### Card Variants

| Variant | Radius | Shadow | Usage |
|---------|--------|--------|-------|
| `default` | 32px | shadow-md | Standard cards |
| `elevated` | 24px | shadow-lg | Featured items |
| `flat` | 16px | none | Compact lists |
| `bordered` | 24px | none | Outline cards |

#### Card Structure

```tsx
<Card className="rounded-[32px] p-6 shadow-md">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Optional subtitle</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
</Card>
```

### Forms

#### Input Styles

```tsx
<input className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm" />
```

#### Form Layout

| Type | Max Width | Usage |
|------|-----------|-------|
| `compact` | 320px | Inline forms |
| `default` | 480px | Standard forms |
| `wide` | 640px | Complex forms |
| `full` | 100% | Address forms |

#### Validation States

| State | Border Color | Icon |
|-------|--------------|------|
| Default | `stone-200` | None |
| Focus | `amber-500` | None |
| Error | `red-500` | AlertCircle |
| Success | `green-500` | CheckCircle |
| Disabled | `stone-100` | None |

### Tables

#### Table Structure

```tsx
<DataTable>
  <DataTableHeader>
    <DataTableRow>
      <DataTableHead>Column 1</DataTableHead>
      <DataTableHead>Column 2</DataTableHead>
    </DataTableRow>
  </DataTableHeader>
  <DataTableBody>
    <DataTableRow>
      <DataTableCell>Data 1</DataTableCell>
      <DataTableCell>Data 2</DataTableCell>
    </DataTableRow>
  </DataTableBody>
</DataTable>
```

#### Responsive Tables

- Mobile: Horizontal scroll with sticky first column
- Tablet: Condensed columns
- Desktop: Full columns

### Navigation

#### Sidebar (Admin)

```tsx
<Sidebar className="w-64">
  <SidebarHeader />
  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>Dashboard</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>
```

### Empty States

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <Icon className="h-12 w-12 text-stone-400" />
  <h3 className="mt-4 text-lg font-semibold">No items found</h3>
  <p className="mt-2 text-sm text-stone-500">
    Get started by creating a new item.
  </p>
  <Button className="mt-4">Create New</Button>
</div>
```

### Loading States

#### Skeleton

```tsx
<Skeleton className="h-4 w-3/4" />
<Skeleton className="h-4 w-1/2" />
```

#### Spinner

```tsx
<Spinner className="h-8 w-8" />
```

---

## Animation Guidelines

### Framework

Using Framer Motion for animations.

### Duration Scale

| Token | Duration | Usage |
|-------|----------|-------|
| `duration-fast` | 150ms | Micro-interactions |
| `duration-normal` | 300ms | Standard transitions |
| `duration-slow` | 500ms | Page transitions |
| `duration-slower` | 700ms | Large reveals |

### Easing

```typescript
const easing = {
  default: [0.25, 0.1, 0.25, 1],
  bounce: [0.68, -0.55, 0.265, 1.55],
};
```

### Animation Patterns

#### Fade In

```tsx
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  {children}
</motion.div>
```

#### Stagger

```tsx
<motion.div
  variants={{
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }}
>
  {items.map(item => (
    <motion.div variants={itemVariants} />
  ))}
</motion.div>
```

### Reduced Motion

Always respect `prefers-reduced-motion`:

```tsx
const { reducedMotion } = useReducedMotion();

<motion.div
  animate={reducedMotion ? {} : { scale: 1.1 }}
  transition={{ duration: 0.3 }}
/>
```

---

## Icon Usage

### Library

Lucide React - Consistent, open-source icons.

### Sizing

| Context | Size |
|---------|------|
| Inline text | 16px |
| Button icons | 20px |
| Navigation | 24px |
| Feature icons | 32px |
| Empty state | 48px |

### Stroke Width

```tsx
// Standard icons
<Icon className="h-5 w-5" />

// Filled/bold icons
<Icon className="h-5 w-5 fill-current" />
```

---

## Accessibility

### Color Contrast

- Text on background: Minimum 4.5:1 ratio
- Large text: Minimum 3:1 ratio
- Interactive elements: Minimum 3:1 against adjacent colors

### Focus States

```tsx
// Always visible focus ring
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
```

### ARIA Labels

```tsx
<Button aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>
```

### Keyboard Navigation

- Tab order follows visual order
- Skip links for main content
- Escape closes modals/dropdowns
- Arrow keys navigate menus

---

*Document maintained by: Development Team*
