@AGENTS.md

# "L" / "LOOK" = read my newest screenshot (HARD RULE, always applies)

When the user sends just "L" or "LOOK" (any case), that means: run `~/.claude/bin/look` (prints the newest screenshot paths from ~/Desktop and the macOS temp thumbnail folder, newest first), Read the first path, and respond to what it shows. Never ask the user to paste or drag the image — drag-into-terminal is unreliable, this is the workaround. If the newest file is one already seen, say nothing new has arrived. If the script is missing, recreate it: find ~/Desktop and $(getconf DARWIN_USER_TEMP_DIR)/TemporaryItems for Screenshot*.png, sort by mtime, newest first.
