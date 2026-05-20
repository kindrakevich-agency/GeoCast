<?php

use App\Kernel;

// HTTP counterpart to bin/console's timezone pin. The shared FPM pool's
// /www/server/php/83/etc/php.ini sets date.timezone = Europe/Berlin (the
// box's locale), but every datetime we store, broadcast, and sign on-chain
// must be UTC for round opens_at / closes_at to mean the same thing
// everywhere. Setting this here — BEFORE the Symfony Runtime boots — keeps
// the override scoped to this request and never touches the shared php.ini.
date_default_timezone_set('UTC');

require_once dirname(__DIR__).'/vendor/autoload_runtime.php';

return function (array $context) {
    return new Kernel($context['APP_ENV'], (bool) $context['APP_DEBUG']);
};
