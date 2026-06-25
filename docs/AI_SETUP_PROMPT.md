# AI Setup Prompt — AeroSign on a fresh Windows machine

Paste the **entire block below** (including the fences) into a fresh chat with any AI coding assistant that has access to your terminal (Claude Code, Cursor, GitHub Copilot Workspace, Continue, Aider, etc.). The assistant will follow it step by step, verifying as it goes, and leave you with the simulator running.

If your assistant doesn't have shell access, give it this prompt anyway — it will at least walk you through every command and tell you what to type.

---

````
You are setting up a project called "AeroSign" on a fresh Windows 10/11 machine that has no developer tools installed. Your job is to take the user from a blank machine to having the simulator running in a browser. Work through the steps in order. After each step, verify it succeeded before moving on. If a verification fails, stop and explain the problem to the user instead of charging ahead.

# Project facts
- Name: AeroSign — Flying AI 3D Drone Simulator
- Repo: https://github.com/Aaronvern/aerosign  (private; the user may need to authenticate or be added as a collaborator)
- Stack: Python 3.10/3.11/3.12 backend (Flask + flask-sock + OpenCV + MediaPipe), Three.js frontend served from Flask.
- Runs entirely on localhost. No cloud, no database. Webcam-based.
- Default port: 5000.
- Default login: username `sohan`, password `sohan03`.

# Hard rules
- Use Windows-native paths and commands (`cmd.exe` or PowerShell). Never assume bash, WSL, or Linux paths.
- Use `python -m venv` for the virtual environment. Inside the venv, prefer `python -m pip ...` over bare `pip` to avoid PATH confusion.
- After every install step, run a verification command and confirm its output before continuing.
- Never run `pip install` outside the activated virtual environment.
- Never modify the user's system PATH except through official installers.
- If `winget` is available (`winget --version` succeeds), prefer it for installing Python and Git. Otherwise, instruct the user to download the official installer and tick "Add to PATH" for Python.
- If the user is on PowerShell and gets "scripts disabled" on venv activation, instruct them to run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` once and retry.

# Step 1 — Check / install Python 3.11
Goal: a working `python --version` that prints 3.10.x, 3.11.x, or 3.12.x. (Avoid 3.13 — MediaPipe may not yet have wheels for it.)

1. Run: `python --version`
   - If it prints 3.10–3.12, skip to step 2.
   - If it prints 3.13 or higher, install 3.11 alongside and call it `py -3.11` from now on.
   - If it errors, install.

2. Install via `winget` if available:
   `winget install --id Python.Python.3.11 -e --silent`

   Otherwise: open https://www.python.org/downloads/windows/ in a browser, download Python 3.11.x, and tell the user to **tick "Add python.exe to PATH"** on the first installer screen, then click Install Now.

3. Open a NEW terminal window (so PATH refreshes) and re-run `python --version`. Confirm the major.minor before continuing.

# Step 2 — Check / install Git
Goal: a working `git --version`.

1. Run: `git --version`. If it works, skip.
2. Install: `winget install --id Git.Git -e --silent`
   Otherwise: download from https://git-scm.com/download/win and run the installer with defaults.
3. Open a new terminal, re-run `git --version`. Confirm.

# Step 3 — Clone the repo
Goal: a folder `aerosign` in `%USERPROFILE%\Documents` containing the project.

1. `cd /d %USERPROFILE%\Documents` (cmd) or `cd $env:USERPROFILE\Documents` (PowerShell).
2. `git clone https://github.com/Aaronvern/aerosign.git`
   - If this fails with an auth error, the user needs to either:
     a) Run `gh auth login` (after installing `winget install --id GitHub.cli -e --silent`), OR
     b) Be added as a collaborator on the private repo, OR
     c) Receive a ZIP of the code from the owner and unzip it into `%USERPROFILE%\Documents\aerosign`.
3. `cd aerosign`
4. Verify: `dir backend frontend requirements.txt` lists all three. If anything is missing, stop and tell the user the clone is incomplete.

# Step 4 — Create the virtual environment
1. From inside the project folder: `python -m venv .venv`
   (If you had to install 3.11 alongside an existing 3.13, use `py -3.11 -m venv .venv`.)
2. Verify: `dir .venv\Scripts\python.exe` succeeds.

# Step 5 — Activate the venv
Pick the command for the user's shell:
- cmd.exe:    `.venv\Scripts\activate.bat`
- PowerShell: `.venv\Scripts\Activate.ps1`

Verify activation by running `where python` — the first line printed must point inside the `.venv\Scripts` folder. If not, activation failed; do not continue.

# Step 6 — Install Python dependencies
1. `python -m pip install --upgrade pip`
2. `python -m pip install -r requirements.txt`
   - Expect this to take 2–5 minutes and download ~300 MB.
   - If it fails on `mediapipe`, the most likely cause is Python 3.13. Re-do step 1 with Python 3.11.
3. Verify: `python -c "import flask, cv2, mediapipe; print('ok', cv2.__version__, mediapipe.__version__)"` must print `ok` and two version numbers.

# Step 7 — Confirm camera access
Windows blocks desktop apps from using the camera by default on some installs.
1. Tell the user to open Settings → **Privacy & security → Camera**.
2. Confirm both **"Camera access"** and **"Let desktop apps access your camera"** are **On**.
3. Tell the user to close Zoom, Teams, Skype, OBS, and the Windows Camera app — only one process can hold the webcam at a time.

# Step 8 — Start the server
1. Still in the activated venv: `python backend\app.py`
2. Within 10 seconds you should see a line containing `Running on http://127.0.0.1:5000`.
3. If the process exits immediately with a webcam error, go back to step 7. If port 5000 is taken, edit the last line of `backend\app.py` to use `port=5050` and try again — then tell the user to use http://localhost:5050/.

# Step 9 — Open the browser
1. Tell the user to open http://localhost:5000/ in Chrome, Edge, or Firefox.
2. Log in with `sohan` / `sohan03`.
3. The live hand panel on the right should show their hand with green landmarks. The 3D scene should show a green drone and orange rings.
4. If the 3D scene is blank, the Three.js CDN (unpkg.com) is being blocked. Tell the user to try a different network.

# Step 10 — Hand over
Print this exact handover summary:

```
AeroSign is running.

Open in browser:   http://localhost:5000/
Login:             sohan / sohan03
Stop server:       press Ctrl+C in the terminal window
Restart later:     cd %USERPROFILE%\Documents\aerosign && .venv\Scripts\activate && python backend\app.py

Gestures (from the synopsis):
  Open palm   -> Hover           Closed fist -> Forward
  Peace sign  -> Backward        Index up    -> Ascend
  Thumb up    -> Descend         3 fingers   -> Yaw left
  4 fingers   -> Yaw right       Thumb+pinky -> Land

Keyboard fallback (works without a webcam):
  Arrow keys / W S / Space / L         C: cycle camera   M: mute   R: reset mission
```

# If anything in this process fails
Do not improvise. Stop, tell the user exactly which step failed, paste the last 20 lines of output, and ask what they want to do.
````
