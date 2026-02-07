# AI-Interviewer
# InterviewDost - AI Mock Interview Platform

InterviewDost is an advanced AI-powered mock interview platform designed to help candidates prepare for job interviews. The system simulates a real-time interview environment using an interactive, lip-syncing AI Avatar, records the session, analyzes responses using LLMs, and provides detailed feedback and scoring.

## 🚀 Features

-   **Interactive AI Avatar**: Real-time conversational AI interviewer powered by Tavus.
-   **Smart Question Generation**: Analyzes your resume and role to generate tailored interview questions using Google Gemini.
-   **Real-time Transcription**: Live transcript of the conversation as it happens.
-   **AI Scoring & Feedback**:
    -   Evaluates answers for **Relevance** (answering the specific question asked) and **Confidence**.
    -   Provides an overall score (Communication, Technical Depth, etc.).
    -   Offers actionable "Strengths" and "Improvements".
-   **Session Recording**: Automatically records audio/video of the interview and stores it securely via Cloudinary for playback.
-   **Admin Dashboard**: Manage users, view all interview sessions, and monitor platform activity.

## 🛠️ Tech Stack

-   **Frontend**: React (Vite), TypeScript, TailwindCSS, Radix UI.
-   **Backend**: Python (FastAPI), SQLAlchemy, Pydantic.
-   **AI Engines**: Google Gemini (LLM), Tavus (Video Avatar).
-   **Storage**: SQLite/PostgreSQL (DB), Cloudinary (Video).

---

## 📦 Installation & Setup

### Prerequisites

-   Node.js (v18+)
-   Python (v3.10+)
-   Git

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/InterviewDost.git
cd InterviewDost
```

### 2. Backend Setup

1.  Navigate to the Backend directory:
    ```bash
    cd Backend
    ```
2.  Create a virtual environment:
    ```bash
    python -m venv venv
    ```
3.  Activate the virtual environment:
    -   **Windows**: `venv\Scripts\activate`
    -   **Mac/Linux**: `source venv/bin/activate`
4.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
5.  Configure Environment Variables:
    -   Copy `.env.example` to `.env`:
        ```bash
        cp .env.example .env
        ```
    -   Open `.env` and fill in your API keys (Gemini, Tavus, Cloudinary). **These are required for the app to function.**

6.  Run the Server:
    ```bash
    uvicorn app.main:app --reload --port 8001
    ```
    The backend will start at `http://localhost:8001`.

### 3. Frontend Setup

1.  Open a new terminal and navigate to the Frontend directory:
    ```bash
    cd Frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure Environment Variables:
    -   Copy `.env.example` to `.env`:
        ```bash
        cp .env.example .env
        ```
    -   Ensure `VITE_API_URL` matches your backend URL (default: `http://localhost:8001`).

4.  Run the Development Server:
    ```bash
    npm run dev
    ```
    The frontend will start at `http://localhost:5173` (or similar).

---

## 🔑 Environment Variables Explanation

### Backend (`Backend/.env`)

-   `DATABASE_URL`: Connection string for the database (e.g., `sqlite:///./interviewdost.db`).
-   `SECRET_KEY`, `ALGORITHM`: Used for JWT authentication security.
-   `GEMINI_API_KEY`: Required for generating questions and scoring answers.
-   `TAVUS_API_KEY`, `TAVUS_PERSONA_ID`: Required to initialize the AI Avatar.
-   `CLOUDINARY_*`: Keys for uploading and storing interview recordings.

### Frontend (`Frontend/.env`)

-   `VITE_API_URL`: The base URL of the backend API.

---

## 🏃 Usage Guide

1.  **Register/Login**: Create an account or sign in.
2.  **Start Interview**:
    -   Enter your target Role (e.g., "Product Manager").
    -   (Optional) Upload your Resume.
    -   Click "Start Interview".
3.  **The Interview**:
    -   Grant camera/microphone permissions.
    -   The AI Avatar will ask you questions. Speak your answers clearly.
    -   Wait for the AI to respond before speaking again.
4.  **End & Review**:
    -   Click "End Interview" when finished.
    -   You will be redirected to the Results page to see your Score, Feedback, and watch the recording.

---

## 🤝 Contributing

Contributions are welcome! Please fork the repository and create a pull request with your changes.
