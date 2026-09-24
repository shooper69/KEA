from PIL import Image
from pathlib import Path

src = Path(r"C:\CURSOR\KEA\assets\images\favicon-192.png")
out = Path(r"C:\CURSOR\KEA\assets\images")
img = Image.open(src).convert("RGBA")

w, h = img.size
side = max(w, h)
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(img, ((side - w) // 2, (side - h) // 2), img)


def save_png(size: int, name: str) -> None:
    resized = canvas.resize((size, size), Image.Resampling.LANCZOS)
    path = out / name
    resized.save(path, format="PNG", optimize=True)
    print(f"wrote {path.name} {size}x{size} {path.stat().st_size} bytes")


for size, name in (
    (32, "favicon-32.png"),
    (48, "favicon-48.png"),
    (96, "favicon-96.png"),
):
    save_png(size, name)

# Proper multi-size ICO (browsers + crawlers that only probe /favicon.ico)
icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
frames = [canvas.resize(size, Image.Resampling.LANCZOS) for size in icon_sizes]
ico_path = out / "favicon.ico"
# Pillow writes ICO from the first image; append the rest.
frames[0].save(
    ico_path,
    format="ICO",
    sizes=icon_sizes,
    append_images=frames[1:],
)
check = Image.open(ico_path)
print(
    f"wrote {ico_path.name} {ico_path.stat().st_size} bytes "
    f"first={check.size} frames={getattr(check, 'n_frames', 1)}"
)
