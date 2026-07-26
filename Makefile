PROJECT ?=
SLUG ?=
AGENTS ?= claude,codex
SCENARIO ?= list-apps
RUNS ?= 1

.PHONY: init build app test smoke stress agent-smoke baseline-v1 surface-parity codex-ab check-docs check-repo ci release-package npm-build npm-publish new-history new-plan

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

surface-parity:
	node ./scripts/check-computer-use-surface-parity.mjs

codex-ab:
	node ./scripts/run-codex-computer-use-ab.mjs --scenario=$(SCENARIO) --repetitions=$(RUNS)

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
