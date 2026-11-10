# Ubuntu Fox Pet 🦊

An original, lightweight, animated desktop fox for Ubuntu GNOME and other X11 Linux desktops. No AI model, network access, account, or GPU required.

![Ubuntu Fox character sheet](assets/source-sheet.png)

## Features (v3)

- Six expressive poses: idle, walk, wave, sleep, surprise, and look
- Transparent always-on-top window with drag-to-position
- Click to pet, double-click to play catch, right-click for feeding, sleeping, mood, and settings
- Food, joy, and energy levels that change over time and are saved locally
- Optional mouse-following, wandering, quiet mode, and three window sizes
- Throw the fox gently with the mouse and watch it bounce from desktop edges
- Right-click Jump / Spin or middle-click to jump; hold left button to cuddle
- Earn bond points and levels from pets, treats, and ball catches; track your catches
- Mouse wheel to resize; all animations are self-contained, with no GPU requirement
- Lightweight PyQt6 interface; no background services or telemetry

## Install

Tested on Ubuntu 24.04 GNOME **X11**.

```bash
sudo apt update
sudo apt install python3-pyqt6
git clone https://github.com/bettercallcaleb/ubuntu-fox-pet.git
cd ubuntu-fox-pet
./install.sh
```

Then open **Ubuntu Fox Pet** from the application launcher, or run `~/.local/share/ubuntu-fox-pet/run.sh`.

**Display support:** GNOME X11 is tested; Wayland behavior varies by compositor, especially global cursor tracking and always-on-top windows.

## Controls

| Action | Result |
|---|---|
| Left-click | Pet the fox; hearts and joy |
| Double-click | Start a ball game |
| Click the ball | Catch it |
| Drag with left button | Reposition; release quickly to toss and bounce |
| Hold left button | Cuddle and collect hearts |
| Middle-click | Jump |
| Mouse wheel | Change size |
| Right-click → Jump / Spin | Perform a trick |
| Right-click → Feed cookie | Increase food |
| Right-click → Show mood & needs | Show three status meters |
| Right-click → Take a nap / Wake up | Control rest |
| Right-click → Follow mouse | Have the fox trail the pointer |
| Right-click → Quiet mode | Suppress speech bubbles |
| Right-click → Quit | Exit |

Preferences, bond points, and catch totals live in `~/.config/ubuntu-fox-pet/state.json` and never leave your machine.

## Uninstall

```bash
rm -rf ~/.local/share/ubuntu-fox-pet ~/.local/share/applications/ubuntu-fox-pet.desktop
```

To delete saved pet state too: `rm -rf ~/.config/ubuntu-fox-pet`.

## Development

```bash
sudo apt install python3-pyqt6
QT_QPA_PLATFORM=offscreen /usr/bin/python3 tests/smoke.py
/usr/bin/python3 pet.py
```

The packaged sprites and icon are stored under `assets/`. `assets/source-sheet.png` is the original AI-generated concept sheet. The app ships with static images and requires no image-generation runtime.

## License and trademark

Licensed under [MIT](LICENSE) for source code and included original artwork. The fox is a fan-made Ubuntu-inspired design; it is **not affiliated with or endorsed by Canonical**. Ubuntu and its logos are trademarks of Canonical Ltd. The project license grants no trademark rights.

Contributions and bug reports are welcome.
