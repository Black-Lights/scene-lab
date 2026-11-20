# Long runs that survive a cut

A video too big for one session is split over several agents: a planner, builders, a checker, run as a Claude
Code workflow or as subagents. A usage limit, a shutdown or a power loss can cut such a run in the middle. Finished
agents are never the problem. The loss is every agent that was in the middle of its work: it starts again with an
empty memory. The rules below make a cut cost minutes, not the run.

This page is the rule for every workflow and every long subagent in this project. Read it before writing a
workflow script.

## What a cut does

- The journal of a run is `<session folder>\subagents\workflows\<run id>\journal.jsonl`. A finished agent has a
  `started` line and a `result` line. An agent that was cut, or that failed on the usage limit, has a `started`
  line and no `result` line. So nothing wrong is ever replayed.
- `Workflow({scriptPath, resumeFromRunId})` replays every finished agent whose prompt and options are unchanged
  and runs the others. It works only in the session that started the run.
- An agent that is run again gets the same prompt and remembers nothing. What it had not written to disk is gone.
- When the limit is reached, the lead session gets a short grace allowance: two or three steps, no more.
- A workflow script cannot read or write files. Only agents can.
- Running workflow agents cannot be sent a message (they are not in the list of agents), so the rule must be in
  their prompt from the start.

## The runs list: docs/runs.md

The lead keeps one file that lists every run, `docs/runs.md`. It is your own work log, so a fresh clone does not
have it: create it when you start your first run, with this skeleton, and keep it in your own clone (it does not
belong in a contribution back).

```markdown
# Runs

Every workflow run of this project, newest first. The rules are in docs/workflows.md.

Session folder (scripts and journals):
`<the lead session's folder: .claude\projects\<project>\<session id>\ in your home folder>`
Scripts are in `workflows\scripts\`, journals in `subagents\workflows\<run id>\journal.jsonl`.

Task outputs:
`<the lead session's tasks folder in the temp folder, ending in \<session id>\tasks\>`
A run's file there (`<task id>.output`) is empty while the run works and holds the result once it has ended.

## In flight

### <run name>: <what it does>

- Run id `<run id>`, script `<script file>`, task id `<task id>`, started <date and time>. Resumed: never.
- Stages: <one line each>. Notes: `.runs/<run name>/`.

## Finished or cut
```

When a run ends, or is cut and not resumed, move its entry under "Finished or cut" with its outcome.

`.venv\Scripts\python runs_status.py` reads the two folders and the section "In flight" and prints one line per
run: RUNNING, CUT or DONE, with the script path and run id to resume it. It needs the wording of the skeleton: a
heading `### <name>: ...`, then "Run id `...`", "script `...`" and "task id `...`". After a resume, put the new task
id into the entry at once, so that the next check does not take the run for cut again.

## The rules

1. **Every agent keeps a notes file and reads it first.** Its prompt ends with the checkpoint rule below. The
   file is `.runs/<run name>/<key>.md` (the folder is ignored by git). A successor that finds the file continues
   from it. A successor that finds a FINAL REPORT in it returns that report in one short turn.
2. **One agent, one piece of work of about half an hour.** Longer work becomes stages. Stages run in parallel
   where their files are disjoint. A stage that is finished is in the journal and is never done twice.
3. **Large inputs and all results also live in files.** Work lists, plans and findings go into files that the
   agents read (`.runs/<run name>/` or the repository), not only into the prompt. Each agent's final report is
   also in its notes file. A later stage, or a new session, can then go on without the journal.
4. **A script stops at the first missing result.** After every `agent()` or `parallel()`:
   `if (!x) return { stopped: '...' }`. A later stage never runs on nothing.
5. **The real work is saved in small pieces.** One commit per fix; one commit per finished file; always by path
   (`git add <paths>`, then `git commit -m ... -- <paths>`), because several agents share the index.
6. **Never edit the prompt of a finished agent in a script that will be resumed.** An edited prompt runs again.
   `RUN` (the name of the notes folder) stays the same across resumes and changes only for a new attempt.
7. **The lead lists every run in docs/runs.md when it starts**: its name, run id, script file, stages and state,
   and brings the entry up to date when the run ends or is cut.
8. **At the limit, in the grace allowance:** commit what is on disk, bring docs/runs.md up to date, and stop.
   Nothing else fits.

## Resuming

- **Same session.** Read the journal to see which agents have a `result`. Call
  `Workflow({scriptPath, resumeFromRunId})` with the script unchanged. Finished agents come back from the
  journal. Each cut agent starts again, finds its notes file and continues.
- **A new session** (the journal cannot be used). Launch the same script file again with no `resumeFromRunId` and
  the same `RUN`. Every agent finds its notes file: a finished one returns its FINAL REPORT in one short turn, a
  cut one continues.
- **After a deliberate change of the work** (new findings, a new brief): a new `RUN` name, so no old notes are
  taken for the new work.

## The checkpoint rule, to paste into a script

```js
// RUN names the notes folder. Keep it when the run is resumed after a cut; change it only for a new attempt.
// ENGINE is the engine folder as an absolute path: agents start in a fresh shell and need the full path.
const ENGINE = '<the engine folder, absolute, with doubled backslashes>'
const RUN = 'kit-fix-1201'
const NOTES = ENGINE + '\\.runs\\' + RUN

const safe = (key) => `

IF YOU ARE CUT OFF. A usage limit or a power loss can stop you at any moment. A successor with this same brief is then started in your place, and it must not start from zero.
1. Before anything else, look for your notes file: ${NOTES}\\${key}.md. If it exists, you ARE the successor: read it, compare it with the files and with "git log", and continue from where it stops. Do not redo what it records as done; spot-check one item. If it ends with a section "FINAL REPORT", the work was finished: check that the commits and files it names are there, and return that report as your answer.
2. If it does not exist, create it in your first minutes, with your plan as a checklist.
3. Keep it current. After every piece of work (a finding confirmed, a fix committed, a part of a file written, a decision that cost effort to reach) append: what is done and where it is (commit id or file path), what you learned that a successor would otherwise have to find out again, and what you were about to do next. Write the entry before you start a long command or a long piece of writing, not after it.
4. Save the work itself in small pieces: one commit per fix or per finished file, by path.
5. When you finish, append your final report to the notes file under the heading "FINAL REPORT", then return it.
The folder .runs is ignored by git: never commit it.`
```

Use it as `agent(PROMPT + safe('fix-python'), {...})`. The key is a file name: letters, digits and hyphens.

## Skeleton of a script

```js
export const meta = { name: '...', description: '...', phases: [{ title: 'Fix' }, { title: 'Check' }] }
const RUN = '...'            // and ENGINE, NOTES, safe() as above

const parts = await parallel([
  () => agent(A + safe('part-a'), { label: 'part:a', phase: 'Fix', schema: S, model: 'opus' }),
  () => agent(B + safe('part-b'), { label: 'part:b', phase: 'Fix', schema: S, model: 'opus' }),
])
if (parts.some(p => !p)) return { stopped: 'a part returned nothing: resume this run by its id', parts }

const check = await agent(CHECK(parts) + safe('check'), { label: 'check', phase: 'Check', schema: C, model: 'opus' })
if (!check) return { stopped: 'the check returned nothing: resume this run by its id', parts }
return { parts, check }
```

Models that worked here: engineering and checking on `model: 'opus'`, mechanical work and web reading on
`model: 'sonnet'`, the strongest model for the plan, the design and scene code.

## Starting again by itself after the limit resets (optional)

A scheduled prompt in the lead session can resume cut runs while nobody watches. It spends a fresh usage window,
so set it up only when the user agrees.

- Schedule it with `CronCreate`, recurring every half hour (for example cron `13,43 * * * *`). Each time, it runs
  runs_status.py (or reads the "In flight" section of docs/runs.md itself) and judges each run by its output: a
  run whose output is still empty is running; a run that ended with an agent that is not done, or with a "stopped"
  result, is cut. Never judge by silence: an agent that waits on a long render is silent and alive.
- For each cut run it resumes the run by its id with the script unchanged, and writes the new task id and "Resumed:
  <time>, <n> times" into the entry at once. A run that was resumed twice with no new finished agent is left for
  the user.
- Write into its prompt that it is a scheduled check and not a message from the user, and to reply in one or two
  lines.
- While the usage limit holds, the check itself cannot run; the first check after the reset resumes the runs, so
  the wait is at most half an hour.
- It lives only as long as the session (it is gone after a shutdown or when the session is closed), fires only
  while the session is idle, and expires after 7 days. After a shutdown, resume by hand as above.
- Half an hour and not an hour, on purpose: the session's cached context lasts one hour, and a check that comes
  later than that costs many times more.
- To switch it off: `CronList`, then `CronDelete` with the job id. Let the check delete itself when nothing is in
  flight.
