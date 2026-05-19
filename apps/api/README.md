# GeoCast API (apps/api)

**Status:** stub. Skeleton + `composer.json` are laid down to lock in
the structure. No endpoints exist yet — the UI runs against mocked
data in `apps/web/src/lib/mock.ts`.

Real implementation comes after the active-round + landing +
resolution UIs are visually locked in. See [`../../CLAUDE.md`](../../CLAUDE.md)
for the full API spec.

## When backend phase starts

```bash
cd apps/api
composer install
cp ../../.env.example ../../.env   # then edit
bin/console doctrine:database:create
bin/console doctrine:migrations:migrate
php -S 0.0.0.0:8000 -t public
```
