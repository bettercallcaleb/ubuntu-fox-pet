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
    assert len(pet.images) == 6
    start_food, start_bond = pet.stats["food"], pet.bond
    pet.feed()
    assert pet.stats["food"] >= start_food
    assert pet.bond == start_bond + 2
    pet.pet()
    assert pet.bond == start_bond + 3
    pet.play()
    assert pet.play_start is not None
    pet.catch()
    assert pet.catches == 1
    assert pet.bond == start_bond + 8
    pet.trick("jump")
    assert pet.trick_kind == "jump"
    pet.trick("spin")
    assert pet.trick_kind == "spin"
    x, y = pet.x(), pet.y()
    pet.throw_vx = 300
    pet.throw_vy = -200
    pet.advance_throw(0.07)
    assert (pet.x(), pet.y()) != (x, y)
    pet.tick()
    pet.show_status()
    image = QImage(pet.size(), QImage.Format.Format_ARGB32)
    image.fill(0)
    pet.render(image)
    pet.sleep()
    assert pet.manual_sleep
    pet.wake()
    assert not pet.manual_sleep
    pet.set_option("follow", True)
    assert pet.follow and not pet.roam
    pet.set_option("quiet", True)
    assert pet.quiet
    pet.change_size(130)
    assert pet.pet_size == 130
    pet.save()
    assert fox.CONFIG.exists()
    stored = fox.UbuntuFox.load()
    assert stored["bond"] == pet.bond
    assert stored["catches"] == pet.catches
    pet.close()

print("SMOKE_OK")
