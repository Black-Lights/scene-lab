# The skill explainer-video

`SKILL.md` in this folder is the template of a Claude Code skill: with it installed, a session in any project can
make a video with this engine ("make a video of this report", "explain X in three minutes").

- **Install:** `setup.ps1` writes the engine folder's full path in place of `{{ENGINE_DIR}}` and saves the result as
  `%USERPROFILE%\.claude\skills\explainer-video\SKILL.md`, where Claude Code finds personal skills.
- **Change it:** edit the template here, never the installed copy (the next install overwrites it), then install
  the skill alone again with `powershell -ExecutionPolicy Bypass -File setup.ps1 -SkillOnly`. Commit the template.
- **Your own steps:** a step that belongs to one machine only (a host you publish page parts to, a place you fetch
  pages from) goes in `local\skill-extras.md` in the engine folder. git ignores `local\`, and the skill reads that
  file when it exists, so the template stays the same for everyone.
