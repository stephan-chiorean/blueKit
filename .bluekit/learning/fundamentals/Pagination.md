# Pagination

Here’s a foundational guide to pagination with a focus on **offset vs cursor**. It prioritizes **result stability** (especially on write-heavy tables), not just performance.

⸻

# Pagination (Foundations)

## What Is Pagination?

**Pagination** is the practice of splitting a large result set into smaller chunks (pages) so clients can load data in pieces instead of all at once.

Common goals:
- **Reduce payload size**
- **Improve UX** (faster initial load)
- **Control DB work**
- **Make lists navigable**

⸻

## Two Main Strategies

### 1) Offset Pagination (page-based)

You ask for **page N** by skipping rows:

```sql
SELECT *
FROM posts
ORDER BY created_at DESC
LIMIT 20 OFFSET 40; -- page 3 of 20
```

**Mental model:** “Give me page 3.”

**Pros:**
- Simple to understand
- Easy to jump to arbitrary pages
- Natural for page numbers (1, 2, 3…)

**Cons:**
- Results can **shift** if data changes
- Large offsets get expensive
- Easy to get duplicates or missing rows on write-heavy tables

⸻

### 2) Cursor Pagination (keyset-based)

You ask for the next page **relative to the last item you saw**:

```sql
SELECT *
FROM posts
WHERE (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

**Mental model:** “Give me the next page after this item.”

The **cursor** is usually an encoded tuple of the last item’s ordering keys:

```json
{
  "items": [/* 20 posts */],
  "next_cursor": "2026-01-30T12:45:00Z|post_9821"
}
```

**Pros:**
- Stable under writes (if ordered by immutable keys)
- Avoids skipping rows due to insert/delete churn
- Consistent performance on large datasets

**Cons:**
- Hard to jump to page 100
- Requires careful ordering and cursor design
- Needs a deterministic, indexed sort key

⸻

## Stability vs Speed (The Real Decision)

**Speed is not the only reason** to pick cursor pagination. In many systems, **stability is the real driver**.

On a **write-heavy table**, offset pagination can produce **duplicate or missing rows** even if the query is “fast.”

### Example: Offset Drift Under Writes

Imagine you fetch page 1:

```
Page 1: A, B, C, D, E
```

Then a new row is inserted at the top (newest):

```
New row: X
```

Now you fetch page 2 using `OFFSET 5`:

```
Page 2: E, F, G, H, I
```

Notice the problem:
- **E appeared twice** (end of page 1, start of page 2)
- **A row was skipped** (one item got pushed out)

This is **pagination drift** — a stability issue, not a speed issue.

⸻

## Why Cursor Pagination Is More Stable

Cursor pagination is **anchored** to the last item you saw, so insertions above that item **don’t affect the next page**.

If you order by **immutable keys** (e.g., `created_at` + `id`):
- New rows don’t change the position of previously seen rows
- Deletes only remove items, they don’t shift unseen rows upward
- You don’t get duplicates or gaps from new inserts

**Key rule:** your cursor must use **deterministic, stable ordering keys**.

⸻

## What “Stable Results” Actually Means

Cursor pagination gives you **stable paging**, not a perfect snapshot:

- You won’t see **duplicates** across page boundaries
- You won’t **skip items** because of new inserts above your last item
- You **may not see newly inserted items** unless you refresh from the top

That last point is important. Cursor pagination is great for **scrolling forward through time**, but it doesn’t magically include rows that arrived *before* your current cursor. This is usually a good tradeoff for feeds and timelines.

⸻

## When to Use Offset Pagination

Offset is still great when:
- The dataset is **small** or mostly static
- You need **page numbers** or “jump to page” UX
- The data is **snapshotted** (e.g., report generated at a fixed time)
- It’s an **admin tool** where occasional drift is acceptable

### Make Offset Safer

If you must use offset on changing data, consider freezing the dataset:

```sql
SELECT *
FROM posts
WHERE created_at <= :cutoff
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;
```

By anchoring to a cutoff timestamp, you remove most drift.

⸻

## When to Use Cursor Pagination

Cursor is a better fit when:
- The table is **write-heavy** (feeds, messages, logs)
- You need **stable, non-duplicated results**
- You’re building **infinite scroll** or “load more” UI
- You expect **very large datasets**

Cursor pagination is about **correctness over time**, not just speed.

⸻

## Choosing the Right Ordering Keys

Cursor pagination only works if your ordering is stable and deterministic.

**Good ordering keys:**
- `created_at` + `id` (immutable timestamp + unique tie-breaker)
- `id` if it’s monotonically increasing

**Bad ordering keys:**
- `updated_at` (changes over time)
- non-unique columns without a tie-breaker

### Always Include a Tie-Breaker

If multiple rows can have the same `created_at`, include `id`:

```sql
ORDER BY created_at DESC, id DESC
```

This guarantees a **total order** and prevents duplicates when paging.

⸻

## Indexing for Cursor Pagination

Cursor pagination only stays fast if the database can efficiently seek into the ordered set.

For the common `created_at + id` pattern, the index should match the order:

```sql
CREATE INDEX posts_created_id_idx
ON posts (created_at DESC, id DESC);
```

With this index, the query can “seek” directly to the cursor and scan forward without skipping rows.

⸻

## Cursor Tokens: Opaque and Filter-Aware

In APIs, cursors should be **opaque** to the client:
- Encode `created_at|id` (and optionally direction) into a token
- Consider signing or encrypting if you want to prevent tampering

Also, **cursors are only valid with the same filters and sort order**:

```sql
-- Original request:
WHERE status = 'published'
ORDER BY created_at DESC, id DESC

-- Next page must use the exact same filters and order:
WHERE status = 'published'
  AND (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC
```

If the filters or sort change, the cursor should be discarded and pagination restarted.

⸻

## Consistency vs Snapshot Semantics

Offset pagination can be **stable** if you read from a **consistent snapshot** (like a transaction with repeatable read). But that’s not always available or practical in APIs.

Cursor pagination gives you **stable ordering without needing a long-lived transaction**, which is why it’s common in APIs.

⸻

## Backwards Pagination (Optional)

If you need a “previous page,” you can use a **before cursor** and reverse the comparison:

```sql
SELECT *
FROM posts
WHERE (created_at, id) > (:first_created_at, :first_id)
ORDER BY created_at ASC, id ASC
LIMIT 20;
```

Then reverse the results in your application to keep the UI in descending order. This keeps the pagination consistent in both directions.

⸻

## Practical Decision Guide

### Choose Offset When:
- You need page numbers or random access
- The data set is small or frozen
- Occasional drift is acceptable

### Choose Cursor When:
- You need stable results under frequent writes
- You’re building infinite scroll or feeds
- Correctness matters more than “go to page 50”

⸻

## TL;DR

- Offset pagination is simple and page-number friendly, but **unstable under writes**.
- Cursor pagination is stable and scalable, but requires careful ordering and can’t jump to arbitrary pages.
- **Speed is not the main reason to choose cursor** — stability on changing data often is.

If your table is **write-heavy**, cursor pagination gives you **correct, stable results** even if speed isn’t the bottleneck.
