---
id: form-validation
alias: Form Validation
is_base: false
version: 1
tags: [form, validation, ui]
description: "Reusable pattern for implementing client-side form validation"
---

# Form Validation Pattern

## Overview
A reusable pattern for implementing client-side form validation with consistent error handling, user feedback, and validation rules. This pattern ensures forms provide clear, immediate feedback to users about input errors.

## Pattern Description

This pattern solves the problem of inconsistent form validation across an application. Instead of validating forms differently in each place, this pattern provides:

1. **Validation Rules**: Reusable validation functions
2. **Error Display**: Consistent error message presentation
3. **Real-time Feedback**: Validate on change or blur
4. **Field-level Validation**: Individual field error states
5. **Form-level Validation**: Submit-time validation summary

## Use Cases

- User registration and login forms
- Settings and configuration forms
- Data entry forms
- Search and filter forms
- Multi-step form wizards

## Component Structure

```tsx
<FormField
  name="fieldName"
  label="Field Label"
  type="text" | "email" | "password" | etc.
  required={boolean}
  validation={validationRules}
  error={errorMessage}
>
  <Input />
</FormField>
```

## Key Principles

1. **Validation Rules**: Reusable functions for common validations
2. **Error States**: Visual indication of invalid fields
3. **Error Messages**: Clear, actionable error text
4. **Timing**: Validate on blur or change (configurable)
5. **Accessibility**: ARIA attributes for screen readers

## Implementation Pattern

The validation system should:
- Define reusable validation rules (required, email, minLength, etc.)
- Show error messages below or near invalid fields
- Highlight invalid fields visually (red border, icon)
- Prevent form submission if validation fails
- Support async validation (e.g., username availability)
- Provide validation summary on submit

## Common Validation Rules

- **Required**: Field must not be empty
- **Email**: Valid email format
- **Min/Max Length**: String length constraints
- **Pattern**: Regex pattern matching
- **Custom**: Application-specific rules

## Benefits

- **Consistency**: Same validation UX everywhere
- **User Experience**: Immediate, clear feedback
- **Accessibility**: Screen reader friendly
- **Maintainability**: Centralized validation logic
- **Type Safety**: TypeScript ensures correct usage

## Customization Points

- Validation rule definitions
- Error message styling and placement
- Validation timing (onChange, onBlur, onSubmit)
- Custom validation functions
- Error icon and visual indicators
- Validation summary layout

