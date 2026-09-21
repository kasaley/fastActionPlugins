// 1Password for FastAction.
//
// Talks to the `op` command line tool and nothing else: no network permission,
// no stored secrets. Values are fetched at the moment you ask for them, copied
// through the host as concealed values, and never written to disk.

const state = {
  settings: {},
  locale: 'ru',
  installed: false,
  status: 'unknown',   // unknown | missing | needsSetup | ready | error
  message: '',
  items: [],
  query: '',
  detail: null,        // { id, title, fields, urls, loading }
  requested: false,    // the list is only fetched after a deliberate click
  usage: {},           // item id → how often it was used from here
  loading: false,
};

const TEXT = {
  ru: {
    title: '1Password',
    missing: 'Не найден 1Password CLI',
    missingHelp: 'Плагин работает через программу op — официальный инструмент 1Password. Установите её и вернитесь сюда.',
    install: 'Как установить',
    copyBrew: 'Скопировать команду brew',
    recheck: 'Проверить снова',
    needsSetup: 'Включите интеграцию с CLI',
    needsSetupHelp: 'В 1Password: Настройки → Разработчик → «Интегрировать с 1Password CLI». Затем разблокировка пойдёт по Touch ID.',
    search: 'Поиск по записям',
    empty: 'Записей нет',
    nothing: 'Ничего не найдено',
    loading: 'Спрашиваем 1Password…',
    unlock: '1Password спросит Touch ID',
    show: 'Показать записи',
    locked: 'Записи под замком',
    lockedHelp: 'Список открывается по вашей команде — тогда же 1Password спросит Touch ID. Ничего не запрашивается в фоне.',
    grant: 'Получить доступ',
    checking: 'Проверяем 1Password…',
    setupSteps: '1Password → Настройки → Разработчик → «Интегрировать с 1Password CLI». Затем 1Password должен остаться в строке меню.',
    howTo: 'Как включить',
    back: 'Назад',
    copy: 'Скопировать',
    username: 'Логин',
    password: 'Пароль',
    otp: 'Одноразовый код',
    notes: 'Заметка',
    website: 'Сайт',
    openSite: 'Открыть сайт',
    autofill: 'Автозаполнить',
    autofillHelp: 'Ввести логин и пароль в активное приложение',
    favorite: 'избранное',
    often: 'Часто используемые',
    all: 'Все записи',
    copied: 'скопировано',
    noFields: 'В этой записи нет полей для копирования',
    frequencyNote: 'Частота считается в FastAction: 1Password такую статистику не отдаёт.',
  },
  en: {
    title: '1Password',
    missing: '1Password CLI not found',
    missingHelp: 'This plugin works through op, the official 1Password command line tool. Install it and come back.',
    install: 'How to install',
    copyBrew: 'Copy the brew command',
    recheck: 'Check again',
    needsSetup: 'Turn on the CLI integration',
    needsSetupHelp: 'In 1Password: Settings → Developer → “Integrate with 1Password CLI”. Unlocking then uses Touch ID.',
    search: 'Search items',
    empty: 'No items',
    nothing: 'Nothing found',
    loading: 'Asking 1Password…',
    unlock: '1Password will ask for Touch ID',
    show: 'Show items',
    locked: 'Items are locked',
    lockedHelp: 'The list is fetched when you ask for it — that is when 1Password asks for Touch ID. Nothing is requested in the background.',
    grant: 'Get access',
    checking: 'Checking 1Password…',
    setupSteps: '1Password → Settings → Developer → “Integrate with 1Password CLI”. Then keep 1Password in the menu bar.',
    howTo: 'How to turn it on',
    back: 'Back',
    copy: 'Copy',
    username: 'Username',
    password: 'Password',
    otp: 'One-time code',
    notes: 'Note',
    website: 'Website',
    openSite: 'Open website',
    autofill: 'Autofill',
    autofillHelp: 'Type the username and password into the active app',
    favorite: 'favourite',
    often: 'Frequently used',
    all: 'All items',
    copied: 'copied',
    noFields: 'Nothing to copy in this item',
    frequencyNote: 'Frequency is counted by FastAction: 1Password does not publish usage data.',
  },
};

function t(key) {
  const table = TEXT[state.locale] || TEXT.en;
  return table[key] || TEXT.en[key] || key;
}

const INSTALL_URL = 'https://www.1password.dev/cli/get-started/';
const INTEGRATION_URL = 'https://www.1password.dev/cli/app-integration/';
const BREW_COMMAND = 'brew install 1password-cli';

// MARK: talking to op

// `op` has no machine-readable errors: exit code is 1 for everything, so the
// message on stderr is all there is to go on.
function classify(stderr) {
  const text = String(stderr || '').toLowerCase();
  if (text.includes('no accounts configured') || text.includes('not currently signed in')
      || text.includes('lostconnectiontoapp') || text.includes('connect with 1password')) {
    return 'needsSetup';
  }
  return 'error';
}

async function op(args, timeout) {
  const result = await fa.exec('op', args, { timeout: timeout || 20 });
  if (result.status !== 0) {
    const kind = classify(result.stderr);
    const error = new Error(String(result.stderr || '').split('\n')[0] || 'op failed');
    error.kind = kind;
    throw error;
  }
  return result.stdout;
}

function vaultArgs() {
  const vault = String(state.settings.vault || '').trim();
  return vault ? ['--vault', vault] : [];
}

async function loadItems() {
  const args = ['item', 'list', '--format=json'];
  const category = String(state.settings.category || 'Login').trim();
  if (category && category.toLowerCase() !== 'all') { args.push('--categories', category); }
  const output = await op(args.concat(vaultArgs()), 25);
  let items = [];
  try { items = JSON.parse(output) || []; } catch (error) { items = []; }
  return items.map((item) => ({
    id: String(item.id || ''),
    title: String(item.title || ''),
    subtitle: String(item.additional_information || ''),
    favorite: !!item.favorite,
    vault: ((item.vault || {}).name) || '',
    updated: String(item.updated_at || ''),
    url: ((item.urls || []).filter((entry) => entry.primary)[0] || (item.urls || [])[0] || {}).href || '',
  })).filter((item) => item.id);
}

// Sorting: what this user actually reaches for, then their favourites, then the
// most recently edited. 1Password itself exposes no usage statistics.
function rank(item) {
  return (state.usage[item.id] || 0) * 10 + (item.favorite ? 3 : 0);
}

function remember(id) {
  state.usage[id] = (state.usage[id] || 0) + 1;
  fa.storage.set({ usage: state.usage });
}

function fieldValue(fields, purpose, type) {
  for (const field of fields) {
    if (purpose && field.purpose === purpose) { return field; }
    if (type && field.type === type) { return field; }
  }
  return null;
}

// MARK: lifecycle

fa.plugin({
  async load(env) {
    state.settings = env.settings || {};
    state.locale = env.locale || 'ru';
    state.installed = !!(env.tools && env.tools.op);
    state.usage = (fa.storage.get() || {}).usage || {};
    state.detail = null;
    if (!state.installed) { state.status = 'missing'; return; }
    // `op account list` reads the local configuration only: it never unlocks a
    // vault and never shows a prompt, so it is safe to run on startup and tells
    // us in advance whether the CLI integration still needs turning on.
    try {
      await op(['account', 'list', '--format=json'], 8);
      state.status = state.items.length ? 'ready' : 'locked';
    } catch (error) {
      state.status = error.kind === 'needsSetup' ? 'needsSetup' : 'locked';
      state.message = error.kind === 'needsSetup' ? '' : String(error.message || error);
    }
  },

  async refresh() {
    state.installed = fa.isInstalled('op');
    if (!state.installed) { state.status = 'missing'; state.items = []; return; }
    // Until the user has asked once, nothing is fetched: the fetch is what makes
    // 1Password ask for Touch ID.
    if (!state.requested) { return; }
    state.loading = true;
    state.message = '';
    fa.update();
    try {
      state.items = await loadItems();
      state.status = 'ready';
      state.message = '';
    } catch (error) {
      state.status = error.kind === 'needsSetup' ? 'needsSetup' : 'error';
      state.message = String(error.message || error);
    } finally {
      state.loading = false;
    }
  },

  async action(id, payload) {
    const separator = String(id).indexOf(':');
    const name = separator < 0 ? String(id) : String(id).slice(0, separator);
    const argument = separator < 0 ? '' : String(id).slice(separator + 1);

    if (name === 'search') { state.query = String((payload && payload.query) || ''); return; }
    if (name === 'unlock') {
      state.requested = true;
      state.status = 'ready';
      await this.refresh();
      return;
    }
    if (name === 'integration') { fa.openURL(INTEGRATION_URL); return; }
    if (name === 'refresh') { await this.refresh(); return; }
    if (name === 'back') { state.detail = null; return; }
    if (name === 'install') { fa.openURL(INSTALL_URL); return; }
    if (name === 'brew') { fa.clipboard.copy(BREW_COMMAND); return; }
    if (name === 'site') { if (argument) { fa.openURL(argument); } return; }

    if (name === 'open') {
      const known = state.items.filter((item) => item.id === argument)[0];
      state.detail = { id: argument, title: (known || {}).title || '', fields: [], urls: [], loading: true };
      // Draw the loading screen before asking 1Password, which may take a while.
      fa.update();
      try {
        // Values are fetched only now, when the user asked for this item — that is
        // also the moment 1Password shows its Touch ID prompt.
        const output = await op(['item', 'get', argument, '--format=json', '--reveal'].concat(vaultArgs()), 60);
        const item = JSON.parse(output);
        state.detail = {
          id: argument,
          title: String(item.title || ''),
          vault: ((item.vault || {}).name) || '',
          fields: (item.fields || []).filter((field) => field.value || field.totp),
          urls: item.urls || [],
          loading: false,
        };
        remember(argument);
      } catch (error) {
        state.detail = null;
        state.status = error.kind === 'needsSetup' ? 'needsSetup' : 'error';
        state.message = String(error.message || error);
      }
      return;
    }

    if (name === 'copyField') {
      const detail = state.detail;
      if (!detail) { return; }
      const field = (detail.fields || []).filter((entry) => String(entry.id) === argument)[0];
      if (!field) { return; }
      const secret = field.type === 'CONCEALED' || field.type === 'OTP';
      const value = field.type === 'OTP' ? String(field.totp || '') : String(field.value || '');
      fa.clipboard.copy(value, { sensitive: secret, clearAfter: Number(state.settings.clearAfter || 45) });
      remember(detail.id);
      return;
    }

    if (name === 'autofill') {
      const detail = state.detail;
      if (!detail || state.settings.autofill === false) { return; }
      const username = fieldValue(detail.fields, 'USERNAME', null);
      const password = fieldValue(detail.fields, 'PASSWORD', 'CONCEALED');
      if (!password) { return; }
      fa.autofill({ username: String((username || {}).value || ''), password: String(password.value || '') });
      remember(detail.id);
    }
  },

  render() {
    if (state.status === 'missing') { return renderMissing(); }
    if (state.status === 'needsSetup' && !state.items.length) { return renderNeedsSetup(); }
    if (state.status === 'locked') { return renderLocked(); }
    if (state.detail) { return renderDetail(); }
    return renderList();
  },
});

function renderMissing() {
  return [
    { type: 'empty', icon: 'lock.square', title: t('missing'), subtitle: t('missingHelp') },
    { type: 'buttons', items: [
      { title: t('install'), icon: 'arrow.up.forward.app', action: 'install' },
      { title: t('copyBrew'), icon: 'doc.on.doc', action: 'brew' },
      { title: t('recheck'), icon: 'arrow.clockwise', action: 'refresh' },
    ] },
    { type: 'note', icon: 'terminal', text: BREW_COMMAND, tint: 'gray' },
  ];
}

function renderLocked() {
  if (state.loading) {
    return [{ type: 'progress', text: t('loading') }, { type: 'note', icon: 'touchid', text: t('unlock'), tint: 'gray' }];
  }
  return [
    {
      type: 'empty', icon: 'lock.fill', title: t('locked'), subtitle: t('lockedHelp'),
      action: { title: t('show'), action: 'unlock' },
    },
  ];
}

// Shown before anything asks for a fingerprint, so the first visit explains
// itself instead of surprising the user with a system prompt.
function renderNeedsSetup() {
  return [
    { type: 'empty', icon: 'person.badge.key', title: t('needsSetup'), subtitle: t('setupSteps'),
      action: { title: t('grant'), action: 'unlock' } },
    { type: 'buttons', items: [
      { title: t('howTo'), icon: 'arrow.up.forward.app', action: 'integration', tint: 'gray' },
      { title: t('recheck'), icon: 'arrow.clockwise', action: 'refresh', tint: 'gray' },
    ] },
  ];
}

function renderList() {
  const nodes = [{
    type: 'header', title: t('often'),
    subtitle: state.items.length ? String(state.items.length) : '',
    actions: [{ action: 'refresh', icon: 'arrow.clockwise', help: t('recheck') }],
  }];

  if (state.loading) {
    nodes.push({ type: 'progress', text: t('loading') });
  }
  if (state.status === 'needsSetup') {
    nodes.push({ type: 'note', icon: 'person.badge.key', text: t('needsSetupHelp'), tint: 'orange' });
  } else if (state.status === 'error' && state.message) {
    nodes.push({ type: 'note', icon: 'exclamationmark.triangle', text: state.message, tint: 'red' });
  }

  nodes.push({ type: 'search', placeholder: t('search'), value: state.query, action: 'search' });

  const query = state.query.trim().toLowerCase();
  const visible = state.items
    .filter((item) => !query || item.title.toLowerCase().includes(query) || item.subtitle.toLowerCase().includes(query))
    .sort((left, right) => {
      const difference = rank(right) - rank(left);
      return difference !== 0 ? difference : left.title.localeCompare(right.title);
    });

  if (!visible.length) {
    nodes.push({
      type: 'empty',
      icon: state.loading ? 'arrow.clockwise' : 'key',
      title: state.loading ? t('loading') : (query ? t('nothing') : t('empty')),
    });
    return nodes;
  }

  nodes.push({
    type: 'list',
    rows: visible.map((item) => ({
      id: item.id,
      icon: 'key.fill',
      iconTint: rank(item) > 0 ? 'accent' : 'gray',
      title: item.title,
      subtitle: item.subtitle,
      trailing: item.vault,
      tap: 'open:' + item.id,
      actions: item.url ? [{ action: 'site:' + item.url, icon: 'safari', help: t('openSite') }] : [],
    })),
  });
  return nodes;
}

function renderDetail() {
  const detail = state.detail;
  const nodes = [{
    type: 'header', title: detail.title || t('title'),
    subtitle: detail.vault || '',
    actions: [{ action: 'back', icon: 'chevron.left', help: t('back') }],
  }];
  if (detail.loading) {
    nodes.push({ type: 'progress', text: t('loading') });
    nodes.push({ type: 'note', icon: 'touchid', text: t('unlock'), tint: 'gray' });
    return nodes;
  }

  const fields = detail.fields || [];
  if (!fields.length) {
    nodes.push({ type: 'empty', icon: 'key', title: t('noFields') });
    return nodes;
  }

  for (const field of fields) {
    const secret = field.type === 'CONCEALED' || field.type === 'OTP';
    const value = field.type === 'OTP' ? String(field.totp || '') : String(field.value || '');
    let label = field.label || field.id;
    if (field.purpose === 'USERNAME') { label = t('username'); }
    if (field.purpose === 'PASSWORD') { label = t('password'); }
    if (field.purpose === 'NOTES') { label = t('notes'); }
    if (field.type === 'OTP') { label = t('otp'); }
    nodes.push({
      type: 'field', label, value, secret,
      mono: field.type === 'OTP',
      copy: 'copyField:' + field.id,
    });
  }

  const site = (detail.urls.filter((entry) => entry.primary)[0] || detail.urls[0] || {}).href || '';
  const buttons = [];
  if (state.settings.autofill !== false && fieldValue(fields, 'PASSWORD', 'CONCEALED')) {
    buttons.push({ title: t('autofill'), icon: 'keyboard', action: 'autofill', help: t('autofillHelp') });
  }
  if (site) { buttons.push({ title: t('openSite'), icon: 'safari', action: 'site:' + site }); }
  if (buttons.length) { nodes.push({ type: 'buttons', items: buttons }); }
  nodes.push({ type: 'note', icon: 'info.circle', text: t('frequencyNote'), tint: 'gray' });
  return nodes;
}
