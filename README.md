# Backend

## Tech Stack
- **Framework**: Hono
- **Database**: PostgreSQL with Drizzle ORM

## API Documentation
The API is structured around the `api` routes. Here are the main modules:

- **/api/auth**: Authentication (Login, Register, etc.)
- **/api/users**: User management
- **/api/materials**: Learning materials (CRUD, Publish/Unpublish)
- **/api/courses**: Course management
- **/api/exams**: Exam creation and management
- **/api/questions**: Question bank management
- **/api/proctoring**: Proctoring session management
- **/api/scoring**: Exam scoring and results
- **/api/analytics**: Learning analytics

## Service Models
This backend integrates with the following machine learning models:
- [Model AES and Material Generator](https://github.com/sahabat-guru/model-aes-and-material-generator)
- [Model Cheating Detection](https://github.com/sahabat-guru/model-cheating-detection)
- [Model AI Material Generator](https://github.com/sahabat-guru/model-ai-material-generator)

## Setup
```bash
npm install
```

## Development
To start the backend server locally:
```bash
npm run dev
```

## Database & Docker
To run with Docker (Database and Backend):
```bash
docker compose up -d
```

## Database Migration
If running locally:
```bash
npm run db:migrate
```
