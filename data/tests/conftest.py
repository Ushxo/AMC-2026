import json
from pathlib import Path

import pytest

OUT = Path(__file__).resolve().parent.parent / "out"


@pytest.fixture(scope="session")
def charger():
    def _charger(nom: str):
        return json.loads((OUT / nom).read_text("utf-8"))

    return _charger
