#!/usr/bin/env python3
"""
Recreate the SPC Day 1 Outlook image using the KMZ file from:
https://www.spc.noaa.gov/products/outlook/day1otlk_cat.kmz

This script downloads the KMZ, locates its embedded KML file, reads the geospatial data,
dynamically determines the risk level for each feature based on keywords found in the 
attributes, and generates a figure that shows only the SPC outlook map with a dark basemap.

Then, it composites an overlay image (same dimensions) on top of the final outlook map.
"""

import os
import requests
import zipfile
import re

import geopandas as gpd
import matplotlib.pyplot as plt
import contextily as ctx  # for basemaps
from PIL import Image     # for compositing

# ------------------------------------------------------------------------------
# 1. Setup Directories and Filenames
# ------------------------------------------------------------------------------
DATA_DIR = "data"
IMAGES_DIR = "images"
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)

# KMZ file path
KMZ_FILE = os.path.join(DATA_DIR, "day1otlk_cat.kmz")

# The main SPC outlook image (background)
SPC_OUTLOOK_IMAGE = os.path.join(IMAGES_DIR, "spc_day1_outlook_recreated.png")

# The overlay image (same size)
OVERLAY_IMAGE = "overlay.png"

# The final composited image
FINAL_IMAGE = os.path.join(IMAGES_DIR, "spc_day1_outlook_with_overlay.png")


# ------------------------------------------------------------------------------
# 2. Download the KMZ File
# ------------------------------------------------------------------------------
def download_kmz():
    url = "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.kmz"
    print(f"Downloading KMZ from {url}...")
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    with open(KMZ_FILE, "wb") as f:
        f.write(response.content)
    print("KMZ downloaded successfully.")

# ------------------------------------------------------------------------------
# 3. Parse the KMZ File and Find the Embedded KML
# ------------------------------------------------------------------------------
def parse_kmz():
    """
    Inspects the KMZ file to find any embedded KML file and then uses GeoPandas
    (with the zip:// protocol) to read the first KML file found.
    """
    print("Inspecting KMZ file for embedded KML...")
    with zipfile.ZipFile(KMZ_FILE, 'r') as kmz:
        # List all files ending with .kml (ignoring case)
        kml_files = [f for f in kmz.namelist() if f.lower().endswith('.kml')]
        if not kml_files:
            raise FileNotFoundError("No KML file found inside the KMZ archive.")
        print("Found KML file(s):", kml_files)
        # Use the first KML file found
        kml_filename = kml_files[0]
        print("Using KML file:", kml_filename)
    
    kml_path = f"zip://{KMZ_FILE}!/{kml_filename}"
    gdf = gpd.read_file(kml_path, driver="KML")
    print("KMZ read successfully. GeoDataFrame preview:")
    print(gdf.head())
    return gdf

# ------------------------------------------------------------------------------
# 3b. Dynamically Determine Risk Level from Feature Attributes
# ------------------------------------------------------------------------------
def assign_risk_levels(gdf):
    """
    Searches for risk level keywords in the "Name" and "Description" fields of each feature.
    Returns a new GeoDataFrame with a "risk_level" column and a color mapping dictionary.
    """
    risk_keywords = {
        "thunder": "thunder",
        "marginal": "marginal",
        "slight": "slight",
        "enhanced": "enhanced",
        "moderate": "moderate",
        "high": "high"
    }
    color_mapping = {
        "thunder": "#82ff88",   # light green
        "marginal": "#167019",  # dark green
        "slight": "#ebe015",    # yellow
        "enhanced": "#de9000",  # orange
        "moderate": "#f70505",  # dark orange
        "high": "#f705cb"       # red
    }
    
    def get_risk_level(row):
        for field in ["Name", "Description"]:
            if field in row and row[field]:
                text = str(row[field]).lower()
                for key in risk_keywords:
                    if key in text:
                        return key
        return None
    
    gdf["risk_level"] = gdf.apply(get_risk_level, axis=1)
    gdf["color"] = gdf["risk_level"].map(color_mapping)
    return gdf, color_mapping

# ------------------------------------------------------------------------------
# 4. Create the SPC Outlook Figure (Map Only)
# ------------------------------------------------------------------------------
def create_outlook_figure(gdf, color_mapping):
    print("Generating simplified SPC outlook figure with state outlines on top...")
    fig, ax = plt.subplots(figsize=(16, 8))
    
    # Reproject the GeoDataFrame to Web Mercator (EPSG:3857)
    gdf.set_crs(epsg=4326, inplace=True)
    gdf_3857 = gdf.to_crs(epsg=3857)
    # Plot polygons
    for risk, color in color_mapping.items():
        subset = gdf_3857[gdf_3857["risk_level"] == risk]
        if not subset.empty:
            subset.plot(ax=ax, color=color, linewidth=1.0, alpha=0.8, zorder=5)
    
    # Plot unassigned
    unassigned = gdf_3857[gdf_3857["risk_level"].isnull()]
    if not unassigned.empty:
        unassigned.plot(ax=ax, color="gray", linewidth=1.0, alpha=0.8, zorder=5)
    
    # Remove axes
    ax.set_axis_off() 
    
    # Set desired map extent for a broader view (approximate values for CONUS in Web Mercator)
    ax.set_xlim([-1.45e7, -7.45e6])
    ax.set_ylim([2.40e6, 6.40e6])
    # Basemap
    ctx.add_basemap(ax, crs="EPSG:3857", source=ctx.providers.CartoDB.DarkMatterNoLabels, zoom=6, zorder=0)
    
    # State outlines
    states_url = "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"
    states = gpd.read_file(states_url)
    states = states.to_crs(epsg=3857)
    states.boundary.plot(ax=ax, edgecolor="#2b2b2b", linewidth=1, zorder=10)
    
    plt.tight_layout()
    plt.savefig(SPC_OUTLOOK_IMAGE, dpi=300, bbox_inches="tight", pad_inches=0)
    plt.close(fig)
    print(f"Simplified SPC outlook figure saved to {SPC_OUTLOOK_IMAGE}")

# ------------------------------------------------------------------------------
# 5. Composite the Overlay on Top
# ------------------------------------------------------------------------------
def composite_images():
    """
    Combine the SPC map (SPC_OUTLOOK_IMAGE) with an overlay image (OVERLAY_IMAGE) 
    so that the overlay sits on top, creating a single final image.
    """
    if not os.path.exists(OVERLAY_IMAGE):
        print(f"Overlay file '{OVERLAY_IMAGE}' not found. Skipping composite.")
        return
    
    from PIL import Image
    
    # Open both images in RGBA mode
    background = Image.open(SPC_OUTLOOK_IMAGE).convert("RGBA")
    foreground = Image.open(OVERLAY_IMAGE).convert("RGBA")
    
    # Ensure they're the same size
    if background.size != foreground.size:
        print("Warning: Background and overlay have different sizes. Attempting to resize overlay.")
        foreground = foreground.resize(background.size, Image.Resampling.LANCZOS)
    
    # Paste the foreground on top of the background
    background.paste(foreground, (0, 0), foreground)
    
    # Save the final composite
    background.save(FINAL_IMAGE)
    print(f"Final composite saved to {FINAL_IMAGE}")

# ------------------------------------------------------------------------------
# Main Execution
# ------------------------------------------------------------------------------
def main():
    try:
        download_kmz()
        gdf = parse_kmz()
        gdf, color_mapping = assign_risk_levels(gdf)
        create_outlook_figure(gdf, color_mapping)
        composite_images()
        print("SPC Day 1 Outlook recreation complete.")
    except Exception as e:
        print("An error occurred:", e)

if __name__ == "__main__":
    main()