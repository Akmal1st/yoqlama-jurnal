"""golden.json ni kompyuter dasturi asosida qayta yaratadi. Hisob-kitob qoidasi ATAYLAB o'zgartirilgandagina ishga tushiring:
    python tests/make_golden.py
so'ng web ilovani ham shunga moslang (npm test o'tishi kerak)."""
import json

from pyjurnal import TESTS, compute

(TESTS / "golden.json").write_text(json.dumps(compute(), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("tests/golden.json yangilandi")
