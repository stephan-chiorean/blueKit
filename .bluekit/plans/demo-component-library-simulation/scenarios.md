---
title: Real-World SaaS Scenarios - Kit Combination Patterns
created: 2025-12-23
purpose: Demonstrate how kits combine to build complex applications
focus: Foundational layers + building blocks architecture
---

# Kit Combination Scenarios for Complex SaaS Applications

This document outlines 15 real-world scenarios showing how kits combine to create production-ready SaaS applications. Each scenario demonstrates the workflow: **Library → Select Kits → Pull to Project → Generate**.

---

## Kit Architecture Principles

### Foundational Layer Kits (Infrastructure)
These kits must be applied first as they establish core infrastructure:
- Database setup & migrations
- Authentication system
- API architecture
- Cloud infrastructure
- CI/CD pipelines
- Monitoring & logging

### Middleware Layer Kits (Services)
Built on foundations, provide reusable services:
- Caching strategies
- Background job processing
- WebSocket servers
- File upload systems
- Email/SMS services

### Feature Layer Kits (Components)
User-facing features that consume middleware:
- UI components
- Workflows
- Business logic patterns
- Integrations

### Cross-Cutting Kits
Applied at any layer:
- Security patterns
- Testing strategies
- Performance optimizations

---

## Scenario 1: Multi-Tenant SaaS with Stripe Billing

**Use Case**: B2B project management tool with team workspaces and subscription billing

### Selected Kits (18 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries
2. Database Migration System
3. Multi-Tenant Database Design
4. JWT Authentication System
5. RBAC (Role-Based Access Control)
6. RESTful API Design Pattern
7. Terraform AWS Infrastructure

**Middleware Layer:**
8. Redis Caching Patterns
9. Background Job Processing
10. WebSocket Server Architecture
11. File Upload System (S3)
12. SendGrid Email Service

**Feature Layer:**
13. Stripe Checkout Integration
14. Stripe Subscription Management
15. Stripe Webhook Handling
16. Advanced Data Table
17. Multi-Step Form Wizard
18. Real-Time WebSocket Sync

### Generation Flow

```
1. Pull all 18 kits into new project "project-manager-saas"

2. Generate in order:
   - Database schema with tenant isolation (kit #3)
   - Auth system with JWT + RBAC (kits #4, #5)
   - API layer with tenant context (kit #6)
   - Infrastructure (Terraform for AWS RDS, S3, ElastiCache)
   - Stripe subscription logic (kits #13, #14, #15)
   - Real-time collaboration (kits #10, #18)
   - File uploads for attachments (kit #11)
   - UI components (kits #16, #17)

3. Result: Full multi-tenant SaaS with:
   - Workspace isolation
   - User authentication with team roles
   - Subscription billing with Stripe
   - Real-time project updates
   - File attachments
   - Background jobs for notifications
```

**Kit Compatibility Notes:**
- Multi-Tenant DB Design provides `tenantId` context used by all feature kits
- RBAC integrates with JWT for token claims
- WebSocket sync uses Redis for pub/sub across instances
- All feature kits assume JWT middleware is present

---

## Scenario 2: Collaborative Document Editor (Google Docs Clone)

**Use Case**: Real-time collaborative text editor with version history and sharing

### Selected Kits (16 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries (for document storage)
2. Database Migration System
3. OAuth 2.0 Implementation (Google login)
4. Session Management
5. tRPC End-to-End Type Safety
6. Kubernetes Deployment

**Middleware Layer:**
7. Real-Time WebSocket Sync
8. Redis Caching Patterns
9. Event-Driven Architecture
10. AWS S3 File Management (document exports)

**Feature Layer:**
11. Rich Text Editor
12. Optimistic Update Patterns
13. Accessible Modal System (share dialog)
14. Command Palette (CMD+K for actions)
15. Toast Notification System
16. Presence tracking (via WebSocket Sync)

### Generation Flow

```
1. Pull kits into "collab-docs"

2. Generate:
   - tRPC API with document CRUD (kit #5)
   - OAuth login flow (kit #3)
   - WebSocket server with operational transformation (kit #7)
   - Rich text editor with collaboration (kit #11)
   - Optimistic updates for instant feedback (kit #12)
   - Document export to S3 (kit #10)
   - Command palette for document actions (kit #14)

3. Result: Collaborative editor with:
   - Real-time cursor positions and typing
   - Conflict-free merging (OT)
   - Version history
   - Export to PDF/Markdown
   - Share permissions
```

**Kit Compatibility:**
- Rich Text Editor + Real-Time WebSocket Sync = pre-configured integration
- Optimistic Update Patterns works with tRPC mutations
- Command Palette pre-wired to common document actions
- Presence tracking is built into WebSocket Sync kit

---

## Scenario 3: E-Commerce Marketplace Platform

**Use Case**: Multi-vendor marketplace with product listings, cart, checkout

### Selected Kits (22 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries
2. Database Migration System
3. Multi-Tenant Database Design (vendors as tenants)
4. JWT Authentication System
5. ABAC (Attribute-Based Access Control)
6. GraphQL Server Setup
7. AWS RDS Setup
8. Terraform AWS Infrastructure

**Middleware Layer:**
9. Redis Caching Patterns
10. CDN Integration (CloudFront)
11. Image Optimization System
12. Background Job Processing
13. AWS SQS/SNS Messaging
14. SendGrid Email Service
15. Twilio SMS Integration

**Feature Layer:**
16. Stripe Checkout Integration
17. Multi-Currency Payment
18. Advanced Data Table (product admin)
19. File Upload System (product images)
20. Infinite Scroll with React Query (product listings)
21. Multi-Step Form Wizard (vendor onboarding)
22. Toast Notification System

### Generation Flow

```
1. Pull all kits into "marketplace-platform"

2. Generate:
   - Multi-tenant schema (vendors, products, orders)
   - GraphQL API with vendor context
   - Product image uploads with CDN (kits #11, #19)
   - Shopping cart with Redis session (kit #9)
   - Checkout with Stripe + multi-currency (kits #16, #17)
   - Order processing background jobs (kit #12)
   - Email/SMS notifications (kits #14, #15)
   - Vendor dashboard with data tables (kit #18)

3. Result: Full marketplace with:
   - Vendor stores
   - Product catalog with search
   - Shopping cart
   - Multi-currency checkout
   - Order management
   - Automated notifications
```

**Kit Compatibility:**
- GraphQL Server + ABAC = field-level permissions
- Image Optimization + CDN = automatic pipeline
- Background Jobs + SQS = distributed queue
- Multi-Tenant DB provides vendor isolation for all features

---

## Scenario 4: Real-Time Analytics Dashboard Platform

**Use Case**: Business intelligence platform with live data visualization and alerts

### Selected Kits (17 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries (time-series data)
2. Database Read Replicas
3. Query Optimization Patterns
4. JWT Authentication System
5. RBAC (Role-Based Access Control)
6. RESTful API Design Pattern

**Middleware Layer:**
7. Redis Caching Patterns
8. Server-Sent Events (SSE)
9. Background Job Processing
10. Prometheus Metrics
11. Grafana Dashboards

**Feature Layer:**
12. Interactive Charts Library
13. Real-Time WebSocket Sync
14. Advanced Data Table
15. Command Palette
16. Toast Notification System
17. Virtualized Tree View (dimension hierarchies)

### Generation Flow

```
1. Pull kits into "analytics-platform"

2. Generate:
   - Time-series data schema with partitioning (kit #1)
   - Read replicas for query load (kit #2)
   - API with cached aggregations (kits #6, #7)
   - SSE for live metric streaming (kit #8)
   - Chart components with real-time updates (kit #12)
   - Alert system via background jobs (kit #9)
   - Prometheus + Grafana for system metrics (kits #10, #11)

3. Result: Analytics platform with:
   - Real-time dashboards
   - Custom metrics
   - Alerts and notifications
   - Historical data analysis
   - Performance monitoring
```

**Kit Compatibility:**
- Interactive Charts + SSE = auto-updating visualizations
- Redis Caching + Query Optimization = sub-second queries
- Background Jobs handles metric aggregation
- Command Palette for quick dashboard actions

---

## Scenario 5: Customer Support Ticketing System

**Use Case**: Help desk with tickets, live chat, knowledge base, and SLA tracking

### Selected Kits (19 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries
2. Database Migration System
3. Multi-Factor Authentication
4. RBAC (Role-Based Access Control)
5. tRPC End-to-End Type Safety
6. Kubernetes Deployment

**Middleware Layer:**
7. WebSocket Server Architecture
8. Redis Caching Patterns
9. Background Job Processing
10. SendGrid Email Service
11. Slack Bot Integration
12. Full-Text Search (PostgreSQL)

**Feature Layer:**
13. AI Chat Interface (support bot)
14. Rich Text Editor (ticket responses)
15. Kanban Board (ticket pipeline)
16. File Upload System (attachments)
17. Advanced Data Table (ticket list)
18. Real-Time WebSocket Sync (chat)
19. Toast Notification System

### Generation Flow

```
1. Pull kits into "support-desk"

2. Generate:
   - Ticket schema with SLA tracking (kit #1)
   - tRPC API for tickets/chat (kit #5)
   - WebSocket for live chat (kits #7, #18)
   - AI chatbot for common questions (kit #13)
   - Knowledge base with full-text search (kit #12)
   - Email integration for ticket creation (kit #10)
   - Slack notifications for agent alerts (kit #11)
   - Kanban view for ticket workflow (kit #15)

3. Result: Support system with:
   - Ticket management
   - Live chat with agents
   - AI-powered responses
   - SLA tracking
   - Knowledge base
   - Multi-channel support
```

**Kit Compatibility:**
- AI Chat Interface + WebSocket Sync = real-time AI responses
- Kanban Board uses Real-Time Sync for live updates
- Background Jobs for SLA breach alerts
- Rich Text Editor for formatted responses

---

## Scenario 6: Video Streaming Platform

**Use Case**: Netflix-style platform with video uploads, transcoding, streaming

### Selected Kits (20 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries
2. Database Migration System
3. OAuth 2.0 Implementation
4. JWT Authentication System
5. RESTful API Design Pattern
6. Kubernetes Auto-Scaling
7. Terraform AWS Infrastructure

**Middleware Layer:**
8. AWS S3 File Management (video storage)
9. CDN Integration (CloudFront)
10. Background Job Processing (transcoding)
11. Redis Caching Patterns
12. AWS SQS/SNS Messaging
13. Stripe Subscription Management

**Feature Layer:**
14. File Upload System (multipart for large videos)
15. Infinite Scroll with React Query (video feed)
16. Advanced Animation System (UI transitions)
17. Accessible Modal System (video player)
18. Image Optimization System (thumbnails)
19. Multi-Currency Payment
20. Content Moderation (AI)

### Generation Flow

```
1. Pull kits into "video-platform"

2. Generate:
   - Video metadata schema (kit #1)
   - OAuth + subscription auth (kits #3, #13)
   - S3 multipart upload for videos (kits #8, #14)
   - Background job for transcoding (kit #10)
   - CDN delivery for streaming (kit #9)
   - Video feed with infinite scroll (kit #15)
   - Subscription billing (kits #13, #19)
   - AI content moderation (kit #20)

3. Result: Streaming platform with:
   - Video uploads with progress
   - Automatic transcoding (multiple resolutions)
   - CDN-based streaming
   - Subscription tiers
   - Content moderation
   - Personalized feeds
```

**Kit Compatibility:**
- File Upload System + Background Jobs = upload → transcode pipeline
- CDN Integration pre-configured for S3 origins
- Stripe Subscription enforces access control
- Content Moderation runs as background job

---

## Scenario 7: Social Media Platform

**Use Case**: Twitter/Instagram clone with posts, feeds, messaging, notifications

### Selected Kits (21 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries (graph queries for follows)
2. Database Migration System
3. Multi-Factor Authentication
4. Session Management
5. GraphQL Server Setup
6. Database Read Replicas
7. AWS RDS Setup

**Middleware Layer:**
8. Redis Caching Patterns (feed cache)
9. WebSocket Server Architecture
10. Background Job Processing
11. Image Optimization System
12. CDN Integration
13. Pub/Sub with Redis
14. SendGrid Email Service
15. Twilio SMS Integration

**Feature Layer:**
16. Infinite Scroll with React Query (feed)
17. Real-Time WebSocket Sync (chat)
18. File Upload System (media)
19. Rich Text Editor (posts with mentions)
20. Toast Notification System
21. Optimistic Update Patterns

### Generation Flow

```
1. Pull kits into "social-platform"

2. Generate:
   - User/post/follow schema with graph queries (kit #1)
   - GraphQL API with feed resolvers (kit #5)
   - Feed generation background jobs (kit #10)
   - Redis-cached personalized feeds (kit #8)
   - Image uploads with optimization (kits #11, #18)
   - Real-time messaging (kits #9, #17)
   - Notifications via pub/sub (kit #13)
   - Infinite scroll feed (kit #16)
   - Optimistic likes/follows (kit #21)

3. Result: Social platform with:
   - User profiles and follows
   - Personalized feed algorithm
   - Real-time chat
   - Media posts (images/videos)
   - Notifications
   - Stories (ephemeral content)
```

**Kit Compatibility:**
- GraphQL + Redis Caching = efficient feed queries
- WebSocket + Pub/Sub = real-time notifications
- Optimistic Updates for instant interactions
- Background Jobs for feed generation

---

## Scenario 8: Learning Management System (LMS)

**Use Case**: Online course platform with video lessons, quizzes, progress tracking

### Selected Kits (18 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries
2. Database Migration System
3. Multi-Tenant Database Design (schools as tenants)
4. OAuth 2.0 Implementation (SSO for schools)
5. RBAC (teachers, students, admins)
6. RESTful API Design Pattern

**Middleware Layer:**
7. AWS S3 File Management
8. CDN Integration
9. Background Job Processing
10. Redis Caching Patterns
11. SendGrid Email Service

**Feature Layer:**
12. File Upload System (course materials)
13. Multi-Step Form Wizard (course creation)
14. Calendar & Date Picker (assignment deadlines)
15. Advanced Data Table (gradebook)
16. Interactive Charts Library (progress)
17. Rich Text Editor (assignments)
18. Video player (custom modal)

### Generation Flow

```
1. Pull kits into "lms-platform"

2. Generate:
   - Multi-tenant schema (schools, courses, students)
   - OAuth SSO for school authentication
   - Course content storage in S3
   - Quiz engine with scoring
   - Progress tracking with analytics
   - Gradebook with data tables
   - Assignment submission system
   - Email notifications for deadlines

3. Result: LMS with:
   - Course authoring tools
   - Video lessons with progress tracking
   - Quizzes and assignments
   - Gradebook
   - Student analytics
   - Deadline notifications
```

**Kit Compatibility:**
- Multi-Tenant DB isolates schools
- RBAC defines teacher/student permissions
- Background Jobs for grading automation
- Charts Library shows student progress

---

## Scenario 9: API Marketplace / Developer Platform

**Use Case**: Platform to publish, monetize, and consume APIs (like RapidAPI)

### Selected Kits (20 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries
2. Database Migration System
3. OAuth 2.0 Implementation (developer auth)
4. API Key Management
5. GraphQL Server Setup
6. API Versioning Strategy
7. Kubernetes Deployment

**Middleware Layer:**
8. API Rate Limiting (Redis)
9. Redis Caching Patterns
10. Background Job Processing
11. Prometheus Metrics
12. Distributed Tracing (OpenTelemetry)
13. Stripe Checkout Integration

**Feature Layer:**
14. Advanced Data Table (API analytics)
15. Interactive Charts Library (usage metrics)
16. Command Palette (developer tools)
17. Rich Text Editor (API documentation)
18. Code syntax highlighting
19. Webhook Provider System
20. API Testing Tools

### Generation Flow

```
1. Pull kits into "api-marketplace"

2. Generate:
   - API catalog schema
   - Developer authentication with OAuth
   - API key generation and management
   - Rate limiting per subscription tier
   - Usage analytics and billing
   - API gateway with versioning
   - Documentation generation
   - Testing playground
   - Webhook integrations

3. Result: API marketplace with:
   - API discovery and search
   - API key authentication
   - Usage-based billing
   - Real-time analytics
   - API documentation
   - Testing tools
   - Webhook support
```

**Kit Compatibility:**
- API Key Management + Rate Limiting = tier-based quotas
- Prometheus + Distributed Tracing = API monitoring
- Stripe integration for usage billing
- GraphQL for flexible API catalog queries

---

## Scenario 10: CRM (Customer Relationship Management)

**Use Case**: Sales CRM with leads, deals, pipeline, email integration

### Selected Kits (19 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries
2. Database Migration System
3. Multi-Tenant Database Design (companies)
4. JWT Authentication System
5. RBAC (sales roles)
6. RESTful API Design Pattern

**Middleware Layer:**
7. Redis Caching Patterns
8. Background Job Processing
9. SendGrid Email Service
10. Webhook Consumer Pattern (email tracking)
11. Event-Driven Architecture

**Feature Layer:**
12. Kanban Board (deal pipeline)
13. Advanced Data Table (contacts)
14. Calendar & Date Picker (meetings)
15. Rich Text Editor (email templates)
16. Multi-Step Form Wizard (lead qualification)
17. Interactive Charts Library (sales analytics)
18. Drag & Drop Builder (email templates)
19. Real-Time WebSocket Sync (live updates)

### Generation Flow

```
1. Pull kits into "crm-platform"

2. Generate:
   - CRM schema (contacts, deals, activities)
   - Email integration with tracking
   - Deal pipeline with drag-drop stages
   - Activity timeline
   - Sales automation workflows
   - Email templates
   - Analytics dashboard
   - Team collaboration

3. Result: CRM with:
   - Contact management
   - Deal pipeline visualization
   - Email integration
   - Activity tracking
   - Sales forecasting
   - Team collaboration
```

**Kit Compatibility:**
- Kanban Board + Real-Time Sync = live pipeline updates
- Email Service + Webhook Consumer = email tracking
- Background Jobs for workflow automation
- Event-Driven for activity logging

---

## Scenario 11: Healthcare Patient Portal

**Use Case**: HIPAA-compliant patient portal with appointments, records, telemedicine

### Selected Kits (17 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries
2. Database Migration System
3. Multi-Factor Authentication
4. Data Encryption at Rest
5. Audit Logging System
6. RBAC (patients, doctors, staff)
7. RESTful API Design Pattern

**Middleware Layer:**
8. Redis Caching Patterns
9. AWS S3 File Management (encrypted records)
10. Background Job Processing
11. SendGrid Email Service
12. Twilio SMS Integration (appointment reminders)

**Feature Layer:**
13. Calendar & Date Picker (appointments)
14. File Upload System (medical records)
15. Accessible Modal System (video calls)
16. Multi-Step Form Wizard (intake forms)
17. Advanced Data Table (appointment history)

### Generation Flow

```
1. Pull kits into "patient-portal"

2. Generate:
   - HIPAA-compliant schema with encryption
   - MFA for patient login
   - Appointment scheduling system
   - Encrypted medical record storage
   - Audit logging for all access
   - Telemedicine video calls
   - SMS appointment reminders
   - Patient intake forms

3. Result: Patient portal with:
   - Secure authentication
   - Appointment booking
   - Medical record access
   - Telemedicine video visits
   - Prescription refills
   - Billing and insurance
```

**Kit Compatibility:**
- Data Encryption + Audit Logging = HIPAA compliance
- MFA enforced for all access
- File Upload System uses encrypted S3 buckets
- Calendar integrated with SMS reminders

---

## Scenario 12: Real Estate Listing Platform

**Use Case**: Property listings with search, virtual tours, agent matching

### Selected Kits (18 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries (geospatial)
2. Database Migration System
3. OAuth 2.0 Implementation
4. RBAC (buyers, sellers, agents)
5. GraphQL Server Setup

**Middleware Layer:**
6. Redis Caching Patterns
7. Image Optimization System
8. CDN Integration
9. Background Job Processing
10. SendGrid Email Service
11. Twilio SMS Integration

**Feature Layer:**
12. Advanced Data Table (property admin)
13. Infinite Scroll with React Query (listings)
14. File Upload System (property images)
15. Calendar & Date Picker (showings)
16. Interactive Charts Library (market trends)
17. Map integration (geospatial search)
18. Virtual tour viewer (360° images)

### Generation Flow

```
1. Pull kits into "real-estate-platform"

2. Generate:
   - Property schema with geospatial indexes
   - Advanced search with filters
   - Image gallery with optimization
   - Virtual tour integration
   - Showing scheduler
   - Agent matching algorithm
   - Market analytics
   - Lead capture forms

3. Result: Real estate platform with:
   - Property search with maps
   - Virtual tours
   - Appointment scheduling
   - Agent profiles
   - Market analytics
   - Lead management
```

**Kit Compatibility:**
- PostgreSQL geospatial + Map integration
- Image Optimization for property photos
- Background Jobs for matching algorithms
- GraphQL for flexible search queries

---

## Scenario 13: Recruitment / ATS Platform

**Use Case**: Applicant tracking system with job posts, candidate pipeline, interviews

### Selected Kits (18 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries
2. Database Migration System
3. Multi-Tenant Database Design (companies)
4. JWT Authentication System
5. RBAC (recruiters, hiring managers)
6. RESTful API Design Pattern

**Middleware Layer:**
7. Redis Caching Patterns
8. Background Job Processing
9. AWS S3 File Management (resumes)
10. SendGrid Email Service
11. Calendar integration API

**Feature Layer:**
12. Kanban Board (candidate pipeline)
13. Advanced Data Table (applicants)
14. File Upload System (resume parsing)
15. Multi-Step Form Wizard (job posting)
16. Calendar & Date Picker (interviews)
17. Rich Text Editor (job descriptions)
18. AI-powered resume screening

### Generation Flow

```
1. Pull kits into "ats-platform"

2. Generate:
   - Multi-tenant schema for companies
   - Job posting management
   - Candidate pipeline with stages
   - Resume parsing and storage
   - Interview scheduling
   - Email automation
   - AI resume screening
   - Collaboration tools

3. Result: ATS with:
   - Job posting
   - Candidate sourcing
   - Pipeline management
   - Interview scheduling
   - Team collaboration
   - Analytics
```

**Kit Compatibility:**
- Kanban Board for pipeline stages
- File Upload + Background Jobs = resume parsing
- AI integration for candidate screening
- Calendar for interview scheduling

---

## Scenario 14: Financial Trading Platform

**Use Case**: Stock/crypto trading with real-time prices, portfolios, alerts

### Selected Kits (19 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries (time-series)
2. Database Migration System
3. Multi-Factor Authentication
4. Data Encryption at Rest
5. Audit Logging System
6. RESTful API Design Pattern
7. Kubernetes Auto-Scaling

**Middleware Layer:**
8. WebSocket Server Architecture (price feeds)
9. Redis Caching Patterns (price cache)
10. Background Job Processing
11. Pub/Sub with Redis
12. Prometheus Metrics

**Feature Layer:**
13. Real-Time WebSocket Sync
14. Interactive Charts Library (candlestick charts)
15. Advanced Data Table (transaction history)
16. Toast Notification System (alerts)
17. Optimistic Update Patterns (trades)
18. Multi-Currency Payment
19. KYC verification workflow

### Generation Flow

```
1. Pull kits into "trading-platform"

2. Generate:
   - Time-series price data schema
   - WebSocket price feed integration
   - Order execution engine
   - Portfolio management
   - Real-time chart updates
   - Price alerts system
   - Transaction audit trail
   - KYC compliance

3. Result: Trading platform with:
   - Real-time price feeds
   - Order execution
   - Portfolio tracking
   - Price alerts
   - Transaction history
   - Compliance features
```

**Kit Compatibility:**
- WebSocket + Pub/Sub for price distribution
- Interactive Charts for live price updates
- Optimistic Updates for instant order feedback
- Audit Logging for compliance
- MFA + Encryption for security

---

## Scenario 15: IoT Device Management Platform

**Use Case**: Manage IoT devices with telemetry, commands, firmware updates

### Selected Kits (17 total)

**Foundation Layer:**
1. PostgreSQL Advanced Queries (time-series telemetry)
2. Database Migration System
3. API Key Management (device auth)
4. Event-Driven Architecture
5. RESTful API Design Pattern
6. Kubernetes Deployment

**Middleware Layer:**
7. AWS SQS/SNS Messaging
8. Pub/Sub with Redis
9. Background Job Processing
10. Prometheus Metrics
11. Distributed Tracing

**Feature Layer:**
12. Real-Time WebSocket Sync (device status)
13. Interactive Charts Library (telemetry)
14. Advanced Data Table (device list)
15. Firmware update system
16. Alert rules engine
17. Device provisioning workflow

### Generation Flow

```
1. Pull kits into "iot-platform"

2. Generate:
   - Device registry schema
   - API key authentication for devices
   - Telemetry data ingestion
   - Real-time device status
   - Command dispatch system
   - Firmware OTA updates
   - Alert rules and notifications
   - Analytics dashboard

3. Result: IoT platform with:
   - Device management
   - Real-time telemetry
   - Remote commands
   - Firmware updates
   - Alerting
   - Analytics
```

**Kit Compatibility:**
- API Key Management for device authentication
- Event-Driven for telemetry ingestion
- Background Jobs for firmware updates
- Real-Time Sync for device status
- Prometheus for system metrics

---

## Cross-Scenario Patterns

### Common Foundation Stack (appears in 10+ scenarios)
- PostgreSQL + Migrations
- JWT Authentication
- RBAC
- RESTful API or GraphQL
- Redis Caching
- Background Job Processing

### Common Feature Combos
- **Data Management**: Advanced Data Table + Infinite Scroll
- **Real-Time**: WebSocket Sync + Pub/Sub + Redis
- **File Handling**: File Upload + S3 + Image Optimization + CDN
- **Payments**: Stripe Checkout + Subscription Management + Webhooks
- **Communication**: SendGrid + Twilio + Slack Integration
- **Analytics**: Charts Library + Prometheus + Grafana

### Kit Dependency Patterns

```
Layer 1 (Foundation):
  ├─ Database kits
  ├─ Auth kits
  └─ API framework kits

Layer 2 (Middleware):
  ├─ Caching (requires Database)
  ├─ Background Jobs (requires Database)
  ├─ WebSocket Server (requires Auth)
  └─ Cloud Services (requires Infrastructure)

Layer 3 (Features):
  ├─ UI Components (requires API + Auth)
  ├─ Integrations (requires Background Jobs)
  └─ AI Features (requires API + Background Jobs)
```

---

## Kit Compatibility Matrix

### Must Be Applied Together
- Multi-Tenant Database Design → MUST apply before all feature kits
- JWT Auth → MUST apply before any protected features
- Terraform Infrastructure → MUST apply before cloud-dependent kits

### Work Better Together
- Real-Time WebSocket Sync + Pub/Sub = multi-instance coordination
- File Upload + Image Optimization = automatic pipeline
- Stripe Checkout + Stripe Webhooks = complete payment flow
- Background Jobs + SQS = distributed processing

### Mutually Exclusive
- JWT Auth ⚔️ Session Management (pick one)
- REST API ⚔️ GraphQL ⚔️ tRPC (pick one)
- PostgreSQL ⚔️ MongoDB (pick one - though some use both)

---

## Demo Workflow

### Step 1: Browse Library
- User searches "build SaaS app"
- Sees categories: Foundation, Features, Integrations
- Filters by tags: "authentication", "payments", "real-time"

### Step 2: Select Scenario
- User picks "Scenario 3: E-Commerce Marketplace"
- Sees list of 22 kits required
- Kits are color-coded by layer (Foundation/Middleware/Feature)

### Step 3: Pull to Project
- User creates new project "my-marketplace"
- Selects all 22 kits from scenario
- Clicks "Pull Selected to Project"
- Kits are organized by dependency order

### Step 4: Generate
- User enters project workspace
- Sees generation order suggestion:
  1. Generate foundation (kits 1-8)
  2. Generate middleware (kits 9-15)
  3. Generate features (kits 16-22)
- User clicks "Generate All" or generates individually
- AI reads all kit markdown and generates integrated code

### Step 5: Customize
- User can remove kits they don't need
- Add additional kits from library
- Regenerate affected components
- Full codebase with integrated features ready to deploy

---

## Key Insights for Demo

1. **Layered Architecture**: Show visual representation of Foundation → Middleware → Features
2. **Smart Dependencies**: System suggests required kits when user selects a feature kit
3. **Scenario Templates**: Pre-built scenarios as starting points
4. **Compatibility Badges**: Visual indicators for "works with" relationships
5. **Generation Preview**: Show what will be generated before running
6. **Incremental Generation**: Add features over time, not all at once
