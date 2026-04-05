# AWS Cost Estimator — Project Plan

## 🎯 Project overview

A web application that helps users estimate the monthly and annual cost of their AWS infrastructure. Users input their service configurations and receive an itemized cost breakdown with savings suggestions.

**Stack:** Next.js (fullstack) · AWS Pricing API · Vercel (deploy)

> ✅ **Decision (Apr 2026):** Dropped Spring Boot. The backend logic is pure math — pricing lookups + calculations — which fits perfectly into Next.js API Routes. Single repo, single deploy, less overhead.
> 

---

## 🧩 Core features

- Select AWS region (affects all pricing)
- Choose from all major AWS service categories
- Fill in configuration inputs per service
- Live cost calculation and itemized summary
- Cost breakdown visualization (by category)
- Savings tips (e.g. Reserved vs On-Demand)
- Export estimate as PDF
- Share estimate via link
- Compare costs across regions

---

## 🗂️ AWS services to support

- Compute
    - EC2 — instance type, OS, quantity, hours/mo, pricing model (On-Demand / Reserved 1yr / Reserved 3yr / Spot)
    - Lambda — requests/mo, avg duration (ms), memory (MB), architecture (x86 / ARM)
    - Fargate / ECS — vCPU, memory, hours/mo, number of tasks
    - EKS — number of clusters, node type, node count
- Storage
    - S3 — storage class, size (GB), PUT/GET requests, data retrieved, transfer out
    - EBS — volume type, size (GB), IOPS, throughput, snapshots
    - EFS — size (GB), storage class, throughput mode
- Database
    - RDS — engine, instance class, Single/Multi-AZ, storage, backups, read replicas
    - Aurora — engine, serverless or provisioned, ACUs, storage, I/O
    - DynamoDB — RCU/WCU or on-demand, storage, DAX, global tables
    - ElastiCache — engine (Redis/Memcached), node type, node count
- Networking
    - Data transfer — outbound internet, inter-region, inter-AZ
    - CloudFront — data transfer out, HTTP/HTTPS requests, origin type
    - API Gateway — type (REST/HTTP/WebSocket), calls/mo, data out
    - NAT Gateway — hours active, data processed
    - Load Balancer — type (ALB/NLB/CLB), hours, LCUs
    - Route 53 — hosted zones, DNS queries, health checks
- Security & monitoring
    - WAF — Web ACLs, rules, requests/mo
    - CloudWatch — custom metrics, log ingestion, alarms, dashboards
    - Secrets Manager — secrets count, API calls/mo
    - CloudTrail — management/data events
- Messaging
    - SQS — requests/mo, message size, queue type (Standard/FIFO)
    - SNS — publishes/mo, delivery type, SMS destination
    - SES — emails sent/mo, attachments

---

## 🖥️ UI/UX design

**3-panel layout:**

1. **Left sidebar** — Draggable palette of AWS services grouped by category.
2. **Center canvas (Design Screen)** — A visual drag-and-drop architecture canvas. When a user finishes the Smart Intake Wizard, the recommended AWS services are automatically mapped here as visual nodes. Clicking a node opens a properties panel to fine-tune its cost configuration.
3. **Right summary panel** — live cost breakdown, bar chart by category, savings tips, export actions.

**Key UX patterns:**

- Visual Drag-and-Drop — Place services physically on the map to visualize architecture.
- Global region selector at the top (affects all service prices)
- Free tier badges shown inline inside nodes
- Savings tip surfaced automatically

---

## 🏗️ System architecture

### Frontend — Next.js

```
src/
  app/
    page.tsx               ← Landing / home
    estimator/
      page.tsx             ← Main estimator page
      layout.tsx
  components/
    sidebar/
      ServiceSidebar.tsx
      ServiceGroup.tsx
    services/
      EC2Form.tsx
      S3Form.tsx
      RDSForm.tsx
      LambdaForm.tsx
      ...etc
    summary/
      CostSummary.tsx
      BreakdownChart.tsx
      SavingsTip.tsx
    shared/
      RegionSelector.tsx
      FieldRow.tsx
      PricingModelTabs.tsx
  hooks/
    useCostEstimate.ts
    useServiceConfig.ts
  lib/
    api.ts                 ← Spring Boot API calls
    types.ts
```

### Backend — Spring Boot

```
src/main/java/com/awsestimator/
  controller/
    EstimateController.java    ← POST /api/estimate
    PricingController.java     ← GET /api/pricing/{service}
  service/
    PricingService.java        ← Fetches from AWS Pricing API
    EstimateCalculator.java    ← Core calculation logic
    CacheService.java          ← Cache pricing data (Redis/in-memory)
  model/
    EstimateRequest.java
    EstimateResponse.java
    ServiceConfig.java
  pricing/
    EC2PricingStrategy.java
    S3PricingStrategy.java
    RDSPricingStrategy.java
    ...etc
```

### Key API endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/estimate` | Calculate full cost estimate |
| GET | `/api/pricing/regions` | List all AWS regions |
| GET | `/api/pricing/{service}` | Get pricing options for a service |
| GET | `/api/pricing/instance-types` | EC2 instance types list |
| POST | `/api/estimate/export` | Generate PDF export |
| GET | `/api/estimate/{id}` | Load shared estimate by ID |

---

## 🗓️ Development phases

### Phase 1 — Foundation (week 1–2)

- [ ]  Project scaffolding (Next.js + Spring Boot)
- [ ]  AWS Pricing API integration (Spring Boot)
- [ ]  Region selector + global state (Next.js)
- [ ]  EC2, S3, RDS forms (most common services)
- [ ]  Basic cost summary panel

### Phase 2 — Expand services (week 3–4)

- [ ]  Lambda, Fargate, EKS forms
- [ ]  DynamoDB, Aurora, ElastiCache forms
- [ ]  Networking services (CloudFront, API Gateway, NAT, ALB)
- [ ]  Pricing model tabs (Reserved / Spot)
- [ ]  Free tier detection and badges

### Phase 3 — Polish & features (week 5–6)

- [ ]  Savings tips engine
- [ ]  Cost breakdown bar chart
- [ ]  PDF export
- [ ]  Share estimate via link (persisted estimate ID)
- [ ]  Multi-region comparison view
- [ ]  Mobile responsive layout

### Phase 4 — Production readiness (week 7–8)

- [ ]  AWS Pricing data caching (TTL: 24h)
- [ ]  Error handling & loading states
- [ ]  Unit tests (Spring Boot services)
- [ ]  Component tests (Next.js)
- [ ]  Deployment (Vercel for FE, AWS/Railway for BE)
- [ ]  CI/CD pipeline

---

## ⚠️ Key technical decisions

> **Stack: Next.js only** — No Spring Boot. All calculation logic lives in `/app/api/` Route Handlers. This keeps the repo simple, deployment is a single `vercel deploy`, and there's no Java infra to maintain.
> 

> **Pricing data: AWS SDK + Next.js Native Cache** — Fetch exact pricing points dynamically via `@aws-sdk/client-pricing` and cache them natively on the Next.js server using `unstable_cache` with a 7-day revalidation rule (`revalidate: 604800`). This perfectly caches prices without needing cron jobs, GitHub Actions, or giant 1GB JSON files.
>

> **Calculation logic: pure functions per service** — Each service gets its own `lib/pricing/ec2.ts` file exporting a pure function `calculateEC2Cost(config) → number`. Easy to test, easy to extend.
> 

> **State management: Zustand** — Use Zustand to hold the full service config across the 3-panel layout. Lightweight, no boilerplate, works well with Next.js App Router.
> 

> **PDF export: `@react-pdf/renderer`** — Render the estimate summary as a PDF entirely in the browser or in an API route. No headless browser needed.
> 

> **Share links: Vercel KV** — Store serialized estimate JSON keyed by a short nanoid. Free tier is sufficient for MVP.
> 

> **Visual Canvas: React Flow** — Use `reactflow` to power the drag-and-drop design screen. It supports custom nodes and drag-and-drop natively, making it easy to translate UI nodes to the underlying JSON cost payload.
> 

> **Pricing accuracy disclaimer** — Always show a disclaimer that estimates are approximate and actual AWS bills may differ based on usage patterns.
> 

---

## 📌 Open questions

- [ ]  Do we want user accounts to save/load estimates?
- [ ]  Should we support AWS Organizations / consolidated billing?
- [ ]  Support for AWS Savings Plans (not just Reserved Instances)?
- [ ]  Internationalization — show prices in local currency?
- [ ]  Integrate directly with AWS Cost Explorer for real vs estimated comparison?
- [ ]  How should default assumptions derived from the Intake Wizard (like inter-AZ traffic ratios or baseline EBS volumes) be surfaced logically to the user so they understand why they were added?

[Smart Intake Form — Traffic & Config Wizard](https://www.notion.so/Smart-Intake-Form-Traffic-Config-Wizard-339fdd5d108f814cbceeccee8f978fe5?pvs=21)