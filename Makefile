PID_FILE := .dev.pid
LOG_FILE := .dev.log

.PHONY: dev stop format check test scraper gb-readings gb-beta

# Start the Vite dev server in the background (own process group, so stop kills it all)
dev:
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Dev server already running (PID $$(cat $(PID_FILE)))"; \
	else \
		setsid pnpm dev > $(LOG_FILE) 2>&1 & echo $$! > $(PID_FILE); \
		for i in $$(seq 60); do \
			grep -q "Local:" $(LOG_FILE) && break; \
			kill -0 $$(cat $(PID_FILE)) 2>/dev/null || break; \
			sleep 0.5; \
		done; \
		if grep -q "Local:" $(LOG_FILE); then \
			echo "Dev server started (PID $$(cat $(PID_FILE))), logs in $(LOG_FILE)"; \
			grep -m1 "Local:" $(LOG_FILE); \
		else \
			echo "Dev server did not start, last logs:"; \
			tail -n 20 $(LOG_FILE); \
			rm -f $(PID_FILE); \
		fi; \
	fi

# Stop the dev server started by `make dev`
stop:
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		kill -- -$$(cat $(PID_FILE)); \
		echo "Dev server stopped"; \
	else \
		echo "No dev server running"; \
	fi
	@rm -f $(PID_FILE)

# Format every file with Prettier
format:
	pnpm format

# Verify formatting, lint, types and tests without changing anything
check:
	pnpm format:check
	pnpm lint
	pnpm exec tsc -b
	pnpm test

# Run unit tests
test:
	pnpm test

# Scrape the official wiki into data/ (ARGS="--limit 10" for a sample, "--offline" to re-parse the cache)
scraper:
	GAME_VERSION=$(GAME_VERSION) pnpm scrape $(ARGS)

# Great Building bonuses beyond level 80 from foe-assistant.com into data/ (after the scraper)
gb-readings:
	pnpm gb-readings

# Great Buildings of the beta server (prestige rework) from a capture cleaned by
# `pnpm har-extract <file.har> beta` into data/ (after the scraper)
gb-beta:
	pnpm gb-beta
