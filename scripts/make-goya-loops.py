from pathlib import Path
import math
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "hero" / "goya-orbit"
OUT = SRC / "live"
OUT.mkdir(parents=True, exist_ok=True)

FACE = [
    (0.38, 0.58),
    (0.72, 0.34),
    (0.56, 0.48),
    (0.50, 0.30),
    (0.42, 0.30),
    (0.58, 0.34),
    (0.40, 0.56),
    (0.30, 0.42),
    (0.24, 0.42),
    (0.18, 0.34),
    (0.42, 0.40),
    (0.62, 0.48),
]

W, H = 480, 640
ONE_WAY = 20


def crop_frame(im, fx, fy, zoom):
    src = im.convert("RGB")
    sw, sh = src.size
    cw = sw / zoom
    ch = cw * H / W
    if ch > sh:
        ch = sh / zoom
        cw = ch * W / H
    cx = fx * sw
    cy = fy * sh
    left = max(0.0, min(sw - cw, cx - cw / 2))
    top = max(0.0, min(sh - ch, cy - ch / 2))
    box = (left, top, left + cw, top + ch)
    return src.resize((W, H), Image.Resampling.LANCZOS, box=box)


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * t)


for i, (fx, fy) in enumerate(FACE, start=1):
    still = SRC / f"goya-{i:02d}.webp"
    dest = OUT / f"goya-{i:02d}.webp"
    im = Image.open(still)
    frames = []
    for n in range(ONE_WAY):
        t = ease(n / (ONE_WAY - 1))
        zoom = 1.04 + 0.14 * t
        ox = fx + 0.035 * math.sin(t * math.pi)
        oy = fy - 0.028 * t
        frames.append(crop_frame(im, ox, oy, zoom))
    loop = frames + frames[-2:0:-1]
    loop[0].save(
        dest,
        save_all=True,
        append_images=loop[1:],
        duration=100,
        loop=0,
        quality=70,
        method=4,
        lossless=False,
    )
    print(dest.name, dest.stat().st_size)
