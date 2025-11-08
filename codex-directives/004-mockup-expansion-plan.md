🎨 Mock-Up Expansion Plan — Deemind Visual Pre-Build Framework

🧩 Goal

Turn the mock-up phase into a complete pre-build design layer, allowing Codex to:

- Generate reusable visual systems (colors, grids, typography, components)
- Produce interactive previews (HTML prototypes)
- Validate UI decisions before build
- Document design reasoning automatically

🧱 Phase 1 — Foundation Expansion

🎯 Objectives

Give Codex design literacy and a structured sandbox.

Steps

Add Visual System Files

- /mockups/_base/
  - tokens.css — core color, typography, spacing variables
  - grid.css — flex/grid system for section layouts
  - typography.css — base headings, paragraphs, RTL/LTR rules

Enable Live Preview Build

- Add a simple vite.config.js or parcel setup in /mockups/
  → allows running npm run mockup:serve to preview.

Store System Metadata

- /mockups/meta.json includes palette, font stacks, border-radius, shadows.

Harmony Pre-Validation

- Lint mock-up HTML/CSS before build phase.
- Store score in /reports/mockup-validation.json.

🧠 Phase 2 — Component Library Mock-Ups

🎯 Objectives

Codex generates reusable visual patterns before coding templates.

Components

| Type | Description | Example Output |
|------|-------------|----------------|
| Header / Navbar | Navigation bar with logo + menu | /mockups/components/navbar.html |
| Hero Section | Headline, image, CTA | /mockups/components/hero.html |
| Product Card | Image, title, price, add-to-cart | /mockups/components/product-card.html |
| Footer | Links, icons, social | /mockups/components/footer.html |
| Form / Button | Input + CTA variants | /mockups/components/form.html |

Codex Rules

- Use Salla component naming (e.g., .s-product-card).
- Apply token classes (--primary, --accent, etc.).
- Auto-document components in /reports/mockup-components.md.

🧭 Phase 3 — Theme Concept Visualization

🎯 Objectives

Convert base + components into coherent theme layouts.

Actions

Auto-Assemble Layouts

- Combine mock-up components into full pages:
  - /mockups/<theme-name>/home.html
  - /mockups/<theme-name>/product.html
  - /mockups/<theme-name>/cart.html

Visual Tokens Preview

- Auto-generate /mockups/<theme-name>/tokens-preview.html
  showing all color and typography variants.

AI-Assisted Design Commentary

- Codex writes /mockups/<theme-name>/concept.md explaining design rationale:
  - “Hero uses gradient primary for visibility.”
  - “Buttons follow 4px radius, Salla guideline.”

Owner Approval Step

- Codex pauses build process until approval:
  - “Mock-up <theme-name> ready — confirm to proceed.”

⚙️ Phase 4 — Integration with Theme Generation

Once approved:

- Mock-up assets are converted into canonical inputs:
  - /mockups/<theme-name>/ → /input/<theme-name>/
- HTML → Twig
- Tokens → CSS variables
- Layouts → Salla templates

Then Deemind build begins.

🧩 Phase 5 — Mock-Up Versioning and Comparison

| Task | Output |
|------|--------|
| Capture mock-up diffs between iterations | /reports/mockup-diff.md |
| Compare Harmony mock-up score vs final build | /reports/mockup-vs-build.md |
| Archive approved mock-ups for design history | /mockups/archive/<theme-name>-v1/ |

📊 Metrics

| Metric | Goal |
|--------|------|
| Mock-Up Lint Score | 0 errors, ≤3 warnings |
| Harmony Pre-Score | ≥90 before build |
| Design Token Coverage | 100% applied |
| Visual Responsiveness | Pass on 360px / 1440px |
| Approval Logs | Recorded in /logs/approvals.json |

🧠 Codex Responsibilities

| Stage | Codex Behavior |
|-------|----------------|
| Mock-Up Generation | Produce /mockups/ HTML/CSS + tokens |
| Validation | Run lint and Harmony pre-score |
| Documentation | Write /reports/mockup-<theme>.md |
| Waiting State | Pause until approval |
| Promotion | Move mock-up → input folder on “go ahead” |
| Finalization | Begin full Deemind build |

✅ Success Definition

A mock-up is considered successful when:

- Visual sections are complete and cohesive
- Design tokens are consistent
- Salla guidelines are followed
- Owner approval given
- Harmony Pre-Score ≥90

Instruction to Codex:

Expand the mock-up framework as described.
Treat /mockups/ as a first-class subsystem of Deemind — not temporary drafts.
Every new theme must start with a validated mock-up, visually approved before code synthesis.
Store mock-ups, reports, and approvals under version control for traceability.

