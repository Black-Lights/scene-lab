Research note · 18 November 2026

# Reflection Lab

Can two small language models that fit on a phone catch each other's mistakes?

Code and every run: github.com/Black-Lights/reflection-lab

Contents

- In short

- The question

- How the loop works

- What was tested

- How answers were graded

- One model against the loop

- Two answers, step by step

- Which model makes a good critic

- Tool-use agents

- Standard benchmarks

- Time and compute

- What this means for the phone

- Next steps

- Limitations

## In short

A small model answers a question from a document, a second small model checks the answer against the
document, and the first model rewrites its answer if the check found a problem. I measured whether this
loop gives fewer hallucinations than the first model alone, on a laptop GPU with the same
.litertlm files an Android phone runs: Gemma 4 E4B, Qwen3 4B and Qwen3 1.7B, on 104
grounded questions, 30 tool-use tasks and four public benchmarks.

101 / 104correct for Gemma 4 E4B with a calculator, the best single-model result

14 → 8hallucinations when Gemma checked the weaker Qwen3 1.7B (p = 0.031)

74 vs 52F1 at spotting hallucinated answers (RAGTruth): Gemma against Qwen3 4B as critic

21 / 30tool-use tasks solved by Gemma; 9 each by the two Qwen3 models

1.7×model time of the Gemma loop compared with Gemma alone

- The prompt mattered most. Telling the analyst that a calculation from the document is
allowed took Gemma from 89 to 97 correct answers out of 104, and a calculator tool to 101.

- The loop helps a little, and only with the right critic. It never added more
hallucinations than it removed once the prompts were fixed, but on 104 questions only one reduction
is statistically significant: Gemma checking the weaker Qwen3 1.7B.

- Gemma is a far better critic than Qwen3. Both Qwen3 models flag almost every
answer, right or wrong, so their objections carry no information.

- On long answers the rewrite can corrupt numbers ("4444.7%" for 44.7 %), which made
the loop worse on FACTS Grounding. Any phone version needs a number check after the rewrite.

## The question

Small models that run on a phone are fast, private and free to call, but they hallucinate: they state
things the source does not say, or get a number wrong. A larger model in the cloud is the usual fix,
which gives up the privacy and the offline use that made the small model attractive. The cheapest fix
that stays on the device is a second small model acting as a critic. This project measures what that
critic adds, what it costs in time, and how often it turns a correct answer into a wrong one.

Everything ran on a Windows laptop (RTX 3060 Laptop GPU with 6 GB, Ryzen 7 5800H, 16 GB RAM) through
LiteRT-LM 0.19.2, Google's runtime for on-device
models, with greedy decoding so that a rerun gives the same text.

Model | File | Size | GPU memory | Used as

Gemma 4 E4B | gemma-4-E4B-it.litertlm | 3.4 GB | 3.0 GB | analyst and critic

Qwen3 4B | qwen3_4b_mixed_int4.litertlm | 2.3 GB | 4.2 GB | critic and analyst

Qwen3 1.7B | Qwen3_1.7B.litertlm (int8) | 1.6 GB | under 3 GB | first critic, then analyst

Two models do not fit in 6 GB together, so the pipeline loads one at a time: all drafts, then
all audits, then all rewrites.

## How the loop works

The analyst's draft is the one-model answer. The critic must start with a verdict line; the
rewrite only runs on ISSUES.

The critic replies VERDICT: OK or VERDICT: ISSUES followed by one line per
problem, tagged [UNSUPPORTED], [WRONG] or [MISSING]. The verdict line
decides whether the refiner runs. Two prompt versions were tested; the second came out of reading every
answer the first one broke.

#### Prompts v1

- Analyst: answer only from the document, say "the document does not say" otherwise.

- Critic: flag claims that are not in the document.

- Refiner: fix the issues in the audit.

#### Prompts v2

- Analyst: a calculation or a simple step of logic from the document is allowed, so state the result;
correct a false assumption in the question.

- Critic: redo every calculation, and quote the document sentence behind every issue, or drop it.

- Refiner: apply only issues with a real quote; never delete a correct calculation.

## What was tested

All documents are fictional, so no model can answer from memory. Some contradict real facts on purpose
(emperor penguins breeding in the Arctic, a Soviet Moon landing in 1971), and the answer has to follow the
document. Each set was written from known failure patterns, reviewed, and frozen before any model saw it.

Set | Items | What it checks

Starter | 30 | answerable, numeric, trap (answer not in the text), counterfactual, multi-hop

Hard | 42 | near-miss numbers, corrected values, superseded rules, false premises, half-answerable questions

Fresh hold-out | 32 | written after the hard-set results, to judge the prompt changes fairly

Agent tasks | 30 | tool use in a small simulated shop, six levels of difficulty

Public benchmarks | 28 to 300 | lm-evaluation-harness (GSM8K, IFEval, MMLU-Pro), RAGTruth, Vectara HHEM, FACTS Grounding

A false-premise question from the hard set: "Why did the board reject the repair of the ferry
terminal roof?" The minutes say that no decision was taken and that repair quotes are expected in
April. The right answer corrects the premise.

## How answers were graded

Every question is answered twice in the same run, so the comparison is paired: McNemar's exact
test on the answers that changed.

Each answer gets one label: correct, hallucination (states something the
document does not support, including an invented answer to a trap), incomplete (nothing
false, but part of the question unanswered) or wrong refusal ("the document does not say"
when it does). The first 144 answers were labelled blind, with the two answers shuffled and the critic's
audit hidden until both were labelled. The full grid was graded by per-case rules that agree with all 144
blind labels, and then a separate review pass read 133 answers one by one: every answer the rules were
unsure about, every answer the loop changed and every hallucination.

## One model against the loop

14 analyst, critic and prompt combinations on the same 104 questions. Left: correct answers.
Right: hallucinations. Each row goes from the analyst alone to the loop.

### The prompt mattered most

With the first prompts, Gemma's misses were calculations it left unfinished: it quoted "385 and 412
million" and stopped, or replied that the document does not say when the answer took one subtraction.
Prompt v2 took Gemma alone from 89 to 97 correct and Qwen3 1.7B from 74 to 90. Some of the new
calculations came out wrong, so Gemma's hallucinations rose from 3 to 6. A calculator and a
date_add tool, called by the analyst through LiteRT-LM's tool calling, then gave 101 correct
and 2 hallucinations. Gemma used the tools in 18 of the 104 drafts; Qwen3 4B in 2.

### What the critic adds

With v2 prompts every loop removed at least as many hallucinations as it added: Gemma checking Gemma 6
to 4, Gemma checked by Qwen3 4B 6 to 3, Qwen3 4B checking itself 7 to 5. Correct answers moved by 0 to +2.
None of these differences is significant on 104 questions (p between 0.45 and 1.0). The one significant
reduction is a strong critic behind a weak analyst: Qwen3 1.7B checked by Gemma went from 14
hallucinations to 8, six removed and none added (p = 0.031).

### When the critic hurts

With the first prompts, a critic that does not match the analyst made answers significantly worse.
Gemma checked by Qwen3 1.7B lost 8 correct answers and gained none (89 to 81, p = 0.008). The critic
called correct calculated numbers "unsupported" and the rewrite deleted them. Prompt v2 removed this: after
the change no loop broke more than 4 answers, and four of the eight broke none.

Analyst | Critic | Prompts | Correct, alone | Correct, loop | Halluc., alone | Halluc., loop

Gemma 4 E4B | Gemma 4 E4B | v1 | 89 | 90 | 3 | 1

Gemma 4 E4B | Qwen3 1.7B | v1 | 89 | 81 | 3 | 1

Qwen3 1.7B | Gemma 4 E4B | v1 | 74 | 80 | 14 | 8

Gemma 4 E4B | Gemma 4 E4B | v2 | 97 | 99 | 6 | 4

Gemma 4 E4B | Qwen3 4B | v2 | 97 | 97 | 6 | 3

Qwen3 4B | Qwen3 4B | v2 | 97 | 99 | 7 | 5

Gemma 4 E4B + calculator | Gemma 4 E4B | v2 + tools | 101 | 102 | 2 | 1

Seven of the 14 rows; the chart above has all of them.

## Two answers, step by step

Both come straight from the run folders, quoted as the models wrote them.

### The critic catches a false premise

Document

... the code freeze, originally set for Friday 13 November, moves to Wednesday 18 November because the payment tests are still failing. ...

Question

Why was the code freeze moved to 13 November?

Draft
Qwen3 1.7B

The code freeze was moved to 13 November because the payment tests are still failing.
The document does not say.hallucination

Audit
Gemma 4 E4B

VERDICT: ISSUES
- [WRONG] The code freeze was moved to 13 November because the payment tests are still failing. : the document says the code freeze moves to Wednesday 18 November because the payment tests are still failing.

Final
Qwen3 1.7B

The code freeze was moved to 18 November because the payment tests are still failing.correct

### The critic deletes a correct answer

Document

... raising the annual mooring fee for boats under 10 metres from 620 to 680 euros, and for boats of 10 metres and over from 1,150 to 1,290 euros. ...

Question

By how much will the annual mooring fee rise for a 12-metre boat?

Draft
Gemma 4 E4B

The annual mooring fee for boats of 10 metres and over will rise from 1,150 to 1,290 euros. This represents an increase of 140 euros.correct

Audit
Qwen3 1.7B

VERDICT: ISSUES
- [WRONG] "This represents an increase of 140 euros": The document says the fee will rise from 1,150 to 1,290 euros, which is an increase of 140 euros. However, the draft incorrectly states "This represents an increase of 140 euros." The correct statement should be "This represents an increase of 140 euros." ...
- [UNSUPPORTED] ... The document does not mention a 12-metre boat. ...

Final
Gemma 4 E4B

The annual mooring fee for boats of 10 metres and over will rise from 1,150 to 1,290 euros.incomplete

With v2

Gemma as critic answered VERDICT: OK and the 140 euros stayed. Qwen3 4B under v2 still filed an issue, then concluded in its own audit that "the draft answer is correct".

## Which model makes a good critic

RAGTruth test split, 150 hallucinated and 150 clean responses. Grey rows: the RAGTruth paper
(Niu et al., 2024, Table 5), full test set.

RAGTruth contains answers written by large models, each annotated for hallucinations. The critic audits
each one against its source with the same prompt it uses in the loop. Both Qwen3 critics flag almost every
response. Their recall is close to 100 and their precision equals the share of hallucinated responses,
which is exactly what flagging everything would give, and their accuracy is at chance. Gemma flags about
half and is right three times in four. At the class mix of the full test split its estimated F1 is 74,
above the prompted GPT-4-turbo baseline in the paper (63) and below the paper's fine-tuned 13B detector
(79).

This explains the grid. A Qwen3 critic objected to 48 to 78 of the 104 drafts, most of them correct,
and the refiner then had to ignore the audit to keep the answer right. Gemma as critic asked for a rewrite
on 2 of Gemma's 104 drafts under prompt v2.

## Tool-use agents

The agent benchmark is a small, deterministic shop: four orders, three customers, five products, a
policy text, shipping rates and a fixed date. The agent has ten tools (order, customer and product lookups,
shipping rates, policy search, a calculator, date arithmetic, refunds and emails) and, in the limit test,
ten plausible distractors such as currency conversion and weather. A task passes only if the answer is
right, every required call was made with the right arguments, and no forbidden action happened.

30 tasks in six levels: single lookups, two-step chains, policy and arithmetic, actions with
conditions, errors and missing data, and chains of four to six calls.

Gemma solved every lookup and every two-step chain. It failed where the task needed the shop policy
without naming it: member discounts and the free-shipping threshold in price totals, a refund of the list
price instead of the amount paid, the restock date instead of the backorder ship date. Once it created a
refund the policy forbids, after calling 9 October to 17 November "within the 30-day window". Qwen3 4B
usually answered after a single call, before it had the data, or announced a lookup and stopped.

A verifier that reads the full tool log and lets the agent rewrite its answer fixed nothing: a rewrite
cannot fetch the discount policy the agent never looked up. Sending the agent back to redo the task with
its tools after an ISSUES verdict did help a little.

Agent | Verifier | First attempt | After retry | Fixed | Broke

Gemma 4 E4B | Qwen3 4B | 21 / 30 | 22 / 30 | 2 | 1

Qwen3 4B | Qwen3 4B | 9 / 30 | 13 / 30 | 5 | 1

Gemma's retry looked up the policy and fixed the gold-member price and a backorder date, and broke a
total it had right, writing 308.97 as 30.97.

## Standard benchmarks

Public data sets on small samples, so they place the models against published numbers only
roughly. Each request was one chat message with thinking off.

Benchmark (items) | Gemma 4 E4B | Qwen3 4B | Qwen3 1.7B

GSM8K, maths word problems, chain of thought (50) | 70 % | 62 % | 56 %

IFEval, following format instructions (50) | 86 % | 86 % | 74 %

MMLU-Pro, knowledge and reasoning (28) | 61 % | 61 % | 43 %

HHEM, hallucination rate of summaries (200) | 0.5 % | 3.0 % | 3.0 %

RAGTruth, F1 as a critic (300) | 74 | 52 | 53

FACTS Grounding, long grounded answers, judged blind (50) | 82 % | 42 % | not run

FACTS Grounding asks for a long answer from a document of 300 to 3,000 words. A response
counts only if it addresses the request and every claim in it is supported by the document. The 114
distinct responses were judged blind against the FACTS criteria, each text once, with model and variant
hidden. Qwen3 4B adds what the document does not say: general knowledge about the topic, causes and
motives, hedged statements turned into facts. Gemma stays with the document.

The loop made Gemma's long answers worse: 82 % to 74 %. The critic flagged 16 of 50
answers, and the rewrites fixed 1 and broke 5. Most breaks are corrupted numbers, with digits doubled or
dropped:

grew 4444.7% (document: 44.7 %)
increased $23333.6 billion (document: $233.6 billion)
about 10 0 million MAUs (document: 100 million)

Seven of the 16 rewrites contain such a number, against 2 of the 50 first drafts, and none of Qwen3
4B's answers. The corrupted rewrites are not the longest inputs, so the cause is still open; it is the
first thing to check on the phone runtime.

## Time and compute

Model seconds per question. The loop costs 1.5 to 4.7 times one model, depending on how often
the critic objects.

Total

Runs with real models | 48

GPU time on one laptop RTX 3060 | 4.9 h

Model calls | 6,724

GPU energy (board power, logged every 5 s for the last runs, estimated before) | 0.35 kWh

Largest experiment: the grid, 14 combinations on 104 questions | 1.6 h

The whole project was built, run and analysed with Claude Code (Claude Opus 5.5) over one session of
about 7 hours, with 6 helper agents for independent reviews, the benchmark
scripts and the blind judging. That took 4.5 hours of active work, 523
model responses, 631 tool calls and about 838 thousand output tokens. Most
of the input was served from the prompt cache (158 million tokens read).

## What this means for the phone

- Work on the analyst first. A better prompt and a calculator did more than any critic.

- If there is a critic, use Gemma 4 E4B. It is the only critic tested that separates right answers from
wrong ones, it rarely asks for a rewrite, and the loop then costs 1.7 times one model.

- A critic pays off most behind a weak analyst: Gemma checking Qwen3 1.7B removed 6 of its 14
hallucinations.

- Check the numbers in every rewrite, and accept it only if every number appears in the document or the
draft.

- For agents, a verifier needs the tools. A rewrite from the log fixes nothing; a retry with the tools
fixes a few tasks.

## Next steps

- Port the loop to Android with LiteRT-LM and the same model files; measure latency, memory and battery,
and check whether the number corruption appears there.

- Larger test sets of 200 to 500 questions, so that differences of two or three answers can be told
apart from chance.

- Fine-tune a small critic (LoRA) on hallucination-detection data. The fine-tuned 13B detector in the
RAGTruth paper reached F1 79; a 1.7B critic with similar skill would be cheap to run on a phone.

- A rule-based number check after the rewrite.

- Trace inside Qwen3 (circuit tracing) why it flags nearly every answer.

## Limitations

The sets are small: 104 grounded questions, 30 agent tasks and 28 to 300 items per public benchmark, so
a difference of a few answers is within chance. The labels come from an AI labeller (Claude) working blind
and from grading rules written by the same author; the rules were checked against the blind labels and an
independent review, and every changed answer was read. Everything ran on one laptop GPU with greedy
decoding, so a phone may produce slightly different text. All prompts and documents are in English.

Code, data, prompts, every run and the full report:
github.com/Black-Lights/reflection-lab
(the full report is in its reports folder).
