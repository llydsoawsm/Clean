import os
from PIL import Image, ImageFont, ImageDraw

# Paths
ASSETS_DIR = "c:/about-school/Clean/mobile/assets"
IONICONS_PATH = "c:/about-school/Clean/mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"
WATER_CHAR = chr(0xf62e)

# Colors
BG_COLOR = (248, 250, 252, 255)       # #f8fafc
BOX_BG = (239, 246, 255, 255)         # #eff6ff
BOX_BORDER = (219, 234, 254, 255)     # #dbeafe
DROPLET_COLOR = (29, 78, 216, 255)    # #1d4ed8
TEXT_TITLE = (15, 23, 42, 255)        # #0f172a
TEXT_SUB = (100, 116, 139, 255)       # #64748b

# Fonts for text
FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REG = "C:/Windows/Fonts/segoeui.ttf"

def draw_droplet_box(draw, cx, cy, box_size, radius, border_width, droplet_scale=0.58):
    half = box_size / 2.0
    x0 = cx - half
    y0 = cy - half
    x1 = cx + half
    y1 = cy + half

    # Draw rounded rectangle
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=BOX_BG, outline=BOX_BORDER, width=border_width)

    # Draw water droplet
    glyph_target_size = int(box_size * droplet_scale)
    # Estimate font size to hit target height
    font_size = int(glyph_target_size * 1.25)
    font = ImageFont.truetype(IONICONS_PATH, font_size)
    bbox = font.getbbox(WATER_CHAR)
    gw = bbox[2] - bbox[0]
    gh = bbox[3] - bbox[1]

    # Center glyph accurately inside box
    gx = cx - (bbox[0] + bbox[2]) / 2.0
    # Droplet visual center is slightly lower than bounding box center because of pointed top
    gy = cy - (bbox[1] + bbox[3]) / 2.0 + (gh * 0.04)

    draw.text((gx, gy), WATER_CHAR, font=font, fill=DROPLET_COLOR)


def generate_splash():
    # 1284 x 2778
    width, height = 1284, 2778
    img = Image.new("RGBA", (width, height), BG_COLOR)
    draw = ImageDraw.Draw(img)

    cx = width / 2.0
    cy = height * 0.44  # Slightly above middle for great mobile visual balance

    box_size = 280
    radius = 68
    border_width = 4
    draw_droplet_box(draw, cx, cy, box_size, radius, border_width, droplet_scale=0.62)

    # Title "Clean"
    title_font = ImageFont.truetype(FONT_BOLD, 92)
    title_text = "Clean"
    t_bbox = title_font.getbbox(title_text)
    tw = t_bbox[2] - t_bbox[0]
    th = t_bbox[3] - t_bbox[1]
    title_y = cy + (box_size / 2.0) + 40
    draw.text((cx - (t_bbox[0] + t_bbox[2]) / 2.0, title_y), title_text, font=title_font, fill=TEXT_TITLE)

    # Subtitle "Laundry Management"
    sub_font = ImageFont.truetype(FONT_REG, 44)
    sub_text = "Laundry Management"
    s_bbox = sub_font.getbbox(sub_text)
    sub_y = title_y + th + 24
    draw.text((cx - (s_bbox[0] + s_bbox[2]) / 2.0, sub_y), sub_text, font=sub_font, fill=TEXT_SUB)

    out_path = os.path.join(ASSETS_DIR, "splash.png")
    img.save(out_path, "PNG")
    print(f"Generated {out_path} ({width}x{height})")


def generate_icon():
    # 1024 x 1024
    width, height = 1024, 1024
    img = Image.new("RGBA", (width, height), BG_COLOR)
    draw = ImageDraw.Draw(img)

    cx, cy = 512, 512
    box_size = 640
    radius = 160
    border_width = 8
    draw_droplet_box(draw, cx, cy, box_size, radius, border_width, droplet_scale=0.64)

    out_path = os.path.join(ASSETS_DIR, "icon.png")
    img.save(out_path, "PNG")
    print(f"Generated {out_path} ({width}x{height})")


def generate_adaptive_icon():
    # 1024 x 1024 (transparent background, safe zone inside 66%)
    width, height = 1024, 1024
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = 512, 512
    box_size = 540
    radius = 135
    border_width = 7
    draw_droplet_box(draw, cx, cy, box_size, radius, border_width, droplet_scale=0.64)

    out_path = os.path.join(ASSETS_DIR, "adaptive-icon.png")
    img.save(out_path, "PNG")
    print(f"Generated {out_path} ({width}x{height})")


def generate_clean_logo():
    # 512 x 512
    width, height = 512, 512
    img = Image.new("RGBA", (width, height), BG_COLOR)
    draw = ImageDraw.Draw(img)

    cx, cy = 256, 256
    box_size = 360
    radius = 90
    border_width = 5
    draw_droplet_box(draw, cx, cy, box_size, radius, border_width, droplet_scale=0.64)

    out_path = os.path.join(ASSETS_DIR, "clean-logo.png")
    img.save(out_path, "PNG")
    print(f"Generated {out_path} ({width}x{height})")


def generate_favicon():
    # 48 x 48
    width, height = 48, 48
    # Render at 192x192 first for supersampled crispness, then downsample with LANCZOS
    hi = Image.new("RGBA", (192, 192), BG_COLOR)
    draw = ImageDraw.Draw(hi)
    draw_droplet_box(draw, 96, 96, 160, 40, 3, droplet_scale=0.64)

    img = hi.resize((width, height), Image.Resampling.LANCZOS)
    out_path = os.path.join(ASSETS_DIR, "favicon.png")
    img.save(out_path, "PNG")
    print(f"Generated {out_path} ({width}x{height})")


if __name__ == "__main__":
    generate_splash()
    generate_icon()
    generate_adaptive_icon()
    generate_clean_logo()
    generate_favicon()
    print("All assets successfully generated!")
