import os
import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageDraw, ImageFont
from datetime import datetime
import pytz

# --- Get the appropriate SPC risk table URL based on current Eastern Time ---
spc_updates = [
    (1, 0, "https://www.spc.noaa.gov/products/outlook/ac1_0600_SItable.html"),
    (8, 0, "https://www.spc.noaa.gov/products/outlook/ac1_1300_SItable.html"),
    (11, 30, "https://www.spc.noaa.gov/products/outlook/ac1_1630_SItable.html"),
    (15, 0, "https://www.spc.noaa.gov/products/outlook/ac1_2000_SItable.html"),
    (20, 0, "https://www.spc.noaa.gov/products/outlook/ac1_0100_SItable.html"),
]

def get_current_spc_url():
    eastern = pytz.timezone("US/Eastern")
    now = datetime.now(eastern)

    for hour, minute, url in sorted(spc_updates, reverse=True):
        update_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if now >= update_time:
            print(f"Selected SPC URL for {hour:02}:{minute:02} ET → {url}")
            return url

    return spc_updates[-1][2]

url = get_current_spc_url()

# --- Fetch the HTML from SPC ---
response = requests.get(url)
response.raise_for_status()
html_content = response.text

# --- Parse the HTML with BeautifulSoup ---
soup = BeautifulSoup(html_content, 'html.parser')

# --- Risk Types & Colors ---
valid_risks = {"HIGH", "MODERATE", "ENHANCED", "SLIGHT", "MARGINAL", "THUNDERSTORM"}
risk_colors = {
    "HIGH": "#FFC0CB",
    "MODERATE": "#FF0000",
    "ENHANCED": "#FFA500",
    "SLIGHT": "#FFFF00",
    "MARGINAL": "#008000",
    "THUNDERSTORM": "#90EE90"
}

# --- Extract Risk Data ---
risk_rows = soup.find_all('tr', style=lambda s: s and 'background-color: #0A2390' in s)
extracted_data = []

for row in risk_rows:
    cells = row.find_all('td')
    if len(cells) >= 4:
        risk_level = cells[0].get_text(strip=True).upper()
        pop = cells[2].get_text(strip=True)
        city_text = cells[3].get_text(strip=True)
        
        if risk_level in valid_risks:
            extracted_data.append({
                "risk": risk_level,
                "pop": pop,
                "city_text": city_text
            })

# --- Image Setup ---
img_width, img_height = 1920, 1080
img = Image.new("RGBA", (img_width, img_height), (255, 255, 255, 0))
draw = ImageDraw.Draw(img)

top_margin = 250
left_margin = 20
left_column_width = 400
box_height = 140
gap = 20

# --- Fonts ---
font_path = "font/RobotoCondensed-Black.ttf"
font_size = 24
city_font_size = 20

try:
    font = ImageFont.truetype(font_path, font_size)
except IOError:
    font = ImageFont.load_default()

try:
    city_font = ImageFont.truetype(font_path, city_font_size)
except IOError:
    city_font = ImageFont.load_default()

# --- Text Wrapping Function ---
def wrap_text(text, font, max_width, draw):
    words = text.split()
    lines = []
    current_line = ""
    for word in words:
        test_line = current_line + (" " if current_line else "") + word
        bbox = draw.textbbox((0, 0), test_line, font=font)
        w = bbox[2] - bbox[0]
        if w <= max_width:
            current_line = test_line
        else:
            if current_line:
                lines.append(current_line)
            current_line = word
    if current_line:
        lines.append(current_line)
    return lines

# --- Draw the Boxes ---
num_boxes = min(5, len(extracted_data))

for i, data in enumerate(extracted_data[:num_boxes]):
    y_top = top_margin + i * (box_height + gap)
    y_bottom = y_top + box_height

    risk = data["risk"]
    color = risk_colors.get(risk, "#000000")

    box_x0 = left_margin
    box_x1 = left_margin + left_column_width

    draw.rectangle([(box_x0, y_top), (box_x1, y_bottom)], fill=color)
    draw.rectangle([(box_x0, y_top), (box_x1, y_bottom)], outline="black", width=2)

    text_x = box_x0 + 10
    text_y = y_top + 10

    risk_line = f"{risk} {num_boxes - i}/{num_boxes}"
    draw.text((text_x, text_y), risk_line, fill="black", font=font)

    pop_line = f"POP: {data['pop']}"
    draw.text((text_x, text_y + 30), pop_line, fill="black", font=font)

    city_text_y = text_y + 70
    max_text_width = left_column_width - 20
    wrapped_lines = wrap_text(data['city_text'], city_font, max_text_width, draw)
    for j, line in enumerate(wrapped_lines):
        draw.text((text_x, city_text_y + j * (city_font_size + 2)), line, fill="black", font=city_font)

# --- Save Image ---
os.makedirs("images", exist_ok=True)
img.save("images/output.png")
print("Image saved as images/output.png")