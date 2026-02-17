# Admin Page Patterns

## Standard List Page Template

Every list page follows this structure:

```
1. Header: title + description + action buttons (export, add, refresh)
2. Filter bar: search input (with icon) + dropdown filters + "필터 초기화" link
3. Bulk actions bar (conditional): "{n}명 선택됨" + bulk action buttons
4. Table card: rounded-xl border, overflow-x-auto for responsive
5. Table: sticky header bg-surface, sortable columns, skeleton loading
6. Pagination: integrated at bottom of table card
```

## Filter Reset Pattern

```tsx
{
  (debouncedSearch || roleFilter !== "ALL") && (
    <button onClick={clearFilters} className="text-xs text-primary hover:underline">
      필터 초기화
    </button>
  );
}
```

## Server-side Pagination Pattern

```tsx
const [page, setPage] = useState(1);
const [limit, setLimit] = useState(25);
// Reset page on filter change
useEffect(() => {
  setPage(1);
}, [debouncedSearch, filter]);
// Pass to Pagination component
<Pagination
  page={page}
  totalPages={totalPages}
  total={total}
  limit={limit}
  onPageChange={setPage}
  onLimitChange={(l) => {
    setLimit(l);
    setPage(1);
  }}
/>;
```

## Destructive Action Pattern

- Single item delete: ConfirmDialog with `confirmText={item.email}` (typed confirmation)
- Bulk delete: ConfirmDialog without typed confirmation but showing count
- Both use `variant="danger"` and show loading state

## Consistent Class Conventions

- Table header: `border-b border-border bg-surface`
- Table row: `border-b border-border transition-colors last:border-b-0 hover:bg-surface`
- Selected row: `bg-primary/5` instead of hover
- Card: `rounded-xl border border-border bg-white p-5`
- Button primary: `bg-primary text-white hover:bg-primary-dark`
- Button secondary: `border border-border bg-white text-muted hover:bg-surface`
- Input: `rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20`
- Badge: Use `StatusBadge` component, not inline classes

## Chart Styling

- CartesianGrid: `strokeDasharray="3 3" stroke="#e5e7eb" vertical={false}`
- XAxis/YAxis: `tick={{ fontSize: 12 }} stroke="#9ca3af" axisLine={false}`
- Tooltip: `borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow`
- Bar radius: `[4, 4, 0, 0]` (top corners rounded)
- Primary blue: `#2563eb`, Secondary green: `#10b981`, Danger red: `#ef4444`
