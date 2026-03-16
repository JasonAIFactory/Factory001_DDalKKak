# DalkkakAI — Developer commands
# Usage: make <command>

.PHONY: dev test clean reset logs shell

## Start dev server (DB + Redis + API with hot reload)
dev:
	docker-compose up

## Run all tests (starts full stack, runs pytest, exits)
test:
	docker-compose --profile test up --abort-on-container-exit --exit-code-from test

## Stop all containers
stop:
	docker-compose down

## Reset everything — wipes the database
reset:
	docker-compose down -v
	docker-compose up

## Watch logs from running containers
logs:
	docker-compose logs -f api

## Open a shell inside the running API container
shell:
	docker-compose exec api bash
