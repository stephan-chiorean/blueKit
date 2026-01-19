# Enterprise SSO: SAML & OIDC Support

**Status:** Future Planning
**Created:** 2026-01-14
**Context:** Enterprise customers require SSO via their corporate identity providers (Okta, Azure AD, Google Workspace, etc.)

---

## Executive Summary

Enterprise customers don't want another username/password. They want employees to sign in with their existing corporate credentials (Okta, Azure AD, Google Workspace). This requires supporting SAML 2.0 and OIDC protocols.

**Good news:** Supabase supports SAML SSO on Pro/Team plans. We don't need to build SSO infrastructure—we configure it.

**The complexity:** Multi-tenant SSO where different organizations use different identity providers, with domain-based routing.

---

## Table of Contents

1. [Why Enterprises Need SSO](#1-why-enterprises-need-sso)
2. [SAML vs OIDC Explained](#2-saml-vs-oidc-explained)
3. [Supabase SSO Capabilities](#3-supabase-sso-capabilities)
4. [Architecture Options](#4-architecture-options)
5. [Multi-Tenant SSO Design](#5-multi-tenant-sso-design)
6. [Implementation Guide](#6-implementation-guide)
7. [Identity Provider Configurations](#7-identity-provider-configurations)
8. [User Provisioning (SCIM)](#8-user-provisioning-scim)
9. [Domain Verification](#9-domain-verification)
10. [Organization Management](#10-organization-management)
11. [Security & Compliance](#11-security--compliance)
12. [Pricing Considerations](#12-pricing-considerations)
13. [Implementation Phases](#13-implementation-phases)

---

## 1. Why Enterprises Need SSO

### The Enterprise Reality

```
┌─────────────────────────────────────────────────────────────┐
│                   Enterprise IT Requirements                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  "Our employees use Okta for everything. If BlueKit         │
│   doesn't support SSO, we can't approve it."                │
│                                                              │
│  - Every enterprise IT department                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Why SSO Matters

| Concern | Without SSO | With SSO |
|---------|-------------|----------|
| **Password fatigue** | Another password to remember | Use existing corporate creds |
| **Security** | Weak passwords, no MFA | Centralized MFA policies |
| **Offboarding** | Manual account deletion | Automatic deprovisioning |
| **Compliance** | Audit nightmare | Centralized access logs |
| **IT approval** | Usually blocked | Usually approved |

### Common Enterprise Identity Providers

| Provider | Protocol | Market Share | Notes |
|----------|----------|--------------|-------|
| **Okta** | SAML, OIDC | ~15% | Most common in tech |
| **Azure AD** | SAML, OIDC | ~30% | Microsoft shops |
| **Google Workspace** | SAML, OIDC | ~20% | Startups, SMBs |
| **OneLogin** | SAML, OIDC | ~5% | Mid-market |
| **Ping Identity** | SAML, OIDC | ~5% | Large enterprises |
| **JumpCloud** | SAML, OIDC | ~3% | Remote-first orgs |
| **Auth0** | OIDC | ~10% | Developer-focused |

---

## 2. SAML vs OIDC Explained

### SAML 2.0 (Security Assertion Markup Language)

**What it is:** XML-based protocol for exchanging authentication data between identity provider (IdP) and service provider (SP).

**How it works:**

```
┌─────────────────────────────────────────────────────────────┐
│                     SAML Auth Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User visits BlueKit                                     │
│              │                                               │
│              ▼                                               │
│  2. BlueKit: "Sign in with SSO" → Enter email domain        │
│              │                                               │
│              ▼                                               │
│  3. BlueKit generates SAML AuthnRequest                     │
│              │                                               │
│              ▼                                               │
│  4. Redirect to corporate IdP (Okta, Azure AD)              │
│              │                                               │
│              ▼                                               │
│  5. User authenticates at IdP (password, MFA)               │
│              │                                               │
│              ▼                                               │
│  6. IdP generates SAML Response (XML assertion)             │
│              │                                               │
│              ▼                                               │
│  7. IdP POSTs assertion to BlueKit ACS URL                  │
│              │                                               │
│              ▼                                               │
│  8. BlueKit validates signature, creates session            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key terms:**
- **IdP (Identity Provider):** Okta, Azure AD, etc.
- **SP (Service Provider):** BlueKit
- **Assertion:** Signed XML containing user identity
- **ACS URL:** Assertion Consumer Service - where IdP sends response
- **Entity ID:** Unique identifier for the SP
- **Metadata:** XML file describing IdP/SP configuration

### OIDC (OpenID Connect)

**What it is:** JSON-based protocol built on OAuth 2.0 for authentication. More modern, simpler than SAML.

**How it works:**

```
┌─────────────────────────────────────────────────────────────┐
│                     OIDC Auth Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User visits BlueKit                                     │
│              │                                               │
│              ▼                                               │
│  2. BlueKit redirects to IdP authorization endpoint         │
│     with client_id, redirect_uri, scope=openid              │
│              │                                               │
│              ▼                                               │
│  3. User authenticates at IdP                               │
│              │                                               │
│              ▼                                               │
│  4. IdP redirects back with authorization code              │
│              │                                               │
│              ▼                                               │
│  5. BlueKit exchanges code for tokens (backend)             │
│              │                                               │
│              ▼                                               │
│  6. BlueKit receives: access_token, id_token, refresh_token │
│              │                                               │
│              ▼                                               │
│  7. id_token contains user claims (email, name, etc.)       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key terms:**
- **id_token:** JWT containing user identity claims
- **access_token:** For accessing protected resources
- **Claims:** User attributes (email, name, groups)
- **Scopes:** What information to request (openid, profile, email)

### SAML vs OIDC Comparison

| Aspect | SAML 2.0 | OIDC |
|--------|----------|------|
| **Format** | XML | JSON/JWT |
| **Age** | 2005 | 2014 |
| **Complexity** | High | Medium |
| **Mobile support** | Poor | Excellent |
| **Enterprise adoption** | Very high | Growing |
| **Setup difficulty** | Complex | Easier |
| **Token format** | XML assertion | JWT |

**Recommendation:** Support both. SAML for legacy enterprises, OIDC for modern orgs.

---

## 3. Supabase SSO Capabilities

### What Supabase Offers

Supabase Auth supports SSO via SAML 2.0 on **Pro plan and above**.

**Built-in features:**
- SAML 2.0 Service Provider
- Multiple IdP connections
- Automatic user provisioning (JIT)
- Attribute mapping
- SSO enforcement per organization

**What we configure:**
- IdP metadata (from customer's Okta/Azure/etc.)
- Attribute mappings (email, name, groups)
- Domain routing (acme.com → Okta, bigcorp.com → Azure)

### Supabase SSO API

```typescript
// Enable SSO for a domain
const { data, error } = await supabase.auth.admin.createSSOProvider({
  type: 'saml',
  metadata_url: 'https://acme.okta.com/app/xxx/sso/saml/metadata',
  domains: ['acme.com'],
  attribute_mapping: {
    keys: {
      email: { name: 'email' },
      name: { name: 'displayName' },
      // Map SAML attributes to Supabase user fields
    },
  },
});

// List SSO providers
const { data: providers } = await supabase.auth.admin.listSSOProviders();

// Delete SSO provider
await supabase.auth.admin.deleteSSOProvider(providerId);
```

### SSO Sign-In Flow

```typescript
// Frontend: SSO sign-in
const signInWithSSO = async (email: string) => {
  const domain = email.split('@')[1];

  const { data, error } = await supabase.auth.signInWithSSO({
    domain: domain,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (data?.url) {
    // Redirect to IdP
    window.location.href = data.url;
  }
};
```

---

## 4. Architecture Options

### Option A: Single-Tenant (Simple)

**Use case:** BlueKit has one corporate customer using SSO.

```
┌─────────────────────────────────────────────────────────────┐
│                    Single-Tenant SSO                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Supabase Project                                           │
│  └── SSO Provider: Acme Corp (Okta)                        │
│      └── Domain: acme.com                                   │
│                                                              │
│  All @acme.com users → Okta → BlueKit                      │
│  All other users → Google/GitHub/Email                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Pros:** Simple to set up
**Cons:** Doesn't scale to multiple enterprise customers

### Option B: Multi-Tenant (Production)

**Use case:** Multiple enterprise customers, each with their own IdP.

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Tenant SSO                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Supabase Project                                           │
│  ├── SSO Provider: Acme Corp                               │
│  │   ├── IdP: Okta                                         │
│  │   └── Domains: acme.com, acme.io                        │
│  │                                                          │
│  ├── SSO Provider: BigCorp                                 │
│  │   ├── IdP: Azure AD                                     │
│  │   └── Domains: bigcorp.com                              │
│  │                                                          │
│  └── SSO Provider: StartupXYZ                              │
│      ├── IdP: Google Workspace                             │
│      └── Domains: startupxyz.com                           │
│                                                              │
│  Domain routing:                                            │
│  @acme.com → Okta                                          │
│  @bigcorp.com → Azure AD                                   │
│  @startupxyz.com → Google Workspace                        │
│  @gmail.com → Social login (Google OAuth)                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Pros:** Scales to unlimited enterprise customers
**Cons:** More complex, need organization management

### Option C: Dedicated Supabase Projects (Isolation)

**Use case:** Enterprise customers want data isolation.

```
┌─────────────────────────────────────────────────────────────┐
│                    Isolated Tenants                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Supabase Project: bluekit-acme                            │
│  └── SSO: Okta (acme.com)                                  │
│  └── Database: Only Acme data                              │
│                                                              │
│  Supabase Project: bluekit-bigcorp                         │
│  └── SSO: Azure AD (bigcorp.com)                           │
│  └── Database: Only BigCorp data                           │
│                                                              │
│  Supabase Project: bluekit-main                            │
│  └── SSO: Social (Google, GitHub)                          │
│  └── Database: Non-enterprise users                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Pros:** Complete data isolation, meets strictest compliance
**Cons:** Expensive, complex to manage, code duplication

### Recommended: Option B (Multi-Tenant)

Most SaaS apps use multi-tenant with Row Level Security for data isolation. Reserve Option C for customers who specifically require dedicated infrastructure.

---

## 5. Multi-Tenant SSO Design

### Domain-Based Routing

```
┌─────────────────────────────────────────────────────────────┐
│                   SSO Login Flow                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User enters email: alice@acme.com                          │
│              │                                               │
│              ▼                                               │
│  Extract domain: acme.com                                   │
│              │                                               │
│              ▼                                               │
│  Query: SELECT * FROM organizations                         │
│         WHERE sso_domain = 'acme.com'                       │
│              │                                               │
│              ├─→ Found: Redirect to Okta                    │
│              │                                               │
│              └─→ Not found: Show regular sign-in options    │
│                  (Google, GitHub, Email)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Organization-Based Access Control

```
┌─────────────────────────────────────────────────────────────┐
│                Organization Hierarchy                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Organization: Acme Corp                                    │
│  ├── SSO Provider: Okta                                    │
│  ├── Domains: acme.com, acme.io                            │
│  ├── Members: (auto-provisioned via SSO)                   │
│  │   ├── alice@acme.com (admin)                            │
│  │   ├── bob@acme.com (member)                             │
│  │   └── carol@acme.com (member)                           │
│  │                                                          │
│  ├── Workspaces: (org-scoped)                              │
│  │   ├── Acme Design System                                │
│  │   └── Acme API Patterns                                 │
│  │                                                          │
│  └── Projects: (org-scoped)                                │
│      ├── acme-frontend                                     │
│      └── acme-backend                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Model

```sql
-- Organizations (enterprise customers)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,          -- acme, bigcorp, etc.

  -- SSO configuration
  sso_enabled BOOLEAN DEFAULT FALSE,
  sso_provider_id TEXT,               -- Supabase SSO provider ID
  sso_domains TEXT[] DEFAULT '{}',    -- Verified domains
  sso_enforced BOOLEAN DEFAULT FALSE, -- Require SSO (no password)

  -- Settings
  default_member_role TEXT DEFAULT 'member',
  auto_join_workspaces UUID[],        -- Auto-add new members

  -- Billing
  plan TEXT DEFAULT 'free',           -- free, team, enterprise
  stripe_customer_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members
CREATE TABLE organization_members (
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member
  joined_via TEXT,                     -- 'sso', 'invite', 'domain'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

-- SSO domain verification
CREATE TABLE sso_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT FALSE,
  verification_method TEXT,           -- 'dns', 'email', 'manual'
  verification_token TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SSO provider configurations
CREATE TABLE sso_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL,        -- 'saml', 'oidc'

  -- SAML config
  saml_entity_id TEXT,
  saml_sso_url TEXT,
  saml_certificate TEXT,
  saml_metadata_url TEXT,

  -- OIDC config
  oidc_issuer TEXT,
  oidc_client_id TEXT,
  oidc_client_secret TEXT,

  -- Attribute mapping
  attribute_mapping JSONB DEFAULT '{}',

  -- Supabase provider ID (after registration)
  supabase_provider_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id)
);
```

---

## 6. Implementation Guide

### Step 1: Organization Setup

```typescript
// Admin creates organization for enterprise customer
async function createOrganization(
  name: string,
  slug: string,
  adminEmail: string
): Promise<Organization> {
  // Create org
  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      name,
      slug,
      plan: 'enterprise',
    })
    .select()
    .single();

  if (error) throw error;

  // Add creator as owner (if they exist)
  const { data: adminUser } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', adminEmail)
    .single();

  if (adminUser) {
    await supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: adminUser.id,
        role: 'owner',
        joined_via: 'created',
      });
  }

  return org;
}
```

### Step 2: Domain Verification

Before enabling SSO for a domain, verify the customer owns it.

```typescript
// Generate domain verification token
async function initiateDomainVerification(
  orgId: string,
  domain: string
): Promise<DomainVerification> {
  const verificationToken = crypto.randomUUID();

  const { data, error } = await supabase
    .from('sso_domains')
    .insert({
      organization_id: orgId,
      domain,
      verification_method: 'dns',
      verification_token: verificationToken,
      verified: false,
    })
    .select()
    .single();

  if (error) throw error;

  // Return instructions for DNS verification
  return {
    domain,
    verificationType: 'TXT',
    recordName: `_bluekit-verification.${domain}`,
    recordValue: verificationToken,
    instructions: `Add a TXT record to your DNS:
      Name: _bluekit-verification
      Value: ${verificationToken}`,
  };
}

// Check if domain is verified
async function checkDomainVerification(domainId: string): Promise<boolean> {
  const { data: domain } = await supabase
    .from('sso_domains')
    .select()
    .eq('id', domainId)
    .single();

  if (!domain) throw new Error('Domain not found');

  // Query DNS for verification record
  const records = await resolveTxt(`_bluekit-verification.${domain.domain}`);
  const isVerified = records.some(r => r.includes(domain.verification_token));

  if (isVerified) {
    await supabase
      .from('sso_domains')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', domainId);
  }

  return isVerified;
}
```

### Step 3: Configure SSO Provider

```typescript
// Configure SAML provider for organization
async function configureSAMLProvider(
  orgId: string,
  config: {
    metadataUrl?: string;
    entityId?: string;
    ssoUrl?: string;
    certificate?: string;
  }
): Promise<SSOProvider> {
  // Get verified domains for this org
  const { data: domains } = await supabase
    .from('sso_domains')
    .select('domain')
    .eq('organization_id', orgId)
    .eq('verified', true);

  if (!domains?.length) {
    throw new Error('No verified domains. Verify domain first.');
  }

  // Register with Supabase
  const { data: supabaseProvider, error: supabaseError } =
    await supabase.auth.admin.createSSOProvider({
      type: 'saml',
      metadata_url: config.metadataUrl,
      metadata_xml: config.metadataUrl ? undefined : buildMetadataXml(config),
      domains: domains.map(d => d.domain),
      attribute_mapping: {
        keys: {
          email: { name: 'email', default: '' },
          name: { name: 'displayName', default: '' },
        },
      },
    });

  if (supabaseError) throw supabaseError;

  // Save config in our database
  const { data: provider, error } = await supabase
    .from('sso_providers')
    .upsert({
      organization_id: orgId,
      provider_type: 'saml',
      saml_metadata_url: config.metadataUrl,
      saml_entity_id: config.entityId,
      saml_sso_url: config.ssoUrl,
      saml_certificate: config.certificate,
      supabase_provider_id: supabaseProvider.id,
    })
    .select()
    .single();

  if (error) throw error;

  // Enable SSO on organization
  await supabase
    .from('organizations')
    .update({
      sso_enabled: true,
      sso_provider_id: supabaseProvider.id,
      sso_domains: domains.map(d => d.domain),
    })
    .eq('id', orgId);

  return provider;
}
```

### Step 4: SSO Sign-In

```typescript
// Frontend: Handle SSO sign-in
async function signInWithSSO(email: string): Promise<void> {
  const domain = email.split('@')[1];

  // Check if domain has SSO configured
  const { data: org } = await supabase
    .from('organizations')
    .select('id, sso_enabled, sso_enforced')
    .contains('sso_domains', [domain])
    .single();

  if (!org?.sso_enabled) {
    // No SSO for this domain, use regular auth
    throw new Error('SSO not configured for this domain');
  }

  // Initiate SSO flow
  const { data, error } = await supabase.auth.signInWithSSO({
    domain: domain,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;

  if (data?.url) {
    window.location.href = data.url;
  }
}

// After SSO callback, auto-join organization
async function handleSSOCallback(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return;

  const domain = user.email?.split('@')[1];

  // Find org for this domain
  const { data: org } = await supabase
    .from('organizations')
    .select('id, default_member_role, auto_join_workspaces')
    .contains('sso_domains', [domain])
    .single();

  if (!org) return;

  // Auto-join org if not already member
  const { data: existingMember } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .single();

  if (!existingMember) {
    // JIT provisioning: add user to org
    await supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: org.default_member_role,
        joined_via: 'sso',
      });

    // Auto-join default workspaces
    if (org.auto_join_workspaces?.length) {
      for (const workspaceId of org.auto_join_workspaces) {
        await supabase
          .from('workspace_members')
          .insert({
            workspace_id: workspaceId,
            user_id: user.id,
            role: 'viewer',
          });
      }
    }
  }
}
```

### Step 5: SSO Enforcement

```typescript
// Check if user must use SSO
async function checkSSORequirement(email: string): Promise<{
  requiresSSO: boolean;
  ssoUrl?: string;
}> {
  const domain = email.split('@')[1];

  const { data: org } = await supabase
    .from('organizations')
    .select('sso_enabled, sso_enforced')
    .contains('sso_domains', [domain])
    .single();

  if (org?.sso_enforced) {
    const { data } = await supabase.auth.signInWithSSO({
      domain: domain,
    });

    return {
      requiresSSO: true,
      ssoUrl: data?.url,
    };
  }

  return { requiresSSO: false };
}

// Frontend: Sign-in form with SSO check
function SignInForm() {
  const [email, setEmail] = useState('');
  const [ssoRequired, setSsoRequired] = useState(false);

  const handleEmailBlur = async () => {
    if (email.includes('@')) {
      const { requiresSSO, ssoUrl } = await checkSSORequirement(email);

      if (requiresSSO) {
        setSsoRequired(true);
        // Optionally auto-redirect
        // window.location.href = ssoUrl;
      }
    }
  };

  return (
    <form>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onBlur={handleEmailBlur}
      />

      {ssoRequired ? (
        <div>
          <p>Your organization requires SSO sign-in</p>
          <button onClick={() => signInWithSSO(email)}>
            Sign in with SSO
          </button>
        </div>
      ) : (
        <>
          <input type="password" />
          <button type="submit">Sign In</button>
        </>
      )}
    </form>
  );
}
```

---

## 7. Identity Provider Configurations

### Okta Configuration

**In Okta Admin Console:**

1. Applications → Create App Integration
2. Select SAML 2.0
3. Configure:
   - Single sign-on URL: `https://<project>.supabase.co/auth/v1/sso/saml/acs`
   - Audience URI: `https://<project>.supabase.co/auth/v1/sso/saml`
   - Name ID format: EmailAddress
   - Attribute statements:
     - email → user.email
     - firstName → user.firstName
     - lastName → user.lastName

**Export metadata URL:**
```
https://acme.okta.com/app/<app-id>/sso/saml/metadata
```

### Azure AD Configuration

**In Azure Portal:**

1. Enterprise Applications → New Application
2. Create your own application → Non-gallery
3. Set up single sign-on → SAML
4. Configure:
   - Identifier (Entity ID): `https://<project>.supabase.co/auth/v1/sso/saml`
   - Reply URL (ACS): `https://<project>.supabase.co/auth/v1/sso/saml/acs`
   - Sign-on URL: Your BlueKit login URL
5. Attributes & Claims:
   - email → user.mail
   - name → user.displayname

**Download metadata:**
- Federation Metadata XML link

### Google Workspace Configuration

**In Google Admin Console:**

1. Apps → Web and mobile apps → Add app → Add custom SAML app
2. Configure:
   - ACS URL: `https://<project>.supabase.co/auth/v1/sso/saml/acs`
   - Entity ID: `https://<project>.supabase.co/auth/v1/sso/saml`
   - Name ID format: EMAIL
3. Attribute mapping:
   - Primary email → email
   - First name → firstName
   - Last name → lastName

**Download metadata:**
- Download IdP metadata

### Generic OIDC Configuration

For OIDC providers:

```typescript
const oidcConfig = {
  issuer: 'https://auth.example.com',
  authorization_endpoint: 'https://auth.example.com/authorize',
  token_endpoint: 'https://auth.example.com/oauth/token',
  userinfo_endpoint: 'https://auth.example.com/userinfo',
  client_id: 'bluekit-client-id',
  client_secret: 'bluekit-client-secret',
  scopes: ['openid', 'email', 'profile'],
};
```

---

## 8. User Provisioning (SCIM)

### What is SCIM?

**SCIM (System for Cross-domain Identity Management):** Standard protocol for automatic user provisioning and deprovisioning.

**Without SCIM:**
- User leaves company → IT manually disables accounts in 50 apps
- New employee → IT manually creates accounts in 50 apps

**With SCIM:**
- User leaves company → IdP automatically disables all connected apps
- New employee → IdP automatically provisions accounts

### SCIM Support in Supabase

As of 2025, Supabase doesn't have native SCIM support. Options:

**Option A: JIT Provisioning (Recommended)**
- Users created automatically on first SSO login
- Users deactivated if SSO session invalid
- Simpler, works today

**Option B: Build SCIM Endpoint**
- Build `/scim/v2/Users` endpoint
- Handle CREATE, UPDATE, DELETE operations
- Complex but full lifecycle management

### JIT Provisioning Implementation

```typescript
// On SSO callback, provision user
async function jitProvisionUser(ssoUser: SSOUser): Promise<User> {
  const domain = ssoUser.email.split('@')[1];

  // Find organization
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .contains('sso_domains', [domain])
    .single();

  if (!org) {
    throw new Error('Organization not found for domain');
  }

  // Check if user exists
  let { data: existingUser } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', ssoUser.email)
    .single();

  if (!existingUser) {
    // Create user profile
    const { data: newUser, error } = await supabase
      .from('user_profiles')
      .insert({
        id: ssoUser.id, // Supabase auth user ID
        email: ssoUser.email,
        display_name: ssoUser.name,
        avatar_url: ssoUser.avatar,
      })
      .select()
      .single();

    if (error) throw error;
    existingUser = newUser;
  }

  // Ensure org membership
  await supabase
    .from('organization_members')
    .upsert({
      organization_id: org.id,
      user_id: existingUser.id,
      role: org.default_member_role,
      joined_via: 'sso',
    });

  // Sync group memberships (if IdP sends groups)
  if (ssoUser.groups) {
    await syncGroupMemberships(org.id, existingUser.id, ssoUser.groups);
  }

  return existingUser;
}
```

### Deprovisioning Strategy

```typescript
// Periodic check for inactive SSO users
async function auditSSOUsers(): Promise<void> {
  // Get all SSO-provisioned users
  const { data: ssoUsers } = await supabase
    .from('organization_members')
    .select(`
      user_id,
      organization_id,
      organizations!inner(sso_provider_id)
    `)
    .eq('joined_via', 'sso');

  for (const member of ssoUsers) {
    // Check last auth session
    const { data: sessions } = await supabase.auth.admin.listUserSessions(
      member.user_id
    );

    const lastSession = sessions?.[0];
    const daysSinceLastAuth = lastSession
      ? (Date.now() - new Date(lastSession.created_at).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    // If no auth in 30 days, deactivate
    if (daysSinceLastAuth > 30) {
      await deactivateUser(member.user_id, member.organization_id);
    }
  }
}

async function deactivateUser(userId: string, orgId: string): Promise<void> {
  // Remove from org (soft delete - keep user account)
  await supabase
    .from('organization_members')
    .update({ deactivated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('organization_id', orgId);

  // Remove from all org workspaces
  await supabase
    .from('workspace_members')
    .delete()
    .eq('user_id', userId)
    .in('workspace_id', (
      await supabase
        .from('workspaces')
        .select('id')
        .eq('organization_id', orgId)
    ).data?.map(w => w.id) || []);
}
```

---

## 9. Domain Verification

### Why Verify Domains?

Prevent malicious actors from claiming domains they don't own:
- Attacker claims "google.com" → All @google.com users routed to attacker's IdP
- Domain verification ensures only domain owners can configure SSO

### Verification Methods

**Method 1: DNS TXT Record (Most Common)**

```
Add TXT record:
Host: _bluekit-verification.acme.com
Value: bluekit-verify=abc123def456
```

**Method 2: DNS CNAME Record**

```
Add CNAME record:
Host: _bluekit.acme.com
Value: verify.bluekit.app
```

**Method 3: Email to Domain Admin**

```
Send verification email to:
- admin@acme.com
- webmaster@acme.com
- postmaster@acme.com
```

**Method 4: File Upload (Fallback)**

```
Upload file to:
https://acme.com/.well-known/bluekit-verification.txt

Content: bluekit-verify=abc123def456
```

### Verification UI

```
┌─────────────────────────────────────────────────────────────┐
│ Verify Domain: acme.com                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ To verify ownership of acme.com, add this DNS record:       │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Type: TXT                                                │ │
│ │ Host: _bluekit-verification                             │ │
│ │ Value: bluekit-verify=abc123-def456-ghi789              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ DNS changes can take up to 48 hours to propagate.           │
│                                                              │
│ [Check Verification Status]                                 │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Alternative methods:                                        │
│ • [Verify via email] Send code to admin@acme.com           │
│ • [Verify via file] Upload verification file               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Organization Management

### Organization Admin Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ Organization Settings: Acme Corp                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [General] [SSO] [Members] [Domains] [Security] [Billing]    │
│            ═══                                               │
│                                                              │
│ Single Sign-On                                               │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ SSO Status: ● Enabled                                    │ │
│ │                                                          │ │
│ │ Provider: Okta                                          │ │
│ │ Domains: acme.com, acme.io                              │ │
│ │ Members via SSO: 127                                    │ │
│ │                                                          │ │
│ │ [Configure SSO] [Test Connection] [Disable SSO]        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ SSO Enforcement                                              │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ☑️ Require SSO for all members                           │ │
│ │                                                          │ │
│ │ When enabled, users with @acme.com email can only      │ │
│ │ sign in via SSO. Password/social login disabled.       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Default Role for New Members                                 │
│                                                              │
│ [Member ▼]  • Viewer  • Member  • Admin                     │
│                                                              │
│ Auto-Join Workspaces                                         │
│                                                              │
│ New members automatically added to:                          │
│ ☑️ Acme Design System                                       │
│ ☑️ Acme Engineering Patterns                                │
│ ☐ Acme Experimental                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Members Management

```
┌─────────────────────────────────────────────────────────────┐
│ Organization Members                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Search members...                    ] [Invite Member]     │
│                                                              │
│ 127 members • 3 admins • 124 members                        │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 👤 Alice Johnson          alice@acme.com                 │ │
│ │    Admin • Joined via SSO • Active 2 hours ago          │ │
│ │    [Change Role ▼] [Remove]                             │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 👤 Bob Smith              bob@acme.com                   │ │
│ │    Member • Joined via SSO • Active 1 day ago           │ │
│ │    [Change Role ▼] [Remove]                             │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 👤 Carol Davis            carol@acme.io                  │ │
│ │    Member • Joined via invite • Active 3 days ago       │ │
│ │    [Change Role ▼] [Remove]                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Load More]                                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Security & Compliance

### Audit Logging

```sql
-- Audit log for SSO events
CREATE TABLE sso_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  event_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event types:
-- sso_login_success
-- sso_login_failure
-- sso_config_updated
-- sso_domain_verified
-- sso_user_provisioned
-- sso_user_deprovisioned
```

### Compliance Features

| Requirement | Implementation |
|-------------|----------------|
| **SOC 2** | Audit logging, access controls |
| **GDPR** | Data export, deletion workflows |
| **HIPAA** | Encryption, access logs |
| **ISO 27001** | Security policies, incident response |

### Security Best Practices

1. **Certificate Pinning:** Validate IdP certificates
2. **Replay Prevention:** Check assertion timestamps
3. **Signature Validation:** Always verify SAML signatures
4. **Session Management:** Short-lived sessions, secure cookies
5. **Logging:** Log all SSO events for audit

```typescript
// Validate SAML assertion
function validateSAMLAssertion(assertion: SAMLAssertion): void {
  // Check timestamp (prevent replay attacks)
  const now = Date.now();
  const notBefore = new Date(assertion.conditions.notBefore).getTime();
  const notOnOrAfter = new Date(assertion.conditions.notOnOrAfter).getTime();

  if (now < notBefore || now >= notOnOrAfter) {
    throw new Error('Assertion outside valid time window');
  }

  // Verify signature
  const isValid = verifyXMLSignature(
    assertion.raw,
    assertion.signature,
    getIdPCertificate(assertion.issuer)
  );

  if (!isValid) {
    throw new Error('Invalid assertion signature');
  }

  // Check audience
  if (assertion.audience !== BLUEKIT_ENTITY_ID) {
    throw new Error('Invalid audience');
  }
}
```

---

## 12. Pricing Considerations

### Supabase SSO Pricing

| Plan | SSO Support | Price |
|------|-------------|-------|
| **Free** | No | $0 |
| **Pro** | Yes (SAML) | $25/month + usage |
| **Team** | Yes (SAML) | $599/month |
| **Enterprise** | Yes (SAML + custom) | Custom |

### BlueKit Pricing Strategy

**Recommendation:** Bundle SSO with enterprise tier

| BlueKit Tier | SSO | Price |
|--------------|-----|-------|
| **Free** | No | $0 |
| **Pro** | No | $10/user/month |
| **Team** | No | $15/user/month |
| **Enterprise** | Yes (SAML + OIDC) | $25/user/month |

**Why gate SSO to Enterprise?**
- SSO is primarily an enterprise requirement
- Enterprises have budget for paid plans
- SSO adds operational complexity (support)
- Industry standard (Slack, Notion, Linear all do this)

### Cost of Multi-Tenant SSO

With Supabase:
- Base: $25-599/month depending on plan
- Per SSO provider: No additional cost
- Per user: Standard auth pricing

**Bottom line:** SSO doesn't significantly increase costs if you're already on Pro/Team plan.

---

## 13. Implementation Phases

### Phase 1: Foundation (2-3 weeks)

- [ ] Add organizations table and schema
- [ ] Create organization management UI (admin)
- [ ] Implement domain verification (DNS)
- [ ] Build SSO configuration forms

### Phase 2: SAML Support (2-3 weeks)

- [ ] Integrate with Supabase SSO API
- [ ] Build SSO sign-in flow
- [ ] Implement JIT provisioning
- [ ] Test with Okta, Azure AD, Google Workspace
- [ ] Add SSO settings to org admin dashboard

### Phase 3: OIDC Support (1-2 weeks)

- [ ] Add OIDC provider configuration
- [ ] Implement OIDC sign-in flow
- [ ] Test with Auth0, custom OIDC providers

### Phase 4: Advanced Features (2-3 weeks)

- [ ] SSO enforcement per organization
- [ ] Group-based role mapping
- [ ] Auto-join workspaces on SSO
- [ ] Audit logging for SSO events
- [ ] Admin dashboard for SSO analytics

### Phase 5: SCIM (Optional, 3-4 weeks)

- [ ] Build SCIM 2.0 endpoint
- [ ] Implement user provisioning
- [ ] Implement user deprovisioning
- [ ] Test with Okta SCIM integration
- [ ] Documentation for IT admins

---

## Summary

### What We're Building

1. **Multi-tenant SSO** - Each enterprise customer configures their IdP
2. **SAML 2.0** - Support Okta, Azure AD, Google Workspace, etc.
3. **OIDC** - Support modern identity providers
4. **Domain verification** - Secure domain ownership before SSO
5. **JIT provisioning** - Auto-create users on first SSO login
6. **Organization management** - Admins control SSO settings

### What Supabase Provides

- SAML Service Provider implementation
- Multi-provider support
- Attribute mapping
- Session management
- Most of the heavy lifting

### What We Build

- Organization/tenant management
- Domain verification
- Admin configuration UI
- JIT provisioning logic
- Integration with our data model

### Enterprise Requirements Met

| Requirement | Solution |
|-------------|----------|
| "Use our Okta" | SAML integration |
| "Use our Azure AD" | SAML/OIDC integration |
| "Verify domain ownership" | DNS/email verification |
| "Auto-provision users" | JIT provisioning |
| "Auto-deprovision users" | Session monitoring + deactivation |
| "Require SSO only" | SSO enforcement flag |
| "Audit who logged in" | SSO audit log |
| "Map groups to roles" | Attribute mapping |

This positions BlueKit for enterprise sales with proper SSO support that IT teams expect.
