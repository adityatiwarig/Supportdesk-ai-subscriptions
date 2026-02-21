# SupportDesk AI Subscriptions

Full-stack AI ticket management platform with credit-based access control, subscription payments, moderator/admin workflows, and password recovery.

## Features

### Authentication and Roles
- User signup/login/logout with JWT auth.
- Role-based access: `user`, `moderator`, `admin`.
- Admin panel for role/skill updates.

### Ticketing and AI Workflow
- Create, view, filter, and delete tickets.
- Ticket status pipeline for moderators (`PENDING`, `RESOLVED`, etc.).
- AI processing trigger on ticket creation (Inngest + local fallback).
- Assigned ticket queue for moderators.

### Credit System
- Default free credits for end users.
- Credits are usage-based (decrement only on ticket creation).
- Admin/moderator have unlimited ticket creation (no credit enforcement).
- Credit values are server-enforced (cannot be trusted from client).

### Subscription and Payments
- Secure payment architecture with:
  - Order creation endpoint
  - Server-side verification
  - Webhook handler
  - Payment history persistence
- Dual payment modes:
  - `mock` mode for local/demo (no Razorpay keys needed)
  - `razorpay` mode for real payments

### Password Recovery
- Forgot-password flow from login page.
- Reset password token generation + expiry.
- Reset screen at `/reset-password/:token`.
- Mail delivery via Mailtrap SMTP.
- Dev fallback link support if mail delivery fails locally.

### Frontend UX
- Dashboard credit panel for end users.
- Subscription modal with payment states (processing/success/failure).
- Responsive UI with role-aware behavior and improved auth pages.

---

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, DaisyUI
- Backend: Node.js, Express
- Database: MongoDB + Mongoose
- Async workflows: Inngest
- Payments: Razorpay (plus local mock mode)
- Email: Nodemailer (Mailtrap SMTP)

---

## Project Structure

```text
.
├── ai-agentic/   # Backend (API, models, controllers, routes, Inngest)
└── frontend/     # Frontend (React app)
```

---

## Environment Variables

### Backend (`ai-agentic/.env`)

Required core values:

```env
MONGO_URI=...
JWT_TOKEN=...
PORT=3000
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
```

Mail:

```env
MAILTRAP_SMTP_HOST=...
MAILTRAP_SMTP_PORT=2525
MAILTRAP_SMTP_USER=...
MAILTRAP_SMTP_PASS=...
```

Payments:

```env
PAYMENT_MODE=mock
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_SUBSCRIPTION_AMOUNT_INR=499
SUBSCRIPTION_CREDITS=25
SUBSCRIPTION_PLAN_ID=starter-monthly
```

Frontend (`frontend/.env`):

```env
VITE_SERVER_URL=http://localhost:3000/api
```

---

## Run Locally

### 1) Backend

```bash
cd ai-agentic
npm install
npm run dev
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3000`

---

## Payment Modes

### Mock Mode (Recommended for demo/interview)
- Set `PAYMENT_MODE=mock`.
- Subscription flow works without Razorpay keys.
- Credits are added through simulated payment verification.

### Razorpay Mode (Production)
- Set `PAYMENT_MODE=razorpay`.
- Configure real Razorpay credentials.
- Configure webhook endpoint:
  - `POST /api/payments/webhook`

---

## Security Notes

- Payment verification is server-side.
- Duplicate verification guarded via payment status checks.
- Credit enforcement happens in backend ticket-creation logic.
- Sensitive values should stay in `.env` and are git-ignored.

---

## API Highlights

- Auth:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password/:token`
- Tickets:
  - `POST /api/tickets`
  - `GET /api/tickets`
  - `GET /api/tickets/assigned`
  - `PATCH /api/tickets/:id/status`
- Payments:
  - `GET /api/payments/config`
  - `GET /api/payments/credits`
  - `POST /api/payments/create-order`
  - `POST /api/payments/verify`
  - `POST /api/payments/webhook`

---

## Recommended Repository Name

`supportdesk-ai-subscriptions`
