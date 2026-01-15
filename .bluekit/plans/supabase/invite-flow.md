# Project Invite Flow: The Local-First Collaboration Challenge

**Status:** Design Exploration
**Created:** 2026-01-15
**Context:** How do you invite someone to collaborate on a project that exists as local files?

---

## The Core Problem

BlueKit projects are **local-first**: they're directories on your machine with a `.bluekit/` folder. When you "invite someone to a project," what are you actually inviting them to?

```
User A's Machine                    User B's Machine
┌─────────────────────┐            ┌─────────────────────┐
│ ~/projects/my-app   │            │        ???          │
│ ├── src/            │            │                     │
│ ├── .bluekit/       │            │  They don't have    │
│ │   ├── plans/      │            │  the project yet!   │
│ │   └── kits/       │            │                     │
│ └── ...             │            │                     │
└─────────────────────┘            └─────────────────────┘
         │                                   │
         │         Supabase Cloud            │
         │    ┌─────────────────────┐       │
         └───→│  synced_project     │←──────┘
              │  - tasks            │  How does User B
              │  - checkpoints      │  connect to this?
              │  - members          │
              └─────────────────────┘
```

### The Questions

1. **What is User B being invited to?** The cloud metadata? The git repo? The concept of the project?

2. **How does User B get the files?** They need the actual `.bluekit/` content to see plans, kits, etc.

3. **What if User B doesn't have a BlueKit account?** Email invite to a person who's never used the app.

4. **What if the project isn't in git?** Some projects are local-only.

5. **How does User B's local project link to the cloud project?** After they have the files.

---

## Two Core Scenarios

Before diving into edge cases, let's fully map the two primary invite scenarios.

---

## Scenario A: Inviting a Non-User

**Alice invites bob@company.com. Bob has never used BlueKit.**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     INVITING A NON-USER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ALICE (Inviter)                         BOB (Invitee - No Account)     │
│  ══════════════                          ═══════════════════════════    │
│                                                                          │
│  1. Alice opens project "my-app"                                        │
│         │                                                                │
│         ▼                                                                │
│  2. Clicks "Invite" → enters bob@company.com                            │
│         │                                                                │
│         ▼                                                                │
│  3. Supabase creates invite record                                      │
│     (status: 'pending')                                                 │
│         │                                                                │
│         ▼                                                                │
│  4. Email sent to Bob ─────────────────────────────────────────────────▶│
│                                                                          │
│                                          5. Bob receives email           │
│                                             "Alice invited you to        │
│                                              collaborate on my-app"      │
│                                                   │                      │
│                                                   ▼                      │
│                                          6. Bob clicks "Accept Invite"  │
│                                                   │                      │
│                                                   ▼                      │
│                                          7. Lands on bluekit.app/invite │
│                                             ┌─────────────────────────┐ │
│                                             │ Sign up to accept       │ │
│                                             │                         │ │
│                                             │ [Continue with Google]  │ │
│                                             │ [Continue with GitHub]  │ │
│                                             │ [Continue with Email]   │ │
│                                             │                         │ │
│                                             │ Invite: my-app          │ │
│                                             │ From: Alice             │ │
│                                             └─────────────────────────┘ │
│                                                   │                      │
│                                                   ▼                      │
│                                          8. Bob signs up (any method)   │
│                                                   │                      │
│                                                   ▼                      │
│                                          9. Invite auto-accepted        │
│                                             (project_members created)   │
│                                                   │                      │
│                                                   ▼                      │
│                                          10. Redirect to:               │
│                                              ┌─────────────────────────┐│
│                                              │ Has BlueKit Desktop?    ││
│                                              └─────────────────────────┘│
│                                                   │                      │
│                                           ┌──────┴──────┐               │
│                                           │             │               │
│                                          YES            NO              │
│                                           │             │               │
│                                           ▼             ▼               │
│                                      Deep link     Download page        │
│                                      to app        with instructions    │
│                                           │                             │
│                                           ▼                             │
│                                      11. Bob opens BlueKit              │
│                                          Sees "my-app" as pending       │
│                                          project with clone instructions│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Points for Non-User Flow

1. **Email is the only touchpoint** - Bob doesn't have the app, so email must be compelling
2. **Sign-up is friction** - Make it as fast as possible (Google OAuth = 2 clicks)
3. **Invite context preserved** - After sign-up, invite is auto-accepted
4. **Desktop app optional** - Bob gets value even in browser (can see tasks)
5. **Clone instructions clear** - Don't assume Bob knows git

### Email Template for Non-Users

```
Subject: Alice invited you to collaborate on "my-app"

┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  👋 Hey there,                                              │
│                                                              │
│  Alice invited you to collaborate on my-app in BlueKit.     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │  "Hey Bob, join us on the new feature work!"           │ │
│  │                                                         │ │
│  │  Project: my-app                                        │ │
│  │  Your role: Member                                      │ │
│  │  Repository: github.com/team/my-app                     │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────────────────────┐   │ │
│  │  │          [ Accept Invite ]                      │   │ │
│  │  └─────────────────────────────────────────────────┘   │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  What is BlueKit?                                           │
│                                                              │
│  BlueKit helps teams organize code knowledge, track tasks,  │
│  and manage project milestones. Think of it as a shared     │
│  brain for your codebase.                                   │
│                                                              │
│  • 📋 Shared task management                                │
│  • 🏁 Checkpoint pinning for releases                       │
│  • 📝 Documentation that lives with your code              │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  This invite expires in 7 days.                             │
│  Questions? Reply to this email.                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Scenario B: Inviting an Existing User

**Alice invites bob@company.com. Bob already has a BlueKit account.**

This is the smoother flow - but has its own complexity because Bob might:
- Already have the project cloned locally
- Have BlueKit open right now (real-time notification)
- Be on a different machine than usual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     INVITING AN EXISTING USER                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ALICE (Inviter)                         BOB (Existing User)            │
│  ══════════════                          ════════════════════           │
│                                                                          │
│  1. Alice opens project "my-app"                                        │
│         │                                                                │
│         ▼                                                                │
│  2. Clicks "Invite" → types "bob"                                       │
│         │                                                                │
│         ▼                                                                │
│  3. Autocomplete shows:                                                 │
│     ┌─────────────────────────────────────────┐                        │
│     │ 👤 Bob Smith                            │                        │
│     │    bob@company.com                      │ ← Existing user!       │
│     │    Collaborator on 2 other projects    │                        │
│     └─────────────────────────────────────────┘                        │
│         │                                                                │
│         ▼                                                                │
│  4. Alice selects Bob, clicks "Invite"                                  │
│         │                                                                │
│         ▼                                                                │
│  5. Supabase:                                                           │
│     - Creates invite (or skips, adds directly)                          │
│     - Sends real-time event ──────────────────────────────────────────▶│
│     - Also sends email (backup) ──────────────────────────────────────▶│
│                                                                          │
│                                          6. IF Bob has BlueKit open:    │
│                                             ┌─────────────────────────┐ │
│                                             │ 🔔 New Invite           │ │
│                                             │                         │ │
│                                             │ Alice invited you to    │ │
│                                             │ collaborate on my-app   │ │
│                                             │                         │ │
│                                             │ [View] [Accept] [Later] │ │
│                                             └─────────────────────────┘ │
│                                                   │                      │
│                                                   ▼                      │
│                                          7. Bob clicks "Accept"         │
│                                                   │                      │
│                                                   ▼                      │
│                                          8. Check: Does Bob have        │
│                                             this repo locally?          │
│                                                   │                      │
│                                           ┌──────┴──────┐               │
│                                           │             │               │
│                                          YES            NO              │
│                                           │             │               │
│                                           ▼             ▼               │
│                                      Auto-link!    Show as pending     │
│                                      ┌──────────┐  with clone URL      │
│                                      │ ✅ Linked │                      │
│                                      │ to my-app│                      │
│                                      └──────────┘                      │
│                                                                          │
│                                          IF Bob is OFFLINE:             │
│                                          - Email arrives                │
│                                          - Next app open shows invite   │
│                                            in notification center       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Differences from Non-User Flow

| Aspect | Non-User | Existing User |
|--------|----------|---------------|
| **Discovery** | Email only | In-app notification + email |
| **Invite UI** | Must type email | Autocomplete from collaborators |
| **Acceptance** | Requires sign-up | One click |
| **Auto-link** | After clone | Immediate if repo exists |
| **Latency** | Minutes (email) | Seconds (real-time) |

### Real-Time Invite Notification

```typescript
// Subscribe to invites for current user
useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel('user-invites')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'project_invites',
        filter: `invitee_email=eq.${user.email}`,
      },
      async (payload) => {
        const invite = payload.new as ProjectInvite;

        // Fetch project details
        const { data: project } = await supabase
          .from('synced_projects')
          .select('*, invited_by:users(display_name, avatar_url)')
          .eq('id', invite.project_id)
          .single();

        // Show toast notification
        toaster.create({
          title: `${project.invited_by.display_name} invited you`,
          description: `Collaborate on "${project.name}"`,
          type: 'info',
          action: {
            label: 'View',
            onClick: () => openInviteModal(invite),
          },
        });

        // Also add to notification center
        addNotification({
          type: 'invite',
          invite,
          project,
        });
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}, [user]);
```

### Auto-Link Detection for Existing Users

When an existing user accepts an invite, immediately check if they already have the repo:

```typescript
async function handleAcceptInvite(invite: ProjectInvite) {
  // 1. Accept the invite (add to project_members)
  await supabase.rpc('accept_project_invite', {
    p_invite_code: invite.invite_code,
  });

  // 2. Get the cloud project details
  const { data: cloudProject } = await supabase
    .from('synced_projects')
    .select()
    .eq('id', invite.project_id)
    .single();

  // 3. Check local projects for matching git URL
  const localProjects = await invoke<LocalProject[]>('get_all_projects');

  for (const local of localProjects) {
    if (!local.gitUrl) continue;

    const normalizedLocal = normalizeGitUrl(local.gitUrl);
    const normalizedCloud = normalizeGitUrl(cloudProject.github_url);

    if (normalizedLocal === normalizedCloud) {
      // Found it! Auto-link
      await invoke('link_project_to_cloud', {
        localProjectId: local.id,
        cloudProjectId: cloudProject.id,
      });

      toaster.create({
        title: 'Project Linked',
        description: `"${local.name}" is now connected to the team project`,
        type: 'success',
      });

      // Navigate to the project
      navigate(`/project/${local.id}`);
      return;
    }
  }

  // No local match found - show pending state
  toaster.create({
    title: 'Invite Accepted',
    description: 'Clone the repository to see the full project',
    type: 'info',
  });

  // Show pending project UI
  navigate('/projects?pending=' + cloudProject.id);
}
```

---

## Collaborators: Managing People Across Projects

Instead of entering emails every time, maintain a list of people you frequently work with.

### The Collaborators Concept

```
┌─────────────────────────────────────────────────────────────┐
│                        Collaborators                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  People you work with across projects. Add someone once,    │
│  invite them to any project with one click.                 │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 👤 Bob Smith                                            ││
│  │    bob@company.com                                      ││
│  │    ─────────────────────────────────────────────────── ││
│  │    Projects: my-app, design-system, api-gateway        ││
│  │    Added: Jan 10, 2026                                  ││
│  │                                                          ││
│  │    [Invite to Project ▼]  [Remove]                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 👤 Carol Chen                                           ││
│  │    carol@company.com                                    ││
│  │    ─────────────────────────────────────────────────── ││
│  │    Projects: my-app                                     ││
│  │    Added: Jan 12, 2026                                  ││
│  │                                                          ││
│  │    [Invite to Project ▼]  [Remove]                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ + Add Collaborator                                      ││
│  │   Enter email address...                                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### How Collaborators Help

**1. Faster Invites**

Instead of typing an email:
```
┌─────────────────────────────────────────────────────────────┐
│ Invite to my-app                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─ Your Collaborators ─────────────────────────────────────┐│
│ │                                                           ││
│ │ ☐ 👤 Bob Smith (bob@company.com)                        ││
│ │     Already on: design-system, api-gateway               ││
│ │                                                           ││
│ │ ☑ 👤 Carol Chen (carol@company.com)                     ││
│ │     Already on: (none)                                   ││
│ │                                                           ││
│ │ ☐ 👤 Dave Wilson (dave@contractor.io)                   ││
│ │     Already on: my-app ← Already a member               ││
│ │                                                           ││
│ └───────────────────────────────────────────────────────────┘│
│                                                              │
│ Or invite by email:                                          │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ new-person@example.com                                 │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                              │
│ [Send Invites]                                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**2. Cross-Project Visibility**

See who's on what:
```
┌─────────────────────────────────────────────────────────────┐
│ Project: my-app                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Team Members (3)                                             │
│                                                              │
│ 👤 Alice (you)           Owner       ●  Online              │
│ 👤 Bob Smith             Member      ○  Offline             │
│ 👤 Carol Chen            Viewer      ●  Online              │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Quick Add from Collaborators:                                │
│                                                              │
│ 👤 Dave Wilson - not on this project  [+ Add]               │
│ 👤 Eve Adams - not on this project    [+ Add]               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**3. Suggested Collaborators**

When you invite someone new, offer to add them as a collaborator:
```
┌─────────────────────────────────────────────────────────────┐
│ ✅ Invite Sent                                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Invited frank@newcompany.com to my-app                      │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Add Frank as a collaborator?                            │ │
│ │                                                          │ │
│ │ You'll be able to quickly invite them to future         │ │
│ │ projects without typing their email again.              │ │
│ │                                                          │ │
│ │ [Add to Collaborators]  [No thanks]                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Collaborators Data Model

```sql
-- Collaborators: people you work with (not project-specific)
CREATE TABLE user_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who owns this collaborator relationship
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The collaborator (might not have an account yet)
  collaborator_email TEXT NOT NULL,
  collaborator_user_id UUID REFERENCES auth.users(id),  -- Set when they sign up

  -- Display info (for users without accounts)
  display_name TEXT,
  notes TEXT,  -- "Frontend contractor", "Design team", etc.

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique per user
  UNIQUE(user_id, collaborator_email)
);

-- Index for quick lookup
CREATE INDEX idx_collaborators_user ON user_collaborators(user_id);
CREATE INDEX idx_collaborators_email ON user_collaborators(collaborator_email);

-- View: Collaborators with their project memberships
CREATE VIEW collaborator_projects AS
SELECT
  uc.id AS collaborator_id,
  uc.user_id AS owner_id,
  uc.collaborator_email,
  uc.collaborator_user_id,
  uc.display_name,
  COALESCE(up.display_name, uc.display_name, uc.collaborator_email) AS resolved_name,
  up.avatar_url,
  array_agg(DISTINCT sp.id) FILTER (WHERE sp.id IS NOT NULL) AS shared_project_ids,
  array_agg(DISTINCT sp.name) FILTER (WHERE sp.name IS NOT NULL) AS shared_project_names
FROM user_collaborators uc
LEFT JOIN user_profiles up ON up.id = uc.collaborator_user_id
LEFT JOIN project_members pm ON pm.user_id = uc.collaborator_user_id
LEFT JOIN project_members owner_pm ON owner_pm.project_id = pm.project_id
  AND owner_pm.user_id = uc.user_id
LEFT JOIN synced_projects sp ON sp.id = pm.project_id
GROUP BY uc.id, uc.user_id, uc.collaborator_email, uc.collaborator_user_id,
         uc.display_name, up.display_name, up.avatar_url;
```

### Collaborator Sync When User Signs Up

When a non-user signs up, link them to existing collaborator entries:

```typescript
// Trigger: After user signs up
async function onUserCreated(user: User) {
  // Find collaborator entries that reference this email
  const { data: collaboratorEntries } = await supabase
    .from('user_collaborators')
    .select('*')
    .eq('collaborator_email', user.email.toLowerCase())
    .is('collaborator_user_id', null);

  // Link them to the new user
  for (const entry of collaboratorEntries || []) {
    await supabase
      .from('user_collaborators')
      .update({
        collaborator_user_id: user.id,
      })
      .eq('id', entry.id);
  }
}
```

### Auto-Add Collaborators

Automatically add people as collaborators when:
1. You invite them to any project
2. They accept and join a project you're on
3. You're added to a project with them

```typescript
// When sending an invite, auto-add as collaborator
async function sendInvite(projectId: string, email: string, role: string) {
  // Send the invite
  await supabase.from('project_invites').insert({
    project_id: projectId,
    invitee_email: email.toLowerCase(),
    role,
    invite_code: generateInviteCode(),
    invited_by: user.id,
  });

  // Auto-add as collaborator (if not already)
  await supabase.from('user_collaborators').upsert({
    user_id: user.id,
    collaborator_email: email.toLowerCase(),
  }, {
    onConflict: 'user_id,collaborator_email',
    ignoreDuplicates: true,
  });
}
```

---

## Scenario Analysis

### Scenario 1: Git-Connected Project

**Most common case.** User A's project is connected to GitHub.

```
User A: ~/projects/my-app → github.com/team/my-app
User B: Needs to clone github.com/team/my-app
```

**Flow:**
1. User A invites User B (by email)
2. Email contains: invite link + git clone URL
3. User B clicks invite link
4. User B signs up (if new) or logs in
5. User B sees: "Clone this repo to get started"
6. User B clones repo, opens in BlueKit
7. BlueKit detects: "This project matches an invite you accepted"
8. Auto-links local project to cloud project

### Scenario 2: Non-Git Project

**Less common but possible.** User A has a local project with no git.

```
User A: ~/projects/my-app (no git)
User B: How do they get the files???
```

**Options:**
- Share as zip file (manual, bad UX)
- Use Supabase Storage to sync `.bluekit/` folder (complex)
- Require git connection for collaboration (simplest)

**Recommendation:** Require git connection for project collaboration. Local-only projects can use BlueKit but not collaborate.

### Scenario 3: Invitee Doesn't Have BlueKit Account

```
User A invites bob@company.com
Bob has never used BlueKit
```

**Flow:**
1. Bob receives email: "Alice invited you to collaborate on my-app"
2. Email contains:
   - What BlueKit is (brief)
   - What the project is
   - Git clone URL (if available)
   - "Accept Invite" button
3. Bob clicks button → lands on web page (or deep link to app)
4. Bob signs up with Google/GitHub/email
5. Invite auto-accepted, Bob is now a project member
6. Bob sees: "To view this project, clone the repository and open it in BlueKit"

### Scenario 4: Invitee Has Account, Doesn't Have Files

```
Bob has BlueKit, accepts invite
Bob doesn't have ~/projects/my-app locally
```

**What Bob Sees in BlueKit:**

```
┌─────────────────────────────────────────────────────────────┐
│ Projects                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📁 my-app                                    [Pending]  │ │
│ │                                                          │ │
│ │ You've been invited to collaborate on this project.     │ │
│ │                                                          │ │
│ │ To get started:                                          │ │
│ │ 1. Clone the repository:                                │ │
│ │    git clone git@github.com:team/my-app.git            │ │
│ │                                                          │ │
│ │ 2. Open the project in BlueKit                          │ │
│ │                                                          │ │
│ │ [Clone with GitHub] [I already have it] [Dismiss]      │ │
│ │                                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📁 other-project                            [Connected] │ │
│ │ ~/projects/other-project                                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Scenario 5: Invitee Has Files at Different Path

```
User A: ~/projects/my-app
User B: ~/code/client-work/my-app (same repo, different path)
```

**Detection:** Match by git remote URL, not by path.

```typescript
// When User B opens a project
const localGitUrl = await getGitRemoteUrl(projectPath);

// Check if this matches any pending invites
const pendingInvites = await supabase
  .from('project_invites')
  .select('*, synced_projects(*)')
  .eq('invitee_id', user.id)
  .eq('status', 'accepted');

for (const invite of pendingInvites) {
  if (invite.synced_projects.github_url === localGitUrl) {
    // Auto-link!
    await linkLocalToCloud(projectPath, invite.synced_projects.id);
  }
}
```

---

## Proposed Flow

### Step 1: User A Enables Collaboration

Before inviting, User A must enable sync on the project.

```
┌─────────────────────────────────────────────────────────────┐
│ Enable Collaboration                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ To invite teammates, this project needs to be synced        │
│ with BlueKit Cloud.                                          │
│                                                              │
│ This enables:                                                │
│ ✓ Shared tasks and assignments                              │
│ ✓ Synced checkpoints across team                            │
│ ✓ Comments on plans and kits                                │
│ ✓ Activity feed                                             │
│                                                              │
│ ⚠️ Requires: Git connection (for teammates to get files)   │
│                                                              │
│ [Enable Collaboration]                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**What Happens:**
1. Creates `synced_project` record in Supabase
2. Links local project to cloud project (`sync_id` in SQLite)
3. Stores git URL for teammate matching

```sql
INSERT INTO synced_projects (
  name,
  github_owner,
  github_repo,
  github_url,
  created_by
) VALUES (
  'my-app',
  'team',
  'my-app',
  'git@github.com:team/my-app.git',
  auth.uid()
);
```

### Step 2: User A Sends Invite

```
┌─────────────────────────────────────────────────────────────┐
│ Invite to my-app                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Invite by email:                                             │
│ ┌────────────────────────────────────────────────┐          │
│ │ bob@company.com                                 │          │
│ └────────────────────────────────────────────────┘          │
│                                                              │
│ Role: [Member ▼]                                            │
│   • Viewer - Can view tasks and plans                       │
│   • Member - Can edit tasks and create checkpoints          │
│   • Admin  - Can manage members and settings                │
│                                                              │
│ Optional message:                                            │
│ ┌────────────────────────────────────────────────┐          │
│ │ Hey Bob, join us on the new feature work!      │          │
│ └────────────────────────────────────────────────┘          │
│                                                              │
│ [Send Invite]                                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**What Happens:**

```sql
INSERT INTO project_invites (
  project_id,
  invitee_email,
  role,
  message,
  invite_code,
  invited_by,
  expires_at
) VALUES (
  'proj_123',
  'bob@company.com',
  'member',
  'Hey Bob, join us on the new feature work!',
  'inv_abc123xyz',  -- unique code
  auth.uid(),
  NOW() + INTERVAL '7 days'
);
```

### Step 3: Email Sent

**Email Template:**

```
Subject: Alice invited you to collaborate on "my-app" in BlueKit

─────────────────────────────────────────────────────────────

Hey Bob,

Alice invited you to collaborate on my-app in BlueKit.

"Hey Bob, join us on the new feature work!"

┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  Project: my-app                                            │
│  Role: Member                                               │
│  Repository: github.com/team/my-app                         │
│                                                              │
│  [ Accept Invite ]                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘

What is BlueKit?
BlueKit helps teams organize code knowledge, track tasks,
and manage project checkpoints.

─────────────────────────────────────────────────────────────

This invite expires in 7 days.
```

### Step 4: Bob Clicks "Accept Invite"

**Flow Branches:**

```
Bob clicks "Accept Invite"
         │
         ▼
┌─────────────────────┐
│ Has BlueKit account?│
└─────────────────────┘
         │
    ┌────┴────┐
    │         │
   YES        NO
    │         │
    ▼         ▼
┌───────┐  ┌───────────────┐
│ Login │  │ Sign Up Page  │
└───────┘  │ (with invite  │
    │      │  context)     │
    │      └───────────────┘
    │              │
    └──────┬───────┘
           │
           ▼
┌─────────────────────────┐
│ Invite Accepted         │
│ (project_members row    │
│  created)               │
└─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│ Has BlueKit Desktop?    │
└─────────────────────────┘
           │
    ┌──────┴──────┐
    │             │
   YES            NO
    │             │
    ▼             ▼
┌───────────┐  ┌───────────────┐
│ Deep link │  │ Download Page │
│ to app    │  │ + instructions│
└───────────┘  └───────────────┘
```

### Step 5: Bob Opens BlueKit Desktop

**Case A: Bob doesn't have the project files**

```
┌─────────────────────────────────────────────────────────────┐
│ 🎉 You've joined "my-app"                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Alice invited you to collaborate on this project.           │
│                                                              │
│ To see the full project (kits, plans, code), you need       │
│ to clone the repository:                                     │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ git clone git@github.com:team/my-app.git                │ │
│ │                                          [Copy]         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ After cloning, open the folder in BlueKit and it will       │
│ automatically connect to your team's project.               │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ In the meantime, you can see:                               │
│ • Tasks (3 assigned to you)                                 │
│ • Checkpoints (12 total)                                    │
│ • Team activity                                             │
│                                                              │
│ [View Tasks]  [View Activity]  [Clone with GitHub Desktop]  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Insight:** Bob can see cloud metadata (tasks, checkpoints, comments) even without local files. He just can't see the actual kit content, plan documents, etc.

**Case B: Bob already has the project (different path)**

BlueKit scans for projects and matches by git URL:

```typescript
// On app startup or when Bob adds a project
async function checkForInviteMatches(localProjectPath: string) {
  const gitUrl = await invoke('get_git_remote_url', { path: localProjectPath });
  if (!gitUrl) return;

  // Check if user has accepted invites matching this git URL
  const { data: projects } = await supabase
    .from('synced_projects')
    .select(`
      *,
      project_members!inner(user_id, role)
    `)
    .eq('project_members.user_id', user.id)
    .or(`github_url.eq.${gitUrl},github_url.eq.${gitUrl.replace('git@', 'https://')}`);

  if (projects?.length > 0) {
    // Found a match!
    const project = projects[0];

    // Auto-link local to cloud
    await invoke('link_project_to_cloud', {
      localProjectId: localProject.id,
      cloudProjectId: project.id,
    });

    toaster.create({
      title: 'Project Connected',
      description: `Linked to team project "${project.name}"`,
      type: 'success',
    });
  }
}
```

### Step 6: Bob Opens the Cloned Project

```
Bob: File → Open Project → ~/code/my-app

BlueKit detects:
1. Has .bluekit/ directory ✓
2. Has git remote: git@github.com:team/my-app.git ✓
3. User has accepted invite for this repo ✓

Auto-linking...

┌─────────────────────────────────────────────────────────────┐
│ ✅ Connected to Team Project                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ This project is now linked to your team's "my-app".         │
│                                                              │
│ You can now:                                                 │
│ • See shared tasks and checkpoints                          │
│ • View Alice's pinned checkpoints                           │
│ • Add comments to plans and kits                            │
│ • See real-time activity from teammates                     │
│                                                              │
│ [Got it]                                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Invite States

```typescript
type InviteStatus =
  | 'pending'      // Sent, not yet clicked
  | 'viewed'       // Clicked link, hasn't signed up/in
  | 'accepted'     // Signed in and accepted
  | 'declined'     // Explicitly declined
  | 'expired'      // Past expiration date
  | 'revoked';     // Inviter cancelled
```

### Database Schema

```sql
-- Project invites
CREATE TABLE project_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What project
  project_id UUID REFERENCES synced_projects(id) ON DELETE CASCADE,

  -- Who's invited
  invitee_email TEXT NOT NULL,
  invitee_id UUID REFERENCES auth.users(id),  -- Set when they accept

  -- Invite details
  role TEXT NOT NULL DEFAULT 'member',
  message TEXT,
  invite_code TEXT UNIQUE NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',

  -- Who invited
  invited_by UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- Index for email lookup
CREATE INDEX idx_invites_email ON project_invites(invitee_email);
CREATE INDEX idx_invites_code ON project_invites(invite_code);

-- Function to accept invite
CREATE OR REPLACE FUNCTION accept_project_invite(p_invite_code TEXT)
RETURNS UUID AS $$
DECLARE
  v_invite project_invites%ROWTYPE;
  v_project_id UUID;
BEGIN
  -- Get and validate invite
  SELECT * INTO v_invite
  FROM project_invites
  WHERE invite_code = p_invite_code
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  -- Update invite status
  UPDATE project_invites
  SET status = 'accepted',
      invitee_id = auth.uid(),
      accepted_at = NOW()
  WHERE id = v_invite.id;

  -- Add to project members
  INSERT INTO project_members (project_id, user_id, role)
  VALUES (v_invite.project_id, auth.uid(), v_invite.role)
  ON CONFLICT (project_id, user_id) DO UPDATE
  SET role = EXCLUDED.role;

  RETURN v_invite.project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Pending Projects View

For projects where user is a member but hasn't linked local files:

```typescript
interface PendingProject {
  id: string;
  name: string;
  description?: string;
  githubUrl?: string;
  githubOwner?: string;
  githubRepo?: string;
  role: 'viewer' | 'member' | 'admin' | 'owner';
  invitedBy: {
    id: string;
    email: string;
    displayName?: string;
  };
  acceptedAt: string;

  // Cloud data available without local files
  taskCount: number;
  checkpointCount: number;
  memberCount: number;
}

// Fetch pending projects (member but no local link)
async function getPendingProjects(): Promise<PendingProject[]> {
  const localSyncIds = await invoke('get_all_sync_ids');  // From local SQLite

  const { data } = await supabase
    .from('synced_projects')
    .select(`
      *,
      project_members!inner(role),
      invited_by:project_invites(invited_by(id, email, display_name)),
      tasks:project_tasks(count),
      checkpoints:synced_checkpoints(count),
      members:project_members(count)
    `)
    .eq('project_members.user_id', user.id)
    .not('id', 'in', `(${localSyncIds.join(',')})`);  // Not linked locally

  return data;
}
```

---

## Edge Cases

### Edge Case 1: Same Email, Different Case

```
Invite sent to: Bob@Company.com
Bob signs up with: bob@company.com
```

**Solution:** Normalize emails to lowercase everywhere.

```sql
-- In accept_project_invite function
WHERE LOWER(invitee_email) = LOWER(auth.email())
```

### Edge Case 2: Invite to Existing Member

```
Alice invites bob@company.com
Bob is already a member (from previous invite)
```

**Solution:** Upsert membership, update role if different.

```sql
INSERT INTO project_members (project_id, user_id, role)
VALUES (...)
ON CONFLICT (project_id, user_id) DO UPDATE
SET role = GREATEST(project_members.role, EXCLUDED.role);  -- Keep higher role
```

### Edge Case 3: User Changes Email

```
Bob was invited as bob@company.com
Bob's Supabase account is bob@personal.com
```

**Solution:** Match by invite code, not just email.

```typescript
// When user clicks invite link with code
const { projectId } = await supabase
  .rpc('accept_project_invite', { p_invite_code: inviteCode });
// Works regardless of email match
```

### Edge Case 4: Multiple Invites, Same Person

```
Alice invites bob@company.com as viewer
Charlie invites bob@company.com as admin
```

**Solution:** Multiple invites are fine. Each acceptance upgrades role if higher.

### Edge Case 5: Git URL Variations

```
User A: git@github.com:team/my-app.git
User B: https://github.com/team/my-app.git
```

**Solution:** Normalize git URLs for comparison.

```typescript
function normalizeGitUrl(url: string): string {
  // Convert SSH to HTTPS format for comparison
  return url
    .replace('git@github.com:', 'https://github.com/')
    .replace(/\.git$/, '')
    .toLowerCase();
}
```

### Edge Case 6: Forked Repo

```
Main repo: github.com/company/my-app
Bob's fork: github.com/bob/my-app
```

**Solution:** Warn that URLs don't match, offer manual link.

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Repository Mismatch                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ This project's remote is:                                    │
│ github.com/bob/my-app                                        │
│                                                              │
│ But the team project is linked to:                          │
│ github.com/company/my-app                                    │
│                                                              │
│ This might be a fork. You can still link this project,      │
│ but make sure you're working on the right codebase.         │
│                                                              │
│ [Link Anyway]  [Cancel]                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Edge Case 7: Project Deleted from Cloud

```
Alice deletes the synced project
Bob still has local files linked to it
```

**Solution:** Graceful degradation.

```typescript
// On project load, check if cloud project still exists
const cloudProject = await supabase
  .from('synced_projects')
  .select()
  .eq('id', localProject.syncId)
  .single();

if (!cloudProject) {
  // Cloud project was deleted
  await invoke('unlink_project', { id: localProject.id });

  toaster.create({
    title: 'Project Unlinked',
    description: 'The team project was deleted. Your local files are unchanged.',
    type: 'info',
  });
}
```

---

## What Collaborators Can Do Without Local Files

Even without cloning the repo, invited members can:

| Feature | Without Files | With Files |
|---------|---------------|------------|
| View tasks | ✅ | ✅ |
| Create/edit tasks | ✅ | ✅ |
| View checkpoints (metadata) | ✅ | ✅ |
| View checkpoint diffs | ⚠️ If GitHub connected | ✅ |
| View plans (metadata) | ✅ | ✅ |
| View plan content | ❌ | ✅ |
| View kits (metadata) | ✅ | ✅ |
| View kit content | ❌ | ✅ |
| Add comments | ✅ | ✅ |
| See activity feed | ✅ | ✅ |
| Real-time presence | ✅ | ✅ |

This makes the invite useful even before the invitee clones the repo. They can start on tasks, see what the team is doing, etc.

---

## Alternative Approaches Considered

### Alternative 1: Sync `.bluekit/` via Supabase Storage

Instead of requiring git, sync the `.bluekit/` folder to Supabase Storage.

**Pros:**
- Works for non-git projects
- Invitees get kit content immediately

**Cons:**
- Storage costs
- Complex sync logic (conflicts, merges)
- Duplicates what git already does
- Doesn't sync the actual code

**Verdict:** Not worth the complexity. Git is the right tool for file sync.

### Alternative 2: Read-Only Web Viewer

Host kit content on web so invitees can view without local files.

**Pros:**
- Immediate access to content
- Works on mobile

**Cons:**
- Hosting costs
- Security (who can see what?)
- Markdown rendering differences
- Still can't edit

**Verdict:** Maybe for future "share publicly" feature, not for team collab.

### Alternative 3: Require Git Clone Before Invite Accept

Force invitees to have the project locally before accepting.

**Pros:**
- Simpler flow
- No "pending" state

**Cons:**
- Chicken-and-egg: How do they know the git URL?
- Can't see tasks until they clone
- Higher friction

**Verdict:** Too restrictive. Let them accept and get value immediately.

---

## Implementation Phases

### Phase 1: Basic Invite Flow (Non-User Path)

- [ ] Create `project_invites` table
- [ ] Build invite UI in project settings
- [ ] Send invite emails (use Supabase Edge Functions + Resend)
- [ ] Accept invite web page (with sign-up flow)
- [ ] Preserve invite context through sign-up
- [ ] Auto-accept after sign-up completes
- [ ] Download/deep link redirect after accept

### Phase 2: Existing User Flow

- [ ] Real-time invite subscription (Supabase Realtime)
- [ ] In-app toast notification for new invites
- [ ] Notification center for pending invites
- [ ] Auto-link detection on invite accept
- [ ] Skip email for existing users (optional setting)

### Phase 3: Pending Projects UI

- [ ] Show pending projects in sidebar/home
- [ ] Display cloud metadata for unlinked projects
- [ ] "Clone" helper with git URL
- [ ] Manual link option (for path mismatches)
- [ ] "I already have it" flow with folder picker

### Phase 4: Collaborators System

- [ ] Create `user_collaborators` table
- [ ] Collaborators management page
- [ ] Auto-add collaborators when inviting
- [ ] Collaborator autocomplete in invite UI
- [ ] Sync collaborator_user_id when non-users sign up
- [ ] Cross-project visibility (which projects is Bob on?)
- [ ] "Quick add from collaborators" in team members view

### Phase 5: Invite Management

- [ ] View pending invites (inviter)
- [ ] Resend invite
- [ ] Revoke invite
- [ ] Invite expiration handling
- [ ] Bulk invite (multiple emails or collaborators)

### Phase 6: Polish

- [ ] Email templates (different for new vs existing users)
- [ ] Invite analytics (sent, viewed, accepted)
- [ ] Team page showing all members + pending invites
- [ ] Suggested collaborators based on shared projects

---

## Open Questions

1. **Invite link format**:
   - Web URL: `bluekit.app/invite/abc123`
   - Deep link: `bluekit://invite/abc123`
   - Or both? (Probably both - web for non-users, deep link for existing)

2. **Email service**:
   - Supabase built-in (limited customization)
   - Resend via Edge Functions (more control)
   - SendGrid/Postmark (enterprise)

3. **Invite permissions**:
   - Can any member invite? Or only admins?
   - Should there be invite quotas?

4. **Pending project visibility**:
   - Show in main project list? Separate section?
   - How prominent should "clone to see content" be?

5. **Non-git projects**:
   - Completely block collaboration?
   - Or allow cloud-only features (tasks, comments)?

6. **Existing user direct add**:
   - Should inviting an existing user skip the invite and add them directly?
   - Or always go through invite flow for consistency?

7. **Collaborator privacy**:
   - Can others see who's in your collaborators list?
   - Or is it private per-user?

8. **Cross-machine sync**:
   - If Bob accepts invite on laptop, how does his desktop know?
   - Real-time sync of pending projects across devices?

---

## Summary

### The Two Flows

| Scenario | Non-User (bob@company.com has no account) | Existing User (Bob has BlueKit) |
|----------|-------------------------------------------|----------------------------------|
| **Touchpoint** | Email only | In-app notification + email backup |
| **First action** | Click email → Sign up | See toast → Click Accept |
| **Friction** | High (must create account) | Low (one click) |
| **Time to accept** | Minutes to hours | Seconds |
| **Auto-link** | After they clone & open | Immediate if repo exists locally |
| **Value before clone** | Tasks, activity, comments | Same, plus faster linking |

### Collaborators Make Repeat Invites Easy

```
First invite to Bob:
  Alice types "bob@company.com" → Bob becomes collaborator

Second invite to Bob (different project):
  Alice types "b" → autocomplete shows Bob → one click
```

### The Local-First Challenge Solved

```
Problem: "How do you invite someone to local files?"

Answer: You don't. You invite them to the CLOUD PROJECT.
        The cloud project syncs metadata (tasks, checkpoints, comments).
        The files sync via git (they clone the repo).
        BlueKit auto-links when git URLs match.
```

### Key Implementation Insight

The invite flow has two distinct paths that should be built separately:

1. **Non-User Path** (Phase 1): Email → Web → Sign Up → Accept → Download
2. **Existing User Path** (Phase 2): Real-time notification → Accept → Auto-link

Building them separately lets you ship value faster (existing users get invites immediately) while the more complex non-user onboarding can be refined.
