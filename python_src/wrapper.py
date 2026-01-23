import sys
import os

# Get the directory where this script is located (python_src)
current_dir = os.path.dirname(os.path.abspath(__file__))

# Prepend this directory to sys.path to prioritize bundled code
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Import the bundled CLI
from codecomplexity.cli import main

if __name__ == '__main__':
    sys.exit(main())
