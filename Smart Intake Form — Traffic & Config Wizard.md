# Smart Intake Form — Traffic & Config Wizard

## Overview

Instead of asking users to know their AWS config upfront, this wizard asks about their **workload and traffic in plain language**, then translates those inputs into recommended AWS service configurations and a cost estimate.

This is the entry point of the estimator — users who don't know AWS fill this out; experienced users can skip straight to the manual estimator.

---

## 🪜 Wizard steps

| Step | Title | Purpose |
| --- | --- | --- |
| 1 | App type | What kind of application is this? |
| 2 | Traffic & usage | How much load does it handle? |
| 3 | Data & storage | What data does it store and access? |
| 4 | Requirements | Availability, compliance, DR needs |
| 5 | Recommendation | Suggested AWS config + estimated cost |

---

## 📋 Step 1 — App type

Ask the user what kind of application they are running. This helps determine the compute pattern.

**Input: single-select chips**

- Web application (server-rendered)
- REST API / backend service
- Mobile backend
- Static website / JAMstack
- Data pipeline / ETL
- Machine learning / AI workload
- Internal tool / admin panel
- Other

**Output used for:** instance family selection (compute-optimized vs general purpose vs memory-optimized), whether Lambda/Fargate is a better fit than EC2.

---

## 📋 Step 2 — Traffic & usage

The core intake step. All inputs are in workload language, not AWS language.

### Inputs

**Monthly active users (MAU)**

Slider: 1K → 10K → 50K → 100K → 500K → 1M → 5M+

**Peak requests per second (RPS)**

Slider: 10 → 50 → 200 → 500 → 1,000 → 5,000+

**Traffic pattern** — chips (single select)

- Steady / always-on
- Business hours only
- Spiky / unpredictable
- Batch / scheduled jobs

**Average response time target** — chips

- < 100ms
- 100 – 500ms
- 
    
    > 500ms is fine
    > 

**Avg request payload size** — select

- Tiny (< 1KB) — API / JSON
- Small (1–50KB)
- Medium (50KB–1MB)
- Large (> 1MB) — file uploads

**Avg response payload size** — select

- Tiny (< 1KB)
- Small (1–50KB) — JSON / HTML
- Medium (50KB–1MB) — images
- Large (> 1MB) — video / files

**Workload type** — chips (single select)

- CPU light — mostly I/O, DB queries
- CPU moderate — business logic
- CPU heavy — video, ML, encoding
- Memory heavy — caching, in-memory

**Outbound data to internet (GB/mo)**

Slider: 10 GB → 100 GB → 500 GB → 1 TB → 5 TB → 10 TB+

**Where are your users?** — chips

- Single region
- Multi-region
- Global

---

## 📋 Step 3 — Data & storage

**Do you use a database?** — yes / no

If yes:

- Database type: Relational (Open-source MySQL/PostgreSQL) / Relational (Commercial Oracle/SQL Server) / NoSQL / Both
- Estimated data size: < 10 GB / 10–100 GB / 100 GB–1 TB / > 1 TB
- Read/write ratio: Read-heavy (80/20) / Balanced (50/50) / Write-heavy (20/80)
- Need high availability (Multi-AZ)? Yes / No
- Backup retention: 7 days / 14 days / 30 days

**Do you store files or media?** — yes / no

If yes:

- Type: Images / Videos / Documents / Mixed
- Estimated storage: < 50 GB / 50–500 GB / 500 GB–5 TB / > 5 TB
- Access frequency: Frequently accessed / Infrequent / Archive

---

## 📋 Step 4 — Requirements

**Availability SLA target** — chips

- 99.5% (acceptable downtime ~3.6 days/yr)
- 99.9% (acceptable downtime ~8.7 hrs/yr)
- 99.99% (acceptable downtime ~52 min/yr)

**Do you need a CDN?** — yes / no / not sure

**Do you need a load balancer?** — yes / no / not sure

**Are there background jobs, event queues, or automated notifications?** — multi-select chips

- None
- Message queues (async task processing)
- Automated Emails / SMS

**Compliance requirements** — multi-select chips

- None
- GDPR
- HIPAA
- PCI DSS
- SOC 2

**Deployment preference** — chips

- Fully managed (Serverless, Fargate, tight AWS integration)
- Container ecosystem (Kubernetes / EKS)
- Balanced (Standard instances/containers)
- Full control (more ops, bare-metal flexibility)

---

## 📋 Step 5 — Recommendation output

This step shows the suggested AWS configuration derived from steps 1–4, with cost estimates per service.

### Layout

- Info callout summarizing the inputs used for the recommendation
- One result card per recommended service (EC2, ALB, CloudFront, RDS, S3, etc.)
- Each card shows: service name, recommended config, reason, estimated monthly cost
- Optional services are clearly badged as "Optional"
- Total compute cost summary bar at the bottom
- Warning that this is compute only — database/storage costs shown separately
- CTA: "Use this config" → pre-fills the full manual estimator
- CTA: "Why this config?" → explains reasoning in plain English

---

## 🔁 Recommendation logic

### EC2 instance sizing (from RPS + workload type)

| RPS | Workload | Recommended instance |
| --- | --- | --- |
| < 50 | CPU light | t3.small / t3.medium |
| < 50 | CPU moderate | t3.medium / t3.large |
| 50–200 | CPU light | t3.medium × 2 |
| 50–200 | CPU moderate | m5.large × 2 |
| 200–500 | CPU light | m5.large × 2–3 |
| 200–500 | CPU heavy | c5.xlarge × 2–3 |
| 500–1000 | Any | c5.xlarge+ with auto scaling |
| 1000+ | Any | c5.2xlarge+ with auto scaling |

### Lambda vs EC2 decision

- Use **Lambda** if: traffic pattern is spiky/batch, RPS < 200, workload is CPU light, app type is API/mobile backend
- Use **EC2** if: steady traffic, RPS > 200, or workload is CPU/memory heavy
- Use **Fargate** if: user selected "fully managed" + containerized workload
- Use **EKS** if: user selected "Container ecosystem (Kubernetes / EKS)" under deployment preferences

### Load balancer rule

- Always recommend ALB if EC2 instance count > 1
- Recommend NLB if latency target is < 100ms

### API Gateway rule

- Always recommend **API Gateway** if App type is "REST API / backend service" OR "Mobile backend", AND recommended compute is Lambda. (Estimate calls based on RPS).

### Compute Storage (EBS) rule

- For every recommended EC2 instance, always attach a baseline **General Purpose SSD (gp3) EBS volume** (e.g., 20GB or 50GB) for OS and local storage.

### Database & Caching recommendation

| DB type | Size | HA needed | Recommended |
| --- | --- | --- | --- |
| Rel. (Open) | Any | No | RDS MySQL/PostgreSQL t3.medium Single-AZ |
| Rel. (Open) | Any | Yes | RDS MySQL/PostgreSQL r5.large Multi-AZ |
| Rel. (Comm.) | Any | No | RDS Oracle/SQL Server t3.medium |
| Relational | > 1TB | Yes | Aurora |
| NoSQL | Any | No | DynamoDB on-demand |
| NoSQL | High write | Yes | DynamoDB provisioned + DAX |

- **ElastiCache (Redis):** Recommend if Latency target is `< 100ms` AND DB is Relational, to handle read-heavy loads.

### Internal Traffic & Networking rule

- If a Multi-AZ Database is recommended, automatically assume 10-20% of outbound data is also transferred internally across AZs to cover synchronous replication or internal microservice chatter.

### Messaging & Background Jobs rule

- Recommend **SQS** if "Message queues (async task processing)" is selected.
- Recommend **SES** and **SNS** if "Automated Emails / SMS" is selected.

---

## 🧩 Component breakdown (Next.js)

```
components/
  intake/
    IntakeWizard.tsx         ← stepper shell, step router
    steps/
      Step1AppType.tsx
      Step2Traffic.tsx
      Step3Storage.tsx
      Step4Requirements.tsx
      Step5Recommendation.tsx
    shared/
      ChipGroup.tsx
      SliderField.tsx
      ResultCard.tsx

lib/
  recommendation/
    engine.ts                ← maps IntakeConfig → RecommendedConfig
    rules/
      compute.ts             ← EC2 / Lambda / Fargate decision logic
      database.ts            ← RDS / Aurora / DynamoDB / ElastiCache logic
      network.ts             ← ALB / CloudFront / API Gateway / NAT logic
      storage.ts             ← S3 class / EBS volume recommendation
      messaging.ts           ← SQS / SNS / SES logic
    types.ts

app/
  api/
    recommend/
      route.ts               ← POST /api/recommend
```

---

## 📌 Open questions

- [ ]  Should step 1 (app type) affect which steps are shown? E.g. static site skips database step entirely
- [ ]  Should we allow users to tweak the recommendation before accepting it?
- [ ]  How do we handle edge cases like > 5M MAU where enterprise support is needed?
- [ ]  Should the recommendation engine run client-side (pure JS) or call `/api/recommend`?
- [ ]  Add a "I don't know" escape hatch on each field that uses a sensible default?