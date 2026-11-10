import importlib.util
import os
import sys
import tempfile
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PyQt6.QtCore import QPointF
from PyQt6.QtGui import QImage
from PyQt6.QtWidgets import QApplication

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
import room

spec = importlib.util.spec_from_file_location("ubuntufoxpet", root / "pet.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.ASSETS = root / "assets"
app = QApplication([])
with tempfile.TemporaryDirectory() as tmp:
    module.CONFIG = Path(tmp) / "state.json"
    pet = module.UbuntuFox()
    window = room.FoxRoom(pet)
    window.show()
    assert window.INTERACTIONS.keys() == {"bed","ball","food","desk","window","tower"}
    image = QImage(1000,650,QImage.Format.Format_ARGB32)
    image.fill(0)
    window.resize(1000,650)
    window.render(image)
    assert image.pixelColor(500,300).alpha() > 0
    if len(sys.argv) > 1:
        assert image.save(sys.argv[1])
    old_food=pet.stats["food"]
    window.go("food")
    window.position=QPointF(*window.INTERACTIONS["food"][1])
    window.tick()
    assert pet.stats["food"] >= old_food
    window.go("bed")
    window.position=QPointF(*window.INTERACTIONS["bed"][1])
    window.tick()
    assert pet.manual_sleep
    window.go("desk")
    window.position=QPointF(*window.INTERACTIONS["desk"][1])
    window.tick()
    assert window.mode=="work"
    window.go("tower")
    window.position=QPointF(*window.INTERACTIONS["tower"][1])
    window.tick()
    assert window.mode=="jump"
    window.go("ball")
    window.position=QPointF(*window.INTERACTIONS["ball"][1])
    window.tick()
    assert window.mode=="play"
    window.set_night(True)
    window.render(image)
    if len(sys.argv) > 2:
        assert image.save(sys.argv[2])
    window.set_night(False)
    window.render(image)
    window.back_to_desktop()
    assert not pet.room_mode
    assert not window.isVisible()
    pet.close()
print("ROOM_SMOKE_OK")
