---
title: BlueKit Framework Principles
created: 2025-12-28
purpose: Define the foundational principles for kit design and composition
focus: End-state oriented, AI-generatable, composable instruction sets
---

# BlueKit Framework Principles

## Core Philosophy

BlueKit is an **instruction library for AI code generation**, not a code snippet library.

The end goal: Users can spin up entirely new projects by selecting 15-20 kits from their library (or community marketplace), and AI generates a working, integrated codebase.

This is only possible if kits follow principles that enable **reliable composition** while maintaining **implementation flexibility**.

---

## The Central Principle: End State Over Process

### ❌ Process-Oriented Kits (Don't Do This)

```markdown
## JWT Authentication Kit

1. Run: npm install jsonwebtoken bcrypt
2. Create file: src/middleware/auth.ts
3. Copy this code: [200 lines of implementation]
4. Add to Express app.use()
5. Create POST /auth/login endpoint
6. Test with curl command
```

**Problems:**
- AI can't adapt to different frameworks (Fastify, Koa, Hono)
- Hard to verify what changed after generation
- Can't regenerate without losing customizations
- Difficult to compose with other kits (which file owns what?)
- Becomes outdated as libraries change

### ✅ End State-Oriented Kits (Do This)

```markdown
## JWT Authentication Kit

### End State

After applying this kit, the application will have:

**Authentication middleware:**
- Validates JWT bearer tokens from Authorization header
- Attaches authenticated user to request context as `req.user`
- Returns 401 for invalid/missing tokens

**Login endpoint:**
- POST /auth/login accepts {email, password}
- Returns {accessToken, refreshToken} on success
- Implements rate limiting (5 attempts per 15 minutes)

**Interfaces available to downstream code:**
- `req.user: User` - Current authenticated user
- `generateTokens(userId): AuthTokens` - Create JWT pair
- `hashPassword(password): string` - Secure password hashing
- `verifyPassword(plain, hash): boolean` - Password verification

**Data model:**
- `users` table: id, email, password_hash, created_at
- `refresh_tokens` table: id, user_id, token_hash, expires_at

**Configuration:**
- Environment: JWT_SECRET, JWT_EXPIRY (default: 24h)

**Security guarantees:**
- Passwords hashed with adaptive cost algorithm (bcrypt/argon2)
- Tokens expire after 24 hours
- Refresh token rotation on use
- CSRF protection on token endpoints

### Implementation Principles

- Use industry-standard JWT libraries (never custom crypto)
- Support access + refresh token pattern
- Token payload: minimal (user ID only, fetch claims separately)
- Implement token revocation (refresh token table or Redis)
- Always hash passwords server-side

### Verification Criteria

After generation, verify:
- ✓ POST /auth/login returns valid JWT on correct credentials
- ✓ Protected routes reject requests without valid token
- ✓ `req.user` populated for authenticated requests
- ✓ Passwords stored as hashes, never plaintext
- ✓ Rate limiting prevents brute force
```

**Benefits:**
- AI chooses implementation details (library, framework, file structure)
- Clear verification criteria for testing
- Easy to regenerate ("use Fastify instead of Express")
- Explicit interfaces enable composition
- Principles guide quality without prescribing specifics

---

## Interface Contracts: The Composition Model

For AI to integrate 15 kits reliably, each kit must declare:

### 1. **Provides** (What This Kit Creates)

The interfaces, types, middleware, or endpoints that other kits can depend on:

```yaml
provides:
  middleware:
    - req.user: User          # Authentication context
    - req.db: DatabaseClient  # Database connection
  types:
    - User
    - JWTPayload
    - AuthTokens
  functions:
    - generateTokens(userId): AuthTokens
    - verifyToken(token): JWTPayload
  endpoints:
    - POST /auth/login
    - POST /auth/refresh
```

### 2. **Requires** (What This Kit Depends On)

What must exist before this kit can work:

```yaml
requires:
  database:
    - users table with columns: id, email, password_hash
  environment:
    - JWT_SECRET
    - DATABASE_URL (optional, from db kit)
  dependencies:
    - http_server: Any framework supporting middleware pattern
```

### 3. **Compatible With** (Synergies)

Kits that work especially well together:

```yaml
compatible_with:
  - rbac-system: Consumes req.user, adds req.permissions
  - multi-tenant-design: Adds tenantId to JWT payload
  - api-rate-limiting: Shares Redis connection
  - oauth-integration: Extends with social login
```

### Example: Full Interface Declaration

```yaml
---
id: jwt-authentication
type: kit
tags: [auth, security, middleware]
description: Stateless authentication using JSON Web Tokens

provides:
  middleware:
    - req.user: User
  types:
    - User
    - JWTPayload
    - AuthTokens
  functions:
    - generateTokens(userId): AuthTokens
    - verifyToken(token): JWTPayload
    - hashPassword(password): string
    - verifyPassword(plain, hash): boolean
  endpoints:
    - POST /auth/login
    - POST /auth/refresh
    - POST /auth/logout

requires:
  database:
    - users table (id, email, password_hash, created_at)
    - refresh_tokens table (id, user_id, token_hash, expires_at)
  environment:
    - JWT_SECRET

compatible_with:
  - rbac-system
  - multi-tenant-design
  - session-management
  - oauth-integration
---
```

---

## Kit Architecture Layers

From scenarios.md, kits organize into dependency layers:

### Layer 1: Foundation (Infrastructure)

**Must be applied first** - establish core infrastructure:
- Database setup & migrations
- Authentication system
- API framework (REST/GraphQL/tRPC)
- Cloud infrastructure (Terraform/CloudFormation)
- CI/CD pipelines
- Monitoring & logging

**Characteristics:**
- Few dependencies on other kits
- Provide fundamental interfaces (db connection, auth middleware)
- Long-lived, rarely regenerated

### Layer 2: Middleware (Services)

**Built on foundations** - reusable services:
- Caching strategies (Redis patterns)
- Background job processing (queues, workers)
- WebSocket servers
- File upload systems (S3, storage)
- Email/SMS services
- Full-text search

**Characteristics:**
- Require foundation layer interfaces
- Provide service interfaces to feature layer
- Moderate complexity

### Layer 3: Features (Components)

**User-facing features** consuming middleware:
- UI components (forms, tables, charts)
- Business workflows
- Third-party integrations (Stripe, Twilio)
- Domain logic patterns

**Characteristics:**
- Depend heavily on layers 1 & 2
- High variability across projects
- Frequently customized/regenerated

### Cross-Cutting (Any Layer)

Applied at any layer:
- Security patterns (encryption, audit logging)
- Testing strategies (unit, integration, e2e)
- Performance optimizations (CDN, caching)
- Developer experience (linting, formatting)

---

## Composition Validation

### Compatibility Rules

**Must Be Applied Together:**
- Multi-Tenant Database Design → MUST apply before all feature kits
- JWT Auth → MUST apply before any protected features
- Terraform Infrastructure → MUST apply before cloud-dependent kits

**Work Better Together:**
- Real-Time WebSocket Sync + Pub/Sub Redis = multi-instance coordination
- File Upload + Image Optimization = automatic pipeline
- Stripe Checkout + Stripe Webhooks = complete payment flow
- Background Jobs + SQS = distributed processing

**Mutually Exclusive:**
- JWT Auth ⚔️ Session Management (choose one auth strategy)
- REST API ⚔️ GraphQL ⚔️ tRPC (choose one API pattern)
- PostgreSQL ⚔️ MongoDB (choose primary database)

### Blueprint Validation

Blueprints can validate composition **before generation**:

```typescript
// Example validation logic
function validateBlueprint(kits: Kit[]): ValidationResult {
  const provided = new Set<string>()
  const required = new Set<string>()
  const conflicts: string[] = []

  for (const kit of kits) {
    // Track what's provided
    kit.provides?.middleware?.forEach(i => provided.add(i))

    // Check requirements
    kit.requires?.middleware?.forEach(i => {
      if (!provided.has(i)) {
        required.add(i)
      }
    })

    // Detect conflicts
    if (kit.id === 'jwt-auth' && kits.some(k => k.id === 'session-auth')) {
      conflicts.push('Cannot use both JWT and Session auth')
    }
  }

  return { provided, required, conflicts }
}
```

---

## The Flexibility Spectrum

### Too Rigid (Over-Protocolized)

```markdown
## Authentication Kit

REQUIRED STRUCTURE:
- File: src/auth/jwt.ts (exact path)
- Library: jsonwebtoken v9.0.2 (exact version)
- Algorithm: HS256 (no alternatives)
- Expiry: 3600 seconds (no configuration)

CODE:
[300 lines of copy-paste code]
```

**Problems:**
- No framework flexibility
- Can't adapt to project conventions
- Stifles innovation
- Breaks when library updates

### Too Loose (Under-Specified)

```markdown
## Authentication Kit

Add authentication to your app. Use JWT or sessions.
Protect your routes. Hash passwords securely.
```

**Problems:**
- AI generates 15 different auth approaches
- No interface contract for other kits
- Can't verify correctness
- Integration requires manual work

### The Sweet Spot (End State + Principles)

```markdown
## Authentication Kit

### End State
- Middleware provides `req.user: User`
- POST /auth/login returns JWT
- Passwords hashed with adaptive cost

### Principles
- Use industry-standard libraries
- Support refresh token rotation
- Implement rate limiting

### Verification
- ✓ req.user populated for authenticated requests
- ✓ Invalid tokens rejected with 401
```

**Benefits:**
- Clear interface contract (`req.user`)
- Implementation flexibility (library choice)
- Testable outcomes (verification criteria)
- Composable (other kits can depend on `req.user`)

---

## The BlueKit Contract

### What BlueKit Enforces (Minimal)

1. **File location**: `.bluekit/` directory structure
2. **File format**: Markdown with YAML front matter
3. **Metadata schema**: `id`, `tags`, `description` (for app UI)

### What BlueKit Recommends (Optional)

1. **Content structure**: End state + Principles + Verification
2. **Interface contracts**: `provides`, `requires`, `compatible_with`
3. **Layer organization**: Foundation → Middleware → Features

### What BlueKit Doesn't Control

1. **Implementation details**: Users choose libraries, frameworks
2. **Content rules**: Can define custom kit formats in .cursorrules/CLAUDE.md
3. **Composition logic**: AI decides how to integrate based on context

---

## User Personas & Workflows

### Persona 1: MCP User (80% of users)

**Goal**: Quick, reliable kit generation

**Workflow**:
1. Uses `bluekit_kit_generateKit` MCP tool
2. Gets kits following end-state principles automatically
3. Kits compose reliably into blueprints
4. Trusts compatibility validation

**BlueKit provides**: Golden path with opinionated best practices

### Persona 2: Power User (15% of users)

**Goal**: Custom kit formats for specific domains

**Workflow**:
1. Defines custom rules in `.cursorrules` or `CLAUDE.md`
2. Manually creates kits following their own conventions
3. Ensures YAML front matter exists for app metadata
4. Takes responsibility for composition/integration

**BlueKit provides**: Flexible storage and organization system

### Persona 3: Community Contributor (5% of users)

**Goal**: Share reusable blueprints with others

**Workflow**:
1. Creates kits using MCP for compatibility
2. Tests composition in multiple projects
3. Publishes to community marketplace
4. Others clone blueprints and customize

**BlueKit provides**: Distribution and discovery platform

---

## Practical Guidelines for Kit Authors

### Do's

✅ **Describe outcomes, not steps**
- "Application has POST /auth/login endpoint"
- NOT "Create file auth.ts and add this code"

✅ **Specify interfaces explicitly**
- "Middleware provides `req.user: User` to downstream handlers"
- Include type definitions for shared interfaces

✅ **State requirements clearly**
- "Requires PostgreSQL database with users table"
- "Requires environment variable: JWT_SECRET"

✅ **Provide principles, not prescriptions**
- "Use adaptive cost hashing (bcrypt/argon2)"
- NOT "Run: npm install bcrypt"

✅ **Include verification criteria**
- Testable conditions that prove end state achieved
- "✓ Invalid tokens return 401 status"

✅ **Document compatibility**
- What this kit works well with
- What it conflicts with
- What it extends

### Don'ts

❌ **Don't prescribe exact libraries**
- Unless critical to the end state (e.g., React for React components)
- Let AI choose based on project context

❌ **Don't specify file structure**
- Projects have different conventions
- Let AI organize based on existing patterns

❌ **Don't include version numbers**
- Except for major breaking changes
- "Use Stripe API v2+" not "stripe@12.3.1"

❌ **Don't provide complete code**
- Give examples, not implementations
- AI should generate fresh code

❌ **Don't assume a framework**
- Unless the kit is framework-specific
- "Assumes HTTP server with middleware support" not "Assumes Express"

❌ **Don't create dependencies lightly**
- Only require what's truly necessary
- Optional integrations go in "compatible_with"

---

## Example: Full Kit Following Principles

```yaml
---
id: multi-tenant-database-design
type: kit
tags: [database, architecture, multi-tenant]
description: Row-level tenant isolation with automatic tenant context

provides:
  middleware:
    - req.tenantId: string
  types:
    - Tenant
    - TenantContext
  functions:
    - withTenant(tenantId, callback)
    - getCurrentTenant(): Tenant
  schema:
    - All tables include tenant_id column with foreign key
    - tenant_id included in all unique constraints

requires:
  database:
    - PostgreSQL 12+ (for row-level security)
    - Migration system
  middleware:
    - req.user: User (from authentication kit)

compatible_with:
  - jwt-authentication: Adds tenantId to JWT payload
  - rbac-system: Scopes permissions to tenant
  - background-jobs: Passes tenant context to workers
  - audit-logging: Logs tenant_id with all changes
---

# Multi-Tenant Database Design Kit

## End State

After applying this kit, the application will have:

### Database Schema

**Tenant isolation:**
- All application tables include `tenant_id` column (UUID, NOT NULL)
- Foreign key constraint: `tenant_id REFERENCES tenants(id) ON DELETE CASCADE`
- All unique constraints include `tenant_id` (e.g., UNIQUE(tenant_id, email))
- Indexes include `tenant_id` as first column for query performance

**Tenants table:**
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(63) UNIQUE,
  plan VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  settings JSONB DEFAULT '{}'
);
```

**Row-Level Security (RLS):**
- RLS policies enabled on all tenant-scoped tables
- Policy: `tenant_id = current_setting('app.current_tenant_id')::UUID`
- Automatic filtering at database level (defense in depth)

### Middleware & Context

**Tenant detection middleware:**
- Extracts tenant from: subdomain, JWT claim, or header (`X-Tenant-ID`)
- Sets `req.tenantId` for all downstream handlers
- Sets session variable: `SET app.current_tenant_id = '<tenant-id>'`
- Returns 403 if tenant not found or user lacks access

**Type definitions:**
```typescript
interface TenantContext {
  tenantId: string
  tenant: Tenant
}

interface Tenant {
  id: string
  name: string
  subdomain: string
  plan: 'free' | 'pro' | 'enterprise'
  settings: Record<string, any>
}
```

**Utility functions:**
- `withTenant(tenantId, callback)` - Execute function with tenant context
- `getCurrentTenant()` - Get current tenant from context
- `getUserTenants(userId)` - List tenants user has access to

### Data Access Patterns

**Automatic tenant scoping:**
- All queries automatically filtered by `tenant_id` (via RLS)
- ORM/query builder configured to include tenant_id in WHERE clauses
- INSERT operations automatically include `tenant_id` from context

**Cross-tenant operations:**
- Explicitly opt-in with `SECURITY_INVOKER` functions
- Require elevated permissions (superuser context)
- Logged in audit trail

### Tenant Management

**Endpoints:**
- POST /tenants - Create new tenant (admin only)
- GET /tenants - List user's tenants
- GET /tenants/:id - Get tenant details
- PUT /tenants/:id - Update tenant settings
- DELETE /tenants/:id - Soft-delete tenant (cascade to all data)

### Configuration

**Environment variables:**
- `TENANT_DETECTION_METHOD`: subdomain | jwt | header (default: subdomain)
- `ALLOW_CROSS_TENANT_ACCESS`: boolean (default: false)

### Security Guarantees

- ✓ No cross-tenant data leakage (enforced at DB level)
- ✓ Tenant context required for all data access
- ✓ Cascade deletes cleanup all tenant data
- ✓ Audit log tracks all tenant operations

## Implementation Principles

### Database Design
- Use UUID for tenant_id (prevents enumeration)
- Include tenant_id in ALL indexes for query performance
- Consider partitioning for very large tenants (10M+ rows)
- Use RLS as defense-in-depth, not sole protection

### Middleware Strategy
- Fail fast: reject requests without valid tenant
- Cache tenant lookups (Redis) to reduce DB queries
- Support multiple detection methods for flexibility
- Log tenant switches for security auditing

### Migration Strategy
- Provide migration to add tenant_id to existing tables
- Include backfill script for existing data
- Add RLS policies incrementally (test before enabling)
- Support gradual rollout (flag-based)

### Performance Considerations
- Composite indexes: (tenant_id, ...other_columns)
- Connection pooling per tenant (for very large tenants)
- Cache tenant settings to avoid repeated queries
- Monitor query plans to ensure index usage

## Integration Points

### With JWT Authentication Kit
JWT payload includes tenant context:
```json
{
  "userId": "...",
  "tenantId": "...",
  "tenantRole": "admin"
}
```

### With RBAC System Kit
Permissions scoped to tenant:
```typescript
// User can be admin in tenant A, viewer in tenant B
hasPermission(userId, tenantId, 'projects.delete')
```

### With Background Jobs Kit
Jobs include tenant context:
```typescript
queue.add('send-email', {
  tenantId: req.tenantId,
  userId: req.user.id,
  template: 'welcome'
})
```

### With Audit Logging Kit
All audit entries include tenant_id:
```sql
INSERT INTO audit_log (tenant_id, user_id, action, resource)
```

## Verification Criteria

After generation, verify:

**Database:**
- ✓ All application tables have tenant_id column
- ✓ RLS policies active on tenant-scoped tables
- ✓ Queries filtered by tenant_id automatically

**Middleware:**
- ✓ req.tenantId populated for all requests
- ✓ Requests without valid tenant return 403
- ✓ Session variable set for RLS

**Data isolation:**
- ✓ User in tenant A cannot access tenant B data
- ✓ Cross-tenant queries fail (unless explicitly allowed)
- ✓ Deleting tenant cascades to all related data

**Performance:**
- ✓ Query plans show index usage on tenant_id
- ✓ No full table scans on large tables
- ✓ Tenant lookup cached (< 5ms overhead)

## Common Pitfalls

❌ **Forgetting tenant_id in queries** - Use RLS as safety net
❌ **Missing tenant_id in unique constraints** - Allows duplicates across tenants
❌ **Not including tenant_id in indexes** - Poor query performance
❌ **Hardcoding tenant detection** - Makes multi-region deployments hard
❌ **Allowing NULL tenant_id** - Creates unscoped data leaks

## Testing Strategy

**Unit tests:**
- Verify middleware sets tenant context
- Test tenant detection methods (subdomain, JWT, header)
- Validate error handling for missing tenant

**Integration tests:**
- Create data in tenant A, verify not visible from tenant B
- Test RLS policies prevent cross-tenant access
- Verify cascade deletes cleanup all tenant data

**Performance tests:**
- Benchmark query performance with tenant_id indexes
- Test with 1000+ tenants to verify scalability
- Monitor connection pool usage
```

---

## Evolution of the System

### Phase 1: Manual Kits (Current)
- Users write markdown files
- Store in `.bluekit/` directories
- Manually manage composition

### Phase 2: MCP-Assisted (In Progress)
- MCP tools generate consistent kits
- Blueprint validation catches incompatibilities
- Recommended patterns emerge

### Phase 3: Marketplace (Future)
- Community shares proven blueprints
- Gallery of projects (Dribbble-style)
- Visual breakdown of kit composition
- One-click clone and customize

### Phase 4: Intelligent Composition (Future)
- AI suggests missing kits for desired features
- Automatic compatibility validation
- Visual blueprint editor (drag-drop kits, reorder layers)
- Investment in blueprints compounds over time

---

## Success Metrics

A kit framework succeeds when:

1. ✅ **15 kits compose into working app** - No manual integration needed
2. ✅ **Regeneration preserves customizations** - Can update one kit without breaking others
3. ✅ **Framework-agnostic** - Same kits work with Express, Fastify, Hono
4. ✅ **Testable outcomes** - Verification criteria prove correctness
5. ✅ **Community adoption** - Users share and remix blueprints
6. ✅ **Speed compounds** - Each project makes next project faster

---

## Conclusion

BlueKit is not a code library. It's a **specification-driven development platform** where:

- **Kits are specifications** (end states, not implementations)
- **AI is the compiler** (specifications → working code)
- **Blueprints are compositions** (how specs combine)
- **Projects are instances** (generated from specifications)

By describing **end states** with **interface contracts**, kits become:
- **Composable** - Reliable integration through clear interfaces
- **Flexible** - AI adapts implementation to context
- **Testable** - Verification criteria prove correctness
- **Reusable** - Same kit works across projects
- **Evolvable** - Regenerate with new requirements

This enables the vision: **Start a project entirely from 15 kits once you build out your library.**

The framework provides enough structure to enable composition, but enough flexibility to enable creativity.

**End state thinking is the key that unlocks everything.**
