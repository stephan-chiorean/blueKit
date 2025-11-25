---
id: loading-state
alias: Loading State
is_base: false
version: 1
tags: [ui, pattern, loading]
description: "Reusable pattern for displaying loading states throughout an application"
---

# Loading State Pattern

## Overview
A reusable pattern for displaying loading states throughout an application. This pattern provides consistent visual feedback when data is being fetched, processed, or when async operations are in progress.

## Pattern Description

This pattern solves the problem of inconsistent loading indicators across different parts of an application. Instead of showing blank screens or random spinners, this pattern provides:

1. **Consistent Indicators**: Unified loading spinner/skeleton design
2. **Contextual Messages**: Optional loading text for clarity
3. **Full Page vs Inline**: Support for both full-page and inline loading
4. **Skeleton Screens**: Placeholder content that matches final layout
5. **Error States**: Graceful handling when loading fails

## Use Cases

- Initial page/data loading
- Form submission feedback
- Async operation progress
- Data refresh indicators
- File upload progress
- Search result loading

## Component Structure

```tsx
<LoadingState
  isLoading={boolean}
  error={Error | null}
  fullPage={boolean}
  message="Loading..."
  skeleton={boolean}
>
  {/* Content shown when not loading */}
  {children}
</LoadingState>
```

## Key Principles

1. **Visual Feedback**: Always show something when loading
2. **Context**: Loading message should explain what's happening
3. **Non-Blocking**: Inline loading shouldn't block entire UI
4. **Error Handling**: Show error state if loading fails
5. **Skeleton Screens**: Use placeholders that match final layout

## Implementation Pattern

The component should:
- Show spinner or skeleton when `isLoading` is true
- Display error message if error exists
- Support full-page overlay or inline loading
- Allow custom loading messages
- Provide skeleton placeholders for better UX
- Handle timeout scenarios gracefully

## Benefits

- **User Feedback**: Users always know something is happening
- **Consistency**: Same loading experience everywhere
- **Better UX**: Skeleton screens reduce perceived load time
- **Error Handling**: Built-in error state management
- **Flexibility**: Works for any async operation

## Customization Points

- Spinner style and animation
- Loading message text
- Skeleton shape and layout
- Error message display
- Timeout duration
- Full-page vs inline mode

