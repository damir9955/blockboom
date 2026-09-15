// ── Политика конфиденциальности — публичная страница для Google Play ────────
//
// Статичный серверный роут (без клиентского JS): https://<домен>/privacy
//   • для Google Play Console — публичная ссылка, доступная без логина;
//   • для игроков — ссылка из футера главного меню;
//   • входит в precache-манифест → доступна и офлайн (как вся игра).
//
// При релизе поднимаем APP_VERSION / UPDATED вместе со sw.js и package.json.

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Block Boom / Блок Бум",
  description:
    "Как игра Block Boom (Блок Бум) обрабатывает данные: персональные данные не собираются, весь игровой прогресс хранится только на устройстве пользователя.",
  robots: { index: true, follow: true },
};

const APP_VERSION = "1.8.6";
const UPDATED = "14 сентября 2026 г.";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <h2 id={`${id}-h`} className="text-[15px] font-black uppercase tracking-wide text-amber-300">
        {title}
      </h2>
      <div className="mt-2.5 space-y-3 text-[13.5px] leading-relaxed text-white/75 sm:text-sm">
        {children}
      </div>
    </section>
  );
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-bold text-amber-300 underline decoration-amber-300/30 underline-offset-2 transition hover:text-amber-200"
    >
      {children}
    </a>
  );
}

const NOT_COLLECTED: string[] = [
  "не требует регистрации и не заводит аккаунты, логины и пароли;",
  "не запрашивает имя, фамилию, дату рождения и пол;",
  "не собирает адреса электронной почты, номера телефонов и домашние адреса;",
  "не запрашивает платёжные данные — в Игре нет реальных платежей, а монеты зарабатываются игрой;",
  "не обращается к фотографиям, документам и другим файлам устройства;",
  "не определяет геолокацию, не читает контакты и список установленных приложений;",
  "не включает камеру и микрофон;",
  "не встраивает собственную аналитику и трекеры поведения.",
];

const SHARED_WITH: ReactNode[] = [
  <>
    <b className="text-white/90">Игровой прогресс и настройки — никому.</b> Они хранятся только на
    устройстве и не покидают его (см. раздел «Какие данные обрабатывает Игра»).
  </>,
  <>
    <b className="text-white/90">Хостинг Vercel.</b> Файлы Игры загружаются с хостинга, на котором
    размещён сайт. Как любой хостинг-провайдер, Vercel обрабатывает IP-адрес и стандартные
    технические заголовки сетевых запросов — исключительно для доставки контента, обеспечения
    безопасности и защиты от злоупотреблений. Эти данные не используются для составления профилей
    пользователей (
    <Ext href="https://vercel.com/legal/privacy-policy">политика Vercel</Ext>).
  </>,
  <>
    <b className="text-white/90">Магазин Google Play</b> (если Игра установлена оттуда) обрабатывает
    сведения об установке, обновлениях и сбоях согласно собственным политикам Google — это
    происходит вне Игры (
    <Ext href="https://policies.google.com/privacy">политика Google</Ext>).
  </>,
  <>
    <b className="text-white/90">Рекламная сеть Yandex</b> — только в объёме, описанном в разделе
    «Реклама» ниже.
  </>,
];

export default function PrivacyPage() {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-[#0f0d15] text-white">
      {/* мягкое янтарное свечение сверху — фирменная атмосфера игры */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[-30%] top-[-20%] h-[55%] bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.10),transparent_65%)]"
      />

      {/* шапка: логотип + возврат в игру */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0f0d15]/92 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 pb-3 pt-[max(env(safe-area-inset-top),12px)]">
          <img
            src="/art/icon.png"
            alt="Логотип игры Block Boom"
            className="size-10 shrink-0 rounded-xl border border-white/20 shadow-[0_6px_16px_rgba(0,0,0,0.5)]"
          />
          <div className="min-w-0 flex-1">
            <div className="logo-3d text-lg font-black leading-none tracking-wide">БЛОК БУМ</div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.25em] text-white/35">
              Block Boom
            </div>
          </div>
          <a
            href="/"
            aria-label="Вернуться в игру"
            className="chip shrink-0 rounded-xl px-3.5 py-2 text-xs font-black text-white/70 transition active:scale-95 hover:text-white"
          >
            ← В игру
          </a>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-2xl flex-1 px-5 pb-10 pt-7">
        <h1 className="text-2xl font-black leading-tight sm:text-3xl">Политика конфиденциальности</h1>
        <p className="mt-1 text-xs font-bold tracking-wide text-white/40">
          игры Block Boom / Блок Бум · обновлено {UPDATED}
        </p>

        {/* короткая суть — сразу, без юридического жаргона */}
        <div className="panel mt-5 rounded-2xl p-4.5 sm:p-5">
          <p className="text-[13.5px] leading-relaxed text-white/85 sm:text-sm">
            <b className="text-amber-300">Коротко:</b> «Блок Бум» — офлайн-игра без аккаунтов. Мы не
            собираем персональные данные — ни имя, ни почту, ни телефон, ни геолокацию. Игровой
            прогресс и настройки хранятся только на вашем устройстве и никуда не передаются.
          </p>
        </div>

        <div className="mt-7 space-y-7">
          <Section id="general" title="1. Общие положения">
            <p>
              Настоящая политика конфиденциальности (далее — «Политика») определяет, какие данные
              обрабатывает игра «Block Boom / Блок Бум» (далее — «Игра») на устройстве пользователя
              и в каких случаях данные могут обрабатываться третьими лицами. Политика
              распространяется на все версии Игры: веб-версию и её установку как приложения (PWA), а
              также на версии, распространяемые через магазины приложений, включая Google Play.
            </p>
            <p>
              Политика составлена с учётом требований Федерального закона от 27.07.2006 № 152-ФЗ «О
              персональных данных» (Российская Федерация) и Регламента (ЕС) 2016/679 (GDPR) в
              объёме, применимом к Игре. Продолжая пользоваться Игрой, вы подтверждаете, что
              ознакомились с настоящей Политикой.
            </p>
          </Section>

          <Section id="data" title="2. Какие данные обрабатывает Игра">
            <p>
              <b className="text-white/90">2.1. Игровой прогресс и настройки.</b> Чтобы Игра «помнила»
              ваши результаты между запусками, в локальном хранилище браузера или приложения
              (localStorage) на устройстве сохраняются: номер последнего открытого уровня и лучшие
              результаты по уровням (звёзды), количество монет и игровых инструментов, выбранный
              язык интерфейса, настройка звука, рекорд бесконечного режима, дата получения
              последнего ежедневного подарка и отметка о полном скачивании файлов Игры для
              офлайн-запуска.
            </p>
            <p>
              <b className="text-white/90">2.2. Файлы самой Игры (офлайн-режим).</b> Чтобы Игра
              запускалась мгновенно и работала без интернета, при первой установке на устройство
              скачиваются и сохраняются в кеше браузера (Cache Storage) все файлы Игры: страница,
              таблицы стилей, скрипты, изображения и иконки.
            </p>
            <p>
              <b className="text-amber-300">Главное:</b> эти данные физически остаются на вашем
              устройстве, доступны только самой Игре и не отправляются на серверы разработчика или
              третьих лиц. У разработчика нет технической возможности видеть ваш игровой прогресс.
            </p>
          </Section>

          <Section id="never" title="3. Чего Игра не делает">
            <p>Игра не собирает и не запрашивает:</p>
            <ul className="list-disc space-y-1.5 pl-5 marker:text-amber-400/60">
              {NOT_COLLECTED.map((item) => (
                <li key={item.slice(0, 24)}>{item}</li>
              ))}
            </ul>
          </Section>

          <Section id="ads" title="4. Реклама">
            <p>
              <b className="text-white/90">Веб-версия</b> (в том числе установленная как PWA)
              показывает только демонстрационный ролик с обратным отсчётом: он проигрывается
              локально в браузере, без обращений к рекламным сетям и без передачи каких-либо данных.
            </p>
            <p>
              <b className="text-white/90">Версия для Android из Google Play</b> может показывать
              рекламные видеоролики (rewarded) для начисления бонусной игровой валюты. Рекламу
              технологически обслуживает партнёр — рекламная сеть{" "}
              <b className="text-white/90">Yandex Mobile Ads</b>. При показе рекламы Yandex может
              автоматически получать и обрабатывать технические данные, необходимые для показа
              рекламы и защиты от мошенничества: рекламный идентификатор устройства (Google
              Advertising ID / OAID), IP-адрес, модель устройства и версию операционной системы,
              язык и часовой пояс и тому подобное. Эти данные обрабатываются согласно политике
              конфиденциальности Яндекса (
              <Ext href="https://yandex.ru/legal/confidential/">yandex.ru/legal/confidential</Ext>)
              и его условиям использования сервиса (
              <Ext href="https://yandex.ru/legal/termsofuse/">yandex.ru/legal/termsofuse</Ext>). Мы
              не связываем эти данные с игровым профилем и не используем их для идентификации
              игроков.
            </p>
            <p>
              Вы можете управлять рекламными предпочтениями: сбросить или удалить рекламный
              идентификатор и отключить персонализацию рекламы можно в настройках устройства
              (Настройки → Google → Реклама → «Удалить рекламный идентификатор») либо в настройках
              рекламы Яндекса.
            </p>
          </Section>

          <Section id="third-parties" title="5. Кому могут передаваться данные">
            <ul className="list-disc space-y-2.5 pl-5 marker:text-amber-400/60">
              {SHARED_WITH.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </Section>

          <Section id="permissions" title="6. Разрешения и доступы">
            <p>
              Игра не запрашивает доступа к контактам, камере, микрофону, геолокации, файлам,
              журналу звонков и другим чувствительным данным устройства. Для работы используются
              только стандартные возможности браузера или операционной системы: локальное хранилище
              и кеш (см. раздел 2), воспроизведение звуков и короткая вибрация при игровых событиях.
              Звук выключается прямо в меню Игры, вибрация — в системных настройках.
            </p>
          </Section>

          <Section id="storage" title="7. Хранение и удаление данных">
            <p>
              Локальные данные хранятся на устройстве, пока установлена Игра. Чтобы удалить их
              полностью и безвозвратно, достаточно очистить хранилище приложения (Настройки →
              Приложения → Block Boom → «Очистить данные» / «Хранилище») или удалить приложение —
              вместе с ним сотрутся игровой прогресс, настройки и кеш файлов. Отдельно запрашивать
              удаление у разработчика не нужно: мы физически не храним ваши игровые данные на своих
              серверах.
            </p>
          </Section>

          <Section id="kids" title="8. Дети">
            <p>
              Игра подходит для широкой аудитории, включая детей, и не собирает данные пользователей
              любого возраста — достижения ребёнка точно так же остаются только на его устройстве.
              Родители могут дополнительно ограничить показ рекламы и загрузку приложений
              средствами семейного контроля Google Play.
            </p>
          </Section>

          <Section id="changes" title="9. Изменения Политики">
            <p>
              Мы можем дополнять настоящую Политику по мере развития Игры — например, при появлении
              новых игровых или рекламных возможностей. Актуальная редакция всегда доступна на этой
              странице, дата последнего обновления указана внизу. Существенные изменения вступают в
              силу вместе с выпуском обновления Игры, в котором они появились.
            </p>
          </Section>

          <Section id="contacts" title="10. Контакты">
            <p>
              Вопросы, связанные с настоящей Политикой и обработкой данных в Игре, направляйте
              разработчику по адресу электронной почты, указанному в карточке приложения в Google
              Play (раздел «Поддержка»), — мы стараемся отвечать оперативно.
            </p>
          </Section>
        </div>
      </main>

      <footer className="mt-auto border-t border-white/10">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-2 px-5 py-5 pb-[max(env(safe-area-inset-bottom),20px)] text-center text-[11px] font-bold tracking-wide text-white/30">
          <div>Block Boom / Блок Бум · версия {APP_VERSION} · обновлено {UPDATED}</div>
          <a
            href="/"
            aria-label="Вернуться в игру"
            className="-mx-2 rounded-lg px-2 py-1 text-white/40 underline decoration-white/25 underline-offset-2 transition active:scale-95 hover:text-white/75"
          >
            ← Вернуться в игру
          </a>
        </div>
      </footer>
    </div>
  );
}
