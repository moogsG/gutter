# GUTTER-STANDARDS.md

Project-specific UI and layout rules for Gutter.

These are tighter than general coding standards because Gutter dies the second it starts feeling like a cluttered toy dashboard.

## Core Principle

Gutter is a **quiet daily cockpit**.
Not a dashboard zoo.
Not a productivity Christmas tree.
Not a pile of fake-important widgets.

Every UI change must reduce friction, reduce decisions, or increase clarity.
If it does not, it does not belong.

## Layout Rules

### 1. Full-screen layout is correct for core journal views
- Daily, Today, and the main journal surface should stay full-width/full-bleed.
- Do not force centered container layouts onto core logging flows.
- Width was not the problem. Drift was the problem.

### 2. Full-width does not mean visually sloppy
- Shared sections still need consistent internal padding.
- Shared rows still need consistent spacing.
- Full-bleed is the canvas, not permission to freestyle.

### 3. Input comes first
- In daily/today views, capture UI belongs above secondary context.
- The first thing visible should help the user act, not admire a widget.

## Visual System Rules

### 4. Use one radius scale
- Default interactive/card radius: `rounded-lg`
- Pills/badges: `rounded-full`
- Small inline affordances: `rounded-md`
- Do not freestyle radius values per component.

### 5. Use one shell style for lightweight sections
- Border treatment, background treatment, and spacing should come from a small shared set of patterns.
- Hover state should be subtle, not theatrical.
- No random glassmorphism or neon treatments unless already part of an intentional shared pattern.

### 6. Shared spacing must be obvious in code
Use shared conventions for:
- section padding
- row spacing
- vertical rhythm
- list density

Do not hand-roll new spacing/layout combinations unless there is a real reason.

## Product Rules

### 7. No fake-useful widgets
A section must answer a real user question such as:
- what should I do now?
- what is blocked?
- what is next?
- what needs attention today?

Bad examples:
- decorative counters
- weak summaries with no action implication
- “focus” sections that are just arbitrary first items

### 8. Today mode must reduce decisions
Today view should help the user choose the next action fast.
If a panel does not influence action, remove it or demote it.

### 9. Metadata should stay quiet
Task metadata like lane, priority, and waiting state should be visible when helpful, but should not dominate the interface.
Structure is for clarity, not noise.

## Implementation Rules

### 10. Prefer shared primitives before adding new one-off UI
Before adding a new visual pattern, check whether it can use:
- existing section spacing
- existing button variants
- existing badge treatment
- existing row/layout conventions

### 11. When changing a page, normalize nearby drift
If you touch a page and see:
- mixed radii
- inconsistent spacing
- random section styles
- one-off panel treatments

clean it up while you are there.

### 12. New sections must justify themselves
Before adding a section, ask:
- what exact user question does this answer?
- what decision does this reduce?
- why does this deserve space above the fold?

If the answer is weak, do not add it.
