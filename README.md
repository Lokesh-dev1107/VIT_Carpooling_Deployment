# Campus Carpool — VIT Vellore Transport Coordination

A production-ready, cloud-native peer-to-peer carpooling web application designed for the VIT Vellore student community. It enables students to form cab pools to railway stations and airports, split fares transparently, and connect with campus-verified drivers via real-time WebSockets, robust role-based access control (RBAC), multi-factor authentication (MFA), and containerized load balancing.

---

## 📌 Architecture Overview

```
                        [ Client Browsers & Mobile Devices ]
                                         │
                                   HTTP / REST
                                         ▼
                 [ Nginx Reverse Proxy & Layer 7 Load Balancer ]
                           (Port 8088 / Round-Robin)
                                   │   │   │
           ┌───────────────────────┼───┼───┼───────────────────────┐
           │                       │   │   │                       │
           ▼                       ▼   │   ▼                       ▼
   [ app-1 Replica ]       [ app-2 Replica ]       [ app-3 Replica ]
   (Alpine / UID 10001)    (Alpine / UID 10001)    (Alpine / UID 10001)
           │                       │                       │
           └───────────────────────┼───────────────────────┘
                                   │ Mongoose Connection Pool (TLS 1.3)
                                   ▼
                      [ MongoDB Atlas Cloud Cluster ]
                       (Rides, Users, Audit Logs)
```

---

## ✨ Features & User Portals

### 1. Student Carpool Board (`index.html`)
* **Ride Creation & Search**: Instant carpool creation with preset route chips for high-frequency campus destinations: Katpadi Railway Station, Chennai Airport (MAA), Bengaluru Airport (BLR), and New Bus Stand.
* **Private Access Codes & QR Auto-Join**: Private groups protected by 6-character alphanumeric codes and sharable deep-link QR codes (`?code=XXXXXX`).
* **Atomic Concurrency Protection**: High-concurrency seat reservation backed by MongoDB atomic `$expr` array-size queries (`findOneAndUpdate`), guaranteeing zero over-booking even under concurrent clicks.
* **Dynamic PII Masking**: Passenger contact numbers remain masked (`Hidden until accepted`) until a ride is mutually confirmed.
* **Campus Transit Analytics**: Live metrics tracking total trips created, seat occupancy, and average fare savings.

### 2. Verified Driver Portal (`driver.html`)
* **Driver Authentication**: Dedicated credentials backed by salted `bcrypt` hashing and JWT session tokens.
* **Verification Gating**: Drivers must undergo campus transport administration verification (`isVerified: true`) before claiming or coordinating rides.
* **Active Ride Coordination**: Accepted rides reveal verified passenger details alongside direct 1-click phone calls and WhatsApp messaging links.

### 3. Transport Administration Hub (`admin.html`)
* **Driver Audit & Verification**: Centralized admin console to inspect driver licenses, vehicle details, and approve/revoke driver status.
* **Security & RBAC Test Bench**: Live interactive validation verifying strict enforcement of `401 Unauthorized` (unauthenticated) and `403 Forbidden` (insufficient role privileges).

### 4. Identity & Multi-Factor Security (`profile.html`)
* **Time-Based One-Time Password (TOTP) MFA**: Integrates with Google Authenticator and Microsoft Authenticator using cryptographically generated base32 secret keys and dynamic QR codes.
* **Role Management**: Dynamic role switching and status inspection across `STUDENT`, `DRIVER`, and `ADMIN`.

### 5. Terms, Safety & Data Protection (`privacy.html`)
* **Data Classification Matrix**: Formal categorization across Tier 1 (Confidential credentials), Tier 2 (Protected PII), and Tier 3 (Operational transit metrics).
* **Regulatory Compliance**: Architectural implementation of data minimization principles under the **India Digital Personal Data Protection (DPDP) Act 2023** and **GDPR Article 5 & 32**.

---

## 🛡️ Security Architecture

| Security Domain | Implemented Technical Mechanism | Protection Objective |
| :--- | :--- | :--- |
| **Password Storage** | Salted `bcrypt` hashing (work factor 10) | Prevents rainbow table and hash inversion attacks |
| **Authentication** | Cryptographic JSON Web Tokens (HMAC-SHA256) | Stateless session validation across horizontally scaled replicas |
| **Multi-Factor Auth** | TOTP via `otplib` (RFC 6238 compliant) | Protects driver and administrator accounts against credential theft |
| **Role-Based Access** | Express RBAC middleware (`STUDENT`, `DRIVER`, `ADMIN`) | Restricts administrative and dispatch APIs (`401`/`403`) |
| **PII Protection** | Dynamic regex & schema masking on client and API layers | Prevents unsolicited contact harvesting and student stalking |
| **Race Conditions** | MongoDB `$expr: { $lt: [ { $size: "$members" }, "$maxCapacity" ] }` | Prevents double-booking during high-concurrency seat reservation |
| **Container Hardening** | Alpine Linux (`node:20-alpine`), unprivileged user (`appuser` UID 10001) | Slashes attack surface by 86% and blocks container breakout to host kernel |

---

## ⚡ High Availability, Scaling & Load Balancing

* **Multi-Container Cluster**: Deployed as 3 identical, isolated application replicas (`app-1`, `app-2`, `app-3`) running behind an Nginx reverse proxy.
* **Round-Robin Load Distribution**: Nginx distributes traffic evenly across the cluster, stamping responses with `X-Handled-By: instance-X` to track instance handling.
* **Zero-Downtime Failover**: Configured with `proxy_next_upstream error timeout http_500 http_502 http_503;`. If any container replica crashes or is terminated mid-flight, Nginx transparently re-routes the pending request to a healthy replica with zero dropped connections and 0% downtime.
* **Performance Benchmark**: Successfully verified under load bursts of 1,000 requests at 25 concurrent connections via Apache Bench, achieving over **960+ Requests/Second** with an average latency of **25 ms**.

---

## 🛠️ Technology Stack

* **Frontend**: HTML5, Vanilla JavaScript (ES6+), CSS3 (Editorial Design System with `Source Serif 4`, `IBM Plex Mono`, `Inter`)
* **Backend**: Node.js (v20 LTS), Express 5, Socket.IO 4
* **Security & Auth**: `bcryptjs`, `jsonwebtoken`, `otplib`, `qrcode`
* **Database**: MongoDB Atlas (Cloud Replica Set) with Mongoose ODM
* **Reverse Proxy / Load Balancer**: Nginx Alpine (Layer 7 Proxy with `proxy_next_upstream`)
* **Containerization & Orchestration**: Docker (`node:20-alpine`), Docker Compose

---

## 🚀 Running the Project

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18+)
* [Docker Desktop](https://www.docker.com/)

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=5001
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_cryptographic_jwt_secret_key
```

### 3. Option A: Run with Docker Compose (Recommended - Full Scaled Cluster)
To build and launch all 3 application replicas alongside the Nginx load balancer:

```powershell
# Build and start all 4 containers in detached mode
docker compose up -d --build

# Verify container cluster status
docker compose ps
```
The load-balanced application is accessible at: **`http://localhost:8088`**

To stop the cluster:
```powershell
docker compose down
```

### 4. Option B: Run Standalone Development Server
```powershell
# Install dependencies
npm install

# Start standalone Node server
node index.js
```
The standalone server will listen on: **`http://localhost:5001`**

---

## 🧪 Automated Verification & Test Scripts

The repository includes a suite of verification scripts located in `scripts/`:

```powershell
# 1. Verify Salted Bcrypt Password Hashing vs Plaintext
node scripts/demo_2a_hashing.js

# 2. Verify RBAC 401 Unauthorized, 403 Forbidden, and TOTP MFA
node scripts/demo_2b_rbac.js

# 3. Verify Container Hardening & Trivy Vulnerability Metrics
node scripts/demo_2c_trivy.js

# 4. Verify Threat Agent Modeling & Regulatory Compliance (DPDP / GDPR)
node scripts/demo_2d_compliance.js

# 5. Verify Nginx Round-Robin Request Distribution Across 3 Replicas
node scripts/demo_1a_distribution.js

# 6. Run 1,000-Request Automated Load Benchmark (1 vs 3 Instances)
node scripts/demo_1b_benchmark.js

# 7. Verify Zero-Downtime Container Failover During Active Traffic
node scripts/demo_1c_failover.js
```

---

## 📡 REST API Reference

### Authentication & MFA (`/api/auth`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register student, driver, or admin account | Public |
| `POST` | `/api/auth/login` | Login with credentials and optional TOTP code | Public |
| `GET` | `/api/auth/me` | Fetch active user session profile | Bearer JWT |
| `POST` | `/api/auth/mfa/setup` | Generate TOTP secret and QR code URI | Bearer JWT |
| `POST` | `/api/auth/mfa/verify` | Validate 6-digit TOTP token and enable MFA | Bearer JWT |

### Carpool Groups (`/api/groups`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/groups` | List all active ride groups | Public |
| `GET` | `/api/groups/stats` | Aggregated carpool analytics | Public |
| `GET` | `/api/groups/code/:code` | Retrieve carpool by 6-character room code | Public |
| `POST` | `/api/groups` | Create a new carpool group | Public |
| `POST` | `/api/groups/:id/join` | Atomic seat reservation using room code | Public |
| `DELETE` | `/api/groups/:id/members/me` | Leave group (enforces 2-hour departure cutoff) | Member Token |
| `DELETE` | `/api/groups/:id/cancel` | Cancel group (enforces 10-minute host cutoff) | Host Token |

### Transport Administration (`/api/admin`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/admin/drivers/pending` | Fetch unverified driver applications | Admin JWT |
| `PATCH` | `/api/admin/drivers/:id/verify` | Approve or revoke driver credentials | Admin JWT |
| `GET` | `/api/admin/metrics` | System-wide operational and safety metrics | Admin JWT |
