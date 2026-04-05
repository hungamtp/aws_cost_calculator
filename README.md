# AWS Service Cost Calculator

A dynamic, drag-and-drop Next.js application that visualizes AWS architectures and estimates their real-time monthly service costs.

## Getting Started

### 1. Docker Development Environment
The easiest and most reproducible way to run this application is via Docker. This runs the app cleanly in Alpine Node without requiring local dependencies.

```bash
# Build and spin up the development container
docker-compose up --build
```
> Note: Since your local directory is volume-mapped, any changes made to `app/page.tsx` will auto-update live on `http://localhost:3000`.

### 2. Standard Local Development
If you prefer running it natively on your machine without Docker:

```bash
npm install
npm run dev
```

## Testing Setup
This project uses **Vitest** for isolated unit testing, ensuring that backend calculation rules are flawless.

```bash
# Run the test suite normally
npm run test

# Run the test suite and output a detailed V8 test coverage report
npm run test:coverage
```
*Note: Running `test:coverage` will generate a detailed HTML report inside the `/coverage` directory outlining exactly which component lines lack test coverage.*

## Production Builds
This Next.js application is strictly configured to compile down to a highly optimized `standalone` build for production, using a multi-stage `Dockerfile`.

```bash
# To verify the production multi-stage build locally:
docker build -t aws-cost-calculator .
docker run -p 3000:3000 aws-cost-calculator
```
