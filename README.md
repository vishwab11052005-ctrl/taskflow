# taskflow
# TaskFlow AI

A full-stack project management and issue tracker with a liquid-glass React interface, FastAPI, PostgreSQL, JWT authentication, and optional local AI through Ollama.

## 1. Install the tools

Install:
- Python 3.12+
- Node.js LTS and npm
- PostgreSQL 16 or 17
- Git
- Ollama if you want local AI features

Docker is not required.

## 2. Create the PostgreSQL database

Open the PostgreSQL SQL shell or pgAdmin and run:

```sql
CREATE USER taskflow WITH PASSWORD 'change_this_password';
CREATE DATABASE taskflow OWNER taskflow;
```

Keep your actual password private.

## 3. Backend setup

Open a terminal in the `backend` folder.

Windows PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and set a strong random `JWT_SECRET` and your PostgreSQL password in `DATABASE_URL`.

Example database URL:

```text
DATABASE_URL=postgresql+psycopg://taskflow:change_this_password@localhost:5432/taskflow
```

Start the backend from the `backend` directory:

```bash
uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs` to test the API.

## 4. Frontend setup

Open a second terminal in the `frontend` folder:

```bash
npm install
```

Copy `.env.example` to `.env`.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Start the frontend:

```bash
npm run dev
```

Open `http://localhost:5173`.

## 5. Optional local AI setup

Install Ollama, then run:

```bash
ollama pull qwen2.5:7b
ollama serve
```

If Ollama is already running as a background service, you do not need to start it again. The backend uses `http://localhost:11434` by default. Set `OLLAMA_MODEL` in `backend/.env` to a model you have downloaded.

Core project and task management remains available if Ollama is not running.

## 6. Run the app every time

Terminal 1, backend:

```bash
cd backend
```

Activate the virtual environment, then:

```bash
uvicorn app.main:app --reload
```

Terminal 2, frontend:

```bash
cd frontend
npm run dev
```

PostgreSQL must be running as a local service. Ollama is only needed for AI features.

## 7. Features in this starter

- Register and log in
- JWT-protected API
- Create and delete projects
- Create, edit, filter, and delete tasks
- Task statuses and priorities
- Dashboard counts and progress
- AI task analysis, subtask suggestions, and project insights
- Liquid-glass styling, responsive layout, Framer Motion transitions, and reduced-motion support

## 8. Security and production notes

This is a development starter, not a production deployment. Before production, add database migrations, password reset and email verification, rate limiting, refresh-token/session strategy, stronger audit logging, deployment-specific CORS, backups, and automated tests. Never commit `.env` files or real secrets.

## 9. Git setup

From the project root:

```bash
git init
git add .
git commit -m "Build TaskFlow AI starter"
```

Create a repository on GitHub, then connect and push it using the commands GitHub provides for your repository.

## 10. Troubleshooting

### PostgreSQL connection fails
- Confirm the PostgreSQL service is running.
- Confirm the database and user exist.
- Check the username, password, port, and database name in `backend/.env`.
- URL-encode special characters in a database password.

### `uvicorn` is not recognized
Activate the backend virtual environment and run:

```bash
python -m uvicorn app.main:app --reload
```

### Frontend cannot reach the backend
- Confirm the API is running at `http://localhost:8000`.
- Confirm `frontend/.env` contains `VITE_API_URL=http://localhost:8000`.
- Restart Vite after changing `.env`.

### AI says it is unavailable
- Confirm Ollama is running.
- Run `ollama list` to verify the selected model exists.
- Match `OLLAMA_MODEL` in `backend/.env` to the installed model.
