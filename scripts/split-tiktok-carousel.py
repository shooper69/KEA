"""Split a 2x3 collage into six 1080x1920 TikTok carousel PNGs."""

from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

SRC = Path(
    r"C:\Users\simrs\.cursor\projects\c-CURSOR-KEA\assets"
    r"\c__Users_simrs_AppData_Roaming_Cursor_User_workspaceStorage"
    r"_886a539b531d651fddf80182decfe8ac_images"
    r"_image-e4b7f111-2a83-462f-b1d9-4eedd06e7cff.jpg"
)
OUT_DIR = Path(r"C:\CURSOR\KEA\assets\images\tiktok-carousel-kea-park")

COLS, ROWS = 2, 3
GUTTER = 2
TARGET_W, TARGET_H = 1080, 1920
NAMES = [
    "01-bench-chat",
    "02-shoulder-nuzzle",
    "03-flying-to-hand",
    "04-on-head-laugh",
    "05-sandwich-lunch",
    "06-hug-from-behind",
]


def to_tiktok(panel: Image.Image) -> Image.Image:
    """
    9:16 TikTok slide: sharp panel centered (full scene kept),
    soft blurred cover behind for full-bleed marketing look.
    """
    bg = ImageOps.fit(
        panel,
        (TARGET_W, TARGET_H),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.42),
    )
    bg = bg.filter(ImageFilter.GaussianBlur(42))
    bg = ImageEnhance.Brightness(bg).enhance(0.72)
    bg = ImageEnhance.Color(bg).enhance(0.9)

    pw, ph = panel.size
    # Fill most of the width; keep a slim margin so it feels like a slide.
    scale = min(TARGET_W / pw * 0.94, TARGET_H / ph * 0.72)
    nw = max(1, int(round(pw * scale)))
    nh = max(1, int(round(ph * scale)))
    sharp = panel.resize((nw, nh), Image.Resampling.LANCZOS)

    # Soft rounded feel via slight shadow plate
    canvas = bg.copy()
    x = (TARGET_W - nw) // 2
    y = (TARGET_H - nh) // 2
    shadow = Image.new("RGBA", (nw + 24, nh + 24), (0, 0, 0, 0))
    shadow_plate = Image.new("RGBA", (nw, nh), (0, 0, 0, 70))
    shadow.paste(shadow_plate, (12, 16))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    canvas_rgba = canvas.convert("RGBA")
    canvas_rgba.alpha_composite(shadow, (x - 12, y - 8))
    canvas_rgba.paste(sharp.convert("RGBA"), (x, y))
    return canvas_rgba.convert("RGB")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    im = Image.open(SRC).convert("RGB")
    width, height = im.size
    cell_w = width // COLS
    cell_h = height // ROWS

    index = 0
    for row in range(ROWS):
        for col in range(COLS):
            left = col * cell_w + (GUTTER if col else 0)
            upper = row * cell_h + (GUTTER if row else 0)
            right = (col + 1) * cell_w - (GUTTER if col < COLS - 1 else 0)
            lower = (row + 1) * cell_h - (GUTTER if row < ROWS - 1 else 0)
            panel = im.crop((left, upper, right, lower))
            slide = to_tiktok(panel)
            path = OUT_DIR / f"{NAMES[index]}.png"
            slide.save(path, format="PNG", optimize=True)
            print(f"wrote {path.name} {slide.size} from panel {panel.size}")
            index += 1

    print(f"OUT {OUT_DIR}")


if __name__ == "__main__":
    main()
