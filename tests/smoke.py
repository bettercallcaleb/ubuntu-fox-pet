import importlib.util
import os
import tempfile
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PyQt6.QtGui import QImage
from PyQt6.QtWidgets import QApplication

repo = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("ubuntu_fox", repo / "pet.py")
fox = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fox)
fox.ASSETS = repo / "assets"
app = QApplication([])
with tempfile.TemporaryDirectory() as folder:
    fox.CONFIG = Path(folder) / "state.json"
    pet = fox.UbuntuFox()
    assert pet.images["idle"].width() > 0
    old_food = pet.stats["food"]
    pet.feed()
    assert pet.stats["food"] >= old_food
    pet.pet()
    pet.play()
    pet.tick()
    pet.show_status()
    frame = QImage(pet.size(), QImage.Format.Format_ARGB32)
    frame.fill(0)
    pet.render(frame)
    pet.sleep()
    assert pet.manual_sleep
    pet.wake()
    assert not pet.manual_sleep
    pet.save()
    assert fox.CONFIG.exists()
    pet.close()
print("SMOKE_OK")
