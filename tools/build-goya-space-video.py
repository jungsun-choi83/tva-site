"""Looping float video for CONTACT (Melius-style left panel)."""
from __future__ import annotations

import math
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/contact/goya-space-astronaut-source.png"
OUT = ROOT / "assets/contact/goya-space-astronaut-float.mp4"
POSTER = ROOT / "assets/contact/goya-space-astronaut-poster.webp"

W, H = 720, 900
FPS = 24
SECONDS = 4
FRAMES = FPS * SECONDS
# Eternal Beam site cream / paper (matches styles.css --cream, contact paper)
BG_TOP = (246, 242, 232)
BG_BOTTOM = (239, 230, 212)


def cream_canvas() -> Image.Image:
    canvas = Image.new("RGB", (W, H), BG_TOP)
    grad = Image.new("RGB", (W, H))
    px = grad.load()
    for y in range(H):
        t = y / max(H - 1, 1)
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        for x in range(W):
            px[x, y] = (r, g, b)
    return Image.blend(canvas, grad, 0.72)


def crop_cover(im: Image.Image, tw: int, th: int) -> Image.Image:
    sw, sh = im.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return im.crop((left, top, left + tw, top + th))


def frame_at(base: Image.Image, i: int) -> np.ndarray:
    t = i / FPS
    phase = t * (2 * math.pi / SECONDS)
    dx = int(10 * math.sin(phase))
    dy = int(14 * math.sin(phase * 0.85 + 0.4))
    rot = 1.8 * math.sin(phase * 0.55)
    scale = 1.0 + 0.018 * math.sin(phase * 1.1)

    layer = base.copy()
    if abs(rot) > 0.01:
        layer = layer.rotate(rot, resample=Image.Resampling.BICUBIC, expand=False)

    lw, lh = layer.size
    sw, sh = int(lw * scale), int(lh * scale)
    layer = layer.resize((sw, sh), Image.Resampling.LANCZOS)

    canvas = cream_canvas()
    px = (W - sw) // 2 + dx
    py = (H - sh) // 2 + dy
    canvas.paste(layer, (px, py))
    return np.asarray(canvas)


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"Missing source: {SRC}")

    base = crop_cover(Image.open(SRC).convert("RGB"), W, H)
    POSTER.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(frame_at(base, 0)).save(POSTER, format="WEBP", quality=86, method=6)

    frames = [frame_at(base, i) for i in range(FRAMES)]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    imageio.mimsave(
        OUT,
        frames,
        fps=FPS,
        codec="libx264",
        quality=8,
        pixelformat="yuv420p",
        macro_block_size=1,
    )
    print(f"Wrote {OUT} ({FRAMES} frames @ {FPS}fps)")
    print(f"Poster {POSTER}")


if __name__ == "__main__":
    main()
