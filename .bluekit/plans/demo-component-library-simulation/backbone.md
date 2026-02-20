
## What is a Backbone?

A backbone is an automatically generated, editable strategic foundation document that defines the core architectural approach, phasing, and decision-making framework for a plan or project. It serves as the structural spine that all subsequent planning and implementation builds upon.

## Purpose

The backbone strategy enables:

1. **Rapid Strategic Alignment**: Auto-generate a foundational strategy that stakeholders can immediately review and refine
2. **Structured Flexibility**: Provide clear direction while remaining fully editable for iteration
3. **Architectural Coherence**: Ensure all downstream work aligns with core principles and patterns
4. **Phase-Based Execution**: Break complex initiatives into logical, sequential phases
5. **Decision Documentation**: Capture key architectural decisions and their rationale upfront

### The Kit-Backbone Relationship

**The backbone is the kit discovery engine.** It serves as:

- **Kit Identifier**: Backbone reveals reusable patterns worth capturing as kits
- **Kit Organizer**: Backbone structure determines kit categorization and relationships
- **Kit Validator**: Implementation against backbone tests if kits are truly reusable
- **Kit Evolver**: Backbone refinement drives kit improvement and new kit creation

**Kits feed back into the backbone through:**

- **Pattern Validation**: Building kits proves which backbone patterns actually work
- **Gap Discovery**: Kit creation reveals missing or incomplete backbone sections
- **Refinement Signals**: Kit reuse patterns inform backbone iteration
- **Knowledge Extraction**: Kits crystallize backbone concepts into concrete artifacts

## Key Characteristics

### Auto-Generated with Intent
- AI analyzes context, requirements, and best practices to generate initial backbone
- Produces opinionated structure based on domain knowledge
- Saves hours of initial planning and research
- Creates consistent formatting and completeness across plans

### Editable by Design
- Every section can be modified, expanded, or removed
- Serves as a starting point, not a constraint
- Encourages human refinement and domain expertise
- Supports iterative improvement as understanding evolves

### Foundation, Not Implementation
- Defines *what* and *why*, not detailed *how*
- Sets architectural direction without prescribing exact solutions
- Establishes principles that guide implementation choices
- Creates shared mental model for team alignment

### Kit-Centric Design
- **Identifies kit opportunities** within architectural patterns
- **Structures kits** according to backbone organization
- **Guides kit creation** with clear context and relationships
- **Validates through kit building** - if patterns can't become kits, backbone needs refinement

## Structure of a Backbone

### 1. Core Architecture Section
Defines fundamental organizational patterns, structures, and models that will govern the work.

**Includes:**
- Structural patterns (tiers, layers, modules)
- File/folder organization
- Data models and schemas
- System boundaries and interfaces

### 2. Phased Approach Section
Breaks work into logical phases with dependencies and sequencing.

**Includes:**
- Phase definitions (Foundation → Build → Refine → Deploy)
- Dependencies between phases
- Success criteria for phase completion
- Logical progression rationale

### 3. Development Workflow Section
Outlines processes, practices, and patterns for executing the work.

**Includes:**
- Creation/build processes
- Quality gates and reviews
- Collaboration patterns
- Iteration cycles

### 4. Technical Foundations Section
Establishes technical decisions, standards, and constraints.

**Includes:**
- Technology choices and rationale
- Integration points
- Performance/scalability considerations
- Technical constraints

### 5. Success Metrics Section
Defines how success will be measured and validated.

**Includes:**
- Quantitative goals
- Qualitative outcomes
- Key performance indicators
- Validation criteria

### 6. Risk Mitigation Section
Identifies potential challenges and mitigation strategies.

**Includes:**
- Known risks and uncertainties
- Mitigation approaches
- Contingency plans
- Assumption documentation

## When to Use a Backbone

### Ideal Use Cases
- **Complex Multi-Phase Projects**: When work spans multiple stages with dependencies
- **Architectural Planning**: When foundational structure decisions impact all downstream work
- **Team Alignment**: When multiple people need shared understanding of approach
- **Unfamiliar Domains**: When AI-generated structure provides valuable starting expertise
- **Standardization Needs**: When consistent planning format benefits organization

### Not Needed For
- Simple, single-phase tasks
- Well-understood, routine operations
- Exploratory research without clear structure
- When existing plans already provide sufficient direction

## Integration with Other Planning Artifacts

### Backbone ↔ Kits (Primary Relationship)

**The backbone-to-kit flow is the central purpose of the backbone strategy.**

#### Backbone → Kits (Discovery & Creation)
1. **Pattern Identification**: Backbone structure reveals repeatable patterns
   - Example: "Three-tier component structure" → creates `component-hierarchy.md` kit
   - Example: "Design token system" → creates `design-tokens-base.md` kit

2. **Kit Scaffolding**: Backbone provides organizational context
   - Backbone phases map to kit categories/tags
   - Backbone sections suggest kit metadata (type, complexity, dependencies)
   - Backbone examples become kit content templates

3. **Relationship Mapping**: Backbone shows how kits connect
   - "Dependencies" section identifies which kits need others
   - "Integration points" reveal kit composition opportunities
   - "Technical foundations" establish base kits that others extend

#### Kits → Backbone (Validation & Refinement)
1. **Reality Check**: Actually building kits tests backbone assumptions
   - If pattern is too complex to document as kit → backbone oversimplified
   - If kit has no clear category → backbone structure incomplete
   - If kit isn't reusable → backbone pattern not truly foundational

2. **Gap Analysis**: Kit creation reveals backbone blind spots
   - Missing sections discovered when kit lacks context
   - New patterns emerge during implementation
   - Edge cases expose backbone assumptions

3. **Evolution Driver**: Kit usage informs backbone iteration
   - Frequently used kits highlight valuable patterns → expand in backbone
   - Unused kits suggest backbone over-engineering → simplify
   - Kit modification patterns signal backbone needs update

#### The Kit Building Loop
```
Backbone (v1) → Identify Patterns → Create Kits → Use Kits →
Discover Gaps/Issues → Refine Backbone (v2) → New Kit Opportunities → ...
```

**This loop is continuous and intentional.** The backbone is never "done" - it evolves as kits prove or disprove its assumptions.

### Backbone → Principles
- Backbone establishes strategic foundation
- Principles document extracted from backbone decisions
- Principles become reusable across projects
- **Kits implement principles** with concrete examples

### Backbone → Detailed Plans
- Backbone provides high-level structure
- Detailed plans fill in implementation specifics
- Plans reference backbone for alignment
- **Plans generate kits** as reusable outputs

### Backbone → Blueprints
- Backbone defines phased approach
- Blueprints operationalize phases into executable tasks
- Blueprint layers map to backbone phases
- **Blueprint tasks create kits** as deliverables

## Workflow for Using Backbones

### 1. Generation
```
User Request → AI Analysis → Backbone Generation → Initial Review
```
- User describes goal or project
- AI identifies domain, patterns, best practices
- AI generates structured backbone document with **kit opportunities identified**
- User performs initial review

### 2. Refinement
```
Review → Edit → Validate → Iterate
```
- Read generated sections critically
- Edit for accuracy, completeness, context
- Validate against requirements and constraints
- **Identify which patterns should become kits**
- Iterate until backbone feels solid

### 3. Kit Discovery & Creation
```
Backbone Patterns → Kit Candidates → Kit Creation → Kit Validation
```
- **Mine backbone for kit opportunities**:
  - Repeatable patterns → process kits
  - Architectural decisions → walkthrough kits
  - Technical standards → reference kits
  - Examples/templates → starter kits

- **Create kits with backbone context**:
  - Kit tags derived from backbone categories
  - Kit descriptions reference backbone sections
  - Kit relationships mapped from backbone dependencies
  - Kit complexity aligned with backbone phases

- **Validate kits against backbone**:
  - Does kit align with backbone principles?
  - Does kit fit backbone organizational structure?
  - Does kit solve problem identified in backbone?
  - Does kit enable backbone implementation?

### 4. Execution with Kit Building
```
Backbone → Implementation → Kit Extraction → Kit Refinement → Backbone Update
```
- Use backbone as reference during implementation
- **Extract reusable patterns as kits during work**
- Build kit library that reflects backbone structure
- **Use kit creation/usage to validate backbone assumptions**
- Update backbone when kits reveal gaps or improvements

### 5. Continuous Evolution
```
Backbone (v1) ↔ Kits ↔ Backbone (v2) ↔ More Kits ↔ ...
```
- Backbone identifies kit opportunities
- Kit building tests backbone validity
- Kit usage reveals backbone gaps
- Backbone updates drive new kit creation
- **The cycle continues indefinitely**

## Benefits of the Backbone Strategy

### For Kit Building
- **Kit Discovery**: Backbone automatically identifies what's worth capturing as kits
- **Kit Organization**: Backbone structure determines kit categorization and hierarchy
- **Kit Context**: Every kit created has clear purpose and relationships defined by backbone
- **Kit Quality**: Backbone principles ensure kits are truly reusable, not one-offs
- **Kit Evolution**: Backbone updates drive systematic kit improvement
- **Kit Completeness**: Backbone coverage analysis reveals missing kits

### For Individuals
- **Faster Planning**: Skip hours of research and structure creation
- **Better Coverage**: AI ensures no major areas overlooked
- **Learning Tool**: Exposes best practices and patterns
- **Starting Point**: Overcome blank page paralysis
- **Kit Guidance**: Always know what kits to build next based on backbone gaps

### For Teams
- **Shared Vision**: Everyone references same foundational document
- **Alignment**: Decisions traced back to backbone rationale
- **Onboarding**: New members understand approach quickly
- **Communication**: Common vocabulary and structure
- **Kit Collaboration**: Backbone shows which kits different team members should create

### For Organizations
- **Consistency**: Similar projects follow similar patterns
- **Knowledge Capture**: Architectural decisions documented and crystallized as kits
- **Quality**: Structured approach reduces ad-hoc planning
- **Scalability**: Proven patterns applied across initiatives
- **Kit Libraries**: Backbones spawn organized, coherent kit collections

## Anti-Patterns to Avoid

### Treating Backbone as Immutable
- **Problem**: Generated backbone becomes rigid constraint, kits forced to fit wrong patterns
- **Solution**: Actively edit and refine based on learning **from kit building**
- **Kit Signal**: If kits feel forced or unnatural, backbone structure is wrong

### Over-Detailing the Backbone
- **Problem**: Backbone becomes implementation plan, loses strategic focus
- **Solution**: Keep backbone high-level; move details to separate plans **and kits**
- **Kit Signal**: If backbone content duplicates kit content, backbone is too detailed

### Ignoring the Backbone
- **Problem**: Generate backbone but never reference it during execution or kit creation
- **Solution**: Regularly validate work against backbone; **let backbone guide kit creation**
- **Kit Signal**: If kits don't reference backbone or feel disconnected, backbone is being ignored

### Backbone Without Context
- **Problem**: Backbone disconnected from actual requirements or constraints
- **Solution**: Include context, assumptions, and constraints in backbone
- **Kit Signal**: If kits can't be categorized using backbone structure, context is missing

### Creating Kits Without Backbone Alignment
- **Problem**: Build kits ad-hoc without checking backbone fit
- **Solution**: Every kit should map to backbone pattern, phase, or principle
- **Kit Signal**: If kit doesn't clearly relate to backbone, either backbone is incomplete or kit is unnecessary

### Not Feeding Kit Learnings Back
- **Problem**: Build kits but never update backbone based on what was learned
- **Solution**: Establish regular backbone review based on kit creation experience
- **Kit Signal**: If backbone hasn't updated after creating 5+ kits, feedback loop is broken

## Evolution and Maintenance

### When to Update Backbone
- Major architectural decisions change
- Fundamental assumptions proven wrong
- Scope significantly expands or contracts
- New phases or structures emerge

### Version Control
- Backbones are markdown files → use git
- Track evolution over time
- Document reason for major changes
- Reference specific versions in plans

### Archival
- Completed project backbones become organizational knowledge
- Patterns extracted into reusable principles
- Serve as templates for similar future work

## Meta-Strategy Summary

The backbone strategy is about **leveraging AI to rapidly generate foundational strategic documents that humans then refine and execute against, with kit building as the primary execution and validation mechanism**. It combines:

- **AI Strength**: Pattern recognition, structure, completeness, best practices
- **Human Strength**: Context, judgment, refinement, decision-making
- **Automation**: Generate 80% of structure automatically
- **Editability**: Preserve 100% human control over final content
- **Kit Integration**: Every backbone pattern is a potential kit; every kit validates the backbone

### The Kit-Backbone Virtuous Cycle

```
    ┌─────────────┐
    │  Backbone   │ ←──────────────┐
    │  Generated  │                │
    └──────┬──────┘                │
           │                       │
           │ Reveals Patterns      │
           ↓                       │
    ┌─────────────┐                │
    │    Kits     │                │ Refines
    │   Created   │                │ Structure
    └──────┬──────┘                │
           │                       │
           │ Validates Patterns    │
           ↓                       │
    ┌─────────────┐                │
    │    Kits     │                │
    │    Used     │ ───────────────┘
    └─────────────┘   Reveals Gaps
```

The result is:
- **Faster planning** that maintains human agency
- **Better kits** that align with architectural vision
- **Validated architecture** proven through kit building
- **Continuous improvement** as kits inform backbone evolution

**The backbone without kits is just documentation. The backbone with kits is a living, evolving knowledge system.**

---

**Last Updated**: 2025-12-28
**Status**: Meta-Strategy Definition
**Owner**: BlueKit Planning System
