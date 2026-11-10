import math
import random
import time
from datetime import datetime
from pathlib import Path
import os

from PyQt6.QtCore import QPoint, QPointF, QRectF, Qt, QTimer
from PyQt6.QtGui import QColor, QCursor, QFont, QLinearGradient, QPainter, QPainterPath, QPen, QPixmap, QPolygonF, QRadialGradient
from PyQt6.QtWidgets import QMenu, QWidget


def c(value, alpha=None):
    color = QColor(value)
    if alpha is not None:
        color.setAlpha(alpha)
    return color


def rounded(p, x, y, w, h, color, r=12, border=None, border_width=1):
    p.setBrush(color)
    p.setPen(QPen(border, border_width) if border else Qt.PenStyle.NoPen)
    p.drawRoundedRect(QRectF(x, y, w, h), r, r)


def ellipse(p, x, y, w, h, color, border=None, border_width=1):
    p.setBrush(color)
    p.setPen(QPen(border, border_width) if border else Qt.PenStyle.NoPen)
    p.drawEllipse(QRectF(x, y, w, h))


def polygon(p, points, color, border=None, border_width=1):
    p.setBrush(color)
    p.setPen(QPen(border, border_width) if border else Qt.PenStyle.NoPen)
    p.drawPolygon(QPolygonF([QPointF(x, y) for x, y in points]))


def stroke(p, points, color, width=2):
    p.setBrush(Qt.BrushStyle.NoBrush)
    p.setPen(QPen(color, width, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap, Qt.PenJoinStyle.RoundJoin))
    for a, b in zip(points, points[1:]):
        p.drawLine(QPointF(*a), QPointF(*b))


def blend(x, a, b):
    return max(a, min(b, x))


def glow(p, x, y, radius, color, opacity=125):
    gradient = QRadialGradient(x, y, radius)
    bright = QColor(color)
    bright.setAlpha(opacity)
    edge = QColor(color)
    edge.setAlpha(0)
    gradient.setColorAt(0, bright)
    gradient.setColorAt(1, edge)
    ellipse(p, x-radius, y-radius, radius*2, radius*2, gradient)


def text(p, x, y, text_value, color="#fff0db", size=11, bold=False, align=None):
    font = QFont("DejaVu Sans", size)
    font.setWeight(QFont.Weight.Bold if bold else QFont.Weight.Normal)
    p.setFont(font)
    p.setPen(c(color))
    if align:
        p.drawText(QRectF(x, y, 200, 28), align, text_value)
    else:
        p.drawText(QPointF(x, y), text_value)


REALISTIC_DIR = Path(os.environ.get("UBUNTU_FOX_REALISTIC_DIR", str(Path.home() / ".local/share/ubuntu-fox-pet/realistic")))


class FoxRoom(QWidget):
    INTERACTIONS = {
        "bed": ((160, 418, 180, 104), (297, 500), "Sleep"),
        "ball": ((458, 477, 128, 88), (517, 520), "Play ball"),
        "food": ((785, 465, 153, 105), (752, 524), "Have a treat"),
        "desk": ((768, 302, 166, 180), (735, 475), "Help at the terminal"),
        "window": ((386, 145, 272, 200), (505, 435), "Watch the sky"),
        "tower": ((620, 238, 130, 235), (627, 474), "Climb and jump"),
    }
    BUTTONS = ("bed", "ball", "food", "desk", "window", "tower")
    PHOTO_INTERACTIONS = {
        "bed": ((154, 314, 243, 141), (266, 439), "Sleep"),
        "ball": ((505, 446, 84, 65), (532, 476), "Play ball"),
        "food": ((577, 419, 117, 85), (662, 485), "Have a treat"),
        "desk": ((461, 198, 240, 213), (628, 444), "Help at the terminal"),
        "window": ((270, 122, 152, 201), (405, 441), "Watch the sky"),
        "tower": ((665, 190, 176, 256), (757, 463), "Climb and jump"),
    }

    def __init__(self, pet):
        super().__init__()
        self.pet = pet
        self.photo_dir = REALISTIC_DIR
        self.photo_background = QPixmap(str(self.photo_dir / "room.png"))
        self.photo_idle = QPixmap(str(self.photo_dir / "idle.png"))
        self.photo_sleep = QPixmap(str(self.photo_dir / "sleep.png"))
        self.photo_walk = [
            QPixmap(str(self.photo_dir / f"walk_{i:02}.png")) for i in range(8)
        ]
        self.photo_ready = not self.photo_background.isNull() and not self.photo_idle.isNull() and all(not f.isNull() for f in self.photo_walk)
        self.photo_mode = self.photo_ready and bool(getattr(pet, "room_realistic", True))
        self.INTERACTIONS = self.PHOTO_INTERACTIONS if self.photo_mode else type(self).INTERACTIONS
        self.photo_last_kind = "idle"
        self.photo_prev_kind = "idle"
        self.photo_mode_change = time.monotonic()
        self.setWindowTitle("Ubuntu Fox Pet  ·  Cozy Room")
        self.setWindowIcon(pet.windowIcon())
        self.setMinimumSize(760, 520)
        self.resize(1060, 720)
        self.setAttribute(Qt.WidgetAttribute.WA_DeleteOnClose, False)
        self.setMouseTracking(True)
        self.position = QPointF(518, 477) if self.photo_mode else QPointF(480, 501)
        self.target = None
        self.action = None
        self.hover = None
        self.mode = "idle"
        self.mode_until = 0
        self.message = "Welcome home!"
        self.message_until = time.monotonic() + 4
        self.ball_started = 0
        self.look_started = time.monotonic()
        self.last_tick = self.look_started
        self.manual_night = None
        self.background_cache = {}
        self.foreground_cache = None
        self.room_timer = QTimer(self)
        self.room_timer.setInterval(40)
        self.room_timer.timeout.connect(self.tick)
        self.room_timer.start()
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)

    def say(self, message, seconds=2.5):
        if not self.pet.quiet:
            self.message = message
            self.message_until = time.monotonic() + seconds

    def is_night(self):
        if self.manual_night is not None:
            return self.manual_night
        hour = datetime.now().hour
        return hour < 7 or hour >= 19

    def fit(self):
        scale = min(self.width() / 1000, self.height() / 650)
        return scale, (self.width() - 1000 * scale) / 2, (self.height() - 650 * scale) / 2

    def scene_point(self, point):
        scale, ox, oy = self.fit()
        return (point.x() - ox) / scale, (point.y() - oy) / scale

    def tick(self):
        now = time.monotonic()
        dt = blend(now - self.last_tick, 0, 0.15)
        self.last_tick = now
        if self.target is not None:
            dx = self.target.x() - self.position.x()
            dy = self.target.y() - self.position.y()
            distance = math.hypot(dx, dy)
            speed = 215 * dt
            if distance < max(2, speed):
                self.position = QPointF(self.target)
                self.target = None
                self.arrived()
            else:
                self.position += QPointF(dx / distance * speed, dy / distance * speed)
                self.pet.direction = 1 if dx > 0 else -1
                self.mode = "walk"
        elif now > self.mode_until and self.mode != "sleep":
            if now - self.look_started > 12 and random.random() < 0.0025:
                self.go(random.choice(("window", "ball", "bed", "tower")), automatic=True)
                self.look_started = now
            elif self.mode != "idle":
                self.mode = "idle"
        self.update()

    def go(self, target, automatic=False):
        if target not in self.INTERACTIONS:
            return
        if self.pet.manual_sleep:
            self.pet.wake()
        x, y = self.INTERACTIONS[target][1]
        self.target = QPointF(x, y)
        self.action = target
        self.mode = "walk"
        self.mode_until = time.monotonic() + 15
        if not automatic:
            self.say({
                "bed": "That bed looks cozy...",
                "ball": "Let's play!",
                "food": "Snack time!",
                "desk": "I'll help you code!",
                "window": "What's outside?",
                "tower": "Up we go!",
            }[target], 2.1)

    def arrived(self):
        name = self.action
        self.action = None
        self.mode_until = time.monotonic() + (5 if name != "bed" else 999999)
        if name == "bed":
            self.pet.sleep()
            self.mode = "sleep"
            self.say("Zzz... sweet dreams")
        elif name == "food":
            self.pet.feed()
            self.mode = "eat"
            self.say("Crunch crunch!")
        elif name == "ball":
            self.pet.play()
            self.ball_started = time.monotonic()
            self.mode = "play"
            self.say("Catch!")
        elif name == "desk":
            self.pet.stats["joy"] = min(100, self.pet.stats["joy"] + 2)
            self.pet.add_bond(1)
            self.pet.change_state("look", 5)
            self.mode = "work"
            self.say("sudo apt install cuddles", 3.5)
            self.pet.save()
        elif name == "window":
            self.pet.change_state("look", 5)
            self.mode = "look"
            self.say("The sky is beautiful...")
        elif name == "tower":
            self.pet.trick("jump")
            self.mode = "jump"
            self.say("Boing!")

    def on_pet(self):
        self.pet.pet()
        self.say(random.choice(("You found me!", "I like it here!", "Hehe!", "More hugs!")))
        self.mode = "wave"
        self.mode_until = time.monotonic() + 2.5

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)
        p.fillRect(self.rect(), c("#130c20"))
        s, ox, oy = self.fit()
        p.translate(ox, oy)
        p.scale(s, s)
        self.draw_room(p)
        self.draw_ui(p)
        p.end()

    def draw_room(self, p):
        if self.photo_mode and self.photo_ready:
            self.draw_photoreal_room(p)
            return
        night = self.is_night()
        if night not in self.background_cache:
            cache = QPixmap(1000, 650)
            cache.fill(Qt.GlobalColor.transparent)
            qp = QPainter(cache)
            qp.setRenderHint(QPainter.RenderHint.Antialiasing)
            qp.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)
            self.draw_room_static(qp, night)
            qp.end()
            self.background_cache[night] = cache
        if self.foreground_cache is None:
            self.foreground_cache = QPixmap(1000, 650)
            self.foreground_cache.fill(Qt.GlobalColor.transparent)
            fp = QPainter(self.foreground_cache)
            fp.setRenderHint(QPainter.RenderHint.Antialiasing)
            self.draw_foreground(fp)
            fp.end()
        p.drawPixmap(0, 0, self.background_cache[night])
        now = time.monotonic()
        p.save()
        p.setClipRect(QRectF(17, 52, 966, 540))
        self.draw_toys(p, now)
        self.draw_fox(p, now)
        p.drawPixmap(0, 0, self.foreground_cache)
        p.restore()

    def draw_photoreal_room(self, p):
        night = self.is_night()
        bounds = QRectF(17, 52, 966, 540)
        p.save()
        p.setClipRect(bounds)
        p.drawPixmap(bounds, self.photo_background, QRectF(self.photo_background.rect()))
        if night:
            p.fillRect(bounds, QColor(14, 22, 47, 53))
            glow(p, 521, 176, 140, "#ffe5b0", 32)
            glow(p, 574, 195, 120, "#ffc787", 45)
        else:
            glow(p, 323, 274, 178, "#fff5d4", 23)
        self.draw_photo_fox(p, time.monotonic())
        p.restore()
        rounded(p, 16, 51, 966, 540, QColor(0,0,0,0), 12, c("#d5b58e", 150), 2)

    def draw_photo_fox(self, p, now):
        moving = self.target is not None
        kind = "walk" if moving else ("sleep" if self.mode=="sleep" and not self.photo_sleep.isNull() else "idle")
        if kind != self.photo_last_kind:
            self.photo_prev_kind = self.photo_last_kind
            self.photo_last_kind = kind
            self.photo_mode_change = now
        fade = blend((now-self.photo_mode_change)/0.30,0.0,1.0)
        x, y = self.position.x(), self.position.y()
        size_scale=blend(.91+(y-445)/590,.82,1.08)
        jumping=self.mode=="jump" and not moving
        lift=0
        if jumping:
            lift=max(0,math.sin(now*math.pi*3))*26
        shadow_width=103*size_scale
        ellipse(p,x-shadow_width*.5,y-9,shadow_width,14,c("#281e18",81))
        glow(p,x,y-7,45,"#21170d",29)

        def pix_for_state(selected):
            if selected=="walk":
                return self.photo_walk[int(now*9.3)%len(self.photo_walk)]
            if selected=="sleep" and not self.photo_sleep.isNull():
                return self.photo_sleep
            return self.photo_idle

        def render(selected,opacity):
            if opacity < .005:
                return
            pix=pix_for_state(selected)
            if pix.isNull():
                return
            h=(138 if selected=="idle" else 105 if selected=="walk" else 80)*size_scale
            w=h*pix.width()/max(pix.height(),1)
            breathing = 1+math.sin(now*1.9)*.005 if selected=="idle" else 1
            bob = abs(math.sin(now*12))*2.1 if selected=="walk" else 0
            p.save()
            p.setOpacity(opacity)
            p.translate(x,y-lift-bob)
            if selected=="walk" and self.pet.direction>0:
                p.scale(-1,1)
            p.drawPixmap(QRectF(-w/2,-h*breathing,w,h*breathing),pix,QRectF(pix.rect()))
            p.restore()

        if self.photo_prev_kind == kind:
            render(kind,1.0)
        else:
            if fade < 1:
                render(self.photo_prev_kind,1-fade)
            render(kind,fade)
        if self.message and now < self.message_until and not self.pet.quiet:
            mx=blend(x-70,225,725)
            my=blend(y-199,95,425)
            width=min(275,max(130,15+len(self.message)*7))
            rounded(p,mx,my,width,36,c("#29202a",223),13,c("#cfaf87"),2)
            text(p,mx+12,my+23,self.message,"#fff4e2",9,True)

    def draw_room_static(self, p, night):
        now = time.monotonic()
        rounded(p, 8, 8, 984, 635, c("#170e20"), 25, c("#9f5b51"), 2)
        p.save()
        p.setClipRect(QRectF(17, 52, 966, 540))
        wall = QLinearGradient(25, 50, 920, 420)
        wall.setColorAt(0, c("#55314e"))
        wall.setColorAt(.5, c("#815047"))
        wall.setColorAt(1, c("#40283e"))
        rounded(p, 17, 52, 966, 540, wall, 10)
        for x in range(45, 990, 90):
            stroke(p, [(x, 58), (x + 8, 356)], c("#ffc88f", 17), 1)
        glow(p, 240, 176, 260, "#fd952f", 78)
        glow(p, 820, 248, 270, "#ff9d44", 62)
        polygon(p, [(18, 54), (983, 54), (956, 112), (46, 112)], c("#4c292f"))
        polygon(p, [(20, 53), (500, 28), (983, 53), (967, 78), (500, 62), (35, 78)], c("#633836"))
        stroke(p, [(35, 96), (965, 96)], c("#b07553"), 12)
        for x in (65, 350, 680, 950):
            polygon(p, [(x-20, 63), (x+17, 64), (x+9, 359), (x-10, 359)], c("#583039", 140))
            stroke(p, [(x-8, 88), (x-8, 350)], c("#a36646", 130), 3)
        polygon(p, [(17, 362), (983, 362), (983, 590), (17, 590)], c("#714341"))
        floor = QLinearGradient(0, 350, 0, 592)
        floor.setColorAt(0, c("#805044"))
        floor.setColorAt(.5, c("#b36d4a"))
        floor.setColorAt(1, c("#71423c"))
        polygon(p, [(18, 360), (982, 360), (982, 590), (18, 590)], floor)
        for y in range(375, 612, 35):
            stroke(p, [(20, y), (980, y)], c("#542937", 115), 2)
            stroke(p, [(20, y + 3), (980, y + 3)], c("#f7ac69", 32), 1)
        for x in range(45, 1020, 115):
            stroke(p, [(x, 360), (x - 45, 590)], c("#572d35", 92), 2)
        glow(p, 460, 500, 410, "#ef8039", 55)
        self.draw_window(p, night, now)
        self.draw_shelf(p)
        self.draw_bed(p)
        self.draw_tower(p)
        self.draw_desk(p, now)
        self.draw_rug(p)
        self.draw_food(p)
        self.draw_fairy_lights(p, now)
        if night:
            rounded(p, 19, 345, 960, 245, c("#291a48", 20), 1)
            glow(p, 176, 183, 220, "#ffb15b", 43)
            glow(p, 853, 303, 230, "#ffad60", 34)
        p.restore()
        rounded(p, 16, 51, 966, 540, QColor(0,0,0,0), 12, c("#d59560", 130), 2)

    def draw_window(self, p, night, now):
        rounded(p, 378, 123, 284, 244, c("#302036"), 30, c("#b8784a"), 9)
        p.save()
        window_clip = QPainterPath()
        window_clip.addRoundedRect(QRectF(392, 133, 256, 220), 22, 22)
        p.setClipPath(window_clip)
        sky = QLinearGradient(0, 134, 0, 365)
        if night:
            sky.setColorAt(0, c("#121d4f"))
            sky.setColorAt(.65, c("#784f96"))
            sky.setColorAt(1, c("#f49b79"))
        else:
            sky.setColorAt(0, c("#6b86bd"))
            sky.setColorAt(.55, c("#ee9c9b"))
            sky.setColorAt(1, c("#ffb477"))
        rounded(p, 392, 132, 260, 225, sky, 20)
        if night:
            for i in range(27):
                x = 403 + (i*71 % 243)
                y = 141 + (i*43 % 130)
                brightness = 115 + int(90 * (1 + math.sin(now*1.4+i)) / 2)
                ellipse(p, x, y, 2 if i%3 else 3, 2 if i%3 else 3, c("#fff9df", brightness))
            glow(p, 571, 191, 55, "#ffda92", 74)
            ellipse(p, 550, 174, 42, 42, c("#fff1cf"))
            ellipse(p, 561, 166, 42, 42, c("#424878"))
        else:
            glow(p, 553, 195, 80, "#fff1a6", 90)
            ellipse(p, 535, 168, 55, 55, c("#ffe7a5"))
        polygon(p, [(387,306),(441,242),(476,281),(531,221),(582,286),(640,257),(659,352),(392,353)], c("#51466e" if night else "#8e7186"))
        polygon(p, [(387,324),(437,278),(492,311),(552,265),(619,321),(658,289),(664,360),(388,360)], c("#383d68" if night else "#695778"))
        for i in range(11):
            x = 400 + i*22
            h = 20 + i*13 % 39
            rounded(p, x, 353-h, 16, h, c("#2f304b" if night else "#59516b"), 1)
            if night:
                for y in range(int(353-h+6), 347, 11):
                    ellipse(p, x+5, y, 3, 3, c("#ffcf78", 200))
        p.restore()
        stroke(p, [(520,135),(520,354)], c("#5d3240"), 9)
        stroke(p, [(391,246),(646,246)], c("#6a3944"), 9)
        rounded(p, 363, 349, 312, 18, c("#8e5348"), 4, c("#dfa16e"), 2)
        polygon(p, [(372,134),(418,130),(419,307),(401,352),(376,351)], c("#6d3249"))
        polygon(p, [(645,134),(674,136),(674,351),(648,344),(633,304)], c("#713348"))
        stroke(p, [(395,177),(400,312)], c("#d07068", 110), 4)
        stroke(p, [(654,169),(652,323)], c("#c86b65", 100), 4)

    def draw_shelf(self, p):
        rounded(p, 63, 163, 264, 18, c("#6a3b35"), 4)
        rounded(p, 66, 155, 263, 11, c("#b9764c"), 3)
        for i in range(13):
            x = 84 + i*15
            h = 33 + (i*7 % 26)
            shades = ("#bd684e","#cc9259","#694456","#d5966c","#846078")
            rounded(p, x, 156-h, 11, h, c(shades[i%5]), 2)
            stroke(p, [(x+3,151-h),(x+3,151)], c("#ffe0a2",65), 1)
        rounded(p, 267, 132, 42, 32, c("#ad684a"), 6)
        for i in range(7):
            x = 284 + math.sin(i*2.4)*23
            y = 125 - (i%3)*17
            ellipse(p, x, y, 18, 10, c("#558551"))
        rounded(p, 85, 208, 222, 14, c("#57343a"), 4)
        rounded(p, 91, 205, 215, 9, c("#9a5d46"), 4)
        for i in range(4):
            rounded(p, 113+i*32, 178, 21, 27, c(("#ce9258","#73516e","#d3aa72","#9b6158")[i]), 2)
        ellipse(p, 261, 171, 32, 34, c("#e5a94e"))
        ellipse(p, 267, 179, 20, 21, c("#fee1a1"))

    def draw_bed(self, p):
        ellipse(p, 46, 480, 288, 48, c("#321d30", 96))
        rounded(p, 45, 363, 290, 148, c("#5d3144"), 33, c("#e6a56e", 120), 4)
        rounded(p, 65, 356, 258, 114, c("#f2c18d"), 31, c("#ffe6b9", 140), 3)
        rounded(p, 78, 352, 232, 54, c("#8e5264"), 24)
        ellipse(p, 92, 364, 80, 45, c("#fee3b0"))
        ellipse(p, 178, 363, 89, 42, c("#ffe7c3"))
        rounded(p, 93, 418, 212, 77, c("#ab4d4d"), 24)
        rounded(p, 100, 417, 204, 70, c("#bd6971"), 28)
        stroke(p, [(117,455),(263,455)], c("#e29d8d"), 3)
        ellipse(p, 216, 436, 40, 33, c("#e8af8a"))
        ellipse(p, 219, 440, 9, 8, c("#a65259"))
        ellipse(p, 239, 440, 9, 8, c("#a65259"))
        ellipse(p, 228, 451, 10, 8, c("#a65259"))
        rounded(p, 77, 492, 13, 25, c("#7f4939"), 3)
        rounded(p, 287, 490, 13, 27, c("#7f4939"), 3)

    def draw_tower(self, p):
        ellipse(p, 626, 449, 137, 23, c("#2d1a29", 65))
        rounded(p, 656, 295, 25, 156, c("#b38a65"), 8, c("#ebbb80"), 2)
        for y in range(301, 442, 9):
            stroke(p, [(659,y),(678,y+1)], c("#e5bd88", 120), 2)
        rounded(p, 716, 340, 22, 112, c("#b38b69"), 8)
        for y in range(346, 446, 9):
            stroke(p, [(718,y),(734,y)], c("#f0d1a0", 110), 2)
        rounded(p, 628, 267, 139, 17, c("#64344d"), 8)
        rounded(p, 632, 262, 132, 14, c("#cf8992"), 7)
        rounded(p, 642, 369, 125, 17, c("#63364f"), 8)
        rounded(p, 645, 364, 119, 16, c("#c78b88"), 7)
        rounded(p, 661, 305, 71, 58, c("#7b4560"), 14, c("#f2c4a3"), 6)
        ellipse(p, 679, 324, 32, 29, c("#38243f"))
        stroke(p, [(748,285),(748,323)], c("#dcb98f"), 2)
        ellipse(p, 736, 320+math.sin(time.monotonic()*2)*3, 22, 22, c("#e9ae62"))
        stroke(p, [(662,273),(747,273)], c("#fde2b0", 90), 2)

    def draw_desk(self, p, now):
        ellipse(p, 756, 483, 208, 27, c("#291929", 95))
        rounded(p, 772, 357, 177, 116, c("#64404a"), 7)
        rounded(p, 760, 362, 201, 15, c("#ae7052"), 4, c("#ecb685"), 2)
        rounded(p, 772, 381, 17, 115, c("#5a3540"), 3)
        rounded(p, 930, 377, 18, 119, c("#5a3540"), 3)
        glow(p, 855, 296, 90, "#e78566", 78)
        rounded(p, 801, 259, 113, 94, c("#35293c"), 8, c("#ba8064"), 5)
        monitor = QLinearGradient(805, 259, 911, 341)
        monitor.setColorAt(0, c("#241b3c"))
        monitor.setColorAt(1, c("#5b315d"))
        rounded(p, 810, 268, 94, 69, monitor, 4)
        text(p, 818, 297, ">_ fox@home", "#ffca91", 9, True)
        text(p, 818, 319, "hello world" if int(now)%8<4 else "♥ stay cozy", "#d0ffa6", 8)
        stroke(p, [(858,351),(858,369)], c("#d7a173"), 5)
        rounded(p, 813, 368, 78, 9, c("#3b293b"), 3)
        rounded(p, 821, 383, 94, 13, c("#d19a77"), 4)
        for i in range(9):
            stroke(p, [(831+i*9,389),(836+i*9,389)], c("#86526b"), 2)
        rounded(p, 922, 342, 29, 35, c("#ebbb8f"), 6)
        ellipse(p, 927, 343, 19, 8, c("#a56c54"))
        glow(p, 946, 280, 55, "#ffc981", 65)
        stroke(p, [(955,341),(945,291),(921,278)], c("#b5856a"), 5)
        polygon(p, [(901,271),(925,256),(942,280),(914,286)], c("#e5ae72"))

    def draw_rug(self, p):
        ellipse(p, 288, 446, 445, 132, c("#502b34", 95))
        ellipse(p, 292, 437, 430, 132, c("#f0b86a"), c("#fff0bf", 100), 4)
        ellipse(p, 308, 449, 399, 108, c("#c97953"), c("#f6d89a", 170), 2)
        ellipse(p, 360, 460, 305, 78, c("#da905c"), c("#f7c477", 130), 3)
        for x, y, rad in ((472,488,17),(516,483,15),(559,490,17),(488,520,17),(542,521,17)):
            ellipse(p, x, y, rad, 14, c("#ffddb0", 130))
        ellipse(p, 503, 497, 46, 27, c("#ffe3b7", 120))

    def draw_toys(self, p, now):
        bx, by = 520, 505
        if self.ball_started:
            age = now-self.ball_started
            if age < 3:
                bx += math.sin(age*3.5)*46
                by -= abs(math.sin(age*6))*23
            else:
                self.ball_started = 0
        ellipse(p, bx-17, by+11, 39, 11, c("#452539",80))
        ellipse(p, bx-21, by-19, 42, 42, c("#f4a344"), c("#ffdf8f"), 2)
        stroke(p, [(bx-17,by-8),(bx,by+18),(bx+17,by-8)], c("#fff0bf"), 5)
        ellipse(p, 354, 537, 52, 15, c("#392337", 82))
        ellipse(p, 353, 515, 47, 31, c("#96718a"))
        ellipse(p, 361, 507, 14, 16, c("#b98d9f"))
        ellipse(p, 382, 507, 14, 16, c("#b98d9f"))
        ellipse(p, 390, 528, 5, 5, c("#221b33"))
        stroke(p, [(352,532),(337,520),(325,524)], c("#b88891"), 3)

    def draw_food(self, p):
        ellipse(p, 797, 547, 153, 28, c("#362132", 85))
        rounded(p, 796, 510, 148, 48, c("#86434d"), 24, c("#f8b97c"), 3)
        ellipse(p, 800, 497, 140, 35, c("#f8d0a0"), c("#e7aa7e"), 3)
        ellipse(p, 814, 506, 112, 20, c("#885436"))
        for i in range(20):
            x = 824 + i*19 % 98
            y = 507 + (i*7%12)
            ellipse(p, x, y, 10, 7, c(("#d99c56","#b87549","#e5ac65")[i%3]))
        ellipse(p, 864, 538, 13, 10, c("#edac70"))
        ellipse(p, 882, 538, 13, 10, c("#edac70"))
        ellipse(p, 873, 531, 14, 10, c("#edac70"))
        ellipse(p, 864, 520, 9, 9, c("#edac70"))
        ellipse(p, 892, 520, 9, 9, c("#edac70"))

    def draw_foreground(self, p):
        ellipse(p, 8, 529, 145, 47, c("#26192f",100))
        polygon(p, [(26,490),(131,490),(118,579),(36,578)], c("#995d4d"))
        stroke(p, [(39,495),(112,495)], c("#edb581"), 4)
        for i in range(18):
            theta=i*2.4
            x=79+math.cos(theta)* (24+(i%4)*11)
            y=468-math.sin(theta)* (35+(i%3)*13)
            stroke(p, [(80,490),(x,y)], c("#638b56"), 3)
            ellipse(p, x-14, y-8, 28, 18, c(("#497e56","#769b52","#395d47")[i%3]))
        for i in range(8):
            x=923+(i*41%75)
            y=480+(i*23%63)
            ellipse(p,x,y,36,15,c(("#64834a","#3f6549")[i%2],190))

    def draw_fairy_lights(self, p, now):
        points=[]
        for i in range(32):
            x=44+i*29
            y=104+18*math.sin(i*math.pi/31)
            points.append((x,y))
        stroke(p,points,c("#2d2630"),3)
        for i in range(1,32,3):
            x,y=points[i]
            size=7 if i%2 else 9
            glow(p,x,y+9,28,"#ffba65",70+int(15*math.sin(now*1.3+i)))
            ellipse(p,x-size/2,y+4,size,size,c("#ffdc94"))

    def draw_fox(self, p, now):
        moving = self.target is not None
        name = ("walk" if moving else
                "sleep" if self.mode == "sleep" else
                "wave" if self.mode in ("wave","eat","work","play") else
                "surprise" if self.mode == "jump" else
                "look" if self.mode == "look" else "idle")
        pixmap = self.pet.images[name]
        x,y = self.position.x(),self.position.y()
        perspective = blend(.74+(y-420)/400,.74,1.06)
        frame_w=170*perspective
        frame_h=170*perspective
        bob=math.sin(now*4)*2 if name=="idle" else abs(math.sin(now*13))*5 if moving else 0
        leap=0
        if self.mode=="jump":
            phase=(now-(self.mode_until-5))%2
            leap=max(0,math.sin(phase*math.pi))*32
        ellipse(p,x-frame_w*.35,y-11,frame_w*.70,14,c("#2c1a2a",90 if leap==0 else 48))
        p.save()
        p.translate(x,y-bob-leap)
        if moving and self.pet.direction < 0:
            p.scale(-1,1)
        body_w=frame_w
        body_h=min(frame_h,pixmap.height()/max(1,pixmap.width())*frame_w)
        p.drawPixmap(QRectF(-body_w/2,-body_h,body_w,body_h),pixmap,QRectF(pixmap.rect()))
        p.restore()
        if self.message and now < self.message_until and not self.pet.quiet:
            message=self.message
            mx=blend(x-75,250,735)
            my=blend(y-body_h-63,215,430)
            width=min(270,max(130,15+len(message)*7))
            rounded(p,mx,my,width,36,c("#3c263f",235),13,c("#d9996a"),2)
            text(p,mx+13,my+23,message,"#fff5d9",9,True)

    def draw_ui(self, p):
        rounded(p,17,9,966,45,c("#281a32"),15,c("#a7686d"),1)
        text(p,42,37,"Ubuntu Fox   /   Realistic Room" if self.photo_mode else "Ubuntu Fox   /   Cozy Room","#ffe5c2",15,True)
        text(p,430,36,f"Bond Lv {1+self.pet.bond//25}  ·  {self.pet.bond} ♥","#f5c18e",10,True)
        stats=(("FOOD","food","#f7ad63"),("JOY","joy","#fc9ba6"),("ENERGY","energy","#9ed8b1"))
        for i,(label,key,color) in enumerate(stats):
            x=631+i*114
            text(p,x,27,label,"#e6c2aa",8,True)
            rounded(p,x,35,91,7,c("#492e46"),4)
            rounded(p,x,35,91*self.pet.stats[key]/100,7,c(color),4)
        rounded(p,16,594,968,47,c("#291d32"),12,c("#ad685c"),1)
        names=("BED","BALL","FOOD","DESK","WINDOW","TOWER")
        for i,name in enumerate(names):
            x=38+i*119
            active=self.hover==self.BUTTONS[i] or self.action==self.BUTTONS[i]
            rounded(p,x,604,106,28,c("#9b534e" if active else "#4a3147"),13,
                    c("#ffbf79") if active else c("#75516a"),1)
            text(p,x+14,623,name,"#fff3df",10,True)
        rounded(p,805,604,151,28,c("#b46b45"),13,c("#e5b57a"),1)
        text(p,825,623,"DESKTOP MODE","#fff0df",9,True)
        if self.hover in self.INTERACTIONS:
            x,y,w,h=self.INTERACTIONS[self.hover][0]
            glow(p,x+w/2,y+h/2,85,"#fdbc69",52)
            rounded(p,x,y,w,h,c("#fdb46b",20),18,c("#ffe6ac",190),2)
            tip=self.INTERACTIONS[self.hover][2]
            tx=blend(x+10,30,780)
            ty=blend(y-24,75,520)
            rounded(p,tx,ty,185,27,c("#3b243b",230),10,c("#ffd292"),1)
            text(p,tx+11,ty+18,tip,"#fff1d7",9,True)

    def hit(self, x, y):
        if 594 <= y <= 642:
            for i,name in enumerate(self.BUTTONS):
                bx=38+i*119
                if bx <= x <= bx+106:
                    return name
            if 805 <= x <= 960:
                return "desktop"
        if self.photo_mode:
            if math.hypot(x-532,y-475) < 26:
                return "ball"
            if math.hypot(x-641,y-465) < 35:
                return "food"
        else:
            if math.hypot(x-520,y-505) < 31:
                return "ball"
            if math.hypot((x-869)/1.25,(y-526)) < 47:
                return "food"
        px,py=self.position.x(),self.position.y()
        if math.hypot((x-px)/.75,(y-(py-75))/.95) < 90:
            return "pet"
        for name,(bounds,_,_) in self.INTERACTIONS.items():
            bx,by,bw,bh=bounds
            if bx <= x <= bx+bw and by <= y <= by+bh:
                return name
        return None

    def mouseMoveEvent(self, event):
        x,y=self.scene_point(event.position())
        new=self.hit(x,y)
        if self.hover!=new:
            self.hover=new
            self.setCursor(Qt.CursorShape.PointingHandCursor if new else Qt.CursorShape.ArrowCursor)
            self.update()

    def mousePressEvent(self, event):
        if event.button()!=Qt.MouseButton.LeftButton:
            return super().mousePressEvent(event)
        x,y=self.scene_point(event.position())
        target=self.hit(x,y)
        if target=="desktop":
            self.back_to_desktop()
        elif target=="pet":
            self.on_pet()
        elif target in self.INTERACTIONS:
            self.go(target)
        elif 70<y<588:
            if self.pet.manual_sleep:
                self.pet.wake()
            self.target=QPointF(blend(x,110,900),blend(y,410,553))
            self.action=None
            self.mode="walk"
            self.say("Coming!",1.2)
        event.accept()

    def mouseDoubleClickEvent(self,event):
        x,y=self.scene_point(event.position())
        if self.hit(x,y)=="pet":
            self.go("ball")
            event.accept()

    def contextMenuEvent(self, event):
        menu=QMenu(self)
        menu.setStyleSheet("QMenu{background:#34213e;color:#fff2dc;border:1px solid #d88b59;padding:5px} QMenu::item:selected{background:#905264}")
        menu.addAction("Back to desktop pet",self.back_to_desktop)
        photo=menu.addAction("Photorealistic room")
        photo.setCheckable(True)
        photo.setEnabled(self.photo_ready)
        photo.setChecked(self.photo_mode)
        photo.triggered.connect(self.toggle_photo)
        menu.addSeparator()
        for target in self.BUTTONS:
            menu.addAction(self.INTERACTIONS[target][2],lambda checked=False,t=target:self.go(t))
        menu.addSeparator()
        action=menu.addAction("Night lighting")
        action.setCheckable(True)
        action.setChecked(self.is_night())
        action.triggered.connect(lambda value:self.set_night(value))
        quiet=menu.addAction("Quiet mode")
        quiet.setCheckable(True)
        quiet.setChecked(self.pet.quiet)
        quiet.triggered.connect(lambda value:self.pet.set_option("quiet",value))
        menu.addAction("Quit",self.quit_all)
        menu.exec(event.globalPos())

    def toggle_photo(self,enabled):
        if enabled and not self.photo_ready:
            return
        self.photo_mode=enabled
        self.INTERACTIONS=self.PHOTO_INTERACTIONS if enabled else type(self).INTERACTIONS
        self.pet.room_realistic=enabled
        self.position=QPointF(518,477) if enabled else QPointF(480,501)
        self.target=None
        self.action=None
        self.mode="idle"
        self.photo_last_kind="idle"
        self.photo_prev_kind="idle"
        self.photo_mode_change=time.monotonic()
        self.pet.save()
        self.update()

    def set_night(self,value):
        self.manual_night=value
        self.update()

    def keyPressEvent(self,event):
        if event.key() == Qt.Key.Key_Escape:
            self.back_to_desktop()
        elif event.key() == Qt.Key.Key_Space:
            self.go("ball")
        else:
            super().keyPressEvent(event)

    def back_to_desktop(self):
        self.pet.room_mode=False
        self.pet.save()
        self.room_timer.stop()
        self.pet.show()
        self.hide()

    def closeEvent(self,event):
        self.back_to_desktop()
        event.accept()

    def quit_all(self):
        self.pet.room_mode=True
        self.pet.save()
        self.pet.close()
        self.room_timer.stop()
        self.hide()
        self.deleteLater()
        from PyQt6.QtWidgets import QApplication
        QApplication.instance().quit()
