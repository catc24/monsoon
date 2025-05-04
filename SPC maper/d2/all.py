#!/usr/bin/env python3
import subprocess
import sys
import time

def run_script(path):
    """
    Runs the given Python script with the same interpreter.
    Raises CalledProcessError if it exits non‐zero.
    """
    print(f"→ Running {path} …")
    subprocess.run([sys.executable, path], check=True)

if __name__ == "__main__":
    # List your scripts here, in the order you want them to run:
    scripts = [
        "script.py",
        "spcboxes.py",
        "compile.py",
    ]

    for i, script in enumerate(scripts):
        try:
            run_script(script)
        except subprocess.CalledProcessError as e:
            print(f"‼  {script} exited with code {e.returncode}. Stopping.")
            sys.exit(e.returncode)

    print("✅ All done!")