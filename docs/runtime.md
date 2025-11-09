## Deemind Runtime Stub 1.0

The runtime stub turns Deemind into an offline storefront simulator so you can browse and interact with any built theme without the real Salla platform.

### Why it exists

| Goal           | Details                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------- |
| Visualize      | Render the adapted Twig/CSS exactly as Salla would.                                      |
| Interact       | Cart, auth, wishlist, locales, and other UI flows are fully wired.                       |
| Stay offline   | No tokens, APIs, or CLI calls to Salla are required.                                     |
| Develop faster | `npm run deemind:build <theme>` → `npm run preview:stub <theme>` gives instant feedback. |

### High-level flow

```
input/<theme> → canonical/<theme> → output/<theme>/src →
preview-static snapshots → server/runtime-stub.js →
browser + dashboard controls
```

1. **Build**: `npm run deemind:build demo` parses the input theme, generates the canonical JSON, and writes Twig/assets to `output/demo/src`.
2. **Seed snapshots**: `tools/preview-static.js` mirrors those pages into `preview-static/<theme>/pages/*.html` with mock data.
3. **Launch stub**: `npm run preview:stub demo` (or the dashboard “Start Stub” button) runs `server/runtime-stub.js` which serves Twig/HTML, assets, and local APIs on `http://localhost:4100`.
4. **Interact**: Open the preview (`/page/index`, `/pages`) and use the theme like a live Salla store; the dashboard shows stub status, logs, and lets you stop/reset it.

### Runtime architecture

```
runtime/
└─ state/                 # per-theme persisted cart/auth data
server/runtime-stub.js    # Express + Twig runtime
data/mock-store*.json     # Legacy seed fallback
mockups/store/partials/   # Composable JSON blocks (products, hero, locales…)
mockups/store/demos/      # Manifest files describing each demo preset
mockups/store/cache/      # Composed snapshots written by store-compose.js
preview-static/<theme>/   # HTML snapshots used by the stub
```

Key behaviors inside `server/runtime-stub.js`:

| Subsystem    | Implementation                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Twig globals | Injects `window.__SALLA_STUB__` and helpers (`salla.cart`, `salla.wishlist`, `salla.auth`, `salla.locale`).       |
| APIs         | Express routes under `/api/cart`, `/api/wishlist`, `/api/auth`, `/api/store`, `/api/state`, etc.                  |
| Persistence  | Each theme’s cart/auth/session lives in `runtime/state/<theme>.json`; resets reseed from `data/mock-store*.json`. |
| Events       | Server-sent events stream `cart`, `wishlist`, `session`, `store` updates so badges stay synced.                   |

### Commands & endpoints

| Command                                  | Purpose                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm run deemind:build demo`             | Run parser → adapter → baseline → reports for `demo`.                                                                 |
| `npm run preview:stub demo`              | Start the runtime stub for `demo` on port 4100.                                                                       |
| `npm run preview:launch demo`            | Seeds snapshots, launches stub, opens the browser (helper script).                                                    |
| `npm run runtime:scenario demo checkout` | Runs scripted flows (add-to-cart/checkout/wishlist) against the stub and writes logs under `logs/runtime-scenarios/`. |

Service & dashboard endpoints:

| Endpoint                                                     | Description                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `POST /api/preview/stub { theme }`                           | Seed snapshots and start the stub process.                                                             |
| `DELETE /api/preview/stub`                                   | Stop the stub.                                                                                         |
| `POST /api/preview/stub/reset { theme? }`                    | Clear persisted state or hot-reset the running stub.                                                   |
| `GET /api/preview/stub/logs`                                 | Tail the stub logs in the dashboard.                                                                   |
| `GET /api/store/demos`                                       | List available demo compositions (from `mockups/store/demos`).                                         |
| `GET /api/store/compose?demo=fashion&parts=products/fashion` | Preview a composition without applying it.                                                             |
| `POST /api/store/preset { demo, overrides?, parts? }`        | Compose the requested demo, persist it to `runtime/state/`, and (if running) hot-swap the stub’s data. |

Runtime stub endpoints (when running):

| Endpoint                                                             | Notes                                                     |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| `GET /api/state`                                                     | Dump current store/products/cart/session snapshot.        |
| `POST /api/state/reset`                                              | Force a reseed (also used by the service reset endpoint). |
| `GET /api/cart`, `POST /api/cart/add`, `POST /api/cart/remove`, etc. | Manage cart contents.                                     |
| `POST /api/auth/login`, `/api/auth/logout`, `/api/auth/me`           | Mock auth lifecycle.                                      |
| `POST /api/store/locale`                                             | Switch `en`/`ar`; triggers RTL and dictionary changes.    |
| `GET/POST /api/twilight`                                             | Enable/disable the Twilight/NEXUS shim for previews.      |
| `GET /api/runtime/analytics`                                         | Stream recent API calls (method/path/status/duration).    |
| `GET /api/runtime/scenarios`                                         | Return the latest scenario runner logs.                   |

### Dashboard integration

All main dashboard pages now show and control the runtime:

| View                          | Capability                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Upload & Theme Intake         | Displays stub status for the selected theme, offers Launch/Stop/Open, and a “Reset State” button.                     |
| Parser / Adapter / Validation | Embed the same StubStatusCard so engineers can open or reset the runtime while inspecting logs, diffs, or QA results. |
| Settings                      | Global stub controls plus log tail, useful for debugging.                                                             |
| Top bar                       | Live badge indicating whether the stub is running and on which port/theme.                                            |

### Typical workflow

```bash
# 1. Build the theme you’re working on
npm run deemind:build demo

# 2. Seed and run the stub (CLI or dashboard)
npm run preview:stub demo

# 3. Open http://localhost:4100/page/index
#    - Add to cart (persists in runtime/state/demo.json)
#    - Log in via mock form
#    - Switch locale to ar/en

# 4. Reset state from dashboard Settings or POST /api/preview/stub/reset
```

### Key files to know

| File                                          | Description                                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `server/runtime-stub.js`                      | Express runtime; injects Salla globals, serves APIs, handles SSE + persistence.               |
| `tools/preview-static.js`                     | Generates HTML snapshots + mock data for each page.                                           |
| `runtime/state/.gitkeep`                      | Ensures the per-theme state directory exists without committing user data.                    |
| `data/mock-store.json`                        | Default store/products/cart seed (copy to `mock-store-<theme>.json` for theme-specific data). |
| `dashboard/src/components/StubStatusCard.tsx` | Shared UI component for Start/Stop/Open/Reset controls.                                       |
| `runtime/twilight/twilight-shim.js`           | Lightweight Twilight bridge loaded when the shim is enabled.                                  |
| `logs/runtime-analytics.jsonl`                | Streaming JSONL log of stub API calls (used by dashboard reports).                            |
| `logs/runtime-scenarios/*.json`               | Scenario runner outputs (chain metadata + per-step details).                                  |
| `mockups/store/partials/**`                   | Composable JSON blocks; supports `@version` suffix for frozen variants.                       |

### Twilight / NEXUS shim

Toggle the Twilight shim from the dashboard Settings page (or via `POST /api/twilight`). When enabled:

- The stub serves `/runtime-twilight/twilight-shim.js` and injects it into every preview page.
- `window.Salla.twilight` becomes available, mirroring the Twilight SDK event API so components that expect `Twilight.init()` can run offline.
- The preference is persisted in `runtime/twilight/config.json` and synchronized live to the running stub.

### Future roadmap (v2 ideas)

- Scenario runner to automate cart → checkout → logout flows.
- Dashboard socket bridge for real-time runtime analytics.
- Twilight/NEXUS bridge to load platform JS components locally.
- Additional platform adapters (Zid, Shopify) reusing the same stub infrastructure.

### Scenario runner

`npm run runtime:scenario <theme> <flow...>` executes scripted flows (add-to-cart, checkout, wishlist). Pass multiple scenarios or use `--chain=add-to-cart,checkout` to run sequentially. Results are logged to `logs/runtime-scenarios/*.json` and surfaced via:

- `/api/runtime/scenarios` → used by the Dashboard Validation page
- Each log captures `chain`, per-scenario status, and every HTTP step with request/response payloads.

Until then, Version 1.0 already delivers a complete offline experience: build, preview, interact, and inspect every theme without leaving your machine.
