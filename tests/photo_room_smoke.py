import importlib.util
import os
import sys
import tempfile
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PyQt6.QtCore import QPointF
from PyQt6.QtGui import QColor, QImage
from PyQt6.QtWidgets import QApplication

repo=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(repo))
import room

spec=importlib.util.spec_from_file_location("foxpet",repo/"pet.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.ASSETS=repo/"assets"
app=QApplication([])
with tempfile.TemporaryDirectory() as folder:
    location=Path(folder)
    module.CONFIG=location/"petstate.json"
    room.REALISTIC_DIR=location/"realistic"
    room.REALISTIC_DIR.mkdir()
    for name in ("idle.png","sleep.png","room.png",*[f"walk_{i:02}.png" for i in range(8)]):
        image=QImage(320,200,QImage.Format.Format_ARGB32)
        image.fill(QColor("#ba754a") if name=="room.png" else QColor("#f29e58"))
        assert image.save(str(room.REALISTIC_DIR/name))
    pet=module.UbuntuFox()
    frame=room.FoxRoom(pet)
    assert frame.photo_ready
    assert frame.photo_mode
    assert len(frame.photo_walk)==8
    assert frame.INTERACTIONS is frame.PHOTO_INTERACTIONS
    frame.resize(1000,650)
    frame.show()
    image=QImage(1000,650,QImage.Format.Format_ARGB32)
    image.fill(0)
    frame.render(image)
    assert image.pixelColor(499,300).alpha()!=0
    frame.go("ball")
    assert frame.target is not None
    frame.position=QPointF(*frame.INTERACTIONS["ball"][1])
    frame.tick()
    assert frame.mode=="play"
    frame.go("bed")
    frame.position=QPointF(*frame.INTERACTIONS["bed"][1])
    frame.tick()
    assert frame.mode=="sleep"
    frame.toggle_photo(False)
    assert not frame.photo_mode
    assert not pet.room_realistic
    frame.render(image)
    frame.toggle_photo(True)
    assert frame.photo_mode
    assert pet.room_realistic
    frame.render(image)
    frame.back_to_desktop()
    assert not pet.room_mode
    pet.close()
print("PHOTO_ROOM_SMOKE_OK")
