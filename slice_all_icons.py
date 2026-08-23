import os
from PIL import Image

src = r"c:\Users\Administrator\OneDrive\Desktop\CineNova\icon.png"
web_dir = r"c:\Users\Administrator\OneDrive\Desktop\CineNova"
res_dir = r"C:\Users\Administrator\AndroidStudioProjects\CineNova\app\src\main\res"

img = Image.open(src).convert("RGBA")

# PWA icons
for size, name in [(192, "icon-192.png"), (512, "icon-512.png")]:
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(os.path.join(web_dir, name), format="PNG")

# Android mipmap icons
mipmap_sizes = {"mipmap-mdpi": 48, "mipmap-hdpi": 72, "mipmap-xhdpi": 96, "mipmap-xxhdpi": 144, "mipmap-xxxhdpi": 192}
for folder, size in mipmap_sizes.items():
    out_dir = os.path.join(res_dir, folder)
    os.makedirs(out_dir, exist_ok=True)
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(os.path.join(out_dir, "ic_launcher.png"), format="PNG")
    resized.save(os.path.join(out_dir, "ic_launcher_round.png"), format="PNG")

# Also copy as app-promo.png for the banner
img_promo = img.resize((256, 256), Image.Resampling.LANCZOS)
img_promo.save(os.path.join(web_dir, "app-promo.png"), format="PNG")

print("All icons sliced successfully!")
