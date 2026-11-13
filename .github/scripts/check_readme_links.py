"""Check that relative links in the root README point to existing files or folders."""

from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[2]
README = ROOT / "README.md"
LINK_PATTERN = re.compile(r"!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+[^)]*)?\)")


def main() -> int:
    source = README.read_text(encoding="utf-8")
    failures: list[str] = []

    for match in LINK_PATTERN.finditer(source):
        destination = match.group(1).strip("<>")
        parsed = urlsplit(destination)
        if parsed.scheme or destination.startswith("//") or not parsed.path:
            continue

        relative_path = unquote(parsed.path)
        target = (ROOT / relative_path).resolve()
        if not target.is_relative_to(ROOT) or not target.exists():
            line = source.count("\n", 0, match.start()) + 1
            failures.append(f"README.md:{line}: broken local link: {destination}")

    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1

    print("All local links in README.md point to existing paths.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
