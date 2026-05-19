.PHONY: help up down logs ps web-dev web-build web-install api-install fresh nuke

help:
	@echo "GeoCast — make targets"
	@echo ""
	@echo "  make web-install   pnpm install in apps/web"
	@echo "  make web-dev       pnpm dev in apps/web (Next.js on :3000)"
	@echo "  make web-build     pnpm build in apps/web"
	@echo ""
	@echo "  make up            docker compose up -d"
	@echo "  make down          docker compose down"
	@echo "  make logs          docker compose logs -f"
	@echo "  make ps            docker compose ps"
	@echo ""
	@echo "  make fresh         clean install everything"
	@echo "  make nuke          drop volumes + node_modules + vendor"

web-install:
	pnpm install

web-dev:
	pnpm dev

web-build:
	pnpm build

api-install:
	cd apps/api && composer install

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

fresh: web-install
	@echo "ready — run 'make web-dev'"

nuke:
	rm -rf apps/web/node_modules apps/web/.next node_modules
	rm -rf apps/api/vendor apps/api/var
	docker compose down -v
