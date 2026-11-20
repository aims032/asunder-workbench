#!/usr/bin/env python3
"""
Reads a captured command log and prints only what matters.

  usage: quiet_filter.py <logfile> <exit_code>

- Short output (MAX_FULL_LINES or fewer) comes back whole, untouched.
- Long output comes back as: error/failure lines (with a little context after
  each), then the last SUMMARY_LINES lines (where tools print their summary),
  then a pointer to the full log.
"""
import re
import sys

# --- Knobs: change these to make it quieter or chattier -----------------------
MAX_FULL_LINES = 60   # at or under this many lines, show everything
SUMMARY_LINES = 15    # always show this many lines from the end
CONTEXT_AFTER = 2     # lines kept after each error line (stack traces, file:line)
MAX_ERROR_LINES = 80  # hard cap on error lines so a 5,000-error build can't flood
# -----------------------------------------------------------------------------

IMPORTANT = re.compile(
    r"error|fail|fatal|exception|traceback|panic|denied|not found|"
    r"cannot|could not|unable to|ERR!|✗|✘",
    re.IGNORECASE,
)
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")


def clean(raw):
    """Strip colour codes and collapse progress bars (\\r redraws) to their final state."""
    lines = []
    for line in raw.splitlines():
        line = ANSI.sub("", line).split("\r")[-1].rstrip()
        if line and (not lines or lines[-1] != line):  # drop exact repeats
            lines.append(line)
    return lines


def main():
    path, code = sys.argv[1], sys.argv[2]
    with open(path, errors="replace") as f:
        lines = clean(f.read())

    if len(lines) <= MAX_FULL_LINES:
        print("\n".join(lines))
        return

    tail_start = len(lines) - SUMMARY_LINES
    keep = set()
    for i, line in enumerate(lines[:tail_start]):
        if IMPORTANT.search(line):
            keep.update(range(i, min(i + CONTEXT_AFTER + 1, tail_start)))
    errors = sorted(keep)[:MAX_ERROR_LINES]

    print(f"[quiet] {len(lines)} lines of output, exit {code}. Showing errors + summary.")
    if errors:
        print("--- errors/failures ---")
        prev = None
        for i in errors:
            if prev is not None and i != prev + 1:
                print("  ...")
            print(lines[i])
            prev = i
    print("--- end of output ---")
    print("\n".join(lines[tail_start:]))
    print(f"[quiet] full log: {path}")


if __name__ == "__main__":
    main()
