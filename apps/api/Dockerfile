# ---------- dev ----------
FROM php:8.3-fpm-alpine AS dev

RUN apk add --no-cache git unzip icu-dev libzip-dev oniguruma-dev \
    && docker-php-ext-configure intl \
    && docker-php-ext-install intl pdo_mysql bcmath zip mbstring opcache \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# ---------- prod ----------
FROM dev AS prod

COPY composer.json composer.lock* ./
RUN composer install --no-dev --no-scripts --no-interaction --prefer-dist --optimize-autoloader || true

COPY . .

RUN composer dump-autoload --optimize --no-dev --classmap-authoritative || true

CMD ["php-fpm"]
