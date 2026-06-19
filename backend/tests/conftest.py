"""pytest configuration — ensure backend/ is on sys.path for all tests."""
import sys
from pathlib import Path

# Add the backend/ directory so tests can import core/, models/, etc.
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
