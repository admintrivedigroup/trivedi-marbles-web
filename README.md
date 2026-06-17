# Trivedi Granit Marmo — Marble Inventory & Business Platform

A full-stack business platform for **Trivedi Granit Marmo**, combining a public-facing marketing website with a private, role-based inventory management system for tracking marble slab stock, warehouse movements, quotations, and client leads.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Environment Variables](#environment-variables)
4. [Getting Started](#getting-started)
5. [Architecture Overview](#architecture-overview)
6. [Public Marketing Website](#public-marketing-website)
7. [Inventory Management App](#inventory-management-app)
8. [Authentication & Roles](#authentication--roles)
9. [Database Schema](#database-schema)
10. [Key Features](#key-features)
11. [API Routes](#api-routes)
12. [Image Handling (Cloudinary)](#image-handling-cloudinary)
13. [Email & CAPTCHA](#email--captcha)
14. [Excel Export](#excel-export)
15. [QR Code & Labels](#qr-code--labels)
16. [Audit Trail](#audit-trail)
17. [Deployment](#deployment)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript (strict mode) |
| Styling | TailwindCSS v4 |
| UI Components | Radix UI primitives + custom wrappers |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + magic links) |
| Image Storage | Cloudinary (auto-converted to WebP) |
| Email Delivery | Resend |
| CAPTCHA | Cloudflare Turnstile |
| Charts | Recharts |
| Excel Export | ExcelJS |
| QR Scanning | html5-qrcode |
| Testing | Vitest |

---

## Project Structure

```
trivedi-marbles/
├── src/
│   ├── app/
│   │   ├── (site)/                  # Public marketing website
│   │   │   ├── page.tsx             # Homepage
│   │   │   ├── about/               # About page
│   │   │   ├── blog/                # Blog list + [id] post
│   │   │   ├── collection/          # Public slab catalog + [id] detail
│   │   │   ├── contact/             # Contact form
│   │   │   ├── products/            # Product showcase
│   │   │   ├── projects/            # Project gallery
│   │   │   ├── privacy-policy/
│   │   │   └── terms/
│   │   │
│   │   └── inventory/               # Private inventory app
│   │       ├── login/               # Login page
│   │       ├── forgot-password/     # Password recovery
│   │       ├── reset-password/      # Password reset
│   │       ├── auth/callback/       # OAuth callback handler
│   │       ├── dashboard/           # Analytics & KPIs
│   │       ├── list/                # Slab inventory table
│   │       ├── add/                 # Add new stock (lot + slabs)
│   │       ├── edit/[id]/           # Edit a lot
│   │       ├── lot/[id]/            # Lot detail, labels, print view
│   │       ├── slab/[id]/           # Slab detail, label, print view
│   │       ├── movement/            # Warehouse transfers
│   │       ├── quotations/          # Generate quotation exports
│   │       ├── reports/             # Analytics & reporting
│   │       ├── audit/               # Audit log (admin+)
│   │       ├── archive/             # Soft-deleted items (admin+)
│   │       ├── leads/               # Client CRM
│   │       ├── journal/             # Notes (admin+)
│   │       ├── settings/            # System settings
│   │       ├── users/               # User management (superadmin only)
│   │       ├── export/              # Excel export API route
│   │       ├── _actions/            # Server Actions (all mutations)
│   │       ├── _components/         # Page-level React components
│   │       └── _lib/                # Server-side data fetching functions
│   │
│   ├── components/
│   │   ├── ui/                      # Radix UI wrappers (button, dialog, etc.)
│   │   ├── animations/              # FadeIn, PageTransition
│   │   ├── collection/              # Public collection grid & detail
│   │   ├── contact/                 # ContactForm + LocationSection
│   │   ├── home/                    # Hero section
│   │   └── layout/                  # Navbar, Footer, BackToTop
│   │
│   └── lib/
│       ├── supabase/                # DB clients (server, client, admin, proxy)
│       ├── cloudinary/              # Image upload & compression
│       ├── blog.ts                  # Blog utilities
│       └── utils.ts                 # cn() helper (clsx + tailwind-merge)
│
├── supabase/
│   └── migrations/                  # SQL migration files
│
├── public/                          # Static assets
├── next.config.ts                   # Next.js config
├── tsconfig.json
└── package.json
```

---

## Environment Variables

Create a `.env.local` file in the root with:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # Server-only, never exposed to browser

# Cloudinary (image upload)
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=your-upload-preset
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email (contact form)
RESEND_API_KEY=your-resend-key

# CAPTCHA (contact form bot protection)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-turnstile-site-key
TURNSTILE_SECRET_KEY=your-turnstile-secret
```

> The `VITE_` prefixed variables are mapped to `NEXT_PUBLIC_` equivalents in `next.config.ts` for compatibility.

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start with LAN access (other devices on same network)
npm run dev:lan

# Production build
npm run build
npm run start

# Run tests
npm test
```

The app runs on `http://localhost:3000`.

- **Public website:** `http://localhost:3000/`
- **Inventory app login:** `http://localhost:3000/inventory/login`
- **Inventory dashboard:** `http://localhost:3000/inventory/dashboard`

---

## Architecture Overview

The application is split into two distinct sections sharing the same Next.js project:

```
┌─────────────────────────────────────────────────────────┐
│                    trivedi-marbles                       │
│                                                         │
│  ┌────────────────────┐   ┌─────────────────────────┐  │
│  │   Public Website   │   │   Inventory App         │  │
│  │   (site) group     │   │   /inventory/*          │  │
│  │                    │   │                         │  │
│  │  • Marketing pages │   │  • Auth-protected       │  │
│  │  • Blog            │   │  • Role-based access    │  │
│  │  • Collection      │   │  • Full CRUD            │  │
│  │  • Contact form    │   │  • Analytics            │  │
│  └────────────────────┘   └─────────────────────────┘  │
│              │                        │                  │
│              └──────────┬─────────────┘                 │
│                         │                               │
│                  ┌──────▼──────┐                       │
│                  │   Supabase  │                       │
│                  │  (Postgres  │                       │
│                  │   + Auth)   │                       │
│                  └─────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

**Data flow pattern:**
- Pages are React Server Components (RSC) — they fetch data on the server.
- Mutations go through **Next.js Server Actions** (in `_actions/`).
- Client-side state is minimal — only for UI interactivity (filters, modals, forms).
- Supabase is used for both the database AND authentication.

---

## Public Marketing Website

Routes are under the `(site)` route group and are **fully public** (no auth required).

| Route | Purpose |
|---|---|
| `/` | Homepage with hero section and LocalBusiness structured data (SEO) |
| `/about` | Company background and team |
| `/products` | Product showcase (material categories) |
| `/projects` | Gallery of completed projects |
| `/collection` | Live catalog of available marble lots (pulled from inventory) |
| `/collection/[id]` | Detailed view of a single lot with slab list |
| `/blog` | Blog listing |
| `/blog/[id]` | Individual blog post |
| `/contact` | Contact form with Cloudflare Turnstile CAPTCHA + email via Resend |
| `/privacy-policy` | Privacy policy |
| `/terms` | Terms of service |

### Public Collection

The `/collection` page shows only lots that have `show_on_website = true` in the database. Staff can toggle this flag per lot from inside the inventory app. Images are served from Cloudinary CDN.

---

## Inventory Management App

All routes under `/inventory/*` require authentication. Unauthenticated users are redirected to `/inventory/login`.

### Page Map

| Route | Description | Min Role |
|---|---|---|
| `/inventory/login` | Email + password login | — |
| `/inventory/forgot-password` | Send reset email | — |
| `/inventory/reset-password` | Set new password | — |
| `/inventory/dashboard` | KPIs, charts, stock summary | Staff |
| `/inventory/list` | Paginated slab inventory, filters, search | Staff |
| `/inventory/add` | Add new lot with slabs | Staff |
| `/inventory/edit/[id]` | Edit lot details | Staff |
| `/inventory/lot/[id]` | Lot detail with all slabs | Staff |
| `/inventory/lot/[id]/add-slab` | Add a slab to existing lot | Staff |
| `/inventory/lot/[id]/edit` | Edit lot inline | Staff |
| `/inventory/lot/[id]/view` | Print-friendly lot view | Staff |
| `/inventory/lot/[id]/labels` | QR label sheet for lot | Staff |
| `/inventory/slab/[id]` | Slab detail with images and history | Staff |
| `/inventory/slab/[id]/view` | Print-friendly slab view | Staff |
| `/inventory/slab/[id]/label` | QR label for single slab | Staff |
| `/inventory/movement` | Warehouse transfers | Staff |
| `/inventory/quotations` | Build & export quotations (Excel) | Staff |
| `/inventory/reports` | Analytics & custom reports | Staff |
| `/inventory/leads` | Client CRM | Staff |
| `/inventory/audit` | System audit log | Admin |
| `/inventory/archive` | Soft-deleted items & restore | Admin |
| `/inventory/journal` | Internal notes | Admin |
| `/inventory/settings` | App configuration | Admin |
| `/inventory/users` | User management | Superadmin |

---

## Authentication & Roles

### Login Flow

1. User visits `/inventory/login` and submits email + password.
2. `login()` server action calls `supabase.auth.signInWithPassword()`.
3. On success, Supabase sets a session cookie (handled by `@supabase/ssr`).
4. User is redirected to `/inventory/dashboard`.
5. Every protected page calls `getCurrentUserProfile()` which reads the session cookie server-side. If no valid session exists, the user is redirected to login.

### Password Reset Flow

1. User requests reset at `/inventory/forgot-password`.
2. `forgotPassword()` server action calls `supabase.auth.resetPasswordForEmail()`.
3. Supabase sends an email with a magic link pointing to `/inventory/auth/callback`.
4. The callback route exchanges the code for a session, then redirects to `/inventory/reset-password`.
5. User sets a new password.

### Invite / New User Flow

1. Superadmin creates a new user in `/inventory/users`.
2. Supabase Admin API (using `service_role` key) sends a magic-link invite email.
3. User clicks the link, lands on `/inventory/auth/callback`, then is taken to `/inventory/reset-password` to set their password.

### Role System

There are 3 roles defined in the `user_profiles` table:

| Role | Access Level |
|---|---|
| `superadmin` | Everything, including user management |
| `admin` | All inventory operations + audit log, archive, journal, settings |
| `staff` | View inventory, add/edit stock, movements, quotations, leads |

### Granular Permissions

On top of roles, 9 permissions can be toggled per-user in `user_permissions`:

| Permission | Default |
|---|---|
| `view_cost_price` | Admin+ |
| `view_dashboard` | All |
| `manage_users` | Superadmin only |
| `delete_records` | Admin+ |
| `view_audit_log` | Admin+ |
| `view_archive` | Admin+ |
| `manage_settings` | Admin+ |
| `write_journal` | Admin+ |
| `view_all_warehouses` | Admin+ |

### Warehouse Access Control

Staff users can be restricted to specific warehouses via `user_warehouse_access`. When set, the inventory list and movement pages show only slabs from those warehouses.

---

## Database Schema

### Core Tables

**`marble_lots`** — One lot = one purchase/shipment of marble
```
id, lot_number, marble_name, category_id, thickness_id,
purchase_date, invoice_number, supplier,
cost_price, selling_price, dealer_price,
notes, show_on_website, is_deleted, created_at
```

**`slabs`** — Individual marble slabs within a lot
```
id, slab_code, lot_id, warehouse_id, rack_number,
length, width, sqft (computed from length × width),
cost_price, selling_price, dealer_price,
status_id, reserved_for, reserved_until,
notes, is_deleted, created_at
```

**`slab_images`** — Photos for each slab (max 8 per slab)
```
id, slab_id, image_url, public_id (Cloudinary), sort_order
```

### Lookup Tables

```
marble_categories   — Stone type (Marble, Granite, Quartzite, etc.)
thickness_options   — Slab thickness (18mm, 20mm, 30mm, etc.)
warehouses          — Physical locations
slab_statuses       — Available, Reserved, Sold, Damaged, etc.
```

### Users & Permissions

```
user_profiles         — user_id (→ auth.users), display_name, role
user_permissions      — user_id, permission, enabled
user_warehouse_access — user_id, warehouse_id
```

### Movement & Transfers

**`slab_movements`** — Audit trail: one row every time a slab changes location
```
id, slab_id, event_type, from_location, to_location, notes, created_at, created_by
```

**`transfer_requests`** — Formal inter-warehouse transfers
```
id, from_warehouse_id, to_warehouse_id,
status (in_transit | received | cancelled),
notes, created_by, created_at, received_at
```

**`transfer_request_items`** — Slabs inside a transfer
```
id, transfer_request_id, slab_id, new_rack_number, received_notes
```

### CRM & Business

**`client_leads`** — Client enquiries with detailed project breakdown
```
id, client_name, contact_no, email, city, source,
requirement_sqft, material_category, budget,
architect_name, contractor_name, project_type,
facade, bedroom, bathroom, kitchen, interior_wall_cladding,
main_flooring, staircase, temple,
converted, first_visit_date, notes, created_at
```

**`audit_log`** — System-wide action log
```
id, user_id, user_email, action, target_type, target_id,
target_label, diff (JSON before/after), timestamp
```

---

## Key Features

### 1. Lot & Slab Management

A **Lot** is a purchase batch (e.g., "50 slabs of Italian Carrara Marble, invoice #TG-2025-001"). Each lot contains multiple **Slabs** with individual dimensions and pricing.

- Create a lot with a full batch of slabs in one form (`/inventory/add`).
- Each slab gets a unique `slab_code` for tracking.
- Slabs can have up to **8 photos** each, stored in Cloudinary.
- Lots can be toggled to appear on the **public website** (`show_on_website`).
- Both lots and slabs support **soft delete** (moved to archive, not permanently removed).

### 2. Inventory List (`/inventory/list`)

A paginated, filterable, sortable table of all slabs:
- **Filter by:** warehouse, status, category, thickness
- **Search:** by lot number, slab code, marble name
- **Sort:** by any column
- **Pagination:** 20 lots per page
- **Batch actions:** update prices, update status, delete multiple

### 3. Dashboard (`/inventory/dashboard`)

Real-time KPIs from aggregation queries:
- Total slab count, total sqft, total stock value
- Breakdown by warehouse, category, and status
- Charts via Recharts
- Cost price visibility is permission-gated

### 4. Warehouse Movement (`/inventory/movement`)

Two types of stock movement:

**Immediate move:** Move a slab to a different warehouse/rack instantly. A `slab_movements` record is written.

**Transfer request:** Create a formal transfer (e.g., Ahmedabad → Ambaji warehouse). Slabs enter `in_transit` status. Receiving warehouse confirms receipt and assigns rack numbers. The transfer is logged and slabs update to the new location automatically.

### 5. Quotation Builder (`/inventory/quotations`)

Build a list of slabs and export as a professionally formatted **Excel file**:
- 13 columns: Slab Code, Marble Name, Lot Number, Category, Length, Width, Sqft, Thickness, Rack, Location, Status, Price, Notes
- Status cells have color coding (green = available, yellow = reserved, red = sold)
- Auto-filter enabled on all columns
- Header row frozen for scrolling
- Totals row at the bottom

### 6. Client CRM (`/inventory/leads`)

Track potential client enquiries with:
- Contact info (name, phone, email, city)
- Project details (type, sqft requirement, budget, material category)
- Room-wise breakdown (facade, bedroom, bathroom, kitchen, flooring, staircase, temple)
- Associated architect and contractor names
- Lead source tracking
- `converted` flag to mark closed deals

### 7. Archive & Restore (`/inventory/archive`)

Deleted lots and slabs are soft-deleted (flagged `is_deleted = true`), not permanently removed. Admin users can:
- Browse all deleted items
- **Restore** individual lots or slabs
- **Permanently delete** (hard delete, irreversible)
- **Batch delete** multiple items

### 8. User Management (`/inventory/users`)

Superadmin-only section to:
- Invite new users via email (Supabase magic link)
- Set roles (staff / admin / superadmin)
- Toggle individual permissions per user
- Assign warehouse access restrictions
- Deactivate or delete users

---

## API Routes

### `GET /inventory/auth/callback`

Handles the Supabase OAuth code exchange after password reset emails and magic link invites.

- Receives `code` in the query string.
- Exchanges the code for a Supabase session.
- Redirects to `/inventory/reset-password` for new invites, or a custom `next` URL otherwise.

### `GET /inventory/export`

Generates and streams a formatted `.xlsx` Excel file.

**Query parameters:**
- `warehouse` — filter by warehouse ID
- `status` — filter by slab status
- `search` — text search across slab code, marble name, lot number

Requires an active authenticated session (returns 401 if not logged in). Uses ExcelJS to build the workbook in memory, then streams it as a binary download.

---

## Image Handling (Cloudinary)

All slab photos are stored on Cloudinary.

**Upload process:**
1. User selects images on the slab edit page.
2. Images are uploaded from the browser directly to Cloudinary using an unsigned upload preset.
3. Cloudinary returns a `public_id` and `secure_url`.
4. A server action saves these to the `slab_images` table.
5. If the DB insert fails, `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` are used server-side to delete the orphaned Cloudinary asset (cleanup on failure).

**Constraints:**
- Max **8 images per slab**
- Auto-converted to **WebP** format on upload
- Images can be **reordered** (drag-and-drop, stored as `sort_order`)
- Images can be **individually deleted**

**Source files:**
- [src/lib/cloudinary/upload.ts](src/lib/cloudinary/upload.ts) — Upload logic
- [src/lib/cloudinary/compress.ts](src/lib/cloudinary/compress.ts) — Compression helpers
- [src/lib/cloudinary/config.ts](src/lib/cloudinary/config.ts) — Config & validation

---

## Email & CAPTCHA

### Contact Form (`/contact`)

1. User fills in the contact form.
2. **Cloudflare Turnstile** renders a bot challenge (configured via `NEXT_PUBLIC_TURNSTILE_SITE_KEY`).
3. On submit, the server action verifies the Turnstile token against Cloudflare's API using `TURNSTILE_SECRET_KEY`.
4. If valid, **Resend** delivers the email using `RESEND_API_KEY` to the business inbox.

### Password Reset Emails

Handled entirely by Supabase Auth — no custom email setup required. Supabase sends the magic link.

---

## Excel Export

The export (`GET /inventory/export`) produces a `.xlsx` file with the following columns:

| Column | Notes |
|---|---|
| Slab Code | Unique slab identifier |
| Marble Name | From parent lot |
| Lot Number | Invoice/lot reference |
| Category | Stone type |
| Length (cm) | Slab dimension |
| Width (cm) | Slab dimension |
| Sqft | Computed from dimensions |
| Thickness | In mm |
| Rack | Storage rack number |
| Location | Warehouse name |
| Status | Available / Reserved / Sold |
| Selling Price | Price per sqft or per slab |
| Notes | Free text |

**ExcelJS formatting applied:**
- Header row: bold, colored background, frozen (stays visible when scrolling)
- Auto-filter on all columns
- Status cells: background color by status (green, amber, red, grey)
- Totals row at the bottom (sum of sqft, count of slabs)
- Column widths auto-fitted to content

---

## QR Code & Labels

Every slab and lot has a dedicated **label print page**:

- `/inventory/lot/[id]/labels` — Full sheet of QR labels for all slabs in the lot
- `/inventory/slab/[id]/label` — Single slab QR label

Each label contains:
- QR code encoding the direct slab URL
- Slab code, marble name, dimensions, rack number, warehouse

**QR scanning** is built into the app via `html5-qrcode`. Staff can scan a label with their phone camera and be taken directly to that slab's detail page.

Label pages are designed for printing with CSS `@media print` styles — no navigation chrome appears in print output.

---

## Audit Trail

Every significant mutation writes a record to `audit_log` via the `logAudit()` helper in [src/app/inventory/_lib/audit-log.ts](src/app/inventory/_lib/audit-log.ts).

**Events logged:**

| Event | Target |
|---|---|
| `create` | lot, slab, lead, user |
| `update` | lot, slab, lead, settings |
| `delete` (soft) | lot, slab |
| `restore` | lot, slab |
| `permanent_delete` | lot, slab |
| `status_change` | slab |
| `movement` | slab |
| `transfer_create` | transfer_request |
| `transfer_receive` | transfer_request |
| `transfer_cancel` | transfer_request |
| `image_add` | slab |
| `image_delete` | slab |
| `website_toggle` | lot |
| `quotation_export` | export |

Each log entry includes a JSON `diff` with before/after values for update events, making it straightforward to see exactly what changed and when.

The audit log is viewable at `/inventory/audit` (admin and superadmin only).

---

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel.
2. Set all environment variables from `.env.local` in the Vercel dashboard.
3. Deploy — Vercel handles serverless functions for API routes and Server Actions automatically.

### Self-hosted Node.js

```bash
npm run build
npm run start    # Starts on port 3000
```

### Supabase Setup

1. Create a Supabase project at supabase.com.
2. Run the SQL from `supabase/migrations/` in the Supabase SQL editor.
3. Configure Supabase Auth:
   - Enable the **Email provider**.
   - Set the **Site URL** to your production domain.
   - Add `/inventory/auth/callback` as an allowed redirect URL.
4. Create the first `superadmin` user in Supabase Auth dashboard, then insert their profile into `user_profiles` with `role = 'superadmin'`.

### Cloudinary Setup

1. Create a Cloudinary account.
2. Create an **unsigned upload preset** (allows browser-side uploads without exposing secrets).
3. Set `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` in your environment variables.

---

## Scripts Reference

```bash
npm run dev             # Development server (localhost:3000)
npm run dev:lan         # Dev server accessible on local network
npm run dev:lan:https   # Dev with HTTPS (needed for camera/QR on mobile browsers)
npm run build           # Production build
npm run start           # Start production server
npm run lint            # ESLint check
npm test                # Run Vitest tests
npm run test:watch      # Vitest in watch mode
```
