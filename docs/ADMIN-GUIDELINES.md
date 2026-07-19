# Admin Guidelines

**Project:** Sri Raghavendra Swamy Matha Website
**Last Updated:** 2026-07-19

---

## Overview

This document defines consistent patterns for all admin modules including CRUD operations, table layouts, forms, permissions, and audit logging. It answers: "How should the admin interface work?"

---

## Admin Dashboard Structure

### Navigation

```
Sidebar
├── Dashboard
├── Bookings
│   ├── Seva Bookings
│   └── Event Registrations
├── Content
│   ├── Events
│   ├── Gallery
│   ├── Announcements
│   └── Knowledge Base
├── Services
│   ├── Sevas
│   └── Poojas
├── Finances
│   ├── Donations
│   ├── Donation Campaigns
│   └── Reports
├── Users
│   ├── All Users
│   └── Trust Committee
├── Settings
│   ├── Temple Settings
│   ├── Timings
│   └── AI Settings
├── AI Assistant
│   ├── Conversations
│   └── Unknown Questions
└── Aaradhane
```

---

## CRUD Patterns

### Standard CRUD Operations

All admin modules follow this pattern:

| Operation | Route | Method | Description |
|-----------|-------|--------|-------------|
| List | `/admin/[module]` | GET | Paginated list with filters |
| Create | `/admin/[module]/new` | GET/POST | Create form + submission |
| Read | `/admin/[module]/[id]` | GET | View single record |
| Update | `/admin/[module]/[id]/edit` | GET/PUT | Edit form + submission |
| Delete | `/admin/[module]/[id]` | DELETE | Soft delete or hard delete |

### Service Layer Pattern

```typescript
// services/[module].service.ts
export class ModuleService {
  // All operations go through service - no direct Firestore calls
  
  async getAll(options?: QueryOptions): Promise<ModuleItem[]> { ... }
  async getById(id: string): Promise<ModuleItem | null> { ... }
  async create(data: CreateDto): Promise<ModuleItem> { ... }
  async update(id: string, data: UpdateDto): Promise<ModuleItem> { ... }
  async delete(id: string): Promise<void> { ... }
}
```

---

## Table Layouts

### Standard Table Structure

```tsx
<DataTable
  data={items}
  columns={columns}
  searchPlaceholder="Search..."
  onSearch={(query) => handleSearch(query)}
>
  <DataTableToolbar>
    <DataTableFilter
      column="status"
      options={statusOptions}
    />
    <DataTableColumnToggle
      columns={toggleableColumns}
    />
    <Button onClick={() => router.push('/admin/module/new')}>
      <Plus className="mr-2 h-4 w-4" />
      Add New
    </Button>
  </DataTableToolbar>
</DataTable>
```

### Table Columns

| Column Type | Width | Alignment | Sortable |
|-------------|-------|-----------|----------|
| Checkbox | 40px | Left | No |
| ID/Code | 100px | Left | Yes |
| Title/Name | Flex | Left | Yes |
| Status | 100px | Center | Yes |
| Date | 120px | Right | Yes |
| Amount | 100px | Right | Yes |
| Actions | 80px | Right | No |

### Table States

#### Loading State

```tsx
<TableBody>
  {isLoading ? (
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        {columns.map((_, j) => (
          <TableCell key={j}>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        ))}
      </TableRow>
    ))
  ) : items.length === 0 ? (
    <TableRow>
      <TableCell colSpan={columns.length}>
        <EmptyState />
      </TableCell>
    </TableRow>
  ) : (
    items.map(item => <TableRow key={item.id} />)
  )}
</TableBody>
```

#### Empty State

```tsx
<div className="flex flex-col items-center justify-center py-12">
  <Inbox className="h-12 w-12 text-stone-400" />
  <h3 className="mt-4 text-lg font-semibold">No items found</h3>
  <p className="mt-2 text-sm text-stone-500">
    Get started by creating your first item.
  </p>
  <Button className="mt-4" onClick={() => router.push('/admin/module/new')}>
    <Plus className="mr-2 h-4 w-4" />
    Create New
  </Button>
</div>
```

### Pagination

```tsx
<DataTablePagination
  table={table}
  totalItems={totalCount}
  itemsPerPage={pageSize}
  onPageChange={handlePageChange}
  onPageSizeChange={handlePageSizeChange}
/>
```

### Search & Filters

```tsx
<div className="flex items-center gap-4">
  <Input
    placeholder="Search by name..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-64"
  />
  
  <Select value={statusFilter} onValueChange={setStatusFilter}>
    <SelectTrigger className="w-40">
      <SelectValue placeholder="Status" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Status</SelectItem>
      <SelectItem value="active">Active</SelectItem>
      <SelectItem value="inactive">Inactive</SelectItem>
    </SelectContent>
  </Select>
  
  <DateRangePicker
    startDate={startDate}
    endDate={endDate}
    onChange={handleDateRangeChange}
  />
</div>
```

---

## Form Patterns

### Standard Form Layout

```tsx
<Form>
  <FormField
    control={form.control}
    name="title"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Title *</FormLabel>
        <FormControl>
          <Input placeholder="Enter title" {...field} />
        </FormControl>
        <FormDescription>
          The title will be displayed publicly.
        </FormDescription>
        <FormMessage />
      </FormItem>
    )}
  />
</Form>
```

### Form Sections

```tsx
<Form>
  {/* Basic Information */}
  <Card>
    <CardHeader>
      <CardTitle>Basic Information</CardTitle>
      <CardDescription>Main details about this item.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <FormField name="title" />
      <FormField name="description" />
      <FormField name="category" />
    </CardContent>
  </Card>

  {/* Media */}
  <Card>
    <CardHeader>
      <CardTitle>Media</CardTitle>
      <CardDescription>Images and videos.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <FormField name="imageUrl" />
      <FormField name="gallery" />
    </CardContent>
  </Card>

  {/* Settings */}
  <Card>
    <CardHeader>
      <CardTitle>Settings</CardTitle>
      <CardDescription>Display and status settings.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <FormField name="active" />
      <FormField name="featured" />
      <FormField name="displayOrder" />
    </CardContent>
  </Card>
</Form>
```

### Validation Patterns

```typescript
const formSchema = z.object({
  title: z.string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be less than 100 characters"),
  
  description: z.string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  
  amount: z.coerce.number()
    .positive("Amount must be positive")
    .min(0, "Amount must be at least 0"),
  
  date: z.date()
    .min(new Date("2020-01-01"), "Date must be after 2020")
    .optional(),
  
  email: z.string()
    .email("Invalid email address"),
});
```

### File Upload

```tsx
<FormField
  control={form.control}
  name="image"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Image</FormLabel>
      <FormControl>
        <ImageUpload
          value={field.value}
          onChange={field.onChange}
          onRemove={() => field.onChange(undefined)}
        />
      </FormControl>
      <FormDescription>
        Max size: 5MB. Formats: JPG, PNG, WebP.
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## Permissions

### Role-Based Access

| Module | super_admin | temple_admin | priest | staff | volunteer |
|--------|-------------|--------------|--------|-------|-----------|
| Dashboard | Full | Full | View | View | View |
| Events | Full | Full | CRUD | CRUD | View |
| Sevas | Full | Full | CRUD | CRUD | View |
| Bookings | Full | Full | CRUD | Read | View |
| Donations | Full | Full | Read | Read | View |
| Users | Full | Full | View | View | None |
| Settings | Full | Edit | View | None | None |
| AI Settings | Full | Full | View | None | None |

### Permission Check

```typescript
// hooks/usePermissions.ts
export function usePermissions() {
  const { user } = useAuth();
  
  return {
    can: (action: Action, resource: Resource) => {
      return hasPermission(user?.role, action, resource);
    },
    
    canEdit: (resource: Resource) => hasPermission(user?.role, 'edit', resource),
    canDelete: (resource: Resource) => hasPermission(user?.role, 'delete', resource),
    canCreate: (resource: Resource) => hasPermission(user?.role, 'create', resource),
  };
}

// Usage
const { canEdit } = usePermissions();
if (!canEdit('events')) {
  return <AccessDenied />;
}
```

### Protected Actions

```typescript
// Confirm destructive actions
const handleDelete = async (id: string) => {
  const confirmed = await confirm({
    title: "Delete Item",
    description: "Are you sure you want to delete this item? This action cannot be undone.",
    confirmText: "Delete",
    confirmVariant: "destructive",
  });
  
  if (confirmed) {
    await deleteItem(id);
  }
};
```

---

## Search

### Search Implementation

```typescript
// Client-side search for small datasets
const filteredItems = useMemo(() => {
  if (!searchQuery) return items;
  
  const query = searchQuery.toLowerCase();
  return items.filter(item => 
    item.title.toLowerCase().includes(query) ||
    item.description.toLowerCase().includes(query)
  );
}, [items, searchQuery]);

// Server-side search for large datasets
const { data, isLoading } = useQuery({
  queryKey: ['items', { search: searchQuery, page }],
  queryFn: () => itemService.search({ 
    query: searchQuery,
    page,
    limit: PAGE_SIZE 
  }),
});
```

### Search UI

```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
  <Input
    placeholder="Search..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="pl-9"
  />
  {searchQuery && (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setSearchQuery('')}
      className="absolute right-1 top-1/2 -translate-y-1/2"
    >
      <X className="h-4 w-4" />
    </Button>
  )}
</div>
```

---

## Filters

### Filter Types

| Filter Type | Component | Usage |
|-------------|-----------|--------|
| Select | `<Select>` | Status, category, type |
| Multi-select | `<MultiSelect>` | Tags, multiple categories |
| Date range | `<DateRangePicker>` | Created at, scheduled date |
| Number range | `<NumberInput>` | Amount range |
| Boolean | `<Switch>` | Active, featured |

### Filter State

```typescript
interface FilterState {
  search?: string;
  status?: string[];
  category?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  amountRange?: {
    min: number;
    max: number;
  };
}

// Persist filters in URL
const searchParams = new URLSearchParams();
searchParams.set('status', status);
searchParams.set('page', page.toString());
router.push(`/admin/module?${searchParams.toString()}`);
```

---

## Audit Logging

### Log Events

```typescript
interface AuditLog {
  id: string;
  timestamp: Timestamp;
  userId: string;
  userName: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  metadata?: Record<string, any>;
}

type AuditAction = 
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'export'
  | 'login'
  | 'logout';
```

### Create Audit Log

```typescript
// utils/audit.ts
export async function createAuditLog(params: {
  action: AuditAction;
  resource: string;
  resourceId: string;
  changes?: AuditLog['changes'];
}) {
  const { user } = useAuth();
  
  await auditService.create({
    ...params,
    userId: user?.id,
    userName: user?.name,
    timestamp: Timestamp.now(),
  });
}

// Usage in service
async update(id: string, data: UpdateDto) {
  const oldData = await this.getById(id);
  const updated = await this.update(id, data);
  
  await createAuditLog({
    action: 'update',
    resource: 'events',
    resourceId: id,
    changes: getChanges(oldData, updated),
  });
  
  return updated;
}
```

### Audit Log Table

| Column | Description |
|--------|-------------|
| Timestamp | When the action occurred |
| User | Who performed the action |
| Action | What was done |
| Resource | What was affected |
| Details | Changes made |

---

## Bulk Operations

### Bulk Select

```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

const handleSelectAll = (checked: boolean) => {
  if (checked) {
    setSelectedIds(new Set(items.map(item => item.id)));
  } else {
    setSelectedIds(new Set());
  }
};

const handleSelectOne = (id: string, checked: boolean) => {
  const newSet = new Set(selectedIds);
  if (checked) {
    newSet.add(id);
  } else {
    newSet.delete(id);
  }
  setSelectedIds(newSet);
};
```

### Bulk Actions

```tsx
{selectedIds.size > 0 && (
  <div className="flex items-center gap-4 rounded-lg bg-amber-50 px-4 py-2">
    <span className="text-sm font-medium">
      {selectedIds.size} selected
    </span>
    
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleBulkAction('activate')}
    >
      <Check className="mr-2 h-4 w-4" />
      Activate
    </Button>
    
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleBulkAction('deactivate')}
    >
      <X className="mr-2 h-4 w-4" />
      Deactivate
    </Button>
    
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleBulkDelete()}
      className="text-red-600"
    >
      <Trash className="mr-2 h-4 w-4" />
      Delete
    </Button>
  </div>
)}
```

---

## Common Patterns

### Module List Page

```
/admin/module/
├── Header: Module Name + Add Button
├── Toolbar: Search + Filters + Bulk Actions
├── Table: Data with pagination
└── Footer: Pagination controls
```

### Module Form Page

```
/admin/module/[id]/
├── Header: Title + Back Button + Delete Button
├── Form:
│   ├── Basic Information Card
│   ├── Media Card
│   └── Settings Card
└── Footer: Cancel + Save Buttons
```

### Module Detail Page

```
/admin/module/[id]/
├── Header: Title + Edit + Delete Buttons
├── Info Cards: Key details
├── Activity Timeline: Recent changes
└── Related Items: Associated records
```

---

## Error Handling

### Form Errors

```tsx
<FormField
  control={form.control}
  name="title"
  render={({ field, fieldState }) => (
    <FormItem>
      <FormLabel>Title</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage>
        {fieldState.error?.message || apiError}
      </FormMessage>
    </FormItem>
  )}
/>
```

### Toast Notifications

```tsx
import { toast } from "sonner";

toast.success("Item created successfully");
toast.error("Failed to create item", {
  description: error.message,
});
toast.warning("Item will be deleted in 5 seconds", {
  action: {
    label: "Undo",
    onClick: () => undoDelete(),
  },
});
```

---

*Document maintained by: Development Team*
