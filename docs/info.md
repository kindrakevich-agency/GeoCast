# GeoCast — як це працює зсередини

Технічний документ для розробників. Описує систему від запиту користувача
до запису в БД, від підпису SIWE до клейму USDC у контракті на Base, і
все важливе між цими точками. Бойова версія працює на
[geocast.games](https://geocast.games); код у репозиторії
`github.com/kindrakevich-agency/GeoCast`.

---

## 1. Загальна архітектура

Система — це класична трирівнева вебзастосовка з двома додатковими
"крилами": реальний час через Pusher і опційний on-chain шар на Base.

![Архітектура GeoCast](architecture.png)

Фізично все живе в одному монорепозиторії, керованому `pnpm` workspaces:

```
apps/
  web/        Next.js 16 · TypeScript · Tailwind 4 · MapLibre · wagmi
  api/        Symfony 7.4 · API Platform · Doctrine · Lexik JWT
contracts/    Foundry · OpenZeppelin · GeoCastPool.sol
infra/        Nginx, скрипти, Caddyfile (для майбутнього SSL)
docs/         Документація + скріншоти + Mermaid-діаграма
```

Деплой — один SSH-крок у GitHub Actions після того, як проходять
typecheck + сборка + контейнерний lint + `composer validate`. Усе крутиться
на одному Hetzner-боксі (Ubuntu 24.04 + aaPanel), Cloudflare стоїть перед
nginx як CDN/проксі/TLS-термінатор.

---

## 2. Модель даних

Три ключові сутності, всі з ULID як первинним ключем (часово-сортовані,
конкатенуються в індексах краще за UUID v4, але без блокувань
автоінкременту).

### `users`

```
id              ULID
wallet_address  varchar(42) UNIQUE (lowercase, з префіксом 0x)
credits_balance int  default 100
games_played    int  default 0
total_score     double  default 0
is_admin        bool default false
created_at      datetime
```

Один користувач = одна Ethereum-адреса. Жодних email, паролів, OAuth.
`total_score` — кумулятивна сума `1/(1 + distance_km)` по всіх
розв'язаних раундах; вона ж і основа для all-time лідерборду в Redis.

### `rounds`

```
id                ULID
number            int UNIQUE  -- лічильник, видимий гравцям
question          varchar(280)
description       text NULL
opens_at          datetime
closes_at         datetime
resolves_at       datetime
status            enum('scheduled','open','closed','resolved')
answer_lat        double NULL  -- виставляється при resolve()
answer_lng        double NULL
total_participants int
pool_credits      int
on_chain_root     varchar(66) NULL  -- Merkle root (v2)
```

Один активний раунд за раз — це свідоме обмеження продукту, а не БД.
Стани змінюються кроном `app:rounds:tick` (хвилинний інтервал) на основі
поточного часу: `scheduled → open` при досягненні `opens_at`,
`open → closed` при `closes_at`.

### `predictions`

```
id                ULID
user_id           FK → users.id
round_id          FK → rounds.id
coords            POINT SPATIAL (SRID 4326)
credits_staked    int default 1
distance_km       double NULL  -- виставляється при resolve()
rank              int NULL
payout            int default 0
placed_at         datetime
```

Ключове: `coords` — це нативний `SPATIAL POINT` MariaDB з прив'язкою до
SRID 4326 (WGS84). Тоді ранжування на резолюції — це один запит:

```sql
UPDATE predictions
SET distance_km =
    ST_Distance_Sphere(coords, POINT(:answer_lng, :answer_lat)) / 1000
WHERE round_id = :round_id;
```

Унікальний індекс `(user_id, round_id)` гарантує одну ставку на раунд.
Просторовий індекс на `coords` поки що не задіяний у запитах, але
закладений на майбутнє (наприклад, "хто був найближче до Києва в усіх
раундах разом").

---

## 3. Аутентифікація: SIWE → JWT

GeoCast використовує EIP-4361 (Sign-In with Ethereum). Жодних бібліотек
"з коробки" — реалізація своя на чотирьох примітивах.

### Послідовність

1. **Клієнт → POST `/api/auth/nonce`** з тілом `{ address }`. Сервер
   генерує криптостійкий nonce (32 символи base32), кладе його в Redis
   з ключем `geocast:siwe:nonce:<address>` і TTL 5 хвилин. Повертає
   `{ nonce, address, expiresIn }`.

2. **Клієнт будує EIP-4361 повідомлення** (`apps/web/src/lib/auth-context.tsx`,
   функція `buildSiweMessage`):

   ```
   geocast.games wants you to sign in with your Ethereum account:
   0x7f4c2b…

   Sign in to GeoCast — daily geo-prediction game.

   URI: https://geocast.games
   Version: 1
   Chain ID: 84532
   Nonce: V8FUHWPASU68HQWMQF32WZKU4UN56VAV
   Issued At: 2026-05-20T10:00:00.000Z
   Expiration Time: 2026-05-20T10:05:00.000Z
   ```

3. **Гаманець підписує** через `wagmi.signMessage`. Це не raw-підпис —
   gмаманець обгортає повідомлення префіксом `"\x19Ethereum Signed Message:\n<len>"`,
   рахує Keccak-256, і вже над цим хешем виконує ECDSA на secp256k1.

4. **Клієнт → POST `/api/auth/verify`** з `{ message, signature }`.
   Сервер:

   - Парсить SIWE (`SiweMessageParser`) — все робиться регулярками,
     без зовнішніх SIWE-бібліотек (siwe v3 зламала зворотну сумісність
     з v2, простіше тримати парсер на 60 рядках регулярок).
   - Перевіряє `Chain ID` за allowlist'ом
     (`SIWE_ALLOWED_CHAIN_IDS` у `.env.local`).
   - Перевіряє `Expiration Time`.
   - Витягує nonce з Redis (DEL з тим самим викликом, тобто single-use),
     порівнює з тим, що в повідомленні, через `hash_equals`.
   - Відновлює адресу з підпису (`SiweVerifier::recoverAddress`):

     ```
     digest = keccak256("\x19Ethereum Signed Message:\n" + len(msg) + msg)
     (r, s, v) = розпарсений підпис
     publicKey = secp256k1.recoverPubKey(digest, {r, s}, v - 27)
     address = "0x" + lower(keccak256(publicKey.x || publicKey.y)[12:])
     ```

     Це канонічна Ethereum-операція `ecrecover` чистим PHP через
     `simplito/elliptic-php`. Виглядає драматично, але по факту
     ~30 рядків.

   - Якщо `lower(recovered) === lower(claimed)` — успіх. Інакше — 401.

5. Сервер знаходить/створює `User`, генерує JWT через Lexik
   (`HS512`, TTL 30 днів — після короткого 1h-вікна користувачі скаржилися
   на постійні re-логіни), повертає `{ token, user }`.

6. Подальші запити несуть `Authorization: Bearer <jwt>`. JWT-валідатор
   у Symfony перевіряє підпис і витягує `walletAddress`, який далі
   використовується ApiSecurityVoter для перевірки `is_admin`.

### Чому JWT, а не сесії

Stateless — фронтенд може кешувати токен у localStorage, REST API ходить
тільки за token-header'ом, нема Sticky-Session проблеми, бекенд можна
масштабувати горизонтально без Redis-сесій. Мінус: токен анулювати
складно. Це портфоліо — компроміс прийнятний.

---

## 4. Активний раунд — клікнув пін → постав ставку

### Сценарій (Branch B — кредитний)

1. Користувач відкриває `/play`. Сторінка — SSR-редірект на
   `/rounds/{current_ulid}` через `apps/web/src/app/play/page.tsx`,
   який бере поточний раунд з `GET /api/rounds/current`.

2. Сторінка раунду
   (`apps/web/src/app/rounds/[id]/page.tsx`) — це full-screen MapLibre
   полотно (Carto Dark Matter, без API-токена), поверх якого летять
   glassmorphic-панелі. Курсор — кросхейр, рендериться через
   власний CSS `cursor: url(...)`.

3. При hydraion'і:
   - `useCurrentRound()` — fetch `/api/rounds/current`
   - `useRoundPins(id)` — fetch `/api/rounds/{id}/pins` (анонімізована
     агрегація пінів для теплової карти)
   - `useEffect` на `/api/rounds/{id}/my-prediction` — щоб ре-гідрувати
     вже поставлений пін після перезавантаження сторінки
   - Підписка на канали Pusher: `round-{id}` (публічний) і
     `presence-round-{id}` (для курсорів).

4. Клік по карті:
   - Mapbox/MapLibre дає координати в EPSG:3857; ми перетворюємо в
     lat/lng через стандартний viewport.
   - Відкривається `ConfirmModal` з координатами і ціною ("1 credit").

5. Підтвердження → `POST /api/rounds/{id}/predictions` з `{ lat, lng }`.

6. Сервер (`PredictionsController::place`):
   - Перевіряє статус раунду (`open` + `now < closes_at`).
   - Перевіряє баланс (`credits_balance >= 1`).
   - В одній транзакції: створює `Prediction`, інкрементує
     `round.total_participants` і `round.pool_credits`, декрементує
     `user.credits_balance`.
   - Якщо в БД вже є запис `(user, round)` — кидає 409 Conflict
     (юнік-індекс).
   - Через `PusherBroadcaster` шле
     `round-{id}` → `pin-placed` з `{ count, pool }`.
   - Повертає клієнту `{ prediction, pool, participants, balance }`.

7. Клієнт:
   - Малює пін з spring-аnimation (`Framer Motion`).
   - Викликає триплет ripple-кіл, що розширюються і fade-out.
   - Відкриває `SidePanel` ("Your pin · locked in").
   - Розкриває теплову карту інших пінів (раніше прихована до коміту).

### Стани UI

- **before**: курсор-кросхейр + bottom-hint "Click anywhere on the map"
- **submitting**: bottom-hint "approving USDC…" / "placing pin…"
- **placed**: SidePanel слайд-ін праворуч, bottom-hint "awaiting resolution"
- **resolved**: див. секцію 6

---

## 5. Реальний час: Pusher Channels

Три типи каналів. Безкоштовний тариф Pusher (Sandbox) дає 100 паралельних
з'єднань і 200k повідомлень/день — більш ніж достатньо для портфоліо.

### Публічний `round-{id}`

Сервер пушить:

- **`pin-placed`** `{ count, pool }` — щоразу, коли хтось ставить пін.
  Клієнт оновлює лічильник "247 explorers playing" і викликає
  `setPinFetchKey(n => n+1)`, щоб перетягнути теплову карту.

- **`round-resolved`** `{ answer: {lat, lng} }` — після того, як
  адмін розв'яже раунд. Клієнт запускає choreography: камера `flyTo`
  на answer, малює лінію great-circle, показує distance-badge,
  висовує leaderboard, кидає конфетті при top-10.

### Presence `presence-round-{id}`

Pusher Presence потребує авторизаційного endpoint — у нас це
`POST /api/pusher/auth` (`PusherAuthController`). Контролер бере
`channel_name + socket_id` з тіла, перевіряє що канал стосується
поточного користувача (за JWT), і повертає HMAC-підписану відповідь
для Pusher SDK.

Через `client-cursor-move` (client event, серверу не видно) гравці
шлють one-другому координати курсорів на карті. На клієнті
`usePresenceCursors` тротлить це до 5 повідомлень/с, рендерить
як маленькі пульсуючі точки з ніком (truncated wallet) над ними.

Це **головний wow-фактор**: гравець розуміє, що грає НЕ один,
зараз, у реальному часі.

### `leaderboard`

Шле `leaderboard-updated` `{ updatedAt }` після кожної резолюції.
Клієнт ловить його, інвалідує `react-query` кеш лідерборду,
підвантажує свіже.

---

## 6. Резолюція та scoring

### Адмін-флоу

1. Адмін заходить на `/admin/round/{id}`.
2. Вбиває локацію у поле "Answer location" — позаду стоїть Nominatim
   (OpenStreetMap) геокодер; адмін бачить пропозиції з координатами і
   countryHint'ом.
3. Натискає "Resolve". Фронт постить
   `POST /api/admin/rounds/{id}/resolve` з `{ answer_lat, answer_lng }`.

### Сервер (`ResolveRoundService::resolve`)

В одній транзакції:

1. `SET round.status = 'resolved'`, виставляє answer_lat/lng + resolved_at.
2. Один SQL UPDATE рахує дистанції для всіх пінів через
   `ST_Distance_Sphere`.
3. Ранжує (`ORDER BY distance_km ASC LIMIT N`), розставляє `rank` в
   циклі.
4. Рахує `payout` за формулою:

   ```
   raw_score_i = 1 / (1 + distance_i)
   payout_i    = floor(pool * raw_score_i / sum(raw_score))
   ```

   Що дає: найближчий пін отримує найбільшу частку, але не 100%.
   Пін за 2000 км все одно дістає копійки — long-tail дружня крива,
   яка тримає casual-гравців на гачку. Сумарні виплати ≤ pool
   (різниця залишається в "протокольному відрі").

5. Інкрементує `user.games_played += 1`, додає `raw_score_i` до
   `user.total_score`, додає `payout_i` до `user.credits_balance`.

6. Оновлює три Redis ZSET'и:
   - `geocast:leaderboard:today:<YYYYMMDD>` (TTL 48h)
   - `geocast:leaderboard:week:<YYYYWW>` (TTL 14d)
   - `geocast:leaderboard:all` (без TTL)

   Скор ZADD'иться як `total_score` юзера, member — wallet address.
   `ZREVRANGE 0 99 WITHSCORES` дає лідерборд за O(log N).

7. Через Pusher шле `round-{id} → round-resolved` всім підписникам
   і `leaderboard → leaderboard-updated` всім, хто на сторінці лідерборду.

Уся транзакція займає кілька секунд для тисячі ставок (профілювали
локально); основний час — це SQL `UPDATE … SET distance_km = ST_…`.

---

## 7. Лідерборди та Redis

ZSET — це sorted set: набір унікальних members зі скорами, який
сортується за скорами в фоні. Операції — O(log N).

Три ZSET'и:

- **`geocast:leaderboard:all`** — кумулятивний `total_score` за всю
  історію. Скор зростає монотонно. Це і є "пожиттєвий" лідерборд.

- **`geocast:leaderboard:week:<W>`** — те саме, але ключ містить
  номер ISO-тижня. Перехід тижня = новий ключ. TTL 14 днів, тобто
  попередній тиждень доступний ще тиждень для UX-плавності.

- **`geocast:leaderboard:today:<YMD>`** — те саме за добу. TTL 48h.

Фронтенд тягне:

```
GET /api/leaderboard?period=today|week|all
→ top 100 з потрібного ZSET
```

При резолюції — atomic `ZADD` на всі три, з тим же скором (delta).
Атомарність важлива: ми не хочемо, щоб two-tab-юзер бачив рядок у
тижневому, але не в добовому.

---

## 8. On-chain v2: GeoCastPool на Base Sepolia

Окрема гілка — не залежить від кредитного флоу. Активується, коли в
`.env` фронтенда виставлені `NEXT_PUBLIC_GEOCAST_POOL_ADDRESS` і
`NEXT_PUBLIC_GEOCAST_USDC_ADDRESS`. Без них фронтенд просто не
показує on-chain UI.

### Контракт `GeoCastPool.sol`

~300 рядків Solidity 0.8.24. Залежності — `@openzeppelin/contracts`
(SafeERC20, MerkleProof, AccessControl).

Ключові константи:

```solidity
uint256 public constant BET = 1e6;          // 1 USDC у мікро-USDC
uint256 public constant RAKE_BPS = 500;     // 5% до treasury
uint256 public constant COORD_SCALE = 1e6;  // lat/lng у мікро-градусах
```

### Commit-reveal анти-чит

Стандартний приклад: якщо просто транслювати в блокчейн `(lat, lng)`,
будь-який спостерігач mempool'а побачить кращі пози чужих ставок до
того, як їхній блок включить, і копіпастне в свою транзакцію з більшим
gas. Тому розділимо в часі обіцянку і розкриття:

1. **`commitBet(roundId, bytes32 commit)`** — гравець шле transferFrom
   1 USDC і записує:
   ```
   commit = keccak256(abi.encodePacked(player, lat, lng, salt))
   ```
   Контракт зберігає commit у мапі `roundCommits[roundId][player]`.

2. **`reveal(roundId, lat, lng, bytes32 salt)`** — після того, як вікно
   ставок закрилось. Контракт рахує `keccak256(...)` і порівнює з
   обіцянкою. Якщо збігається — пара (player, lat, lng) фіксується в
   `roundReveals`. Якщо ні — revert.

3. Salt живе у `localStorage` користувача
   (`apps/web/src/lib/onchain/commit.ts`). Якщо переїхали браузер, або
   очистили storage — пін не розкриєш, USDC спалена. Це сам собою
   обмеження UX, але інакше commit-reveal не працює.

### Merkle-drop резолюція

Чому не платити on-chain з контракту по таблиці виплат? Бо це
квадратичне газове споживання. Замість того:

1. Адмін викликає `resolve(roundId, lat, lng, bytes32 merkleRoot)`.
2. Контракт зберігає answer + root, нічого не платить.
3. Лист дерева — `keccak256(bytes.concat(keccak256(abi.encode(player, amount))))`
   (подвійний keccak, sorted-pair encoding — щоб збігалося з
   OZ `MerkleProof.verify`).
4. Гравець викликає `claim(roundId, amount, bytes32[] proof)`. Контракт
   будує лист на льоту, верифікує через MerkleProof, відмічає в
   `claimed[roundId][player] = true`, переказує USDC.

Газ-вартість резолюції стає O(1) для контракту і O(N) для off-chain
білдера. Гравці платять O(log N) на кожен клейм — це норма.

### Off-chain settler (`MerkleBuilder`)

`apps/api/src/Service/Onchain/MerkleBuilder.php` робить:

1. Тягне з БД revealed-піни цього раунду.
2. Рахує `distance_km`, `raw_score`, `payout` (та сама математика, що в
   кредитному флоу — `1/(1+d)`).
3. Хешує листя:
   `keccak256(bytes.concat(keccak256(abi.encode(player, amount))))`.
4. Будує дерево парами, sorted-pair: на кожному рівні пара хешів
   сортується лексикографічно перед хешуванням разом.
5. Повертає `{ root, proofs: {player → bytes32[]} }`.

Корінь дерева адмін постить в контракт через `resolve()`. Доказ
(`proof[]`) і `amount` віддаються гравцеві через
`GET /api/rounds/{id}/claim-proof` (auth-required, повертає тільки
доказ для цього гаманця).

PHPUnit покриває чотирма тестами: один-лист дерево, два листи,
непарна кількість, перевірка proof-структури.

### Event mirror (`OnchainSync`)

Symfony-команда `app:onchain:sync` (cron, кожні 5 хвилин):

1. Тягне з БД останній оброблений `block_number` з таблиці `onchain_sync`.
2. Робить JSON-RPC `eth_getLogs` на ноді (Alchemy Base Sepolia) у вікнах
   до 1000 блоків (limit безкоштовного тарифу).
3. Чекає 2 confirmations.
4. Декодує events: `Committed`, `Revealed`, `Resolved`, `Claimed`.
5. Записує в `onchain_events` з `UNIQUE(chain_id, block_number, log_index)`
   — ідемпотентно.
6. Може ретригернути off-chain settler, якщо побачив новий `Resolved`.

`EthRpcClient` — мінімальний JSON-RPC клієнт через Symfony HttpClient,
два методи: `blockNumber()` і `getLogs(filter)`. Не `final`, бо
PHPUnit не вміє мокати final-класи.

`EventDecoder` пам'ятає topic0 для кожного event'а як `keccak256("EventName(types,...)")`,
розкодовує `int32` для lat/lng з sign-extension, `uint256` через GMP.
Покритий тестами.

### Чому Base, чому Sepolia

- **Base** — L2 від Coinbase, ~$0.001 за транзакцію, EVM-сумісний.
  Юзери з Coinbase Wallet там вже є за замовчуванням.
- **Sepolia** як testnet — Coinbase роздає тестові USDC через CDP
  Portal (https://portal.cdp.coinbase.com/).
- **Альтернативи**: Arbitrum, Optimism. Base виграв за моментальною
  інтеграцією Coinbase Wallet та офіційними Circle-розгортанням USDC.

### Гонорар (rake)

5% від кожної ставки переказується на `treasury` (Safe-адреса). У
портфоліо-режимі це фіктивний Safe, але архітектурно вирішує реальну
бізнес-задачу: монетизація без зміни UX гравця.

---

## 9. wagmi конфіг — нюанси

`apps/web/src/lib/wagmi.ts` — навмисно вузький список ланцюгів:
`[base, baseSepolia]`. Спокуса додати mainnet + Polygon + Optimism, щоб
ENS-імена резолвилися — погана: RainbowKit + TanStack Query пулять
**кожен** ланцюг RPC у фоні (баланси, ENS, chain ID), безкоштовний
`ethereum-rpc.publicnode.com` починає віддавати 429, далі backoff-loop,
далі повний браузер console залитий помилками.

ENS-імена в UI ніде не показуються (гаманець завжди як `0x7f…a3b`),
тому втрата нульова. Якщо гаманець ввімкнено на іншій мережі — wagmi
покаже банер "wrong network" з кнопкою switch.

`SIWE_ALLOWED_CHAIN_IDS` на бекенді ширший
(`1, 8453, 84532, 137, 10, 42161, 11155111`) — щоб user міг підписатись
з будь-якої поширеної мережі, а не лише з Base.

---

## 10. Інфраструктура та деплой

### Hetzner + aaPanel

Один Ubuntu 24.04 бокс. aaPanel — це панель керування веб-серверами
(аналог cPanel/ISPmanager, але з нативною підтримкою PHP 8.3 FPM +
Node.js project manager). Всі шляхи мають префікс `/www/wwwroot/<domain>`
і `/www/server/...`.

Сервер ділиться з двома іншими проектами (Tripsquick, Settle); конфіги
не перетинаються — кожен vhost в окремому файлі
(`/www/server/panel/vhost/nginx/<domain>.conf`).

### Cloudflare

DNS + проксі + Universal SSL. Origin-сертифікат від CF (15-річний)
встановлений на сервері. CF-режим — Full (Strict не пройде, бо
GeoCast і Tripsquick використовують один cert, але CF не вимагає
точного збігу імен в Full-режимі).

Перед роботою з CF вимикається **Bot Fight Mode** AI block (інакше
GPTBot, ClaudeBot та інші легітимні скрейпери блокуються).

### GitHub Actions CI/CD

`.github/workflows/ci.yml` — три джоби:

1. **frontend** — `pnpm install --frozen-lockfile`, typecheck, build.
2. **php** — `composer validate`, `composer install`, `lint:yaml`,
   `lint:container`, PHPUnit (якщо є тести).
3. **deploy** — залежить від обох + `if: push && main`. Через
   `appleboy/ssh-action` коннект до сервера, виконання:

   ```
   git reset --hard origin/main
   cd apps/api && composer install --no-dev --optimize-autoloader
   APP_ENV=prod bin/console cache:clear --no-warmup
   APP_ENV=prod bin/console cache:warmup
   APP_ENV=prod bin/console doctrine:migrations:migrate --no-interaction
   /etc/init.d/php-fpm-83 restart   # обов'язково, бо opcache.validate_timestamps=0
   cd ../web && rm -rf .next
   NEXT_PUBLIC_API_URL=https://geocast.games/api pnpm --filter ./apps/web build
   fuser -k -n tcp 3010   # вбити старий next-server, який тримає сокет
   bash /www/server/nodejs/vhost/scripts/geocast.sh
   ```

   `--webpack` прапор примусово використовує webpack-білдер, бо
   Turbopack-SSR має баг із orphan-чанками, які HTML не підв'язує
   `<script>`-тегом.

### Прикурена логіка деплою

- **Чистка `.next` перед кожною збіркою** — Turbopack/webpack кеші вже
  кілька разів давали stale-chunk SSR баги.
- **`fuser -k -n tcp 3010`** замість kill-by-PID — PID-файл стає
  stale, якщо Node стартував поза aaPanel-скриптом; вбиваємо власника
  сокета напряму.
- **PHP-FPM `restart`, не `reload`** — opcache в проді з
  `validate_timestamps=0`, reload не перечитує новий PHP-код.

---

## 11. SEO та "видимість для роботів"

Програмні іконки + OG через `next/og`:

- **`app/icon.tsx`** — 32×32 favicon, рендерить SVG-пін на градієнтному
  тлі через ImageResponse при білді.
- **`app/apple-icon.tsx`** — 180×180 для iOS.
- **`app/opengraph-image.tsx`** — статичний 1200×630 з логотипом і
  тагліном.
- **`app/rounds/[id]/opengraph-image.tsx`** — **динамічний** OG, який
  fetch'ить раунд на час запиту і вбудовує в зображення сам текст
  питання + countdown + status-pill. Шарування лінка раунду в
  Twitter/Discord одразу показує превʼю з реальним станом гри.

JSON-LD: на лендінгу три блоби — `WebSite`, `Organization`, `FAQPage`
(зчитуються Google для rich-results FAQ-accordion).

`robots.ts` блокує `/admin`, `/api`, `/me`. `sitemap.ts` віддає три
публічні URL'и. `manifest.ts` дає Android встановлюваність.

Cloudflare має окрему опцію `is_robots_txt_managed` — вона
**вимкнена**, інакше CF переписує `robots.txt` своїм managed-контентом
з `Disallow: /` для GPTBot/ClaudeBot/etc, і власний `robots.ts` не
доходить до користувача.

---

## 12. Архітектурні рішення і трейд-офи

- **ULID замість UUIDv4** — часово-сортовані, краще лягають у B-tree
  індекси MariaDB (insertion locality), людинозчитувані під час
  дебагу. Один мінус: тригерний пакет
  `symfony/uid` дає API трохи косу збоку Doctrine — поки що
  закладено власну ULID-логіку в Entity'ях.

- **SPATIAL POINT + ST_Distance_Sphere** замість Haversine в PHP —
  ранжування тисячі пінів в SQL ~30мс, у PHP-циклі — секунди. Плюс
  отримуємо безкоштовний просторовий індекс.

- **Redis ZSET для лідерборду** — read-throughput ~100к/с одного
  Redis-вузла, ZREVRANGE за O(log N). MariaDB з ORDER BY на тих самих
  даних — повільніше і ламає кеш-локальність.

- **Pusher замість self-hosted WebSocket** — портфоліо-вимоги
  диктують не випʼячувати інфраструктуру: один сервіс, його тариф
  достатній, не доводиться розгортати Centrifugo чи Soketi. На
  справжньому продукті — Centrifugo з власним хостингом.

- **JWT 30 днів замість 1 година** — короткий TTL давав zombie-state
  після переходу через нічну зміну часу: stale-token → 401 на
  кожному запиті → API-client не міг розрізнити "non-auth" і
  "auth-expired". 30 днів + auto-clear на 401 у `apiFetch` працює
  чисто.

- **Doctrine `IDENTITY(p.user) = :userId`** замість `p.user = :user`
  для ULID — Doctrine `UlidType` не байндить інстанс прозоро в DQL,
  доводиться розбивати на колонку + явний type. Виявилось після того,
  як `findPagedForUser` повертала нуль рядків в проді (юзер є, ставки
  є, JOIN порожній).

- **`next build --webpack`** замість Turbopack — Turbopack 16.2 ще
  емітить orphan SSR-чанки, які `<script>`-тегом не підвʼязуються,
  і хуки не виконуються (виглядає як SSR-only сторінка з мертвими
  обробниками).

---

## 13. Сторонні залежності, які варто знати

### PHP (apps/api/composer.json)

- `symfony/*` — фреймворк
- `api-platform/core` — REST endpoints + OpenAPI
- `doctrine/orm` (3.x) + `doctrine/dbal` (3.x)
- `lexik/jwt-authentication-bundle` — JWT
- `predis/predis` — Redis-клієнт без розширення `ext-redis`
- `pusher/pusher-php-server` — Pusher SDK
- `kornrunner/keccak` + `simplito/elliptic-php` — Keccak-256 + secp256k1
- `phpseclib/mcrypt_compat` — bigint-операції для GMP

### TypeScript (apps/web/package.json)

- `next@^16.2.6`, `react@^19.2.0`
- `tailwindcss@^4` — нова версія з CSS-першим конфігом
- `maplibre-gl` + `react-map-gl` (без mapbox-токена)
- `framer-motion` для анімацій
- `wagmi@^2` + `viem@^2` + `@rainbow-me/rainbowkit`
- `pusher-js`
- `siwe` (npm) — поки що тільки для типів; повідомлення будуємо власним
  `buildSiweMessage`
- `@tanstack/react-query` — кеш HTTP-запитів

### Solidity (contracts/foundry.toml)

- `@openzeppelin/contracts@5` — SafeERC20, MerkleProof, AccessControl
- Foundry для збірки/тестів (`forge build`, `forge test`)

---

## 14. Як читати код

Якщо це твоя перша година з кодовою базою — рекомендований шлях:

1. `CLAUDE.md` — продуктова специфікація і скоуп
2. `README.md` — як запустити локально + якоюсь архітектурою
3. `apps/api/src/Service/Siwe/SiweVerifier.php` — серце автентифікації
4. `apps/api/src/Service/Resolve/ResolveRoundService.php` — резолюція раунду
5. `apps/web/src/app/rounds/[id]/page.tsx` — фронт активного раунду
6. `contracts/src/GeoCastPool.sol` — v2 on-chain
7. `apps/api/src/Service/Onchain/MerkleBuilder.php` — off-chain settler
8. `.github/workflows/ci.yml` — як проект потрапляє в прод

Все інше — деталі цих восьми вузлів.

---

*Документ актуальний станом на 2026-05-20. Для змін —
див. `git log -- docs/info.md`.*
