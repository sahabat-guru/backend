# SahabatGuru Backend API

Platform AI Assistant untuk Guru dan Murid - Backend Service

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Hono
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT (access + refresh tokens)
- **WebSocket**: Socket.IO
- **Validation**: Zod
- **Logging**: Pino

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Docker (optional, for containerized development)

### Installation

1. Clone the repository and navigate to the backend directory:

```bash
cd be
```

2. Install dependencies:

```bash
npm install
```

3. Copy environment file and configure:

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start PostgreSQL (using Docker or local installation):

```bash
docker compose up db -d
```

5. Run database migrations:

```bash
npm run db:push
```

6. Start development server:

```bash
npm run dev
```

The server will start at `http://localhost:8080`

### Using Docker Compose

For full development environment:

```bash
docker compose up -d
```

This starts:

- Backend API at `http://localhost:8080`
- PostgreSQL at `localhost:5432`
- Adminer (DB UI) at `http://localhost:8081`

## API Documentation

### Base URL

```
http://localhost:8080/api
```

### Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Endpoints

#### Auth

| Method | Endpoint             | Description       | Auth |
| ------ | -------------------- | ----------------- | ---- |
| POST   | `/api/auth/register` | Register new user | No   |
| POST   | `/api/auth/login`    | Login             | No   |
| POST   | `/api/auth/refresh`  | Refresh token     | No   |
| POST   | `/api/auth/logout`   | Logout            | Yes  |
| GET    | `/api/auth/me`       | Current user      | Yes  |

#### Users

| Method | Endpoint        | Description    | Auth |
| ------ | --------------- | -------------- | ---- |
| GET    | `/api/users/me` | Get profile    | Yes  |
| PUT    | `/api/users/me` | Update profile | Yes  |

#### Materials (Guru only)

| Method | Endpoint                     | Description                                |
| ------ | ---------------------------- | ------------------------------------------ |
| GET    | `/api/materials/templates`   | List available templates                   |
| POST   | `/api/materials/generate`    | Generate material (PPT/RPP/LKPD/Questions) |
| GET    | `/api/materials`             | List materials                             |
| GET    | `/api/materials/:id`         | Get material detail                        |
| PUT    | `/api/materials/:id`         | Update material                            |
| DELETE | `/api/materials/:id`         | Delete material                            |
| POST   | `/api/materials/:id/publish` | Publish material                           |

#### Courses (Murid only)

| Method | Endpoint                     | Description              |
| ------ | ---------------------------- | ------------------------ |
| GET    | `/api/courses/materials`     | List published materials |
| GET    | `/api/courses/materials/:id` | Get material detail      |

#### Exams

| Method | Endpoint                      | Description      | Role  |
| ------ | ----------------------------- | ---------------- | ----- |
| GET    | `/api/exams`                  | List exams       | Both  |
| POST   | `/api/exams`                  | Create exam      | GURU  |
| GET    | `/api/exams/:id`              | Get exam detail  | Both  |
| PUT    | `/api/exams/:id`              | Update exam      | GURU  |
| DELETE | `/api/exams/:id`              | Delete exam      | GURU  |
| POST   | `/api/exams/:id/questions`    | Add questions    | GURU  |
| POST   | `/api/exams/:id/publish`      | Publish exam     | GURU  |
| POST   | `/api/exams/:id/end`          | End exam         | GURU  |
| GET    | `/api/exams/:id/participants` | Get participants | GURU  |
| POST   | `/api/exams/:id/join`         | Join exam        | MURID |
| POST   | `/api/exams/:id/submit`       | Submit answer    | MURID |
| POST   | `/api/exams/:id/finish`       | Finish exam      | MURID |
| GET    | `/api/exams/my-exams`         | Student's exams  | MURID |

#### Questions (Guru only)

| Method | Endpoint             | Description     |
| ------ | -------------------- | --------------- |
| POST   | `/api/questions`     | Create question |
| GET    | `/api/questions`     | List questions  |
| GET    | `/api/questions/:id` | Get question    |
| PUT    | `/api/questions/:id` | Update question |
| DELETE | `/api/questions/:id` | Delete question |

#### Proctoring

| Method | Endpoint                              | Description          | Role  |
| ------ | ------------------------------------- | -------------------- | ----- |
| POST   | `/api/proctoring/events`              | Report event         | MURID |
| POST   | `/api/proctoring/browser-events`      | Report browser event | MURID |
| GET    | `/api/proctoring/exams/:examId/logs`  | Get logs             | GURU  |
| GET    | `/api/proctoring/exams/:examId/stats` | Get stats            | GURU  |

#### Scoring (Guru only)

| Method | Endpoint                             | Description        |
| ------ | ------------------------------------ | ------------------ |
| GET    | `/api/scoring/exams/:examId`         | Get exam scores    |
| POST   | `/api/scoring/exams/:examId/trigger` | Trigger AI scoring |
| PUT    | `/api/scoring/answers/:answerId`     | Override score     |

#### Analytics (Guru only)

| Method | Endpoint                             | Description        |
| ------ | ------------------------------------ | ------------------ |
| GET    | `/api/analytics/overview`            | Dashboard overview |
| GET    | `/api/analytics/exams/:examId`       | Exam analytics     |
| GET    | `/api/analytics/students/:studentId` | Student analytics  |

## WebSocket

### Connection

```javascript
const socket = io("http://localhost:8080/exam", {
	auth: { token: "your_jwt_token" },
});
```

### Namespaces

#### /exam

- `exam:join` - Join exam room
- `exam:joined` - Joined confirmation
- `exam:start` - Exam started (broadcast)
- `exam:end` - Exam ended (broadcast)

#### /proctoring

- `proctoring:observe` - Teacher observe exam
- `proctoring:start` - Student start session
- `proctoring:alert` - Violation alert (to teacher)
- `proctoring:warning` - Warning (to student)

## Deployment

### Google Cloud Run

1. Build and push Docker image:

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/sahabatguru-backend
```

2. Deploy to Cloud Run:

```bash
gcloud run deploy sahabatguru-backend \
  --image gcr.io/PROJECT_ID/sahabatguru-backend \
  --region asia-southeast2 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=your-db-url,JWT_SECRET=your-secret"
```

## Project Structure

```
src/
├── main.ts                 # Entry point
├── app.ts                  # Hono app setup
├── types/                  # Shared types
├── libs/                   # Core libraries
│   ├── config/            # Configuration
│   ├── db/                # Database (Drizzle)
│   ├── jwt/               # JWT utilities
│   ├── storage/           # GCS storage
│   └── websocket/         # Socket.IO
├── middlewares/           # Hono middlewares
├── services/              # External services
│   ├── material-generator.service.ts
│   └── proctoring-ai.service.ts
└── modules/               # Feature modules
    ├── auth/
    ├── users/
    ├── materials/
    ├── courses/
    ├── exams/
    ├── proctoring/
    ├── scoring/
    └── analytics/
```

## License

MIT
