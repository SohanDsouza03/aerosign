"""Flask + WebSocket server for the Flying AI 3D Drone Simulator.

Responsibilities:
    * Serve the Three.js frontend (login + simulator pages).
    * Run the OpenCV/MediaPipe gesture loop in a background thread.
    * Push the current gesture command over a WebSocket every frame.
    * Stream the annotated webcam frame as MJPEG for the operator view.

Run:
    python backend/app.py
Then open http://localhost:5000/ in a browser.
"""
from __future__ import annotations

import json
import threading
import time
from pathlib import Path

import cv2
from flask import Flask, Response, redirect, render_template, request, session, url_for
from flask_sock import Sock

from gesture_recognizer import GestureRecognizer


# ---------------------------------------------------------------------------
# Flask setup
# ---------------------------------------------------------------------------

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app = Flask(
    __name__,
    template_folder=str(FRONTEND_DIR / "templates"),
    static_folder=str(FRONTEND_DIR / "static"),
)
app.config["SECRET_KEY"] = "flying-ai-drone-simulator-demo-key"
sock = Sock(app)


# ---------------------------------------------------------------------------
# Gesture pipeline (background thread)
# ---------------------------------------------------------------------------

class GestureState:
    """Thread-safe container for the latest gesture and webcam frame."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._gesture = "none"
        self._fingers = [0, 0, 0, 0, 0]
        self._frame_jpeg: bytes | None = None
        self._running = False
        self._camera_ok = False
        self._error: str | None = None

    def update(self, gesture: str, fingers: list, jpeg: bytes) -> None:
        with self._lock:
            self._gesture = gesture
            self._fingers = fingers
            self._frame_jpeg = jpeg
            self._camera_ok = True

    def set_error(self, message: str) -> None:
        with self._lock:
            self._error = message
            self._camera_ok = False

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "gesture": self._gesture,
                "fingers": list(self._fingers),
                "camera_ok": self._camera_ok,
                "error": self._error,
                "ts": time.time(),
            }

    def jpeg(self) -> bytes | None:
        with self._lock:
            return self._frame_jpeg

    def mark_running(self, value: bool) -> None:
        with self._lock:
            self._running = value

    def is_running(self) -> bool:
        with self._lock:
            return self._running


STATE = GestureState()


def gesture_loop() -> None:
    """Continuously read frames, classify gestures, update shared state."""
    recognizer = GestureRecognizer()
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        STATE.set_error("Webcam not available. Plug in a camera and restart.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    try:
        while STATE.is_running():
            ok, frame = cap.read()
            if not ok:
                time.sleep(0.05)
                continue

            result = recognizer.process(frame)
            ok, buf = cv2.imencode(".jpg", result.annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            if not ok:
                continue
            STATE.update(result.gesture, result.finger_state, buf.tobytes())
    finally:
        cap.release()
        recognizer.close()


def ensure_gesture_thread_started() -> None:
    if STATE.is_running():
        return
    STATE.mark_running(True)
    t = threading.Thread(target=gesture_loop, daemon=True)
    t.start()


# ---------------------------------------------------------------------------
# HTTP routes
# ---------------------------------------------------------------------------

# A trivial demo "user database". Real auth is out of scope for this project.
DEMO_USERS = {
    "sohan": "sohan03",
    "siddarth": "sid01",
    "admin": "admin",
}


@app.route("/", methods=["GET"])
def root():
    if session.get("user"):
        return redirect(url_for("simulator"))
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")
        if DEMO_USERS.get(username) == password:
            session["user"] = username
            return redirect(url_for("simulator"))
        error = "Invalid username or password. Try sohan / sohan03."
    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect(url_for("login"))


@app.route("/simulator")
def simulator():
    if not session.get("user"):
        return redirect(url_for("login"))
    ensure_gesture_thread_started()
    return render_template("simulator.html", user=session["user"])


@app.route("/camera.mjpg")
def camera_mjpg():
    """MJPEG stream of the annotated webcam feed."""
    if not session.get("user"):
        return "Unauthorized", 401
    ensure_gesture_thread_started()

    def generate():
        boundary = b"--frame"
        while True:
            jpeg = STATE.jpeg()
            if jpeg is None:
                time.sleep(0.05)
                continue
            yield boundary + b"\r\nContent-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
            time.sleep(1 / 25)  # cap at ~25 fps

    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")


# ---------------------------------------------------------------------------
# WebSocket route — pushes gestures to the Three.js scene at ~20 Hz
# ---------------------------------------------------------------------------

@sock.route("/ws/gesture")
def ws_gesture(ws):
    ensure_gesture_thread_started()
    last_sent = None
    while True:
        snap = STATE.snapshot()
        # Always send a heartbeat every cycle so the client can detect liveness.
        payload = json.dumps(snap)
        try:
            ws.send(payload)
        except Exception:
            break
        last_sent = snap["gesture"]
        time.sleep(1 / 20)


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Open http://localhost:5000/ — log in with sohan / sohan03")
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
