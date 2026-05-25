"""Generates PWA icons using Pillow. Run by GitHub Actions before npm build."""
from PIL import Image, ImageDraw
import os


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    s = size / 512.0
    green = (22, 163, 74)
    r = int(size * 0.22)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=green)

    white = (255, 255, 255)

    # ── FORK (left) ──
    fx = 152 * s
    tine_w = int(14 * s)
    tine_h = int(110 * s)
    tine_y = int(90 * s)
    tine_r = int(7 * s)
    gap = int(18 * s)

    for i in range(3):
        tx = int(fx - gap + i * gap - tine_w // 2)
        draw.rounded_rectangle([tx, tine_y, tx + tine_w, tine_y + tine_h], radius=tine_r, fill=white)

    neck_x = int(fx - tine_w * 1.1)
    neck_w = int(tine_w * 2.2)
    neck_y = int(tine_y + tine_h - int(8 * s))
    neck_h = int(32 * s)
    draw.rounded_rectangle([neck_x, neck_y, neck_x + neck_w, neck_y + neck_h], radius=int(4 * s), fill=white)

    handle_w = int(26 * s)
    handle_x = int(fx - handle_w // 2)
    handle_y = int(neck_y + neck_h - int(4 * s))
    handle_h = int(200 * s)
    draw.rounded_rectangle([handle_x, handle_y, handle_x + handle_w, handle_y + handle_h],
                           radius=int(13 * s), fill=white)

    # ── KNIFE (right) ──
    kx = 360 * s
    blade_w = int(28 * s)
    blade_x = int(kx - blade_w // 2)
    blade_y = int(90 * s)
    blade_h = int(160 * s)

    bpts = [
        (blade_x, blade_y + int(20 * s)),
        (blade_x + blade_w, blade_y),
        (blade_x + blade_w, blade_y + blade_h),
        (blade_x, blade_y + blade_h),
    ]
    draw.polygon(bpts, fill=white)
    draw.ellipse([blade_x, blade_y, blade_x + int(20 * s), blade_y + int(40 * s)], fill=white)

    khandle_w = int(26 * s)
    khandle_x = int(kx - khandle_w // 2)
    khandle_y = int(blade_y + blade_h - int(4 * s))
    khandle_h = int(170 * s)
    draw.rounded_rectangle([khandle_x, khandle_y, khandle_x + khandle_w, khandle_y + khandle_h],
                           radius=int(13 * s), fill=white)

    return img


os.makedirs("public/icons", exist_ok=True)

for size in [180, 192, 512]:
    make_icon(size).save(f"public/icons/icon-{size}.png")
    print(f"✓ icon-{size}.png")

make_icon(180).save("public/apple-touch-icon.png")
print("✓ apple-touch-icon.png")
