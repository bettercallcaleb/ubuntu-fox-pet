# Ubuntu Fox Pet 🦊

**v4 Cozy Room Mode** — a layered interactive home for your animated Linux desktop companion.

![Ubuntu Fox Cozy Room — daytime](docs/room-preview.png)

![Ubuntu Fox Cozy Room — night lighting](docs/room-night.png)

An original, lightweight, animated desktop fox for Ubuntu GNOME and other X11 Linux desktops. No AI model, network access, account, or GPU required.

![Ubuntu Fox character sheet](assets/source-sheet.png)

## Features (v4)

- **Cozy Room:** layered 2.5D cabin with bed, ball, food bowl, computer, window and climbing tower
- Click a furniture hotspot and the fox walks over to interact
- Day/night window scenery, warm animated string lights, soft shadows, floor perspective and foreground foliage
- Room status HUD, persistent bond level, local pet needs, floating speech bubbles
- Classic floating pet is preserved; switch freely between Desktop and Room Mode
- All graphics are drawn locally using Qt; no AI model, browser, GPU, account or network needed

### Room controls

| Action | Effect |
|---|---|
| Right-click desktop fox → Open cozy room | Switch to room |
| Click bed | Walk over and sleep |
| Click ball | Play fetch |
| Click food bowl | Eat a treat |
| Click terminal desk | Pretend to code |
| Click window | Gaze outside |
| Click climbing tower | Jump |
| Click anywhere on the floor | Walk there |
| Click the fox | Cuddle and increase bond |
| Esc or DESKTOP MODE | Return to floating fox |
| Space | Play fetch |
| Right-click → Night lighting | Toggle room lighting |

## Classic desktop features

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

## v5: Local photorealistic room (experimental)

Ubuntu Fox can use a locally generated 3D-render-style room and realistic fox sprites. The default drawing remains available through **right-click → Photorealistic room** and the floating desktop pet still works.

- Physically shaded wood cabin, photorealistic fur and natural animal proportions
- Eight coherent quadruped walk-cycle frames, blended into the room's continuous positional movement
- Separate realistic idle and sleeping poses, controlled by room hotspots
- No GPU or AI model required during gameplay; all generated outputs are PNGs loaded by PyQt6
- This is **photorealistic 2.5D sprite animation**, not yet a rigged, independently rotatable 3D mesh

**To use the optional local assets:** Generate the four PNGs with a locally licensed Qwen-Image-2.1-Turbo checkpoint, then prepare them:

\`\`\`bash
python tools/generate_research_assets.py --model-dir /path/to/Qwen-Image-2.1-Turbo --out-dir "$HOME/fox-assets" --only fox_master room_empty walk_sheet sleep_pose
python tools/prepare_research_assets.py --input "$HOME/fox-assets" --install
\`\`\`

The generator needs a separate environment with compatible CUDA, PyTorch, Diffusers (QwenImage21Pipeline), Transformers, Pillow and NumPy. Asset preparation needs Pillow and NumPy. The app itself requires only PyQt6.

Generated files are installed into \`~/.local/share/ubuntu-fox-pet/realistic/\`; these files **are not included in this MIT-licensed repository**. The checkpoint used for local evaluation has a **Qwen Research License with non-commercial restrictions**. Model rights, generated-image rights, and any redistribution or commercial use need separate review. Do not upload the model weights or these experimental outputs as MIT-licensed source assets.

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
