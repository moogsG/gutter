# Gutter Roadmap

Post-v1.0.0 feature roadmap and long-term vision.

---

## v1.1 — Integration & Polish (Q2 2026)

**Focus:** Improve existing integrations, expand testing, better UX

### Testing
- [ ] Integration tests for calendar API (mock accli)
- [ ] Integration tests for meeting-prep API (async file ops)
- [ ] Integration tests for Jira API (mock HTTP)
- [ ] End-to-end Playwright tests for core workflows
- [ ] Expand natural language command parser tests
- [ ] Coverage reporting automation

### Calendar
- [ ] Google Calendar support (via gcal CLI or API)
- [ ] Microsoft Outlook Calendar support (via Graph API)
- [ ] Recurring event display improvements
- [ ] Calendar event editing from Gutter UI

### Jira
- [ ] Comment on issues from Gutter
- [ ] Attach journal entries to Jira issues
- [ ] Bi-directional linking (Jira issue → journal entry)
- [ ] Sprint planning integration (view current sprint tasks)

### UX
- [ ] Keyboard shortcuts documentation (modal, `/help`)
- [ ] Command palette search improvements (fuzzy matching)
- [ ] Drag-and-drop task reordering in Daily Log
- [ ] Kanban board persistence (save column order, filters)
- [ ] Empty state illustrations
- [ ] Loading skeleton screens
- [ ] Toast notification system

---

## v1.2 — Projects & Context (Q3 2026)

**Focus:** Better task organization, automatic context linking

### Projects
- [ ] Project management layer (beyond collections)
- [ ] Project timelines (Gantt-style view)
- [ ] Project-scoped task lists (Kanban per project)
- [ ] Automatic project tagging (AI suggests projects for entries)
- [ ] Cross-project search and reports

### Context Linking
- [ ] Entity extraction (people, places, tools, clients)
- [ ] Relationship graph (Neo4j or SQLite graph queries)
- [ ] Context panel (show related entries when viewing a task/note)
- [ ] "What did I say about X?" semantic search improvements
- [ ] Timeline view (entries + meetings + Jira + Slack in one stream)

### RAG Improvements
- [ ] Expand vector search to Slack messages
- [ ] Expand vector search to Jira issues
- [ ] Embed external documents (PDFs, Google Docs, Confluence)
- [ ] Cross-source semantic search (journal + docs + comms)

---

## v1.3 — Collaboration (Q4 2026)

**Focus:** Multi-user support, shared collections

### Multi-User
- [ ] User accounts (local SQLite or auth provider)
- [ ] Per-user journals (private by default)
- [ ] Shared collections (team spaces)
- [ ] Permission system (read/write/admin)
- [ ] Activity feed (what teammates are working on)

### Team Features
- [ ] Daily standups (automated summary of yesterday's work)
- [ ] Team dashboards (aggregate task status)
- [ ] Shared meeting prep (collaborate on prep notes)
- [ ] Mentions and notifications (e.g., @moogs in a note)

---

## v2.0 — Mobile & Sync (2027)

**Focus:** Mobile apps, cloud sync, offline-first

### Mobile Apps
- [ ] iOS app (React Native or native Swift)
- [ ] Android app (React Native or native Kotlin)
- [ ] Quick capture widget (add task without opening app)
- [ ] Voice capture on mobile (native STT)
- [ ] Push notifications (reminders, mentions)

### Sync
- [ ] Self-hosted sync server (WebSocket + SQLite replication)
- [ ] End-to-end encrypted sync
- [ ] Conflict resolution (CRDTs or last-write-wins)
- [ ] Offline-first architecture (local DB + background sync)

### Browser Extension
- [ ] Chrome/Firefox extension for quick capture
- [ ] Capture web page as journal entry (markdown + metadata)
- [ ] Jira/Slack/Gmail integration (capture directly from tools)

---

## v2.1 — Advanced AI (2027)

**Focus:** Proactive assistance, long-term memory, habit coaching

### Proactive AI
- [ ] Daily briefing (agenda + priorities)
- [ ] Smart reminders (context-aware nudges)
- [ ] Task prioritization suggestions (urgency + importance)
- [ ] Meeting follow-up automation (extract action items)
- [ ] Weekly review (reflection prompts, habit trends)

### Habit Tracking & ADHD Support
- [ ] Habit tracking (streak visualization)
- [ ] Task breakdown (AI splits large tasks into steps)
- [ ] Focus mode (pomodoro timer + distraction blocking)
- [ ] Energy level tracking (link tasks to energy patterns)
- [ ] Dopamine-driven gamification (XP, achievements, streaks)

### Long-Term Memory
- [ ] Episodic memory (life timeline, major events)
- [ ] Spaced repetition (resurface old ideas, lessons learned)
- [ ] Conversation threads (track ongoing discussions with people)
- [ ] Life logging (photos, locations, activities)

---

## Future Ideas (Backlog)

**Not committed, but interesting:**

- [ ] Obsidian sync (two-way sync with Obsidian vault)
- [ ] Notion integration (embed Gutter views in Notion)
- [ ] GitHub integration (link commits/PRs to journal entries)
- [ ] Time tracking (automatic task duration estimation)
- [ ] Budget tracking (link expenses to projects)
- [ ] Health integration (Apple Health, Oura, Whoop)
- [ ] Reading list (track articles, books, papers)
- [ ] Social feed (aggregate mentions across platforms)
- [ ] AI coach (long-term accountability partner)
- [ ] Data export (markdown, JSON, PDF reports)
- [ ] Self-hosted analytics (track what works, what doesn't)

---

## Contributing

Have an idea? Open an issue or submit a PR! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Priority:** Features that improve ADHD support, local-first privacy, and AI assistance are most aligned with Gutter's mission.
