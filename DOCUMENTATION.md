# Multi-Target CI/CD Pipeline Documentation

## Overview

This repository uses a multi-target GitHub Actions workflow (`.github/workflows/deploy.yml`) designed for modern web applications. It validates code quality, builds Docker images, publishes artifacts to GitHub Container Registry (GHCR), and supports targeted deployments to **Zoho Catalyst (AppSail)**, **Vercel**, and **AWS (S3)**.

---

## Architecture & Workflow Strategy

```
                      ┌────────────────────────┐
                      │    Push / PR / Tag     │
                      └───────────┬────────────┘
                                  │
                                  ▼
                     ┌──────────────────────────┐
                     │ STAGE 1: Code Quality    │
                     │ (npm ci & npm run build) │
                     └────────────┬─────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ STAGE 3A        │      │ STAGE 3B        │      │ STAGE 3C        │
│ Zoho Catalyst   │      │ Vercel          │      │ AWS S3          │
│ (Development)   │      │ (Production)    │      │ (Static Sync)   │
└────────┬────────┘      └─────────────────┘      └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Manual Promotion│
│ (Catalyst UI)   │
└─────────────────┘
```

### Environment Isolation Policy (Zoho Catalyst)
* **Development Sandbox:** Automated via `zcatalyst-cli` during CI/CD execution.
* **Production Environment:** Immutable by policy. Catalyst does not allow direct CLI or API cross-environment deployments to Production. Once a build is deployed to Development, it must be promoted via the **Catalyst Console**.

---

## Prerequisites & Repository Secrets

Secrets are loaded dynamically. You only need to configure the secrets for the target(s) you intend to use.

| Secret Name | Required For | Description |
| :--- | :--- | :--- |
| `CATALYST_TOKEN` | Zoho Catalyst | Generated via `catalyst login:ci` |
| `VERCEL_TOKEN` | Vercel | Vercel Personal Access Token |
| `AWS_ACCESS_KEY_ID` | AWS | AWS IAM Access Key |
| `AWS_SECRET_ACCESS_KEY` | AWS | AWS IAM Secret Key |
| `AWS_S3_BUCKET_NAME` | AWS | Destination S3 Bucket Name |

---

## Local Development & Operations Manual

### 1. Local Application Setup

```bash
# Navigate to the frontend application directory
cd cicd-react-app

# Install project dependencies
npm install

# Start the local development server
npm start

# Run local production build check
npm run build
```

---

### 2. Docker Operations

```bash
# Build local Docker image (from repo root)
docker build -t cicd-react-app:local ./cicd-react-app

# Run Docker container locally on port 3000
docker run -d -p 3000:3000 -e X_ZOHO_CATALYST_LISTEN_PORT=3000 cicd-react-app:local

# Verify running container status
docker ps

# Test container endpoint
curl -I http://localhost:3000
```

---

### 3. Zoho Catalyst CLI Operations

```bash
# Install Catalyst CLI globally
npm install -g zcatalyst-cli

# Generate CI/CD Token for GitHub Actions
catalyst login:ci

# Login locally to Catalyst account
catalyst login

# Target project environment and deploy manually
catalyst deploy --project 31902000002215215 --org 905328786
```

---

### 4. Git Release & Deployment Triggers

```bash
# Create and push a release tag (triggers automatic Catalyst deployment)
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Manually triggering via GitHub CLI
gh workflow run deploy.yml -f deploy_target=catalyst
gh workflow run deploy.yml -f deploy_target=vercel
gh workflow run deploy.yml -f deploy_target=aws
```

---

## Complete Workflow Configuration (`.github/workflows/deploy.yml`)

```yaml
name: Flexible Multi-Target CI/CD Pipeline

on:
  push:
    branches:
      - '**'
    tags:
      - 'v*'
  pull_request:
    branches:
      - main
      - master
      - dev
  workflow_dispatch:
    inputs:
      deploy_target:
        description: 'Select Deployment Target'
        required: true
        default: 'catalyst'
        type: choice
        options:
          - 'catalyst'
          - 'vercel'
          - 'aws'
          - 'docker-only'

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # STAGE 1: Code Quality & Build Verification
  ci-quality-check:
    name: CI Safety and Build Verification
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: cicd-react-app/package-lock.json

      - name: Install & Build Check
        run: |
          cd cicd-react-app
          npm ci || npm install
          npm run build

  # STAGE 2: Standalone Docker Image Build & Push (GHCR)
  build-and-push-docker:
    name: Build & Push Docker Image
    needs: ci-quality-check
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch' && inputs.deploy_target == 'docker-only'

    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Lowercase Repository Name
        run: echo "REPO_LOWER=$(echo '${{ github.repository }}' | tr '[:upper:]' '[:lower:]')" >> $GITHUB_ENV

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push Docker Image
        uses: docker/build-push-action@v5
        with:
          context: ./cicd-react-app
          file: ./cicd-react-app/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ env.REPO_LOWER }}:latest
            ghcr.io/${{ env.REPO_LOWER }}:${{ github.ref_name }}

  # STAGE 3A: Deploy to Zoho Catalyst (Development Sandbox)
  deploy-to-catalyst:
    name: Deploy Container to Zoho Catalyst AppSail
    needs: ci-quality-check
    runs-on: ubuntu-latest
    if: |
      (github.event_name == 'workflow_dispatch' && inputs.deploy_target == 'catalyst') ||
      startsWith(github.ref, 'refs/tags/v')

    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Lowercase Repository Name
        run: echo "REPO_LOWER=$(echo '${{ github.repository }}' | tr '[:upper:]' '[:lower:]')" >> $GITHUB_ENV

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build Docker Image Locally & Push GHCR
        run: |
          docker build -t ghcr.io/${{ env.REPO_LOWER }}:latest ./cicd-react-app
          docker push ghcr.io/${{ env.REPO_LOWER }}:latest

      - name: Deploy to Catalyst AppSail
        run: |
          npm install -g zcatalyst-cli
          catalyst deploy --token ${{ secrets.CATALYST_TOKEN }} --project 31902000002215215 --org 905328786

      - name: Promotion Guidelines
        run: |
          echo "=========================================================="
          echo " SUCCESS: Build deployed to Catalyst Development sandbox."
          echo " Catalyst Console: [https://console.catalyst.zoho.com/baas/905328786/project/31902000002215215/Production#/serverless/appsail/31902000002208788/deployment](https://console.catalyst.zoho.com/baas/905328786/project/31902000002215215/Production#/serverless/appsail/31902000002208788/deployment)"
          echo " Note: Per Zoho Catalyst policy, open the link above and click 'Create Deployment' / 'Promote' to publish to Production."
          echo "=========================================================="

  # STAGE 3B: Deploy to Vercel (Production)
  deploy-to-vercel:
    name: Deploy App to Vercel
    needs: ci-quality-check
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch' && inputs.deploy_target == 'vercel'

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Vercel CLI
        run: npm install --global vercel@latest

      - name: Pull Vercel Environment Information
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: ./cicd-react-app

      - name: Build Project Artifacts
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: ./cicd-react-app

      - name: Deploy Project Artifacts to Vercel
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: ./cicd-react-app

  # STAGE 3C: Deploy to AWS S3
  deploy-to-aws:
    name: Deploy App to AWS
    needs: ci-quality-check
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch' && inputs.deploy_target == 'aws'

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Build & Sync Static Assets to S3
        run: |
          cd cicd-react-app
          npm ci || npm install
          npm run build
          aws s3 sync build/ s3://${{ secrets.AWS_S3_BUCKET_NAME }} --delete

      - name: Verify AWS S3 Sync
        run: echo "AWS S3 Sync completed successfully."
```

---

## Production Promotion Runbook (Zoho Catalyst)

1. **Pipeline Execution:** Trigger the GitHub Action workflow manually or push a release tag (`v1.0.x`).
2. **Verification:** Confirm that the `deploy-to-catalyst` job completes with status `Success`.
3. **Console Access:** Open the [Zoho Catalyst AppSail Deployment Console](https://console.catalyst.zoho.com/baas/905328786/project/31902000002215215/Production#/serverless/appsail/31902000002208788/deployment).
4. **Promotion:** Select the latest build from the Development environment list and click **Create Deployment** to promote it live to Production.