"""Hand gesture recognition using MediaPipe.

Detects 21 hand landmarks from a webcam frame and classifies one of:
    - hover    (open palm, 5 fingers up)
    - up       (only index finger up)
    - down     (only thumb up, others curled)
    - forward  (closed fist)
    - backward (peace sign - index + middle up)
    - left     (3 fingers up - index, middle, ring)
    - right    (4 fingers up - all except thumb)
    - land     (all fingers down + thumb out, "Y" / pinky+thumb)
    - none     (no hand detected)
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import mediapipe as mp


# MediaPipe Hands setup (single hand is enough for our use case).
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
mp_styles = mp.solutions.drawing_styles


# Landmark indices for fingertips and PIP joints (one level below tip).
TIP_IDS = [4, 8, 12, 16, 20]   # thumb, index, middle, ring, pinky
PIP_IDS = [3, 6, 10, 14, 18]


@dataclass
class GestureResult:
    gesture: str          # the classified gesture name
    finger_state: list    # 5-element list of 0/1 (thumb..pinky)
    annotated_frame: any  # BGR image with landmarks drawn for display


class GestureRecognizer:
    """Wraps MediaPipe Hands and adds simple finger-up classification."""

    def __init__(self, detection_conf: float = 0.7, tracking_conf: float = 0.6):
        self._hands = mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=detection_conf,
            min_tracking_confidence=tracking_conf,
        )

    def close(self) -> None:
        self._hands.close()

    def process(self, bgr_frame) -> GestureResult:
        # MediaPipe expects RGB; selfie-view feels more natural so we flip.
        frame = cv2.flip(bgr_frame, 1)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        results = self._hands.process(rgb)
        rgb.flags.writeable = True

        annotated = frame.copy()
        finger_state = [0, 0, 0, 0, 0]
        gesture = "none"

        if results.multi_hand_landmarks:
            hand_landmarks = results.multi_hand_landmarks[0]
            handedness = results.multi_handedness[0].classification[0].label
            finger_state = self._fingers_up(hand_landmarks, handedness)
            gesture = self._classify(finger_state)

            mp_drawing.draw_landmarks(
                annotated,
                hand_landmarks,
                mp_hands.HAND_CONNECTIONS,
                mp_styles.get_default_hand_landmarks_style(),
                mp_styles.get_default_hand_connections_style(),
            )

        self._draw_hud(annotated, gesture, finger_state)
        return GestureResult(gesture=gesture, finger_state=finger_state, annotated_frame=annotated)

    @staticmethod
    def _fingers_up(landmarks, handedness: str) -> list:
        lm = landmarks.landmark
        state = [0, 0, 0, 0, 0]

        # Thumb: compare x of tip vs IP joint. Direction depends on hand.
        # The frame is flipped (selfie view), so "Right" hand in MediaPipe
        # appears on the left of the screen.
        if handedness == "Right":
            state[0] = 1 if lm[TIP_IDS[0]].x < lm[PIP_IDS[0]].x else 0
        else:
            state[0] = 1 if lm[TIP_IDS[0]].x > lm[PIP_IDS[0]].x else 0

        # Other 4 fingers: tip should be above (smaller y) the PIP joint.
        for i in range(1, 5):
            state[i] = 1 if lm[TIP_IDS[i]].y < lm[PIP_IDS[i]].y else 0
        return state

    @staticmethod
    def _classify(state: list) -> str:
        # state is [thumb, index, middle, ring, pinky], 1 = extended.
        # Order matters: check more specific patterns before generic ones.
        if state == [0, 0, 0, 0, 0]:
            return "forward"
        if state == [1, 1, 1, 1, 1]:
            return "hover"
        if state == [0, 1, 0, 0, 0]:
            return "up"
        if state == [1, 0, 0, 0, 0]:
            return "down"
        if state == [0, 1, 1, 0, 0]:
            return "backward"
        if state == [0, 1, 1, 1, 0]:
            return "left"
        if state == [0, 1, 1, 1, 1]:
            return "right"
        if state == [1, 0, 0, 0, 1]:
            return "land"
        return "none"

    @staticmethod
    def _draw_hud(frame, gesture: str, state: list) -> None:
        h, w = frame.shape[:2]
        cv2.rectangle(frame, (0, 0), (w, 40), (20, 20, 20), -1)
        cv2.putText(
            frame,
            f"Gesture: {gesture.upper()}",
            (10, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 120),
            2,
        )
        cv2.putText(
            frame,
            f"Fingers: {state}",
            (w - 260, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (200, 200, 200),
            1,
        )
