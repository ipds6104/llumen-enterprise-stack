# ==============================================================================
# LLUMEN ENTERPRISE STACK - MAKEFILE AUTOMATION
# ==============================================================================

.PHONY: all help init up down restart logs health test saml dev clean

SHELL := /usr/bin/env bash

help:
	@echo "Available commands in Llumen Enterprise Stack:"
	@echo "  make init     - Initialize directories and cryptographically secure secrets (.env)"
	@echo "  make up       - Start production stack in background"
	@echo "  make down     - Stop all containers"
	@echo "  make restart  - Restart all containers"
	@echo "  make logs     - Stream aggregated logs from all services"
	@echo "  make health   - Audit container health statuses"
	@echo "  make test     - Run unit tests and governance checks"
	@echo "  make saml     - Start stack with SAML 2.0 federation overlay"
	@echo "  make dev      - Start stack with local development debug overlay"
	@echo "  make clean    - Remove build artifacts and temporary files"

init:
	@bash scripts/init-secrets.sh

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

health:
	@bash scripts/healthcheck.sh

test:
	@bash scripts/test-stack.sh

saml:
	docker compose -f docker-compose.yml -f docker-compose.saml.yml up -d

dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

clean:
	@rm -rf services/jit-provisioner/node_modules
	@echo "Cleaned build artifacts."
