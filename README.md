# AeroSign — Flying AI 3D Drone Simulator

> An AI-powered 3D simulator for realistic drone flight and control using hand gestures.
> *AeroSign* = aerial flight + hand signs.
>

## What it does

A virtual quadcopter drone is flown around a 3D city using **only hand gestures** captured by a webcam. No remote, joystick, or keyboard needed (though a keyboard fallback is included for demos).

The system has three parts that work together in real time:

1. **Vision (Python + OpenCV + MediaPipe)** — captures the webcam, finds 21 hand landmarks, and classifies the gesture.
2. **Server (Flask + WebSocket)** — pushes the current gesture to the browser ~20 times a second.
3. **3D Simulator (Three.js)** — a drone with physics, obstacles, pickup rings, and a follow-camera reacts to the gesture in the browser.

---

## Gesture map

| Gesture                          | Command       |
|----------------------------------|---------------|
| Open palm (5 fingers up)         | Hover         |
| Closed fist (0 fingers)          | Move forward  |
| Peace sign (index + middle)      | Move backward |
| Index finger only                | Ascend ↑      |
| Thumb only                       | Descend ↓     |
| Three fingers (index/mid/ring)   | Yaw left      |
| Four fingers (no thumb)          | Yaw right     |
| Thumb + pinky ("Y" / hang-loose) | Land          |

---

## Setting up on a fresh machine

- **Windows, from scratch (no dev tools installed)** — follow the step-by-step guide in [`docs/SETUP_WINDOWS.md`](docs/SETUP_WINDOWS.md).
- **Want an AI assistant to do the setup for you?** Paste [`docs/AI_SETUP_PROMPT.md`](docs/AI_SETUP_PROMPT.md) into Claude Code / Cursor / Copilot / etc. and it will install and configure everything.

## How to run (short version, if you already have Python + git)

### 1. Install Python dependencies

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 2. Start the server

```bash
.venv/bin/python backend/app.py
```

You should see:

```
Open http://localhost:5000/ — log in with sohan / sohan03
```

### 3. Open in a browser

Go to **http://localhost:5000/** and log in.

| Username | Password    |
|----------|-------------|
| sohan    | sohan03    |
| sid      | sid03      |
| admin    | admin      |

Allow webcam access when the browser prompts (the server reads the camera, not the browser — but a good well-lit camera helps gesture accuracy).

### 4. Fly

Hold your hand in front of the camera and form the gestures above. The drone in the 3D scene will respond.

**Your mission:** fly through all 4 orange rings while avoiding the buildings. A timer starts when you begin moving; rings collected, time, and score update live on the HUD. Score = base 1000 − (time × 8) − (collisions × 50).

**Shortcuts (also work alongside gestures):**

| Key      | Action                              |
|----------|-------------------------------------|
| `C`      | Cycle camera (chase / FPV / top)    |
| `M`      | Toggle sound on/off                 |
| `R`      | Reset mission                       |
| Arrows   | Forward / back / yaw left / right   |
| `W` / `S`| Ascend / descend                    |
| `Space`  | Hover                               |
| `L`      | Land                                |

> **No webcam?** The keyboard shortcuts above let you demo the simulator without one.

---

## Project structure

```
sohan-proj/
├── backend/
│   ├── app.py                  # Flask + WebSocket server, MJPEG stream
│   └── gesture_recognizer.py   # MediaPipe hand landmarks → gesture
├── frontend/
│   ├── templates/
│   │   ├── login.html          # Login page (DFD: User Authentication)
│   │   └── simulator.html      # Main 3D simulator page
│   └── static/
│       ├── style.css           # Dark, modern UI theme
│       └── simulator.js        # Three.js scene, physics, WebSocket client
├── requirements.txt
└── README.md
```

---

## How each part maps to the synopsis

| Synopsis module               | Where it lives                                                  |
|-------------------------------|-----------------------------------------------------------------|
| Hand detection and tracking   | `backend/gesture_recognizer.py` — MediaPipe Hands               |
| Gesture recognition           | `GestureRecognizer._fingers_up` + `_classify`                   |
| AI gesture classification     | MediaPipe's pretrained hand-landmark model + rule-based mapping |
| Command mapping engine        | `simulator.js` → `intentFromGesture`                            |
| 3D drone simulation env.      | Three.js scene in `simulator.js` (drone, buildings, ground)     |
| Real-time response system     | WebSocket at `/ws/gesture`, MJPEG at `/camera.mjpg`             |
| User authentication           | `/login` route in `app.py`                                      |
| Collision detection           | `resolveCollisions` (AABB vs sphere) in `simulator.js`          |

---

## Tech stack

- **Python 3.10+** — backend language
- **OpenCV 4** — webcam capture, image processing
- **MediaPipe 0.10** — hand-landmark detection (21 keypoints per hand)
- **Flask 3** — web server, templating, sessions
- **flask-sock** — WebSocket support
- **Three.js 0.160** — 3D rendering in the browser (loaded via importmap CDN, no build step)

---

## Future scope (from the synopsis)

- VR/AR integration (WebXR is a natural fit since the frontend is already Three.js)
- Voice commands via Whisper for hybrid input
- Real drone bridging via DJI / Tello SDK
- Cloud-hosted multi-user training
- Train a custom YOLOv8 model for harder lighting conditions
