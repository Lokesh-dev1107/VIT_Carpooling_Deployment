# Campus Carpool — VIT Vellore Transport Coordination

A production-grade, cloud-native peer-to-peer carpooling web application designed for the VIT Vellore student community. It enables students to form cab pools to railway stations and airports, split fares transparently, and connect with campus-verified drivers via real-time WebSockets.

---

## 🌐 Live Deployment Links

- **Frontend (Vercel):** [https://vit-carpooling-deployment.vercel.app/](https://vit-carpooling-deployment.vercel.app/)
- **Backend API (Render + Docker):** [https://vit-carpool-backend.onrender.com](https://vit-carpool-backend.onrender.com)
- **Database:** MongoDB Atlas (Managed Cloud Cluster)

---

## 📌 Architecture Overview

```
[ Student / Driver Client ]
           │
     HTTPS │ (Static UI: HTML5 / Editorial CSS / Vanilla JS)
           ▼
     [ Vercel CDN ]
           │
     REST  │  Socket.IO (WSS)
           ▼
[ Render Web Service (Docker Container) ]
  ├── Express 5 API Server
  ├── JWT Auth & Lifecycle Engine
  └── Socket.IO Real-Time Event Hub
           │
           ▼ Mongoose ODM
   [ MongoDB Atlas ]
   (Rides, Drivers, Ledger)
```

---

## ✨ Key Features

### 🎓 Student Board (`index.html`)
- **Group Ride Creation:** Students set destination, departure time, total seats, and fare per seat with preset quick-pick chips for high-frequency campus routes (Katpadi Station, Chennai Airport MAA, BLR Airport, New Bus Stand).
- **Private Group Codes & Deep Links:** Rides use a 6-character alphanumeric code for joining. Unauthenticated viewers on the board see no codes, preserving group privacy.
- **Interactive QR Code Auto-Join:** Creating a ride generates an on-screen QR code that deep-links directly back into the application (`?code=XXXXXX`), automatically filling the code input and focusing on passenger registration.
- **Atomic Concurrency Protection:** Prevents overbooking race conditions using MongoDB `$expr` checks (`findOneAndUpdate`), ensuring seats cannot be double-booked by simultaneous clicks.
- **Self-Service Leave/Cancel Rules:** Members can exit up to 2 hours before departure; hosts can cancel rides up to 10 minutes before pickup.
- **Campus Savings & Platform Analytics:** Real-time metrics tracking total rides completed, occupancy rates, average cost per seat, and status breakdown.

### 🚖 Driver Portal (`driver.html`)
- **Secure Driver Authentication:** Dedicated signup and login with salted `bcrypt` password hashing and 7-day JWT authentication.
- **Passenger Privacy Guard:** In the open `Available Requests` queue, passenger phone numbers are masked as `Hidden until accepted`.
- **My Confirmed Rides Dashboard:** Once a driver accepts a ride, the trip moves to their personal ledger, revealing direct **1-Click Call** and **WhatsApp** coordination links.
- **Dynamic Operations HUD:** Tracks lifetime trips completed and total gross earnings calculated automatically on the client.

### ⚡ Real-Time Synchronization
- Backed by **Socket.IO** bidirectional WebSockets: whenever a ride is created, joined, cancelled, or accepted, all connected student and driver clients immediately refresh their views without a manual page reload.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3 (Editorial Design System with `Source Serif 4`, `IBM Plex Mono`, and `Inter`) |
| **Backend** | Node.js (v20), Express 5, Socket.IO 4 |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, cryptographic member tokens |
| **Database** | MongoDB Atlas with Mongoose ODM (Schemas: `RideGroup`, `Driver`) |
| **Containerization** | Docker (`node:20-alpine`, multi-stage dependency caching) |
| **Cloud Hosting** | **Vercel** (Frontend) + **Render** (Backend Docker Container) |

---

## 🚀 Running Locally

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Docker Desktop](https://www.docker.com/) (Optional, for containerized run)
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster URI

### 2. Clone the Repository
```bash
git clone https://github.com/Lokesh-dev1107/VIT_Carpooling_Deployment.git
cd VIT_Carpooling_Deployment
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory:
```env
PORT=5001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
```

### 4. Install Dependencies & Run
```bash
# Install dependencies
npm install

# Start development server
node index.js
```
The server will start on `http://localhost:5001`.

### 5. Open the Frontend
Launch `index.html` (Student Board) or `driver.html` (Driver Portal) using VS Code Live Server (`http://127.0.0.1:5500`) or open them directly in your browser. The client automatically detects local environments and routes API calls to `localhost:5001`.

---

## 🐳 Docker Deployment

To build and run the backend locally using Docker:

```bash
# 1. Build the Docker image
docker build -t vit-carpooling:latest .

# 2. Run the container with environment variables
docker run -p 5001:5001 --env-file .env vit-carpooling:latest
```

---

## 📡 REST API Reference

### Ride Groups (`/api/groups`)
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/groups` | Fetch all active groups (excludes cancelled) | Public |
| `GET` | `/api/groups/stats` | Aggregate metrics (occupancy, destinations, avg fare) | Public |
| `GET` | `/api/groups/code/:code` | Look up a group by its 6-character code | Public |
| `POST` | `/api/groups` | Create a new ride group (creator becomes host) | Public |
| `POST` | `/api/groups/:id/join` | Join an open ride group using code | Public |
| `DELETE` | `/api/groups/:id/members/me` | Leave a ride (allowed up to 2h before departure) | Member Token |
| `DELETE` | `/api/groups/:id/cancel` | Cancel an entire ride (host only) | Host Token |
| `PATCH` | `/api/groups/:id/driver/accept` | Driver accepts a full group | Bearer JWT |

### Drivers (`/api/drivers` & `/api/driver`)
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/drivers/signup` | Register a new driver profile | Public |
| `POST` | `/api/drivers/login` | Driver login returning JWT token | Public |
| `GET` | `/api/driver/groups` | Fetch available pending and confirmed rides | Bearer JWT |

---

