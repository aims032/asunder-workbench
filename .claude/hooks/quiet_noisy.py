#!/usr/bin/env python3
"""
PreToolUse hook for Bash: keeps noisy commands from flooding Claude's context.

How it works:
  1. Claude Code hands this script the Bash command (as JSON on stdin) before it runs.
  2. If the command is a known noisy one (install, build, test, package manager...),
     we rewrite it so its output goes to a log file, then quiet_filter.py prints
     back only what matters: errors, failures, and the final summary.
  3. Anything else passes through untouched (we print nothing and exit 0).

The rewrite runs in the same shell, so `cd`, exported variables and the exit
code all behave exactly as if the command ran normally.

Escape hatch: put `QUIET=0` anywhere in a command to get the full raw output.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FILTER = os.path.join(HERE, "quiet_filter.py")

# Commands that print a lot and say little. Each pattern must match at the
# start of the command or right after a separator (&&, ;, ||, newline).
NOISY = [
    r"(npm|pnpm|yarn|bun)\s+(install|i|ci|add|update|upgrade|build|test|run\s+(build|test)\S*)\b",
    r"npx\s+(jest|vitest|playwright|tsc|next\s+build|vite\s+build)\b",
    r"(pip3?|python3?\s+-m\s+pip|uv\s+pip)\s+install\b",
    r"(uv\s+(sync|add)|poetry\s+install|pipenv\s+install)\b",
    r"(pytest|python3?\s+-m\s+pytest|tox)\b",
    r"swift\s+(build|test|package\s+(resolve|update))\b",
    r"xcodebuild\b",
    r"cargo\s+(build|test|install|check|clippy)\b",
    r"go\s+(build|test|install|get|mod\s+download)\b",
    r"(make|ninja|cmake\s+--build|mvn|\./gradlew|gradle)\b",
    r"(sudo\s+)?(apt-get|apt)\s+(install|update|upgrade)\b",
    r"brew\s+(install|upgrade|update)\b",
    r"(gem\s+install|bundle(\s+install)?|pod\s+install)\b",
    r"docker\s+(build|pull|compose\s+(build|pull|up))\b",
]
NOISY_RE = re.compile(r"(^|&&|\|\||;|\n)\s*(" + "|".join(NOISY) + ")", re.MULTILINE)

# Skip when the command already manages its own output.
ALREADY_HANDLED = re.compile(r"\||>|QUIET=0")


def main():
    data = json.load(sys.stdin)
    if data.get("tool_name") != "Bash":
        return
    tool_input = data.get("tool_input") or {}
    cmd = tool_input.get("command", "")

    # Background jobs write to their own output file; leave them alone.
    if tool_input.get("run_in_background"):
        return
    if not NOISY_RE.search(cmd) or ALREADY_HANDLED.search(cmd):
        return

    # Run the original command in a brace group (same shell, so cd/vars stick),
    # capture everything to a log, filter it, then restore the original exit code.
    wrapped = (
        '__qlog=$(mktemp "${TMPDIR:-/tmp}/claude-quiet.XXXXXX.log")\n'
        "{\n"
        f"{cmd}\n"
        '} >"$__qlog" 2>&1 </dev/null\n'
        "__qrc=$?\n"
        f'python3 "{FILTER}" "$__qlog" "$__qrc"\n'
        '(exit "$__qrc")'
    )

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "updatedInput": {**tool_input, "command": wrapped},
        }
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # If the hook ever breaks, never block the command; just run it raw.
        pass
