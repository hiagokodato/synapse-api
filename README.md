# Synapse API

Backend API for the Synapse Platform built with Node.js, TypeScript and PostgreSQL.

Synapse API is responsible for authentication, chatbot flow management, real-time communication, analytics, integrations and scalable REST APIs focused on conversational automation systems.

---

# ✨ Features

- JWT authentication
- Refresh token flow
- Role-based authorization
- RESTful API architecture
- Real-time communication with WebSockets
- Chatbot flow management
- Conversation tracking
- Analytics and metrics
- External API integrations
- Webhook support
- Scalable modular architecture
- Request validation
- Global error handling
- Rate limiting
- API documentation with Swagger

---

# 🚀 Tech Stack

## Backend
- Node.js
- TypeScript
- NestJS
- Prisma ORM
- PostgreSQL
- JWT
- Socket.io
- Swagger
- Docker

---

# 🏗️ Architecture

The project follows a modular and scalable architecture inspired by enterprise backend applications.

```bash
src/
 ├── auth/
 ├── chatbot/
 ├── conversations/
 ├── analytics/
 ├── integrations/
 ├── websocket/
 ├── common/
 ├── prisma/
 ├── config/
 └── main.ts

---

# 🛠️ Getting Started

## Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL)

## Setup

```bash
cp .env.example .env
# Edit JWT secrets before running in production

docker compose up -d
npm install
npm run db:migrate
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API in watch mode |
| `npm run build` | Compile for production |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |

## Endpoints (v1)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/health` | No | Health check |
| `POST` | `/auth/register` | No | Create account |
| `POST` | `/auth/login` | No | Login |
| `POST` | `/auth/refresh` | No | Rotate tokens |
| `POST` | `/auth/logout` | No | Revoke refresh token |
| `GET` | `/auth/me` | Bearer | Current user |

Swagger UI: http://localhost:3000/docs