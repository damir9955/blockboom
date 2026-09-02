# Block Boom / Блок Бум — Blast Block Puzzle

Мобильная головоломка (жанр Block Blast / Toon Blast): поле 8×8, фигуры из блоков,
тикающие бомбы, 40 уровней с целями и лимитом ходов, звёзды, монеты, бустеры.
Языки: RU / EN (автодетект + переключатель). Полностью работает офлайн (PWA).

## Запуск локально

```bash
bun install        # или npm install
bun run dev        # http://localhost:3000
```

## Деплой на Vercel (5 минут)

1. Создай репозиторий на GitHub и запушь этот код:
   ```bash
   git init
   git add .
   git commit -m "Block Boom 1.0.0"
   git branch -M main
   git remote add origin https://github.com/ТВОЙ_ЛОГИН/blockboom.git
   git push -u origin main
   ```
2. Зайди на vercel.com → **Add New… → Project** → выбери репозиторий → **Deploy**
   (настройки менять не нужно: Next.js определится автоматически).
3. Получишь адрес вида `blockboom-xxx.vercel.app` — это и есть адрес игры
   (HTTPS уже включён, манифест, офлайн и иконки внутри).

## assetlinks.json (после упаковки в PWABuilder)

Когда соберёшь Android-пакет на pwabuilder.com, там покажут SHA-256 отпечаток
твоего ключа подписи. Создай файл `public/.well-known/assetlinks.json`
(шаблон — `assetlinks.example.json` в корне, подставь свой package_name и SHA),
закоммить и запушь — Vercel перепубликует сайт, и приложение будет
открываться без адресной строки.

## Никогда не коммить

- `.env` и любые ключи
- keystore / пароль от него (это подпись приложения — храни отдельно!)
