#!/usr/bin/env python3
import fcntl
import json
import math
import os
import random
import sys
import time
from pathlib import Path

from PyQt6.QtCore import QPoint, QRectF, Qt, QTimer
from PyQt6.QtGui import QColor, QCursor, QFont, QIcon, QPainter, QPainterPath, QPixmap
from PyQt6.QtWidgets import QApplication, QMenu, QWidget

APP_DIR = Path(__file__).resolve().parent
if (APP_DIR / "assets" / "sprites").is_dir():
    ASSETS = APP_DIR / "assets"
elif (APP_DIR / "sprites").is_dir():
    ASSETS = APP_DIR
else:
    ASSETS = Path.home() / ".local/share/ubuntu-pet"
CONFIG = Path.home() / ".config/ubuntu-fox-pet/state.json"
SPRITES = ("idle", "walk", "wave", "sleep", "surprise", "look")


def clamp(value, low=0, high=100):
    return max(low, min(high, value))


class UbuntuFox(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Ubuntu Fox Pet")
        self.setWindowIcon(QIcon(str(ASSETS / "icon.png")))
        self.setWindowFlags(
            Qt.WindowType.Tool
            | Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.NoDropShadowWindowHint
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setAttribute(Qt.WidgetAttribute.WA_ShowWithoutActivating)
        self.setMouseTracking(True)
        self.images = {name: QPixmap(str(ASSETS / "sprites" / f"{name}.png")) for name in SPRITES}
        if any(p.isNull() for p in self.images.values()):
            raise RuntimeError("Missing pet sprites")

        self.data = self.load()
        stats = self.data.get("stats", {})
        self.stats = {k: clamp(float(stats.get(k, 75))) for k in ("food", "joy", "energy")}
        elapsed = clamp(time.time() - float(self.data.get("saved_at", time.time())), 0, 28800)
        self.stats["food"] = clamp(self.stats["food"] - elapsed / 1500)
        self.stats["joy"] = clamp(self.stats["joy"] - elapsed / 2700)
        self.stats["energy"] = clamp(self.stats["energy"] + elapsed / 600)
        self.bond = int(clamp(self.data.get("bond", 0), 0, 999999))
        self.catches = int(clamp(self.data.get("catches", 0), 0, 999999))
        self.pet_size = int(self.data.get("size", 190))
        if self.pet_size not in (130, 190, 260):
            self.pet_size = 190
        self.roam = bool(self.data.get("roam", True))
        self.follow = bool(self.data.get("follow", False))
        self.quiet = bool(self.data.get("quiet", False))
        self.drag_offset = None
        self.was_dragged = False
        self.drag_last = None
        self.pressed_at = None
        self.hold_rewarded = False
        self.throw_vx = 0.0
        self.throw_vy = 0.0
        self.trick_start = None
        self.trick_kind = None
        self.manual_sleep = False
        self.state = "idle"
        self.direction = -1
        self.now = time.monotonic()
        self.until = self.now + 3
        self.last_tick = self.now
        self.last_save = self.now
        self.last_hover = 0
        self.hover_started = None
        self.bubble = ""
        self.bubble_until = 0
        self.status_until = 0
        self.play_start = None
        self.feed_start = None
        self.particles = []
        self.resize(self.pet_size + 80, self.pet_size + 85)

        area = QApplication.primaryScreen().availableGeometry()
        saved_x, saved_y = self.data.get("x"), self.data.get("y")
        if isinstance(saved_x, int) and isinstance(saved_y, int):
            x, y = saved_x, saved_y
        else:
            x, y = area.right() - self.width() - 35, area.bottom() - self.height() - 25
        self.move(self.clamped_position(QPoint(x, y)))
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.tick)
        self.timer.start(70)
        QApplication.instance().aboutToQuit.connect(self.save)

    @staticmethod
    def load():
        try:
            return json.loads(CONFIG.read_text(encoding="utf-8"))
        except (OSError, ValueError, TypeError):
            return {}

    def save(self):
        CONFIG.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "version": 3, "stats": {k: round(v, 2) for k, v in self.stats.items()},
            "bond": self.bond, "catches": self.catches,
            "size": self.pet_size, "roam": self.roam, "follow": self.follow,
            "quiet": self.quiet, "x": self.x(), "y": self.y(), "saved_at": time.time(),
        }
        tmp = CONFIG.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
        tmp.replace(CONFIG)
        self.last_save = time.monotonic()

    def clamped_position(self, pos):
        area = self.screen().availableGeometry() if self.screen() else QApplication.primaryScreen().availableGeometry()
        return QPoint(
            int(clamp(pos.x(), area.left(), area.right() - self.width() + 1)),
            int(clamp(pos.y(), area.top(), area.bottom() - self.height() + 1)),
        )

    def say(self, message, duration=2.0):
        if not self.quiet:
            self.bubble = message
            self.bubble_until = time.monotonic() + duration

    def change_state(self, name, duration):
        self.state = name
        self.until = time.monotonic() + duration
        self.update()

    def hearts(self, amount=5, kind="heart"):
        now = time.monotonic()
        for _ in range(amount):
            self.particles.append({
                "x": random.randint(self.width() // 3, self.width() * 2 // 3),
                "y": random.randint(self.height() // 2, self.height() * 3 // 4),
                "at": now + random.uniform(0, 0.3),
                "dx": random.uniform(-20, 20), "kind": kind,
            })
        self.particles = self.particles[-40:]

    def add_bond(self, amount):
        self.bond = min(999999, self.bond + amount)

    def trick(self, kind):
        self.manual_sleep = False
        self.throw_vx = 0.0
        self.throw_vy = 0.0
        self.trick_kind = kind
        self.trick_start = time.monotonic()
        self.change_state("wave" if kind == "jump" else "surprise", 1.3)
        self.stats["energy"] = clamp(self.stats["energy"] - 2)
        self.add_bond(1)
        self.hearts(4, "sparkle")
        self.say("Boing!" if kind == "jump" else "Wheee!", 1.3)
        self.save()

    def pet(self):
        self.manual_sleep = False
        self.stats["joy"] = clamp(self.stats["joy"] + 4)
        self.add_bond(1)
        self.change_state("wave", 1.7)
        self.hearts()
        self.say(random.choice(("Purrr!", "You're my friend!", "More pats!", "Yay!")), 1.7)
        self.save()

    def feed(self):
        self.manual_sleep = False
        self.play_start = None
        self.feed_start = time.monotonic()
        self.stats["food"] = clamp(self.stats["food"] + 22)
        self.stats["joy"] = clamp(self.stats["joy"] + 3)
        self.add_bond(2)
        self.change_state("wave", 2.1)
        self.hearts(5, "sparkle")
        self.say("Nom nom!", 1.8)
        self.save()

    def play(self):
        if self.play_start is not None:
            return
        if self.stats["energy"] < 8:
            self.say("Too sleepy to play!", 2)
            self.change_state("sleep", 3)
            return
        self.manual_sleep = False
        self.feed_start = None
        self.play_start = time.monotonic()
        self.stats["energy"] = clamp(self.stats["energy"] - 8)
        self.stats["joy"] = clamp(self.stats["joy"] + 13)
        self.change_state("walk", 2.9)
        self.say("Catch the ball!", 2)
        self.save()

    def ball_pos(self, now=None):
        now = now or time.monotonic()
        if self.play_start is None:
            return None
        t = clamp((now - self.play_start) / 2.7, 0, 1)
        return (23 + (self.width() - 46) * t,
                self.height() - 37 - abs(math.sin(t * math.pi * 4)) * 62)

    def catch(self):
        self.play_start = None
        self.stats["joy"] = clamp(self.stats["joy"] + 5)
        self.catches = min(999999, self.catches + 1)
        self.add_bond(5)
        self.hearts(7, "sparkle")
        self.change_state("wave", 2)
        self.say("Great catch!", 2)
        self.save()

    def sleep(self):
        self.manual_sleep = True
        self.play_start = None
        self.change_state("sleep", 999999)
        self.say("Zzz...", 1.8)
        self.save()

    def wake(self):
        self.manual_sleep = False
        self.change_state("wave", 2)
        self.say("I'm awake!")
        self.save()

    def show_status(self):
        self.status_until = time.monotonic() + 7
        self.update()

    def choose_state(self):
        if self.stats["energy"] < 22:
            return "sleep", random.uniform(7, 11)
        if not self.roam and not self.follow:
            return random.choice(("idle", "idle", "look", "wave")), random.uniform(2, 5)
        choices = ("idle", "walk", "wave", "sleep", "look", "surprise")
        weights = (39, 24, 13, 10, 11, 3)
        choice = random.choices(choices, weights)[0]
        if choice == "walk":
            self.direction = random.choice((-1, 1))
        return choice, {"idle": 5, "walk": 3, "wave": 2, "sleep": 6, "look": 3, "surprise": 1.5}[choice]

    def advance_throw(self, dt):
        if max(abs(self.throw_vx), abs(self.throw_vy)) < 15:
            self.throw_vx = 0
            self.throw_vy = 0
            return
        area = self.screen().availableGeometry()
        x = self.x() + self.throw_vx * dt
        y = self.y() + self.throw_vy * dt
        min_x = area.left()
        max_x = max(min_x, area.right() - self.width() + 1)
        min_y = area.top()
        max_y = max(min_y, area.bottom() - self.height() + 1)
        if x <= min_x or x >= max_x:
            x = clamp(x, min_x, max_x)
            self.throw_vx *= -0.5
            self.hearts(2, "sparkle")
        if y <= min_y or y >= max_y:
            y = clamp(y, min_y, max_y)
            self.throw_vy *= -0.5
            self.hearts(2, "sparkle")
        self.move(round(x), round(y))
        decay = 0.76 ** (dt * 10)
        self.throw_vx *= decay
        self.throw_vy *= decay

    def tick(self):
        now = time.monotonic()
        dt = clamp(now - self.last_tick, 0, 2)
        self.last_tick = now
        if self.drag_offset is not None and not self.was_dragged and not self.hold_rewarded:
            if self.pressed_at is not None and now - self.pressed_at > 0.9:
                self.hold_rewarded = True
                self.pet()
        if self.trick_start is not None and now - self.trick_start > 1.25:
            self.trick_start = None
            self.trick_kind = None
        self.stats["food"] = clamp(self.stats["food"] - dt / 1500)
        self.stats["joy"] = clamp(self.stats["joy"] - dt / 2700)
        if self.state == "sleep" or self.manual_sleep:
            self.stats["energy"] = clamp(self.stats["energy"] + dt / 10)
        elif self.state == "walk":
            self.stats["energy"] = clamp(self.stats["energy"] - dt / 800)
        else:
            self.stats["energy"] = clamp(self.stats["energy"] + dt / 3600)
        if self.play_start is not None and now - self.play_start >= 2.7:
            self.catch()
        if self.feed_start is not None and now - self.feed_start > 2.1:
            self.feed_start = None
        self.particles = [p for p in self.particles if now - p["at"] < 1.55]
        if self.bubble and now > self.bubble_until:
            self.bubble = ""
        if self.drag_offset is None:
            if abs(self.throw_vx) > 0 or abs(self.throw_vy) > 0:
                self.advance_throw(dt)
            elif self.follow and not self.manual_sleep and self.play_start is None:
                cursor = QCursor.pos()
                dx = cursor.x() - self.geometry().center().x()
                dy = cursor.y() - self.geometry().center().y()
                distance = math.hypot(dx, dy)
                if distance > 155:
                    step = min(3.2, distance - 155)
                    self.move(self.clamped_position(self.pos() + QPoint(round(step * dx / distance), round(step * dy / distance))))
                    self.direction = 1 if dx > 0 else -1
                    if now >= self.until or self.state != "walk":
                        self.change_state("walk", 0.3)
            elif self.state == "walk" and self.roam and not self.manual_sleep and self.play_start is None:
                self.move(self.clamped_position(self.pos() + QPoint(self.direction * 2, 0)))
                area = self.screen().availableGeometry()
                if self.x() <= area.left() or self.x() + self.width() >= area.right():
                    self.direction *= -1
            if not self.manual_sleep and self.play_start is None and now >= self.until:
                name, duration = self.choose_state()
                self.change_state(name, duration)
            if not self.manual_sleep and self.play_start is None and not self.follow and now - self.last_hover > 18:
                if self.underMouse():
                    if self.hover_started is None:
                        self.hover_started = now
                    elif now - self.hover_started > 1.3:
                        self.change_state("look", 2.6)
                        self.last_hover = now
                        self.hearts(2, "sparkle")
                else:
                    self.hover_started = None
        if now - self.last_save > 45:
            self.save()
        self.update()

    def paintEvent(self, event):
        now = time.monotonic()
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)
        sprite = self.images[self.state]
        scale = self.pet_size / max(sprite.width(), sprite.height())
        w, h = round(sprite.width() * scale), round(sprite.height() * scale)
        left = (self.width() - w) // 2
        bob = round(math.sin(now * 3.5) * 3) if self.state == "idle" else 0
        if self.state == "walk":
            bob = round(abs(math.sin(now * 13)) * 4)
        top = self.height() - h - 12 - bob
        effect_progress = 0.0
        if self.trick_start is not None:
            effect_progress = clamp((now - self.trick_start) / 1.2, 0, 1)
            if self.trick_kind == "jump":
                top -= round(math.sin(effect_progress * math.pi) * 52)
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(23, 12, 34, 35))
        p.drawEllipse(QRectF(self.width() * .2, self.height() - 17, self.width() * .6, 10))
        p.save()
        if self.trick_start is not None and self.trick_kind == "spin":
            cx, cy = left + w / 2, top + h / 2
            p.translate(cx, cy)
            p.rotate(360 * (1 - (1 - effect_progress) ** 2))
            p.translate(-cx, -cy)
        if self.state == "walk" and self.direction > 0:
            p.save()
            p.translate(left + w, top)
            p.scale(-1, 1)
            p.drawPixmap(0, 0, w, h, sprite)
            p.restore()
        else:
            p.drawPixmap(left, top, w, h, sprite)
        p.restore()
        if self.feed_start is not None:
            elapsed = now - self.feed_start
            x = self.width() * .73 - elapsed * 20
            y = 50 + min(elapsed / 1.2, 1) * (self.height() - 115)
            p.setPen(QColor(122, 58, 33))
            p.setBrush(QColor(243, 163, 68))
            p.drawEllipse(QRectF(x - 12, y - 12, 24, 24))
            p.setBrush(QColor(122, 58, 33))
            for cx, cy in ((-5, -3), (4, 5), (6, -6)):
                p.drawEllipse(QRectF(x + cx, y + cy, 4, 4))
        if self.play_start is not None:
            x, y = self.ball_pos(now)
            p.setPen(QColor(107, 42, 61, 210))
            p.setBrush(QColor(255, 135, 48))
            p.drawEllipse(QRectF(x - 12, y - 12, 24, 24))
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor(255, 239, 180, 225))
            p.drawEllipse(QRectF(x - 5, y - 7, 7, 7))
        for particle in self.particles:
            age = now - particle["at"]
            if age < 0:
                continue
            alpha = round(255 * max(0, 1 - age / 1.5))
            x = particle["x"] + particle["dx"] * age
            y = particle["y"] - age * 53
            p.save()
            p.translate(x, y)
            p.scale(0.7 + age * .2, 0.7 + age * .2)
            if particle["kind"] == "heart":
                path = QPainterPath()
                path.moveTo(0, 9)
                path.cubicTo(-19, -4, -13, -15, 0, -7)
                path.cubicTo(13, -15, 19, -4, 0, 9)
                p.setBrush(QColor(249, 82, 139, alpha))
            else:
                path = QPainterPath()
                path.moveTo(0, -11)
                path.lineTo(4, -3)
                path.lineTo(12, 0)
                path.lineTo(4, 3)
                path.lineTo(0, 11)
                path.lineTo(-4, 3)
                path.lineTo(-12, 0)
                path.lineTo(-4, -3)
                path.closeSubpath()
                p.setBrush(QColor(255, 180, 46, alpha))
            p.setPen(Qt.PenStyle.NoPen)
            p.drawPath(path)
            p.restore()
        if now < self.status_until:
            self.paint_status(p)
        elif self.bubble:
            font = QFont("Sans", 9)
            font.setBold(True)
            p.setFont(font)
            metrics = p.fontMetrics()
            bw = min(self.width() - 14, metrics.horizontalAdvance(self.bubble) + 23)
            rect = QRectF((self.width() - bw) / 2, 5, bw, 32)
            p.setBrush(QColor(53, 30, 65, 243))
            p.setPen(QColor(253, 163, 69, 224))
            p.drawRoundedRect(rect, 13, 13)
            p.setPen(QColor(255, 241, 221))
            p.drawText(rect, Qt.AlignmentFlag.AlignCenter, self.bubble)
        p.end()

    def paint_status(self, p):
        panel = QRectF(19, 4, self.width() - 38, 102)
        p.setPen(QColor(231, 137, 68, 225))
        p.setBrush(QColor(49, 28, 61, 239))
        p.drawRoundedRect(panel, 11, 11)
        p.setFont(QFont("Sans", 8, QFont.Weight.Bold))
        for i, (key, label, color) in enumerate((
            ("food", "Food", QColor("#ffb55d")),
            ("joy", "Joy", QColor("#f489b9")),
            ("energy", "Energy", QColor("#8cd6b3")),
        )):
            y = 14 + i * 21
            p.setPen(QColor("#f8edde"))
            p.drawText(30, y + 9, label)
            bar = QRectF(86, y, max(30, self.width() - 132), 10)
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor("#1c1428"))
            p.drawRoundedRect(bar, 5, 5)
            filled = QRectF(bar.x(), bar.y(), max(0, bar.width() * self.stats[key] / 100), 10)
            p.setBrush(color)
            p.drawRoundedRect(filled, 5, 5)
            p.setPen(QColor("#f8edde"))
            p.drawText(self.width() - 42, y + 9, f"{round(self.stats[key])}")
        p.setFont(QFont("Sans", 8, QFont.Weight.Bold))
        p.setPen(QColor("#ffda9e"))
        p.drawText(QRectF(28, 78, self.width() - 56, 20),
                   Qt.AlignmentFlag.AlignCenter,
                   f"Bond Lv {1 + self.bond // 25}   ★ {self.bond}   Catches {self.catches}")

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_offset = event.globalPosition().toPoint() - self.pos()
            self.was_dragged = False
            self.drag_last = (event.globalPosition().toPoint(), time.monotonic())
            self.pressed_at = time.monotonic()
            self.hold_rewarded = False
            self.throw_vx = 0
            self.throw_vy = 0
            event.accept()
        elif event.button() == Qt.MouseButton.MiddleButton:
            self.trick("jump")
            event.accept()
        else:
            super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        if self.drag_offset is not None:
            target = event.globalPosition().toPoint() - self.drag_offset
            if (target - self.pos()).manhattanLength() > 5:
                self.was_dragged = True
            self.move(self.clamped_position(target))
            now = time.monotonic()
            point, timestamp = self.drag_last or (event.globalPosition().toPoint(), now)
            elapsed = now - timestamp
            if elapsed > 0.004:
                latest = event.globalPosition().toPoint()
                self.throw_vx = clamp((latest.x() - point.x()) / elapsed, -1100, 1100)
                self.throw_vy = clamp((latest.y() - point.y()) / elapsed, -1100, 1100)
                self.drag_last = (latest, now)
            event.accept()

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_offset = None
            if self.was_dragged:
                now = time.monotonic()
                if self.drag_last and now - self.drag_last[1] > 0.13:
                    self.throw_vx = 0
                    self.throw_vy = 0
                if math.hypot(self.throw_vx, self.throw_vy) > 220:
                    self.change_state("surprise", 0.7)
                    self.hearts(3, "sparkle")
                else:
                    self.throw_vx = 0
                    self.throw_vy = 0
                self.save()
            elif not self.hold_rewarded:
                ball = self.ball_pos()
                if ball and math.hypot(event.position().x() - ball[0], event.position().y() - ball[1]) < 42:
                    self.catch()
                elif self.play_start is None:
                    self.pet()
            event.accept()

    def mouseDoubleClickEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.play()
            event.accept()

    def contextMenuEvent(self, event):
        menu = QMenu(self)
        menu.setStyleSheet(
            "QMenu { background:#35213e; color:#fff5e7; border:1px solid #dc7936; "
            "padding:5px; } QMenu::item:selected { background:#85475b; }"
        )
        header = menu.addAction("Ubuntu Fox  •  Interactive Pet")
        header.setEnabled(False)
        menu.addSeparator()
        menu.addAction("Feed cookie", self.feed)
        menu.addAction("Play fetch", self.play)
        menu.addAction("Pet / cuddle", self.pet)
        menu.addAction("Jump!", lambda: self.trick("jump"))
        menu.addAction("Spin!", lambda: self.trick("spin"))
        menu.addAction("Show mood & needs", self.show_status)
        menu.addSeparator()
        menu.addAction("Wake up" if self.manual_sleep else "Take a nap", self.wake if self.manual_sleep else self.sleep)
        for text, key in (("Wander around", "roam"), ("Follow mouse", "follow"), ("Quiet mode", "quiet")):
            action = menu.addAction(text)
            action.setCheckable(True)
            action.setChecked(getattr(self, key))
            action.triggered.connect(lambda checked, name=key: self.set_option(name, checked))
        sizes = menu.addMenu("Size")
        for label, size in (("Small", 130), ("Medium", 190), ("Large", 260)):
            action = sizes.addAction(label)
            action.setCheckable(True)
            action.setChecked(size == self.pet_size)
            action.triggered.connect(lambda checked, value=size: self.change_size(value))
        menu.addSeparator()
        menu.addAction("Quit", QApplication.instance().quit)
        menu.exec(event.globalPos())

    def set_option(self, key, enabled):
        setattr(self, key, enabled)
        if key == "follow" and enabled:
            self.roam = False
        if key == "roam" and enabled:
            self.follow = False
        if key == "quiet" and enabled:
            self.bubble = ""
        self.save()

    def wheelEvent(self, event):
        sizes = (130, 190, 260)
        index = sizes.index(self.pet_size)
        shift = 1 if event.angleDelta().y() > 0 else -1
        self.change_size(sizes[int(clamp(index + shift, 0, len(sizes) - 1))])
        event.accept()

    def change_size(self, size):
        anchor = self.geometry().bottomRight()
        self.pet_size = size
        self.resize(size + 80, size + 85)
        self.move(self.clamped_position(QPoint(anchor.x() - self.width(), anchor.y() - self.height())))
        self.save()
        self.update()


def main():
    app = QApplication(sys.argv)
    app.setApplicationName("Ubuntu Fox Pet")
    app.setQuitOnLastWindowClosed(True)
    lock_path = Path(f"/tmp/ubuntu-fox-pet-{os.getuid()}.lock")
    lock = open(lock_path, "a+")
    try:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return 0
    pet = UbuntuFox()
    pet.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
