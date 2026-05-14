# AeroSign — Setup Guide for Windows (from scratch)

Follow this if you've just got a Windows laptop / PC with **nothing developer-related installed**. By the end you'll have AeroSign running in your browser at `http://localhost:5000`.

Total time: ~15 minutes (most of it is downloads).

---

## What you need before you start

- A Windows 10 or 11 PC
- A working built-in or USB webcam
- ~2 GB of free disk space (for Python, dependencies, etc.)
- An internet connection
- About 15 minutes

You do **not** need to know how to code. Just follow each step in order.

---

## Step 1 — Install Python

1. Go to **https://www.python.org/downloads/windows/**
2. Click the big yellow **"Download Python 3.11.x"** button (any 3.10, 3.11, or 3.12 will work — avoid 3.13 for now because MediaPipe lags behind).
3. Open the downloaded `.exe` installer.
4. **Very important:** on the first installer screen, **tick the box that says "Add python.exe to PATH"** (at the bottom).
5. Click **Install Now**.
6. When it finishes, click **Close**.

**Verify it worked.** Open the Start menu, type `cmd`, press Enter. In the black Command Prompt window type:

```
python --version
```

You should see something like `Python 3.11.9`. If you see "command not found" or similar, you forgot to tick the PATH box — uninstall Python from Settings → Apps and re-run the installer with the box ticked.

---

## Step 2 — Install Git

1. Go to **https://git-scm.com/download/win**
2. The download starts automatically. If not, click **"Click here to download the latest version"**.
3. Run the installer. Click **Next** through every screen — the defaults are fine.
4. Click **Install**, then **Finish**.

**Verify.** Open a new Command Prompt window and type:

```
git --version
```

You should see something like `git version 2.45.0`.

---

## Step 3 — (Optional) Install Visual Studio Code

You don't need an editor to run this project, but if you want to look at the code:

1. Go to **https://code.visualstudio.com/Download**
2. Download the **Windows** installer.
3. Run it, accept the defaults.

---

## Step 4 — Get the project code

You have two options.

### Option A — Clone with Git (recommended)

This needs you to be added as a collaborator on the private repo first. If you've been invited and accepted the invite, open Command Prompt and run:

```
cd %USERPROFILE%\Documents
git clone https://github.com/Aaronvern/aerosign.git
cd aerosign
```

You may be asked to log into GitHub the first time — a browser window will pop up.

### Option B — Download as ZIP

If you don't have repo access, ask the owner to send you the ZIP, then:

1. Right-click the ZIP → **Extract All…** → into `Documents`.
2. Open the extracted folder.
3. **Shift + Right-click** anywhere inside the folder → **"Open in Terminal"** (Windows 11) or **"Open PowerShell window here"** (Windows 10).

From here on, every command runs inside the project folder.

---

## Step 5 — Create a Python virtual environment

A virtual environment is an isolated copy of Python that holds this project's libraries without polluting your whole system.

In the project folder, run:

```
python -m venv .venv
```

This takes a few seconds. You won't see any output — that's normal. A new folder called `.venv` will appear.

---

## Step 6 — Activate the virtual environment

In the same Command Prompt window, type:

```
.venv\Scripts\activate
```

Your prompt will change to start with `(.venv)` — that means you're inside the virtual environment. **Every command from now on must be run in this same window** (or you have to re-activate).

> **PowerShell users**: if you see a red error about "running scripts is disabled", run this once: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` and answer **Y**. Then try the activate command again.

---

## Step 7 — Install the project's Python libraries

```
pip install -r requirements.txt
```

This downloads OpenCV, MediaPipe, Flask, and a few other libraries. **It will take 2–5 minutes** and print a lot of text. Wait for the prompt to come back. The last line should say something like `Successfully installed ...`.

If you see warnings about pip being out of date, you can ignore them, or run:

```
python -m pip install --upgrade pip
```

---

## Step 8 — Run the simulator

Still in the same window:

```
python backend\app.py
```

You should see:

```
Open http://localhost:5000/ — log in with megha / drone123
 * Running on http://127.0.0.1:5000
```

**Leave this window open.** Closing it stops the server.

---

## Step 9 — Open the simulator in your browser

1. Open **Chrome**, **Edge**, or **Firefox**.
2. Go to **http://localhost:5000/**
3. Log in:
   - Username: `megha`
   - Password: `drone123`
4. The first time, Windows may ask if you want to allow the app to use your camera — click **Allow**. (The webcam is read by Python, not the browser, so the browser itself won't prompt.)
5. Hold your hand in front of the camera and fly!

If the live camera box on the right shows your hand with green dots and lines drawn on it, the gesture detection is working.

---

## How to stop the simulator

In the Command Prompt window where it's running, press **Ctrl + C**. The server stops. Close the window when you're done.

---

## How to restart later

You don't have to re-install anything. Just:

1. Open Command Prompt.
2. `cd %USERPROFILE%\Documents\aerosign` (or wherever you put it)
3. `.venv\Scripts\activate`
4. `python backend\app.py`

---

## Troubleshooting

**"python is not recognized as an internal or external command"**
Python wasn't added to PATH. Re-run the Python installer, click **Modify** → tick **"Add python.exe to PATH"** → finish.

**"No module named 'cv2'" or similar**
You skipped Step 7, or you forgot to activate the venv. Run `.venv\Scripts\activate` then `pip install -r requirements.txt` again.

**Webcam shows a black image / "no camera" in the corner**
- Close any other app that might be using the camera (Zoom, Teams, Skype, the Windows Camera app).
- Check Windows Settings → **Privacy & security → Camera** → make sure **"Camera access"** and **"Let desktop apps access your camera"** are both **On**.
- On laptops, some have a physical webcam switch or `Fn+F8` shortcut to toggle the camera.

**The page loads but the 3D scene is empty / black**
Your browser may be blocking the external Three.js CDN. Check that you can open https://unpkg.com in the browser. If you're on a school/college network with a firewall, try a personal hotspot.

**The drone barely responds to gestures**
- Make sure your hand is fully in the frame, palm roughly facing the camera, in good lighting.
- Use a plain background if possible (no other hands or skin-tones visible).
- Hold each gesture steady for half a second.
- As a fallback, click anywhere in the 3D scene and use the keyboard: arrow keys, `W`/`S`, `Space`, `L`, `C`, `M`, `R`.

**"Port 5000 already in use"**
Something else is on that port. Open `backend\app.py`, find the line `app.run(host="0.0.0.0", port=5000, ...)` and change `5000` to e.g. `5050`. Save, then go to `http://localhost:5050/` instead.

---

## Optional — make a one-click shortcut

If you don't want to type commands every time:

1. Open Notepad and paste:

   ```
   @echo off
   cd /d "%USERPROFILE%\Documents\aerosign"
   call .venv\Scripts\activate
   python backend\app.py
   pause
   ```

2. Save the file as `AeroSign.bat` on your Desktop (in the **Save as type** dropdown pick **All files**, otherwise Notepad adds `.txt`).
3. Double-click it whenever you want to fly. A Command Prompt opens, server starts, browser still needs to be opened to `http://localhost:5000/` manually.
