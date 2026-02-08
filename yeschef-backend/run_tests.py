
import pytest
import sys
import os

if __name__ == "__main__":
    # Ensure current directory is in path
    sys.path.append(os.getcwd())
    
    # Run tests
    exit_code = pytest.main(["tests/test_api.py", "-v"])
    sys.exit(exit_code)
