import os
from PIL import Image

src_img = r"C:\Users\Administrator\.gemini\antigravity\brain\3cf232b0-9681-4ca4-968a-bec346b8160a\cinenova_icon_1779992520317.png"
base_res = r"C:\Users\Administrator\AndroidStudioProjects\CineNova\app\src\main\res"

sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192
}

try:
    with Image.open(src_img) as img:
        img = img.convert("RGBA")
        for folder, size in sizes.items():
            out_dir = os.path.join(base_res, folder)
            os.makedirs(out_dir, exist_ok=True)
            
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            
            # Save normal icon
            out_path1 = os.path.join(out_dir, "ic_launcher.png")
            resized.save(out_path1, format="PNG")
            
            # Save round icon (same for simplicity)
            out_path2 = os.path.join(out_dir, "ic_launcher_round.png")
            resized.save(out_path2, format="PNG")
            
    print("Icons successfully sliced and saved to mipmap folders!")
except Exception as e:
    print(f"Error: {e}")
