# codex: apply customizations to generated Salla theme (Deemind engine)

# 🎨 Codex Directive: Apply Customizations to the Generated Salla Theme

## 🎯 Objective
Allow the project owner (Bakheet) to request **structural, visual, or behavioral customizations** to any Salla theme built by Deemind.  
Codex must interpret each request precisely, modify the correct files, and rebuild + re-validate the theme automatically — without breaking Harmony or schema compliance.

---

## 🧠 Context

This directive applies to all themes generated under:

/output/<theme-name>/

and to their canonical source structures under `/input/<theme-name>/`.

Codex already has:
- Full knowledge of **Salla theme architecture**
- Access to **Salla design tokens**, **schema**, and **baseline themes**
- The **Deemind engine** (parser → mapper → adapter → validator → delivery)
- The **Harmony** validation pipeline and CI/CD workflows

---

## 🧩 Customization Types Codex Must Support

| Type | Description | Typical Files Affected |
|------|--------------|------------------------|
| **Layout / Structure** | Add, remove, or reorder sections on pages (hero, banner, footer, product grids) | `/layouts/`, `/pages/`, `/partials/` |
| **Design Tokens** | Change colors, fonts, radii, spacing, or animation timing | `/configs/design-tokens.json`, `theme.json → settings.design` |
| **Typography** | Adjust font families, sizes, or weights | `theme.json → settings.fonts`, `/assets/styles.css` |
| **Content Blocks** | Add or edit reusable content sections (hero banners, testimonials, newsletter, etc.) | `/partials/`, `theme.json → blocks` |
| **Behavioral / JS** | Modify or add JavaScript behavior (e.g., sticky cart, menu toggles) | `/assets/script.js` |
| **i18n / Localization** | Update translation strings or add new locales | `/configs/i18n.json` |
| **Performance** | Adjust asset limits, enable lazy loading, or minify rules | `/configs/build.json`, `/tools/validate-performance.js` |

---

## 💬 How Requests Will Be Given

Each customization request will be written in plain language, for example:

> “Codex, rebuild the homepage hero with image on left, text on right, and a call-to-action button.”  
> “Codex, replace primary color with `#0046FF` and secondary with `#11224E`.”  
> “Codex, add a product reviews block below product description with a star rating placeholder.”  

Codex must:
1. Parse intent → identify affected files.
2. Apply changes safely (create backups if needed).
3. Rebuild the theme (`npm run deemind:build <theme>`).
4. Validate via Harmony (lint, schema, and design token checks).
5. Commit results with a descriptive message.

---

## 🧰 Workflow Steps

1. **Interpret Customization**
   - Detect which layer the request affects (layout, tokens, JS, etc.).
   - Locate correct source files.
   - Cross-check with schema to ensure compatibility.

2. **Modify Files**
   - Apply edits or create new partials/layouts as required.
   - Maintain clean, linted syntax.
   - Update `theme.json` for any new blocks/settings.

3. **Rebuild**
   - Run full Deemind build pipeline.
   - Generate new `/output/<theme>/` artifacts.

4. **Validate**
   - Run Harmony checks (lint, token parity, schema drift).
   - Confirm theme passes `salla validate` (if CLI available).
   - Compare before/after via diff summary.

5. **Document**
   - Generate `/reports/customization-<theme>-<timestamp>.md` summarizing:
     - Changed files
     - Build results
     - Validation outcomes
     - Visual or structural changes (text summary)
   - Append to `/logs/harmony-score.json`.

6. **Commit**
   - Commit with format:  
     ```
     chore(theme): <theme-name> customization — <short summary>
     ```
   - Tag automatically if build validated.

---

## 🧭 Acceptance Criteria for Each Customization

- ✅ Build completes successfully, zero schema violations.  
- ✅ Lint score passes (`eslint`, `stylelint`, `twig-lint`).  
- ✅ Harmony score ≥95.  
- ✅ Token diff shows only approved visual deltas.  
- ✅ All modified Twig templates render valid syntax.  
- ✅ Reports updated and committed automatically.  

---

## 🧠 Additional Behavior Rules

- Always prefer **extending or overriding partials** rather than rewriting them.  
- Maintain **naming parity** with Salla conventions (`product-card.twig`, `navbar.twig`, etc.).  
- Validate new CSS variables against `configs/design-tokens.json`.  
- Never remove mandatory keys from `theme.json`.  
- If a customization could break schema or style consistency, raise an issue labeled `codex-improvement` instead of committing.  

---

## 📦 Deliverables per Customization

| File | Description |
|------|--------------|
| `/reports/customization-<theme>-<timestamp>.md` | Detailed customization report |
| `/output/<theme>/` | Updated, rebuilt theme |
| `/logs/harmony-score.json` | Updated validation metrics |
| `/configs/design-tokens.json` | Updated tokens (if color/font change) |
| `/theme.json` | Updated settings/blocks (if structural change) |

---

> **Instruction to Codex:**  
> Execute customization requests directly on `main`, maintaining full schema, token, and Harmony compliance.  
> Each customization must rebuild, validate, and document itself automatically.  
> All changes must remain Salla-compatible and use existing design tokens and theme architecture.  
> If a customization conflicts with Salla validation rules, create an issue labeled `codex-improvement` instead of applying unsafe edits.


