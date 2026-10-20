PID_FILE := .dev.pid
LOG_FILE := .dev.log

.PHONY: dev stop

# Start the Vite dev server in the background (own process group, so stop kills it all)
dev:
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Dev server already running (PID $$(cat $(PID_FILE)))"; \
	else \
		setsid pnpm dev > $(LOG_FILE) 2>&1 & echo $$! > $(PID_FILE); \
		sleep 2; \
		echo "Dev server started (PID $$(cat $(PID_FILE))), logs in $(LOG_FILE)"; \
		grep -m1 "Local:" $(LOG_FILE) || true; \
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
