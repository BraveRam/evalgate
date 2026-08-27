"""
EvalGate - Prompt Engineering, Regression Testing & Quality Gate Platform.
"""

from dotenv import find_dotenv, load_dotenv

# Auto-load .env file from working directory or ancestors
load_dotenv(find_dotenv(usecwd=True))

__version__ = "0.1.0"
