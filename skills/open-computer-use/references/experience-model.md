# Reusable Experience Model

Read this reference when turning Computer Use test results into reusable agent guidance or reviewing whether an existing experience is too broad.

## Principle

Store experience as conditional decision support, not as a replay script. The model must still observe the current UI, choose the next action dynamically, and verify what changed.

## Experience Entry

Record:

- **ID and status:** observation, hypothesis, locally validated, or cross-context validated.
- **Scope:** agent host, model when relevant, operating system, app and version, tool path, and UI conditions.
- **Trigger:** the signals that make the experience relevant.
- **Observed failure:** what happened, without an unsupported cause.
- **Recommended strategy:** a preferred decision or action and why it fits.
- **Expected evidence:** what should change if the strategy works.
- **Recovery boundary:** when to re-plan, stop, or ask for help.
- **Counterconditions:** situations where the experience must not be applied.
- **Regression evidence:** test IDs, repetitions, and observed outcomes.

## Promotion

1. Record a new result as an observation.
2. Reproduce it before treating the proposed cause as a hypothesis.
3. Validate the strategy in a fresh session with the original failure case.
4. Keep it local to the observed platform or app until varied cases support broader scope.
5. Promote it to cross-context experience only when it survives relevant UI, app, platform, or agent variation.

If two validated experiences conflict, preserve both with narrower preconditions. Do not hide variation behind one universal instruction.

## Placement

Keep stable safety, authorization, and evidence boundaries in `SKILL.md`. Put detailed browser, application, platform, or business experience in separate reference files and link them directly from `SKILL.md` for progressive disclosure.
