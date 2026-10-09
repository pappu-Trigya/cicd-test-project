# Complete Multi-Target CI/CD Pipeline & Operations Manual

## Overview

This repository (`pappu-Trigya/cicd-test-project`) contains a fully automated multi-target GitHub Actions CI/CD pipeline (`.github/workflows/deploy.yml`). It validates code quality, builds Docker images, publishes container artifacts to GitHub Container Registry (GHCR), and supports targeted deployments to **Zoho Catalyst (AppSail)**, **Vercel**, and **AWS (S3)**.

---

## 1. Architecture & Workflow Strategy

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

### Key Policies & Rules
* **Dynamic Secret Evaluation:** GitHub Actions evaluates secrets per job execution. Unused target secrets (e.g., AWS or Vercel keys during a Catalyst run) are **not required**.
* **Zoho Catalyst Environment Isolation:** Builds deploy automatically to the **Development** sandbox. Direct deployment to Production via API/CLI is restricted by Zoho policy; manual promotion via the **Catalyst Console** is required.

---

## 2. Secrets & Repository Variables

| Secret / Variable Name | Required For Target | Description |
| :--- | :--- | :--- |
| `CATALYST_TOKEN` | Zoho Catalyst | Generated via `catalyst login:ci` |
| `VERCEL_TOKEN` | Vercel | Vercel Personal Access Token |
| `AWS_ACCESS_KEY_ID` | AWS S3 | IAM Access Key |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 | IAM Secret Key |
| `AWS_S3_BUCKET_NAME` | AWS S3 | Target S3 Bucket Name |

---

## 3. Essential Operations Command Cheat Sheet

### A. Local React App Commands

```bash
# Navigate to application directory
cd cicd-react-app

# Install project dependencies
npm install

# Start local development server (http://localhost:3000)
npm start

# Verify local production build
npm run build

# Return to repository root
cd ..
```

### B. Git Operations

```bash
# Check status and current branch
git status
git branch -a

# Create and switch to a new development branch
git checkout -b feature/workflow-updates

# Stage, commit, and push changes
git add .
git commit -m "feat: configure multi-target pipeline"
git push -u origin feature/workflow-updates

# Create and push release tag (Triggers Catalyst Deployment)
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Delete local and remote tags (if needed)
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0
```

### C. Docker Operations (Run from Repo Root)

```bash
# Build local Docker image
docker build -t cicd-react-app:local ./cicd-react-app

# Run container locally on port 3000
docker run -d \
  -p 3000:3000 \
  -e X_ZOHO_CATALYST_LISTEN_PORT=3000 \
  --name react-container \
  cicd-react-app:local

# Verify running container status and logs
docker ps
docker logs -f react-container

# Test local endpoint
curl -I http://localhost:3000

# Stop and remove local container
docker stop react-container
docker rm react-container
```

### D. GitHub Container Registry (GHCR) Commands

```bash
# Authenticate to GHCR
echo $GH_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Tag and push image manually to GHCR
docker tag cicd-react-app:local ghcr.io/pappu-trigya/cicd-test-project:latest
docker push ghcr.io/pappu-trigya/cicd-test-project:latest
```

### E. GitHub CLI (`gh`) Commands

```bash
# Authenticate GitHub CLI
gh auth login

# Trigger specific pipeline targets manually
gh workflow run deploy.yml -f deploy_target=catalyst
gh workflow run deploy.yml -f deploy_target=vercel
gh workflow run deploy.yml -f deploy_target=aws
gh workflow run deploy.yml -f deploy_target=docker-only

# Watch live pipeline logs in terminal
gh run watch
```

### F. Zoho Catalyst CLI Commands

```bash
# Install CLI globally
npm install -g zcatalyst-cli

# Generate CI access token for GitHub secrets
catalyst login:ci

# Login locally and deploy manually
catalyst login
catalyst deploy --project 31902000002215215 --org 905328786
```

---

## 4. Complete Workflow File (`.github/workflows/deploy.yml`)

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

  # STAGE 3B: Deploy to Vercel (Preview / Production)
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

## 5. Catalyst Production Promotion Runbook

1. Push a release tag (`v1.0.x`) or run `gh workflow run deploy.yml -f deploy_target=catalyst`.
2. Ensure the GitHub Actions run finishes with a green `Success` status.
3. Access the [Zoho Catalyst AppSail Console](https://console.catalyst.zoho.com/baas/905328786/project/31902000002215215/Production#/serverless/appsail/31902000002208788/deployment).
4. Select the newly built Development package and click **Create Deployment / Promote** to go live in Production.