# BugSense AI

## Intelligent Bug Diagnosis Platform with Fix Recommendation Assistance

**Author:** Snehali Dey

BugSense AI is an intelligent bug diagnosis and engineering support platform that helps developers submit bug reports, source code, logs, stack traces, and supporting files. It uses a multi-agent diagnosis workflow to provide structured engineering guidance, historical bug matches, root-cause information, remediation suggestions, and an overall bug-risk score.

The primary goal of BugSense AI is to **reduce manual bug-triage effort and reuse historical debugging knowledge so that recurring problems can be identified and resolved faster**.

---

## ✨ Key Features

- **New Diagnosis Workspace** for submitting structured bug reports.
- **Raw Source-Code Input** for providing code directly as diagnostic context.
- **Multi-language Log Parsing** for Python, JavaScript/Node/TypeScript, Java, C/C++, Go, Rust, and generic error logs.
- **Supporting File Uploads** for text, log, and code evidence.
- **Five-Agent AI Diagnosis Pipeline**:
  1. Triage Agent
  2. Log Intelligence Agent
  3. Similarity/Duplicate Detection Agent
  4. Root Cause Agent
  5. Remediation Agent
- **AI Bug Risk Score** from 0–100 with risk factors and risk level.
- **Duplicate and Similar Bug Detection** using historical cases.
- **Historical Knowledge Vault** for reusing verified resolution knowledge.
- **Root Cause Analysis** with confidence information and historical grounding.
- **Fix Recommendations** with estimated fix time, best practices, and prevention tips.
- **Case History** with search and filtering by severity and status.
- **Bug Lifecycle Management**:
  - Open
  - In Progress
  - Resolved
  - Closed
- **Resolution Knowledge Storage** for future diagnosis.
- **Attachments and OCR** when OCR support is available.
- **Comments and Investigation Notes** for collaboration.
- **Audit Timeline** for tracking case activity.
- **Analytics and Project Health Dashboard**.
- **PDF Diagnostic Report Export**.
- **BugSense Copilot**, an in-app assistant for bug-related questions.
- **Role-Based Administration** for managing users and roles.
- **Dark and Light Theme** support.

---

## 🧠 Multi-Agent Diagnosis Workflow

```text
Bug Report / Source Code / Logs / Attachments
                    |
                    v
             Triage Agent
       Severity, Priority, Category
                    |
                    v
          Log Intelligence Agent
     Exception, File, Line, Function
                    |
                    v
        Similarity Detection Agent
        Historical Bug Matching
                    |
                    v
            Root Cause Agent
       Probable Cause + Confidence
                    |
                    v
           Remediation Agent
       Fix + Best Practices + Prevention
                    |
                    v
              Risk Engine
          Overall Risk Score: 0–100
```

### Agent Responsibilities

| Agent | Responsibility |
|---|---|
| **Triage Agent** | Predicts severity, priority, and category with confidence and reasoning. |
| **Log Intelligence** | Extracts exception type, failure file, line number, function, and log summary. |
| **Similarity Agent** | Finds historical bugs and returns similarity percentages. |
| **Root Cause Agent** | Produces the probable root cause using resolved historical cases where available. |
| **Remediation Agent** | Suggests fixes, best practices, prevention guidance, and estimated fix time. |
| **Risk Engine** | Combines evidence into an overall 0–100 risk score and risk level. |

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React, Vite, Tailwind CSS | User interface and client-side interaction |
| Backend | FastAPI, Python | REST API and application logic |
| Database | SQLite, SQLAlchemy | Users, bugs, analysis, comments, events, and history |
| Authentication | JWT, bcrypt | Login and role-based access |
| AI / Analysis | Multi-agent diagnosis pipeline | Triage, log parsing, similarity, root cause, and remediation |
| Historical Retrieval | Similarity and knowledge-base retrieval | Reuse of resolved bugs and fixes |
| Reports | PDF generation | Exportable diagnostic reports |
| Charts | Chart.js, react-chartjs-2 | Analytics and engineering visualizations |

---

## 📁 Project Structure

```text
smart-bug-analyzer/
├── backend/
├── frontend/
├── uploads/
└── ...
```

> The backend and frontend should be run in two separate terminals.

---

## ✅ Requirements

Before running the project, install:

- Python 3.12 recommended for the backend
- Node.js and npm for the frontend
- VS Code, PowerShell, Command Prompt, or another terminal
- Internet access if the configured AI provider requires it

If the project contains a `.env.example` file, create a `.env` file and configure the required environment variables or API keys.

---

## 🚀 Local Setup

### 1. Run the Backend

Open a terminal and navigate to the backend directory:

```powershell
cd path\to\smart-bug-analyzer\backend
```

Create a Python 3.12 virtual environment:

```powershell
py -3.12 -m venv .venv
```

Activate the environment:

```powershell
.venv\Scripts\Activate.ps1
```

If PowerShell activation is restricted, use Command Prompt:

```bat
.venv\Scripts\activate.bat
```

Install dependencies:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Start the FastAPI server:

```powershell
python -m uvicorn app.main:app
```

Backend address:

```text
http://127.0.0.1:8000
```

Keep this terminal running.

---

### 2. Run the Frontend

Open a **second terminal** and navigate to the frontend directory:

```powershell
cd path\to\smart-bug-analyzer\frontend
```

Install frontend packages:

```powershell
npm install
```

Start the Vite development server:

```powershell
npm run dev
```

Open the URL printed by Vite. The usual local address is:

```text
http://localhost:5173
```

---

## 👤 Login and User Access

- Use a registered account from the project database.
- Create an account through the application if registration is enabled.
- Do not assume a default password unless one is explicitly provided with the project.
- Supported roles include:
  - Developer
  - Team Lead
  - QA Engineer
  - Engineering Manager
  - Admin
- Admin privileges are managed through the Admin / Control Center and cannot be self-selected by a normal user.

---

## 🎬 Recommended Demo Flow

1. Log in and open **Overview**.
2. Open **New Diagnosis**.
3. Click **Load demo case**, or enter a new case manually.
4. Create the diagnostic case.
5. Open the case and select **Run AI diagnosis** or **Re-run AI analysis**.
6. Review the **AI Risk Intelligence** score and risk factors.
7. Review Triage, Log Intelligence, Historical Similarity, Root Cause, and Remediation results.
8. Check the parsed failure point, including file, line, and function when available.
9. Open a similar historical case.
10. Mark a case as **Resolved** and save resolution knowledge.
11. Open **Knowledge Vault** to view reusable historical knowledge.
12. Open **Insights** to view analytics, project health, and charts.
13. Download the PDF report.
14. Open **BugSense Copilot** and ask:
    - `List critical bugs`
    - `What is the health score?`
15. Demonstrate case history filtering and lifecycle controls.

---

## 🧪 Demo Test Case

### Input

| Field | Sample Value |
|---|---|
| Title | ZeroDivisionError in calculation service |
| Description | The calculation service crashes when division is performed with zero as the denominator. |
| Project | BugSense Demo |
| Component / Module | calculation-service |
| Category | Backend |
| Severity | High |
| Priority | P1 |

### Sample Stack Trace

```python
Traceback (most recent call last):
  File "calculator.py", line 24, in divide
    result = a / b
ZeroDivisionError: division by zero
```

### Expected Output

BugSense AI should:

- Store the case in Case History.
- Identify `ZeroDivisionError`.
- Identify `calculator.py`, line `24`, and function `divide()` when the trace is formatted correctly.
- Produce severity, priority, and category predictions with confidence.
- Show historical matches when similar bugs exist.
- Provide a probable root cause and confidence.
- Suggest remediation and prevention recommendations.
- Return an overall 0–100 risk score and a risk level such as:
  - Minimal
  - Low
  - Medium
  - High
  - Critical

---

## 🧠 Historical Learning Workflow

Historical learning becomes more useful after resolved cases contain valid resolution notes.

1. Open a previously solved case.
2. Set its status to **Resolved**.
3. Enter clear resolution knowledge describing the verified root cause and successful fix.
4. Save the resolution knowledge.
5. Open **Knowledge Vault** and verify that the case appears.
6. Create or analyze a similar new case.
7. Compare the Similarity and Root Cause results.

---

## 🔧 Troubleshooting

| Problem | Likely Cause | Solution |
|---|---|---|
| `uvicorn` is not recognized | Uvicorn is not installed or the environment is inactive | Activate `.venv`, install requirements, and run `python -m uvicorn app.main:app` |
| `pip.exe` is blocked | Windows Application Control or execution policy | Use `python -m pip` instead of `pip` |
| Frontend cannot connect to backend | Backend is not running or API address is incorrect | Start FastAPI at `127.0.0.1:8000` and verify frontend configuration |
| Frontend changes are not visible | Browser/Vite cache or unsaved files | Save changes and refresh the browser |
| Backend changes are not visible | Uvicorn was started without reload | Stop the server and start it again |
| AI analysis fails | Missing AI configuration, API key, backend error, or missing data | Check the backend terminal and required environment variables |
| Root cause is not useful | No similar resolved case with resolution notes exists | Resolve a matching case and save clear resolution knowledge |
| Knowledge Vault is empty | No resolved bugs contain saved resolution notes | Resolve a bug and save its resolution knowledge |
| Sign-out/menu overlap occurs | Frontend layering issue | Use the current redesigned Topbar included in the final project |

---

## ⚡ Quick Start

### Backend terminal

```powershell
cd backend
.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app
```

### Frontend terminal

```powershell
cd frontend
npm run dev
```

### Open the application

```text
http://localhost:5173
```

---

## 🔐 Security and Configuration Notes

- Keep secrets and API keys in `.env`.
- Do not commit `.env` files containing real credentials.
- Add virtual environments, build folders, databases, uploads, and logs to `.gitignore` where appropriate.
- Use strong passwords for real deployments.
- Review role permissions before deploying publicly.

---

## 📌 Project Status

BugSense AI provides a complete project handover guide covering its features, architecture, setup process, demonstration flow, and troubleshooting steps.

Some capabilities depend on the project's configured AI provider, available historical data, OCR support, and environment configuration.

---

## 👩‍💻 Author

**Snehali Dey**

BugSense AI — Intelligent Bug Diagnosis Platform with Fix Recommendation Assistance.

---

## 📄 License

This project is intended for educational, demonstration, and portfolio purposes. Add an appropriate open-source license before publishing the repository publicly.
