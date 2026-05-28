# Heaven Schedule Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync public CityHeaven attendance data into the OP search page and let users filter casts by work date.

**Architecture:** A Node script fetches the public weekly attendance page, extracts dates, cast names, girl IDs, profile URLs, and work times, then writes `schedule.json`. The static `index.html` loads that JSON at runtime, adds date filter buttons, marks matching rows/cards, and turns cast names into Heaven profile links when a profile URL is available.

**Tech Stack:** Static HTML/CSS/JavaScript, Node 20 built-in `fetch`, GitHub Actions scheduled workflow, existing Playwright tests.

---

### Task 1: Sync Data

**Files:**
- Create: `scripts/sync-heaven-schedule.js`
- Create: `schedule.json`
- Create: `.github/workflows/sync-schedule.yml`

- [ ] Add a dependency-free Node script that fetches `https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/attend/?of=y2`, parses weekly tables, and writes `schedule.json`.
- [ ] Add a GitHub Actions workflow that runs the script hourly and commits changed `schedule.json`.
- [ ] Run `node scripts/sync-heaven-schedule.js` and confirm `schedule.json` contains `dates`, `castsByDate`, and `profilesByName`.

### Task 2: Page Integration

**Files:**
- Modify: `index.html`
- Modify: `tests/pricelist.spec.js`

- [ ] Add schedule UI below the existing option filters.
- [ ] Load `schedule.json` on startup and render date buttons.
- [ ] Extend `applyFilters()` so name, option, and schedule date filters combine with AND logic.
- [ ] Link cast names to Heaven profiles where a matched profile URL exists.
- [ ] Add focused tests for date filtering and profile links.

### Task 3: Verify and Publish

**Files:**
- Modify: `index.html`
- Modify: `tests/pricelist.spec.js`
- Modify: `schedule.json`

- [ ] Parse `index.html` to catch malformed markup.
- [ ] Serve locally and verify date filtering in the browser.
- [ ] Commit and push to `main`.
