PROJECT ?=
SLUG ?=
AGENTS ?= claude,codex
SCENARIO ?= list-apps
RUNS ?= 1
CANDIDATE ?= v1.2
CLAUDE_COMMAND ?= claude
CLAUDE_SETTINGS ?= ~/.claude/settings.json
CLAUDE_MODEL ?= deepseek-v4-flash

.PHONY: init build app test smoke stress agent-smoke baseline-v1 baseline-v11 surface-parity adaptation-check app-agent-check codex-plugin-install-check codex-ab claude-harness v12-calibration v12-acceptance check-docs check-repo ci release-package npm-build npm-publish new-history new-plan

init:
	@if [ -z "$(PROJECT)" ]; then echo "用法: make init PROJECT=项目名"; exit 1; fi
	./scripts/init-project.sh "$(PROJECT)"

build:
	swift build

app:
	./scripts/build-open-computer-use-app.sh debug

test:
	swift test

smoke:
	./scripts/run-tool-smoke-tests.sh

stress:
	./scripts/run-tool-stress-tests.sh

agent-smoke:
	node ./scripts/run-agent-smoke-tests.mjs --agents=$(AGENTS) --scenario=$(SCENARIO)

baseline-v1:
	node ./scripts/check-ocu-v1-baseline.mjs

baseline-v11:
	node ./scripts/check-ocu-v11-frozen-baseline.mjs

surface-parity:
	node ./scripts/check-computer-use-surface-parity.mjs

adaptation-check:
	swift build -c release --product OpenComputerUse
	node ./scripts/check-agent-adaptation.mjs
	node ./scripts/test-claude-hook-guard.mjs

app-agent-check:
	./scripts/build-open-computer-use-app.sh debug
	node ./scripts/check-app-agent-singleton.mjs

codex-plugin-install-check:
	./scripts/check-codex-plugin-install.sh

codex-ab:
	node ./scripts/run-codex-computer-use-ab.mjs --candidate=$(CANDIDATE) --scenario=$(SCENARIO) --repetitions=$(RUNS)

claude-harness:
	node ./scripts/run-codex-computer-use-ab.mjs --arms=claude --candidate=$(CANDIDATE) --scenario=$(SCENARIO) --repetitions=$(RUNS) --claude-command="$(CLAUDE_COMMAND)" --claude-settings="$(CLAUDE_SETTINGS)" --claude-model="$(CLAUDE_MODEL)"

v12-calibration:
	node ./scripts/run-ocu-v12-acceptance.mjs --repetitions=3 --timeout-ms=90000 --allow-dirty=true

v12-acceptance:
	node ./scripts/run-ocu-v12-acceptance.mjs --repetitions=5 --timeout-ms=90000

check-docs:
	./scripts/check-docs.sh

check-repo:
	./scripts/check-docs.sh
	./scripts/check-repo-hygiene.sh

ci:
	./scripts/ci.sh

release-package:
	./scripts/release-package.sh

npm-build:
	node ./scripts/npm/build-packages.mjs

npm-publish:
	node ./scripts/npm/publish-packages.mjs

new-history:
	@if [ -z "$(SLUG)" ]; then echo "用法: make new-history SLUG=变更名"; exit 1; fi
	./scripts/new-history.sh "$(SLUG)"

new-plan:
	@if [ -z "$(SLUG)" ]; then echo "用法: make new-plan SLUG=计划名"; exit 1; fi
	./scripts/new-exec-plan.sh "$(SLUG)"
