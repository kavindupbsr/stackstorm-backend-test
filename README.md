# StackStorm Backend Service (`stackstorm-backend`)

> **Enterprise-Grade Modular Monolith REST API for Dickwella Fashion Corner**  
> Department of Software Engineering, Faculty of Science, University of Kelaniya  
> Academic Course: **SENG 31242 – Software Engineering Project** (16-Week Delivery Cycle)

---

## 1. Project Overview & Context

`stackstorm-backend` is the core server-side application powering the **Dickwella Fashion Corner** e-commerce platform. Designed as a horizontally scalable, layered modular monolith (`Controller -> Service -> Model -> Database`), it provides robust REST APIs adhering strictly to JSON:API conventions, resilient stock reservation, localized Sri Lankan payment processing (LKR), and high-security session management.

### Key Business & Technical Constraints
- **Strict Currency Standard:** Exclusively Sri Lankan Rupees (`LKR X,XXX.00`). No multi-currency drift.
- **Guest Checkout Support:** `ORDER.customer_id` is nullable with embedded contact/shipping snapshot.
- **Strict Return/Exchange Policy:** 30-day window anchored to actual delivery date (excluding final-sale items).
- **1:1 Loyalty Program:** Unified Customer-Loyalty architecture with automated tier accruals and 2-quarter downgrade grace periods.
- **Zero-Drift Containerization:** PostgreSQL 17 and Redis 7 provisioned via Docker Compose.

---

## 2. Multi-Repository Topology

The StackStorm platform is structured across four dedicated repositories to enable independent deployment lifecycles and conflict-free collaboration among the 4 student engineers:

| Repository | Responsibility | Technology Stack |
|---|---|---|
| **`stackstorm-backend`** *(This Repository)* | REST API Gateway, Business Services, DB ORM, Redis Cache, Real-time WebSockets | Node.js 20 LTS, Express.js 4, PostgreSQL 17, Sequelize 6, Redis 7, Socket.IO 4 |
| **`stackstorm-frontend-customer`** | Customer-facing Storefront SPA (Browsing, Cart, Checkout, Profile, Tracking) | React 18, Vite, Vanilla CSS Tokens, CSS Modules |
| **`stackstorm-frontend-admin`** | Internal Retail Management Portal (Catalog, Inventory, Order Fulfillment, Analytics) | React 18, Vite, Vanilla CSS Tokens, Charting |
| **`stackstorm-docs`** | Academic SRS, SDS, API Specifications, Architecture Diagrams & Manuals | Markdown, Mermaid, OpenAPI 3.0 |

---

## 3. Git Branching Strategy & Git Flow Standard

To guarantee branch stability and prevent direct-to-main regressions, all four team members adhere to strict Git Flow conventions:

```text
main (Production Releases, Protected)
  ▲
  │ (Tagged Release PR)
develop (Active Integration Branch, Protected)
  ▲
  ├── feature/STORM-XXX-<slug>    (New feature development)
  ├── bugfix/STORM-XXX-<slug>     (Defect resolution during sprint)
  ├── chore/STORM-XXX-<slug>      (Scaffolding, dependencies, CI/CD)
  └── hotfix/STORM-XXX-<slug>     (Emergency production patch directly off main)
```

### Branch Naming Rules
- **Features:** `feature/STORM-XXX-short-description` (e.g., `feature/STORM-007-user-roles-model`)
- **Chores/Setup:** `chore/STORM-XXX-short-description` (e.g., `chore/STORM-001-multi-repo-setup`)
- **Bugfixes:** `bugfix/STORM-XXX-short-description` (e.g., `bugfix/STORM-014-lockout-ttl-fix`)

### Branch Protection Policy
1. Direct pushes to `main` and `develop` are **strictly blocked**.
2. Merging requires at least **1 peer code review approval**.
3. All GitHub Actions CI checks (ESLint, Prettier, Jest test suite >= 80% coverage) must pass.

---

## 4. Student Engineering Team

| Student Name | Student Number | Primary Module Ownership |
|---|---|---|
| **Amarawickrama R.H.** | SE/2021/008 | Multi-Repo, GitHub CI, S3 Upload Pipeline, Order Logic, Real-Time Socket.IO |
| **S. Thanoogithan** | SE/2021/045 | Docker Infrastructure, Sequelize ORM Config, Redis Lockout, Concurrency & Returns |
| **B.K. Pabasara** | SE/2021/062 | Express Foundation, Response Formatting, User Models, Checkout Flow, Loyalty Program |
| **Lakshani A.T.** | SE/2021/089 | Centralized Winston Logger, Catalog/Variant Schema, RBAC Guards, Admin Dashboards |

---

## 5. Quickstart Guide

### Prerequisites
- **Node.js:** `v20.x LTS` (tested on Node v20.15+)
- **npm:** `v10.x+`
- **Git:** `v2.40+`
- **Docker Desktop:** Container engine for PostgreSQL 17 and Redis 7

### Installation
```bash
# 1. Clone repository
git clone https://github.com/stackstorm/stackstorm-backend.git
cd stackstorm-backend

# 2. Switch to development branch
git checkout develop

# 3. Install dependencies
npm install

# 4. Run shift-left test suite
npm test
```

---

## 6. Directory Structure (Target Monolith Layout)

```text
stackstorm-backend/
├── .editorconfig          # Consistent multi-editor formatting
├── .gitattributes         # Enforced LF line endings
├── .gitignore              # Repository exclusions (secrets, node_modules)
├── package.json            # Node.js project manifest and scripts
├── README.md               # Backend documentation and developer manual
├── docker-compose.yml      # (STORM-002) PostgreSQL 17 & Redis 7 containers
├── src/                    # Source code root
│   ├── config/             # Environment, DB, Redis, and logger configs
│   ├── controllers/        # HTTP request orchestrators
│   ├── middlewares/        # Auth, rate-limiter, validator, error handlers
│   ├── models/             # Sequelize ORM schema definitions
│   ├── routes/             # REST route endpoints (/api/v1/...)
│   ├── services/           # Core domain business logic
│   └── utils/              # Response formatters, constants, helpers
└── tests/                  # Automated test suites
    ├── unit/               # Fast, shift-left isolated unit tests
    └── integration/        # Supertest API and database integration tests
```

---

## 7. License & Academic Attribution
Developed exclusively for academic evaluation under **SENG 31242: Software Engineering Project**, Department of Software Engineering, University of Kelaniya.  
Client: **Dickwella Fashion Corner**, Matara/Dickwella, Southern Province, Sri Lanka.
