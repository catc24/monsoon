from PIL import Image, ImageDraw, ImageFont
from datetime import datetime

# Open the base image (background)
bg = Image.open("images/bg2.png").convert("RGBA")

# Open the second image and resize it to match the background if needed
overlay1 = Image.open("images/output.png").convert("RGBA")
if overlay1.size != bg.size:
    overlay1 = overlay1.resize(bg.size, Image.LANCZOS)

# Composite bg and overlay1
combined = Image.alpha_composite(bg, overlay1)

# Open the top image and scale it down to 30% of its original size
overlay2 = Image.open("images/spc_day2_outlook_with_overlay.png").convert("RGBA")
new_width = overlay2.width * 35 // 100
new_height = overlay2.height * 35 // 100
overlay2 = overlay2.resize((new_width, new_height), Image.LANCZOS)

# Calculate position for overlay2:
# Right edge 10px from right and bottom edge 40px from bottom
x = combined.width - overlay2.width - 40
y = combined.height - overlay2.height - 80

# Paste the scaled overlay2 on top using its alpha channel as mask
combined.paste(overlay2, (x, y), overlay2)

# Create a drawing context
draw = ImageDraw.Draw(combined)

# Load a larger TrueType font (size 30) if available, else fall back to default
try:
    font = ImageFont.truetype("arial.ttf", 30)
except IOError:
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 30)
    except IOError:
        font = ImageFont.load_default()

# Get the current timestamp in the desired format
timestamp_text = f"made on {datetime.now().strftime('%m:%d:%y at %H:%M:%S')}"

# Calculate text dimensions using textbbox
bbox = draw.textbbox((0, 0), timestamp_text, font=font)
text_width = bbox[2] - bbox[0]
text_height = bbox[3] - bbox[1]

# Position the text in the top right corner with a 10px margin
text_x = combined.width - text_width - 10
text_y = 10

# Draw a black outline for improved visibility
outline_color = "black"
for offset in [(-1, -1), (-1, 1), (1, -1), (1, 1)]:
    draw.text((text_x + offset[0], text_y + offset[1]), timestamp_text, font=font, fill=outline_color)

# Draw the timestamp text in white
draw.text((text_x, text_y), timestamp_text, font=font, fill="white")

# Save the final combined image
combined.save("final_image.png")
print("Final image saved as 'final_image.png'")