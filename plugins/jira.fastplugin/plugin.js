// Jira for FastAction.
//
// Runs in the plugin sandbox: the only way out is the `fa` API, and the only
// server this plugin may talk to is the one the user confirmed.

const state = {
  settings: {},
  locale: 'ru',
  token: '',
  me: null,              // { displayName } once the connection is checked
  screen: 'list',        // list | setup | filters | builder | pick | events
  detailFrom: '',        // screen the open issue was reached from, for «back»
  filters: [],
  filterIndex: 0,
  issues: [],
  query: '',
  detail: null,          // { key, issue, comments, loading }
  saved: [],             // filters fetched from Jira
  builder: { project: '', mine: true, status: 'open', period: 'any' },
  loading: false,
  busy: '',
  error: '',
  switching: false,     // true while the user is changing filters, so no alerts
  seen: {},             // filter jql → { issue key: updated }
  watched: {},          // issue key → updated, for the issues you follow
  watchedAt: 0,         // when the watched issues were last checked
  events: [],           // what happened, newest first, with a read flag
  filterQuery: '',      // search over the filters taken from Jira
};

const TEXT = {
  ru: {
    setupTitle: 'Подключите Jira',
    stepSite: 'Адрес',
    stepEmail: 'Почта',
    stepToken: 'Токен',
    stepOf: 'Шаг %@ из %@',
    hintSite: 'Вставьте любую ссылку из вашей Jira — адрес подставится сам.',
    hintEmail: 'Почта, с которой вы входите в Jira.',
    hintToken: 'API-токен. Он ляжет в связку ключей, а не в настройки.',
    next: 'Далее',
    back: 'Назад',
    finish: 'Проверить и включить',
    badSite: 'Не похоже на адрес Jira. Нужен адрес вида company.atlassian.net',
    badEmail: 'Не похоже на почту',
    badTokenEmpty: 'Вставьте токен',
    siteUnreachable: 'Этот адрес не отвечает как Jira — проверьте ссылку',
    checkFailed: 'Jira не приняла почту и токен',
    setupStep1: 'Шаг 1. Вставьте любую ссылку из вашей Jira — адрес подставится сам',
    linkPlaceholder: 'https://company.atlassian.net/jira/software/...',
    add: 'Добавить',
    setupStep2: 'Шаг 2. Почта, с которой вы входите в Jira',
    emailPlaceholder: 'you@company.com',
    setupStep3: 'Шаг 3. API-токен',
    tokenHelp: 'Кнопка откроет страницу токенов Atlassian. Создайте токен и вставьте его сюда — он ляжет в связку ключей.',
    tokenPlaceholder: 'вставьте токен',
    createToken: 'Создать токен',
    save: 'Сохранить',
    check: 'Проверить подключение',
    connected: 'Подключено: %@',
    serverHint: 'Для Server / Data Center выберите тип в настройках плагина и вставьте личный токен.',
    empty: 'По этому фильтру задач нет',
    nothing: 'Ничего не найдено',
    search: 'Поиск по задачам',
    loading: 'Загружаем задачи…',
    open: 'Открыть в браузере',
    copyKey: 'Скопировать номер',
    copyLink: 'Скопировать ссылку',
    refresh: 'Обновить',
    back: 'Назад',
    comments: 'Комментарии',
    description: 'Описание',
    noDescription: 'Описание не заполнено',
    noComments: 'Комментариев нет',
    assignee: 'Исполнитель',
    status: 'Статус',
    priority: 'Приоритет',
    updated: 'Обновлена',
    nobody: 'не назначен',
    newIssue: 'Новая задача',
    newIssues: 'Новых задач: %d',
    watchedUpdated: 'Обновление по наблюдаемой задаче',
    watchedUpdatedMany: 'Обновлений по наблюдаемым: %d',
    watching: 'Наблюдаю',
    badToken: 'Jira не приняла токен. Проверьте почту и API-токен.',
    tooFast: 'Jira просит подождать. Следующая попытка чуть позже.',
    badJQL: 'Jira не поняла запрос JQL',
    openInJira: 'Открыть этот фильтр в Jira',
    events: 'Уведомления',
    noEvents: 'Пока ничего не происходило',
    markRead: 'Прочитано',
    markAllRead: 'Прочитать всё',
    unread: 'непрочитанных: %d',
    searchFilters: 'Поиск по фильтрам',
    newIssueEvent: 'Новая задача в фильтре «%@»',
    filters: 'Фильтры',
    myFilters: 'Фильтры',
    fromJira: 'Взять из Jira',
    fromLink: 'Из ссылки на доску или поиск',
    builder: 'Собрать фильтр',
    remove: 'Удалить',
    pickTitle: 'Ваши фильтры в Jira',
    noSaved: 'В Jira не нашлось сохранённых фильтров',
    project: 'Проект',
    projectPlaceholder: 'например IT',
    mine: 'Мои',
    anyone: 'Все',
    statusOpen: 'Открытые',
    statusProgress: 'В работе',
    statusAny: 'Любой статус',
    periodAny: 'За всё время',
    period7: 'За 7 дней',
    period30: 'За 30 дней',
    create: 'Создать фильтр',
    added: 'Фильтр добавлен',
    boardImported: 'Взято с доски: %@',
    linkNotUnderstood: 'Не удалось разобрать ссылку. Подойдёт ссылка на доску, проект, задачу или результат поиска.',
    advanced: 'Свой JQL можно дописать в настройках плагина.',
    checking: 'Проверяем…',
  },
  en: {
    setupTitle: 'Connect Jira',
    stepSite: 'Address',
    stepEmail: 'Email',
    stepToken: 'Token',
    stepOf: 'Step %@ of %@',
    hintSite: 'Paste any link from your Jira — the address fills itself in.',
    hintEmail: 'The email you sign in to Jira with.',
    hintToken: 'An API token. It goes to the keychain, not to the settings.',
    next: 'Next',
    back: 'Back',
    finish: 'Check and turn on',
    badSite: 'That does not look like a Jira address. It should look like company.atlassian.net',
    badEmail: 'That does not look like an email address',
    badTokenEmpty: 'Paste the token',
    siteUnreachable: 'This address does not answer as Jira — check the link',
    checkFailed: 'Jira did not accept the email and the token',
    setupStep1: 'Step 1. Paste any link from your Jira — the address fills itself in',
    linkPlaceholder: 'https://company.atlassian.net/jira/software/...',
    add: 'Add',
    setupStep2: 'Step 2. The email you sign in to Jira with',
    emailPlaceholder: 'you@company.com',
    setupStep3: 'Step 3. API token',
    tokenHelp: 'The button opens the Atlassian tokens page. Create a token and paste it here — it goes into the keychain.',
    tokenPlaceholder: 'paste the token',
    createToken: 'Create a token',
    save: 'Save',
    check: 'Check the connection',
    connected: 'Connected: %@',
    serverHint: 'For Server / Data Center pick the type in the plugin settings and paste a personal token.',
    empty: 'No issues in this filter',
    nothing: 'Nothing found',
    search: 'Search issues',
    loading: 'Loading issues…',
    open: 'Open in browser',
    copyKey: 'Copy issue key',
    copyLink: 'Copy link',
    refresh: 'Refresh',
    back: 'Back',
    comments: 'Comments',
    description: 'Description',
    noDescription: 'No description',
    noComments: 'No comments yet',
    assignee: 'Assignee',
    status: 'Status',
    priority: 'Priority',
    updated: 'Updated',
    nobody: 'unassigned',
    newIssue: 'New issue',
    newIssues: 'New issues: %d',
    watchedUpdated: 'An issue you watch changed',
    watchedUpdatedMany: 'Issues you watch changed: %d',
    watching: 'Watching',
    badToken: 'Jira rejected the token. Check the email and API token.',
    tooFast: 'Jira asked to slow down. Retrying a little later.',
    badJQL: 'Jira could not parse the JQL',
    openInJira: 'Open this filter in Jira',
    events: 'Notifications',
    noEvents: 'Nothing has happened yet',
    markRead: 'Mark as read',
    markAllRead: 'Mark all as read',
    unread: 'unread: %d',
    searchFilters: 'Search filters',
    newIssueEvent: 'New issue in “%@”',
    filters: 'Filters',
    myFilters: 'Filters',
    fromJira: 'Take from Jira',
    fromLink: 'From a board or search link',
    builder: 'Build a filter',
    remove: 'Remove',
    pickTitle: 'Your filters in Jira',
    noSaved: 'No saved filters found in Jira',
    project: 'Project',
    projectPlaceholder: 'e.g. IT',
    mine: 'Mine',
    anyone: 'Anyone',
    statusOpen: 'Open',
    statusProgress: 'In progress',
    statusAny: 'Any status',
    periodAny: 'All time',
    period7: 'Last 7 days',
    period30: 'Last 30 days',
    create: 'Create the filter',
    added: 'Filter added',
    boardImported: 'Taken from the board: %@',
    linkNotUnderstood: 'Could not read that link. A board, project, issue or search link works.',
    advanced: 'Your own JQL can be added in the plugin settings.',
    checking: 'Checking…',
  },
};

function t(key, ...values) {
  const table = TEXT[state.locale] || TEXT.en;
  let line = table[key] || TEXT.en[key] || key;
  // Each value fills the next placeholder, so a line can carry more than one.
  for (const value of values) {
    line = line.replace('%d', value).replace('%@', value);
  }
  return line;
}

const TOKEN_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens';

// MARK: settings

function site() {
  return String(state.settings.site || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

function isCloud() {
  return state.settings.auth !== 'server';
}

function isConfigured() {
  return !!site() && !!state.token && (!isCloud() || !!state.settings.email);
}

function base() {
  return 'https://' + site();
}

function browseURL(key) {
  return base() + '/browse/' + key;
}

// MARK: Jira API

function headers() {
  const auth = isCloud()
    ? 'Basic ' + fa.base64(String(state.settings.email || '') + ':' + state.token)
    : 'Bearer ' + state.token;
  return { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' };
}

async function call(path, options) {
  const response = await fa.http.json(Object.assign({
    url: base() + path, headers: headers(),
  }, options || {}));
  fa.log('Jira ' + ((options && options.method) || 'GET') + ' ' + path.split('?')[0] + ' → ' + response.status);
  const fail = (message, extra) => {
    const error = new Error(message);
    error.status = response.status;
    Object.assign(error, extra || {});
    return error;
  };
  if (response.status === 401 || response.status === 403) { throw fail(t('badToken')); }
  if (response.status === 429) { throw fail(t('tooFast')); }
  if (response.status === 404) { throw fail('HTTP 404', { notFound: true }); }
  if (response.status >= 400) {
    const messages = (response.json && response.json.errorMessages) || [];
    const detail = messages.length ? messages[0] : ('HTTP ' + response.status);
    if (response.status === 400) {
      const query = (options && options.body) ? (JSON.parse(options.body).jql || '') : '';
      throw fail(t('badJQL') + (query ? ': ' + query : '') + (detail ? ' — ' + detail : ''));
    }
    throw fail(detail);
  }
  return response.json || {};
}

// Jira Cloud replaced /search with /search/jql; Server/DC still has the old one.
// v2 is used on purpose: it returns plain text instead of ADF documents.
async function search(jql) {
  const body = {
    jql,
    fields: ['summary', 'status', 'priority', 'assignee', 'updated', 'issuetype'],
    maxResults: 50,
  };
  try {
    const result = await call('/rest/api/2/search/jql', { method: 'POST', body: JSON.stringify(body) });
    return result.issues || [];
  } catch (error) {
    if (!error.notFound) { throw error; }
    const result = await call('/rest/api/2/search', {
      method: 'POST', body: JSON.stringify(Object.assign({ startAt: 0 }, body)),
    });
    return result.issues || [];
  }
}

// Every filter the user can see, not just the first page of them: Jira returns
// fifty at a time, and older servers answer on different addresses entirely.
async function savedFilters() {
  const collected = [];
  const byId = {};
  const add = (list, favourite) => {
    for (const filter of (list || [])) {
      if (!filter) { continue; }
      const known = byId[filter.id];
      if (known) {
        // The same filter arrives from several endpoints; the favourites one is
        // the only place that says it is starred.
        if (favourite) { known.favourite = true; }
        continue;
      }
      if (favourite) { filter.favourite = true; }
      byId[filter.id] = filter;
      collected.push(filter);
    }
  };

  try {
    let startAt = 0;
    for (let page = 0; page < 6; page++) {
      const result = await call('/rest/api/2/filter/search?expand=jql&maxResults=50&startAt=' + startAt);
      const values = result.values || [];
      add(values);
      if (result.isLast || values.length < 50) { break; }
      startAt += values.length;
    }
  } catch (error) {
    if (!error.notFound) { fa.log('фильтры: ' + String(error && error.message ? error.message : error)); }
  }

  // Server and Data Center have their own endpoints; they cost one request each.
  for (const path of ['/rest/api/2/filter/favourite?expand=jql', '/rest/api/2/filter/my?expand=jql']) {
    try {
      const result = await call(path);
      add(Array.isArray(result) ? result : result.values, path.indexOf('favourite') >= 0);
    } catch (error) {
      if (!error.notFound) { fa.log('фильтры: ' + String(error && error.message ? error.message : error)); }
    }
  }
  // Starred first, then alphabetically: with every filter in the list, the ones
  // the user marked themselves should not be buried.
  collected.sort((left, right) => {
    if (!!left.favourite !== !!right.favourite) { return left.favourite ? -1 : 1; }
    return String(left.name || '').localeCompare(String(right.name || ''));
  });
  return collected;
}

// MARK: filters

// Everything worth telling the user about is kept here too, so it can be read
// later — a notification in the notch is easy to miss.
function addEvent(event) {
  state.events.unshift(Object.assign({
    id: String(Date.now()) + '-' + Math.round(Math.random() * 100000),
    at: Date.now(),
    read: false,
  }, event));
  state.events = state.events.slice(0, 60);
  saveFilters();
}

function unreadCount() {
  return state.events.filter((event) => !event.read).length;
}

function saveFilters() {
  // Filters typed in the settings are not stored here: they are re-read from the
  // settings every time, and saving them would add a copy on every launch.
  fa.storage.set({
    filters: state.filters.filter((filter) => !filter.fromSettings),
    seen: state.seen,
    watched: state.watched,
    events: state.events.slice(0, 60),
  });
}

function addFilter(filter) {
  if (!filter || !filter.jql) { return false; }
  const same = state.filters.filter((entry) => entry.jql === filter.jql).length > 0;
  if (!same) { state.filters.push({ title: filter.title || 'JQL', jql: filter.jql }); }
  state.filterIndex = state.filters.length - 1;
  saveFilters();
  return !same;
}

function defaultFilters() {
  const ru = state.locale === 'ru';
  return [
    { title: ru ? 'Мои задачи' : 'My issues',
      jql: 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC' },
    { title: ru ? 'Я автор' : 'Reported by me',
      jql: 'reporter = currentUser() AND resolution = Unresolved ORDER BY updated DESC' },
    { title: ru ? 'Наблюдаю' : 'Watching',
      jql: 'watcher = currentUser() AND resolution = Unresolved ORDER BY updated DESC' },
  ];
}

// Filters typed by hand in the plugin settings: one per line, "Название | JQL".
function extraFilters() {
  return String(state.settings.filters || '').split('\n')
    .map((line) => line.trim()).filter(Boolean)
    .map((line) => {
      const separator = line.indexOf('|');
      return separator < 0
        ? { title: 'JQL', jql: line }
        : { title: line.slice(0, separator).trim(), jql: line.slice(separator + 1).trim(), fromSettings: true };
    })
    .filter((filter) => filter.jql);
}

function buildJQL(options) {
  const parts = [];
  if (options.project) { parts.push('project = ' + options.project.toUpperCase()); }
  if (options.mine) { parts.push('assignee = currentUser()'); }
  if (options.status === 'open') { parts.push('resolution = Unresolved'); }
  if (options.status === 'progress') { parts.push('statusCategory = "In Progress"'); }
  if (options.period === '7') { parts.push('updated >= -7d'); }
  if (options.period === '30') { parts.push('updated >= -30d'); }
  if (!parts.length) { parts.push('assignee = currentUser()'); }
  return parts.join(' AND ') + ' ORDER BY updated DESC';
}

function builderTitle(options) {
  const pieces = [];
  if (options.project) { pieces.push(options.project.toUpperCase()); }
  pieces.push(options.mine ? t('mine') : t('anyone'));
  if (options.status === 'open') { pieces.push(t('statusOpen').toLowerCase()); }
  if (options.status === 'progress') { pieces.push(t('statusProgress').toLowerCase()); }
  return pieces.join(' · ');
}

// Adds a condition to a JQL that may already end with ORDER BY.
function withClause(jql, clause) {
  const text = String(jql || '').trim();
  const match = /\border\s+by\b/i.exec(text);
  if (!match) { return text ? text + ' AND ' + clause : clause; }
  const where = text.slice(0, match.index).trim();
  const order = text.slice(match.index).trim();
  return (where ? where + ' AND ' + clause : clause) + ' ' + order;
}

// A link the user copied from Jira: a board, a project, an issue or a search.
async function filterFromLink(link) {
  const text = String(link || '').trim();
  const match = text.match(/^https?:\/\/([^/\s]+)(\/[^\s]*)?$/i);
  if (!match) { return null; }
  const host = match[1].toLowerCase();
  const path = match[2] || '';
  if (host !== site()) {
    // The address is part of what the user allows, so it goes through the host.
    fa.settings.set('site', host);
    return { pendingHost: host };
  }

  const query = path.indexOf('?') >= 0 ? path.slice(path.indexOf('?') + 1) : '';
  const parameters = {};
  for (const pair of query.split('&')) {
    if (!pair) { continue; }
    const index = pair.indexOf('=');
    const key = decodeURIComponent(index < 0 ? pair : pair.slice(0, index));
    const value = decodeURIComponent((index < 0 ? '' : pair.slice(index + 1)).replace(/\+/g, ' '));
    (parameters[key] = parameters[key] || []).push(value);
  }

  if (parameters.jql && parameters.jql.length) {
    return { title: t('fromLink'), jql: parameters.jql[0] };
  }

  // A link to a saved filter: take the filter itself, it is the whole query.
  const filterId = (parameters.filter && parameters.filter[0])
    || (path.match(/\/filters?\/(\d+)/) || [])[1];
  if (filterId && /^\d+$/.test(filterId)) {
    const filter = await call('/rest/api/2/filter/' + filterId);
    if (filter.jql) { return { title: filter.name || t('fromLink'), jql: filter.jql }; }
  }

  const board = path.match(/\/boards\/(\d+)/);
  const project = path.match(/\/projects\/([A-Za-z][A-Za-z0-9_]+)/);
  const issue = path.match(/\/browse\/([A-Za-z][A-Za-z0-9_]+)-\d+/);

  let jql = '';
  let title = '';
  if (board) {
    // A board is driven by a saved filter; take its JQL so the tab shows the
    // same issues the board does.
    try {
      const configuration = await call('/rest/agile/1.0/board/' + board[1] + '/configuration');
      const filterId = ((configuration.filter || {}).id) || '';
      if (filterId) {
        const filter = await call('/rest/api/2/filter/' + filterId);
        jql = filter.jql || '';
        title = filter.name || '';
      }
      if (!title) {
        const info = await call('/rest/agile/1.0/board/' + board[1]);
        title = info.name || '';
      }
    } catch (error) {
      jql = '';
    }
  }
  if (!jql && (project || issue)) {
    const key = (project ? project[1] : issue[1]).toUpperCase();
    jql = 'project = ' + key + ' AND resolution = Unresolved';
    title = title || key;
  }
  if (!jql) { return null; }

  // Board URLs carry the filters the user picked in the board header.
  const assignees = parameters.assignee || [];
  if (assignees.length) {
    jql = withClause(jql, 'assignee in (' + assignees.map((id) => '"' + id.replace(/"/g, '') + '"').join(', ') + ')');
  }
  if (parameters.text && parameters.text[0]) {
    jql = withClause(jql, 'text ~ "' + parameters.text[0].replace(/"/g, '') + '"');
  }
  if (!/\border\s+by\b/i.test(jql)) { jql += ' ORDER BY updated DESC'; }
  return { title: title || t('fromLink'), jql };
}

// Issues you follow in Jira. There is no push channel for this — Jira Cloud has
// webhooks, which need a public address, and no streaming API — so this asks on the
// same schedule as the list, and only about what changed recently.
async function checkWatched() {
  if (state.settings.notifyWatched === false) { return; }
  // Not more than once every few minutes, whatever else triggers a refresh.
  // Zero is a real value here, so it cannot be defaulted away with `||`.
  const minutes = state.settings.watchedIntervalMinutes;
  const every = (minutes === undefined || minutes === null ? 2 : Number(minutes)) * 60000;
  if (Date.now() - state.watchedAt < every) { return; }
  state.watchedAt = Date.now();
  let issues = [];
  try {
    issues = await search('watcher = currentUser() AND updated >= -3d ORDER BY updated DESC');
  } catch (error) {
    fa.log('наблюдаемые задачи: ' + String(error && error.message ? error.message : error));
    return;
  }

  const known = state.watched || {};
  const first = !Object.keys(known).length;
  const changed = [];
  const now = {};
  for (const issue of issues) {
    const stamp = issue.fields.updated || '';
    now[issue.key] = stamp;
    if (!first && known[issue.key] !== undefined && known[issue.key] !== stamp) { changed.push(issue); }
  }
  // Keys that were being watched before stay remembered, so a issue that falls out
  // of the three-day window does not come back as "changed" later.
  state.watched = Object.assign({}, known, now);

  if (!changed.length || state.settings.notify === false) { return; }
  if (changed.length === 1) {
    const issue = changed[0];
    fa.notify({
      title: issue.key + ' · ' + (issue.fields.summary || ''),
      subtitle: t('watchedUpdated') + ' · ' + ((issue.fields.status || {}).name || ''),
      icon: 'eye', tint: 'teal',
      // Pressing the notification opens that issue, not just the tab.
      action: 'open:' + issue.key,
    });
  } else {
    fa.notify({
      title: t('watchedUpdatedMany', changed.length),
      subtitle: changed.slice(0, 3).map((issue) => issue.key).join(', '),
      icon: 'eye', tint: 'teal',
      // Several at once: the feed of events is the thing to open.
      action: 'screen:events',
    });
  }
  for (const issue of changed.slice(0, 10)) {
    addEvent({
      key: issue.key,
      title: issue.key + ' · ' + (issue.fields.summary || ''),
      subtitle: t('watchedUpdated') + ' · ' + ((issue.fields.status || {}).name || ''),
      icon: 'eye', tint: 'teal',
    });
  }
}

// MARK: text helpers

// Jira's wiki markup, reduced to something readable in a small panel.
function plain(text) {
  return String(text || '')
    .replace(/\{code(:[^}]*)?\}/g, '')
    .replace(/\{quote\}/g, '')
    .replace(/\{noformat\}/g, '')
    .replace(/\{color(:[^}]*)?\}/g, '')
    .replace(/\[([^|\]]+)\|([^\]]+)\]/g, '$1 ($2)')
    .replace(/\[~accountid:[^\]]+\]/g, '@')
    .replace(/^[ \t]*[*#]+ /gm, '• ')
    .replace(/^h[1-6]\.\s*/gm, '')
    .replace(/[*_+]{1,2}([^*_+\n]+)[*_+]{1,2}/g, '$1')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ago(value) {
  const stamp = Date.parse(String(value || '').replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  if (!stamp) { return ''; }
  const seconds = Math.max(0, (Date.now() - stamp) / 1000);
  const ru = state.locale === 'ru';
  if (seconds < 60) { return ru ? 'сейчас' : 'now'; }
  if (seconds < 3600) { return Math.round(seconds / 60) + (ru ? ' мин' : ' min'); }
  if (seconds < 86400) { return Math.round(seconds / 3600) + (ru ? ' ч' : ' h'); }
  return Math.round(seconds / 86400) + (ru ? ' дн' : ' d');
}

function statusTint(issue) {
  const category = ((issue.fields.status || {}).statusCategory || {}).key || '';
  if (category === 'done') { return 'green'; }
  if (category === 'indeterminate') { return 'blue'; }
  return 'gray';
}

function priorityTint(issue) {
  const name = ((issue.fields.priority || {}).name || '').toLowerCase();
  if (name.includes('highest') || name.includes('blocker') || name.includes('критич')) { return 'red'; }
  if (name.includes('high') || name.includes('высок')) { return 'orange'; }
  if (name.includes('low') || name.includes('низк')) { return 'gray'; }
  return 'teal';
}

// MARK: lifecycle

fa.plugin({
  async load(env) {
    state.settings = env.settings || {};
    state.locale = env.locale || 'ru';
    state.token = fa.secrets.get('token') || '';
    const stored = fa.storage.get() || {};
    state.seen = stored.seen && typeof stored.seen === 'object' ? stored.seen : {};
    state.watched = stored.watched && typeof stored.watched === 'object' ? stored.watched : {};
    state.events = Array.isArray(stored.events) ? stored.events : [];
    state.filters = (stored.filters || []).filter((filter) => filter && filter.jql);
    if (!state.filters.length) { state.filters = defaultFilters(); }
    state.filters = state.filters.concat(extraFilters());
    state.filterIndex = Math.min(state.filterIndex, state.filters.length - 1);
    state.detail = null;
    state.error = '';
    state.screen = isConfigured() ? 'list' : 'setup';
    if (isConfigured()) { await this.refresh(); }
  },

  async refresh() {
    if (!isConfigured()) { state.screen = 'setup'; return; }
    const filter = state.filters[state.filterIndex];
    if (!filter) { return; }
    state.loading = true;
    state.error = '';
    fa.update();
    try {
      const issues = await search(filter.jql);
      fa.log('фильтр «' + filter.title + '»: задач ' + issues.length + ' | ' + filter.jql);
      // Each filter remembers its own issues: switching filters is not news, it is
      // just a different question asked of the same Jira.
      const key = filter.jql;
      const known = state.seen[key] || {};
      const firstLook = !state.seen[key];
      const fresh = issues.filter((issue) => !known[issue.key]);
      state.issues = issues;

      // Tell the notch about issues that appeared since the last look, and stay
      // quiet the first time a filter is used so it does not shout about everything.
      if (state.settings.notify !== false && !firstLook && !state.switching && fresh.length) {
        if (fresh.length === 1) {
          fa.notify({
            title: fresh[0].key + ' · ' + (fresh[0].fields.summary || ''),
            subtitle: t('newIssue'), icon: 'checklist', tint: 'blue',
            action: 'open:' + fresh[0].key,
          });
        } else {
          fa.notify({
            title: t('newIssues', fresh.length), subtitle: filter.title,
            icon: 'checklist', tint: 'blue', action: 'screen:events',
          });
        }
        for (const issue of fresh.slice(0, 10)) {
          addEvent({
            key: issue.key,
            title: issue.key + ' · ' + (issue.fields.summary || ''),
            subtitle: t('newIssueEvent', filter.title),
            icon: 'checklist', tint: 'blue',
          });
        }
      }
      const seen = {};
      for (const issue of issues) { seen[issue.key] = issue.fields.updated || '1'; }
      state.seen[key] = seen;
      await checkWatched();
      saveFilters();
    } catch (error) {
      state.error = String(error && error.message ? error.message : error);
    } finally {
      state.loading = false;
      state.switching = false;
    }
  },

  async action(id, payload) {
    const separator = String(id).indexOf(':');
    const name = separator < 0 ? String(id) : String(id).slice(0, separator);
    const argument = separator < 0 ? '' : String(id).slice(separator + 1);
    const text = String((payload && (payload.text || payload.query)) || '');

    try {
      switch (name) {
        case 'search': state.query = text; return;
        case 'refresh': await this.refresh(); return;
        case 'back':
          // Back goes where the issue was opened from: the list of issues, or the
          // feed of events if that is where it was picked.
          state.detail = null;
          state.screen = state.detailFrom || 'list';
          state.detailFrom = '';
          return;
        case 'screen':
          state.screen = argument;
          state.detail = null;
          state.detailFrom = '';
          state.error = '';
          return;
        case 'browse': fa.openURL(browseURL(argument)); return;
        case 'copyKey': fa.clipboard.copy(argument); return;
        case 'copyLink': fa.clipboard.copy(browseURL(argument)); return;
        case 'tokenPage': fa.openURL(TOKEN_URL); return;
        case 'markRead': {
          const event = state.events.filter((entry) => entry.id === argument)[0];
          if (event) { event.read = true; saveFilters(); }
          return;
        }
        case 'markAllRead':
          state.events.forEach((event) => { event.read = true; });
          saveFilters();
          return;
        case 'clearEvents':
          state.events = [];
          saveFilters();
          return;
        case 'filterSearch': state.filterQuery = text; return;
        case 'openEvent': {
          const event = state.events.filter((entry) => entry.id === argument)[0];
          if (event) { event.read = true; saveFilters(); }
          if (event && event.key) {
            state.screen = 'list';
            await this.action('open:' + event.key, {});
            // Set after opening, because opening clears it.
            state.detailFrom = 'events';
          }
          return;
        }
        case 'openFilter': {
          const filter = state.filters[state.filterIndex];
          if (filter) { fa.openURL(base() + '/issues/?jql=' + encodeURIComponent(filter.jql)); }
          return;
        }

        case 'filter':
          state.filterIndex = Number(argument) || 0;
          state.detail = null;
          state.query = '';
          // Looking at another filter is a question, not an event.
          state.switching = true;
          await this.refresh();
          return;

        case 'setupStep': {
          const draft = setupDraft();
          draft.step = Number(argument) || 0;
          state.error = '';
          return;
        }

        case 'setupNext': {
          const key = argument;
          const draft = setupDraft();
          state.error = '';
          const problem = setupProblem(key, text);
          if (problem) {
            state.error = problem;
            return;
          }
          // Saved as you go: leaving halfway does not throw away what was typed.
          if (key === 'site') {
            const host = text.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
            fa.settings.set('site', host);
            // The host writes the setting down and hands it back on its own time;
            // the wizard needs it right now, in this very step.
            state.settings.site = host;
            draft.site = 'https://' + host;
          } else if (key === 'email') {
            fa.settings.set('email', text);
            state.settings.email = text;
            draft.email = text;
          } else {
            fa.secrets.set('token', text);
            state.token = text;
          }
          draft.done[key] = true;

          const steps = setupSteps();
          const index = steps.indexOf(key);
          if (index < steps.length - 1) {
            draft.step = index + 1;
            return;
          }

          // The last step checks the whole thing at once and, if Jira refuses,
          // sends you back to the step that is actually wrong.
          state.busy = t('checking');
          fa.update();
          try {
            state.me = await call('/rest/api/2/myself');
            state.busy = '';
            state.setup = null;
            state.screen = 'list';
            await this.refresh();
          } catch (error) {
            state.busy = '';
            const blame = blameStep(error);
            draft.step = Math.max(steps.indexOf(blame.step), 0);
            draft.done[blame.step] = false;
            state.error = blame.message;
          }
          return;
        }

        case 'check': {
          state.busy = t('checking');
          fa.update();
          const me = await call('/rest/api/2/myself');
          state.me = me;
          state.busy = '';
          state.error = '';
          return;
        }

        case 'link': {
          state.busy = t('checking');
          fa.update();
          const filter = await filterFromLink(text);
          state.busy = '';
          if (!filter) { state.error = t('linkNotUnderstood'); return; }
          if (filter.pendingHost) { return; }
          addFilter(filter);
          state.screen = 'list';
          state.detail = null;
          state.switching = true;
          await this.refresh();
          return;
        }

        case 'pick': {
          state.busy = t('checking');
          state.screen = 'pick';
          fa.update();
          state.saved = await savedFilters();
          state.busy = '';
          return;
        }
        case 'addSaved': {
          const found = state.saved.filter((filter) => String(filter.id) === argument)[0];
          if (found) {
            addFilter({ title: found.name, jql: found.jql });
            state.screen = 'list';
            state.detail = null;
            state.switching = true;
            await this.refresh();
          }
          return;
        }

        case 'removeFilter': {
          state.filters.splice(Number(argument), 1);
          if (!state.filters.length) { state.filters = defaultFilters(); }
          state.filterIndex = Math.min(state.filterIndex, state.filters.length - 1);
          saveFilters();
          return;
        }

        case 'builderProject': state.builder.project = text; return;
        case 'builderMine': state.builder.mine = argument === 'yes'; return;
        case 'builderStatus': state.builder.status = argument; return;
        case 'builderPeriod': state.builder.period = argument; return;
        case 'builderCreate':
          addFilter({ title: builderTitle(state.builder), jql: buildJQL(state.builder) });
          state.screen = 'list';
          state.detail = null;
          state.switching = true;
          await this.refresh();
          return;

        case 'open': {
          // The detail is only drawn from the plain list screen, so a notification
          // that arrives while another screen is up still shows the issue.
          state.screen = 'list';
          state.detailFrom = '';
          state.detail = { key: argument, issue: null, comments: [], loading: true };
          fa.update();
          const issue = await call('/rest/api/2/issue/' + encodeURIComponent(argument)
            + '?fields=summary,status,priority,assignee,reporter,updated,created,description');
          const comments = await call('/rest/api/2/issue/' + encodeURIComponent(argument)
            + '/comment?maxResults=20&orderBy=-created');
          state.detail = {
            key: argument, issue, comments: (comments.comments || []).slice().reverse(), loading: false,
          };
          return;
        }
      }
    } catch (error) {
      state.busy = '';
      state.detail = null;
      state.error = String(error && error.message ? error.message : error);
    }
  },

  render() {
    if (state.screen === 'setup') { return renderSetup(); }
    if (state.screen === 'filters') { return renderFilters(); }
    if (state.screen === 'builder') { return renderBuilder(); }
    if (state.screen === 'pick') { return renderPick(); }
    if (state.screen === 'events') { return renderEvents(); }
    if (state.detail) { return renderDetail(); }
    return renderList();
  },
});

// MARK: screens

function errorNode() {
  return state.error
    ? [{ type: 'note', icon: 'exclamationmark.triangle', text: state.error, tint: 'red' }]
    : [];
}

function busyNode() {
  return state.busy ? [{ type: 'progress', text: state.busy }] : [];
}

/// The steps, in order. Server and Data Center sign in with a token alone, so
/// there is no email step to walk through.
function setupSteps() {
  return isCloud() ? ['site', 'email', 'token'] : ['site', 'token'];
}

function setupDraft() {
  if (!state.setup) {
    state.setup = {
      step: 0,
      site: site() ? 'https://' + site() : '',
      email: String(state.settings.email || ''),
      token: '',
      done: { site: !!site(), email: !!state.settings.email, token: !!state.token },
    };
  }
  return state.setup;
}

/// Each step is checked before it lets you move on, so a mistake is caught where
/// it was made instead of at the end.
function setupProblem(key, value) {
  const text = String(value || '').trim();
  if (key === 'site') {
    const host = text.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) ? '' : t('badSite');
  }
  if (key === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? '' : t('badEmail');
  }
  return text ? '' : t('badTokenEmpty');
}

/// Which step a failed check belongs to: an address that does not answer is not
/// the token's fault, and a refused token is not the address's.
function blameStep(error) {
  const status = error && error.status;
  if (status === 401 || status === 403) {
    return { step: 'token', message: t('checkFailed') };
  }
  if (!status || status === 404) {
    return { step: 'site', message: t('siteUnreachable') };
  }
  return { step: 'token', message: String((error && error.message) || t('checkFailed')) };
}

function renderSetup() {
  const draft = setupDraft();
  const steps = setupSteps();
  const index = Math.min(Math.max(draft.step, 0), steps.length - 1);
  const key = steps[index];
  const nodes = [{
    type: 'header',
    title: t('setupTitle'),
    subtitle: t('stepOf', String(index + 1), String(steps.length)),
  }].concat(errorNode(), busyNode());

  // Every step is one tap away, so a typo two steps back is easy to fix.
  nodes.push({
    type: 'buttons',
    items: steps.map((name, position) => ({
      title: (position + 1) + '. ' + t('step' + name[0].toUpperCase() + name.slice(1))
        + (draft.done[name] ? ' ✓' : ''),
      // The step you are on is the highlighted one.
      tint: position === index ? 'accent' : 'gray',
      action: 'setupStep:' + position,
    })),
  });

  nodes.push({ type: 'text', value: t('hint' + key[0].toUpperCase() + key.slice(1)), style: 'caption' });

  if (key === 'token') {
    nodes.push({ type: 'note', icon: 'key', text: t('tokenHelp'), tint: 'gray' });
    nodes.push({ type: 'buttons', items: [{ title: t('createToken'), icon: 'arrow.up.forward.app', action: 'tokenPage' }] });
  }

  nodes.push({
    type: 'input',
    label: t('step' + key[0].toUpperCase() + key.slice(1)),
    placeholder: t(key === 'site' ? 'linkPlaceholder' : (key === 'email' ? 'emailPlaceholder' : 'tokenPlaceholder')),
    value: key === 'token' ? '' : draft[key],
    secret: key === 'token',
    submit: index === steps.length - 1 ? t('finish') : t('next'),
    action: 'setupNext:' + key,
  });

  if (index > 0) {
    nodes.push({
      type: 'buttons',
      items: [{ title: t('back'), icon: 'chevron.left', action: 'setupStep:' + (index - 1) }],
    });
  }
  if (key === 'site' && !isCloud()) {
    nodes.push({ type: 'note', icon: 'info.circle', text: t('serverHint'), tint: 'gray' });
  }
  return nodes;
}

function renderList() {
  const filter = state.filters[state.filterIndex] || { title: '', jql: '' };
  const nodes = [{
    type: 'header', title: filter.title,
    subtitle: state.issues.length ? String(state.issues.length) : '',
    actions: [
      { action: 'screen:events', icon: unreadCount() ? 'bell.badge.fill' : 'bell', help: t('events'),
        tint: unreadCount() ? 'orange' : 'accent' },
      { action: 'screen:filters', icon: 'line.3.horizontal.decrease.circle', help: t('filters') },
      { action: 'refresh', icon: 'arrow.clockwise', help: t('refresh') },
    ],
  }];

  if (state.filters.length > 1) {
    nodes.push({
      type: 'buttons',
      items: state.filters.slice(0, 6).map((entry, index) => ({
        title: entry.title, action: 'filter:' + index,
        tint: index === state.filterIndex ? 'accent' : 'gray',
      })),
    });
  }
  nodes.push({ type: 'search', placeholder: t('search'), value: state.query, action: 'search' });
  nodes.push.apply(nodes, errorNode());

  const query = state.query.trim().toLowerCase();
  const visible = state.issues.filter((issue) => !query
    || issue.key.toLowerCase().includes(query)
    || String(issue.fields.summary || '').toLowerCase().includes(query));

  if (!visible.length) {
    nodes.push({
      type: 'empty',
      icon: state.loading ? 'arrow.clockwise' : 'checklist',
      title: state.loading ? t('loading') : (query ? t('nothing') : t('empty')),
      subtitle: state.loading || query ? '' : filter.jql,
      action: state.loading || query ? undefined : { title: t('openInJira'), action: 'openFilter' },
    });
    return nodes;
  }

  nodes.push({
    type: 'list',
    rows: visible.map((issue) => ({
      id: issue.key,
      icon: 'circle.fill',
      iconTint: priorityTint(issue),
      title: issue.key,
      subtitle: String(issue.fields.summary || ''),
      trailing: ago(issue.fields.updated),
      badges: [{ text: ((issue.fields.status || {}).name || ''), tint: statusTint(issue) }],
      tap: 'open:' + issue.key,
      actions: [
        { action: 'browse:' + issue.key, icon: 'arrow.up.forward.app', help: t('open') },
        { action: 'copyKey:' + issue.key, icon: 'number', help: t('copyKey') },
        { action: 'copyLink:' + issue.key, icon: 'link', help: t('copyLink') },
      ],
    })),
  });
  return nodes;
}

function renderFilters() {
  const nodes = [{
    type: 'header', title: t('myFilters'),
    actions: [{ action: 'back', icon: 'chevron.left', help: t('back') }],
  }].concat(errorNode(), busyNode());

  nodes.push({
    type: 'buttons', items: [
      { title: t('fromJira'), icon: 'tray.and.arrow.down', action: 'pick' },
      { title: t('builder'), icon: 'slider.horizontal.3', action: 'screen:builder' },
    ],
  });
  nodes.push({ type: 'text', value: t('fromLink'), style: 'caption' });
  nodes.push({ type: 'input', placeholder: t('linkPlaceholder'), submit: t('add'), action: 'link' });

  nodes.push({
    type: 'list',
    rows: state.filters.map((filter, index) => ({
      id: 'filter-' + index,
      icon: index === state.filterIndex ? 'checkmark.circle.fill' : 'line.3.horizontal.decrease.circle',
      iconTint: index === state.filterIndex ? 'accent' : 'gray',
      title: filter.title,
      subtitle: filter.jql,
      tap: 'filter:' + index,
      actions: filter.fromSettings ? [] : [{ action: 'removeFilter:' + index, icon: 'xmark', help: t('remove'), tint: 'red' }],
    })),
  });
  nodes.push({ type: 'note', icon: 'info.circle', text: t('advanced'), tint: 'gray' });
  return nodes;
}

function renderBuilder() {
  const builder = state.builder;
  const nodes = [{
    type: 'header', title: t('builder'),
    actions: [{ action: 'screen:filters', icon: 'chevron.left', help: t('back') }],
  }].concat(errorNode());

  nodes.push({ type: 'text', value: t('project'), style: 'caption' });
  nodes.push({
    type: 'input', placeholder: t('projectPlaceholder'), value: builder.project,
    submit: t('save'), action: 'builderProject',
  });
  nodes.push({
    type: 'buttons', items: [
      { title: t('mine'), action: 'builderMine:yes', tint: builder.mine ? 'accent' : 'gray' },
      { title: t('anyone'), action: 'builderMine:no', tint: builder.mine ? 'gray' : 'accent' },
    ],
  });
  nodes.push({
    type: 'buttons', items: [
      { title: t('statusOpen'), action: 'builderStatus:open', tint: builder.status === 'open' ? 'accent' : 'gray' },
      { title: t('statusProgress'), action: 'builderStatus:progress', tint: builder.status === 'progress' ? 'accent' : 'gray' },
      { title: t('statusAny'), action: 'builderStatus:any', tint: builder.status === 'any' ? 'accent' : 'gray' },
    ],
  });
  nodes.push({
    type: 'buttons', items: [
      { title: t('periodAny'), action: 'builderPeriod:any', tint: builder.period === 'any' ? 'accent' : 'gray' },
      { title: t('period7'), action: 'builderPeriod:7', tint: builder.period === '7' ? 'accent' : 'gray' },
      { title: t('period30'), action: 'builderPeriod:30', tint: builder.period === '30' ? 'accent' : 'gray' },
    ],
  });
  nodes.push({ type: 'text', value: buildJQL(builder), style: 'mono' });
  nodes.push({ type: 'buttons', items: [{ title: t('create'), icon: 'plus', action: 'builderCreate' }] });
  return nodes;
}

// What happened lately, and what you have already looked at.
function renderEvents() {
  const unread = unreadCount();
  const nodes = [{
    type: 'header',
    title: t('events'),
    subtitle: unread ? t('unread', unread) : '',
    actions: [
      { action: 'back', icon: 'chevron.left', help: t('back') },
      { action: 'markAllRead', icon: 'checkmark.circle', help: t('markAllRead') },
      { action: 'clearEvents', icon: 'trash', help: t('remove'), tint: 'red' },
    ],
  }];

  if (!state.events.length) {
    nodes.push({ type: 'empty', icon: 'bell.slash', title: t('noEvents') });
    return nodes;
  }

  nodes.push({
    type: 'list',
    rows: state.events.map((event) => ({
      id: event.id,
      icon: event.read ? 'circle' : 'circle.fill',
      iconTint: event.read ? 'gray' : (event.tint || 'blue'),
      title: event.title,
      subtitle: event.subtitle,
      trailing: ago(new Date(event.at).toISOString()),
      tap: 'openEvent:' + event.id,
      actions: event.read ? [] : [{ action: 'markRead:' + event.id, icon: 'checkmark', help: t('markRead') }],
    })),
  });
  return nodes;
}

function renderPick() {
  const nodes = [{
    type: 'header', title: t('pickTitle'),
    actions: [{ action: 'screen:filters', icon: 'chevron.left', help: t('back') }],
  }].concat(errorNode(), busyNode());

  if (!state.busy && !state.saved.length) {
    nodes.push({ type: 'empty', icon: 'tray', title: t('noSaved') });
    return nodes;
  }
  nodes.push({ type: 'search', placeholder: t('searchFilters'), value: state.filterQuery, action: 'filterSearch' });

  const query = state.filterQuery.trim().toLowerCase();
  const visible = state.saved.filter((filter) => !query
    || String(filter.name || '').toLowerCase().includes(query)
    || String(filter.jql || '').toLowerCase().includes(query));
  if (!visible.length) {
    nodes.push({ type: 'empty', icon: 'magnifyingglass', title: t('nothing') });
    return nodes;
  }
  nodes.push({
    type: 'list',
    rows: visible.map((filter) => ({
      id: String(filter.id),
      icon: 'star',
      iconTint: filter.favourite ? 'yellow' : 'gray',
      title: String(filter.name || ''),
      subtitle: String(filter.jql || ''),
      tap: 'addSaved:' + filter.id,
    })),
  });
  return nodes;
}

function renderDetail() {
  const detail = state.detail;
  const nodes = [{
    type: 'header', title: detail.key,
    actions: [
      { action: 'back', icon: 'chevron.left', help: t('back') },
      { action: 'browse:' + detail.key, icon: 'arrow.up.forward.app', help: t('open') },
      { action: 'copyKey:' + detail.key, icon: 'number', help: t('copyKey') },
      { action: 'copyLink:' + detail.key, icon: 'link', help: t('copyLink') },
    ],
  }];
  if (detail.loading || !detail.issue) {
    nodes.push({ type: 'progress', text: t('loading') });
    return nodes;
  }

  const fields = detail.issue.fields || {};
  nodes.push({ type: 'text', value: String(fields.summary || ''), style: 'title' });
  nodes.push({
    type: 'text', style: 'caption',
    value: [
      t('status') + ': ' + ((fields.status || {}).name || '—'),
      t('assignee') + ': ' + ((fields.assignee || {}).displayName || t('nobody')),
      t('priority') + ': ' + ((fields.priority || {}).name || '—'),
      t('updated') + ': ' + ago(fields.updated),
    ].join('   ·   '),
  });

  const description = plain(fields.description);
  nodes.push({
    type: 'section', title: t('description'),
    children: [{ type: 'text', value: description || t('noDescription'), style: description ? 'body' : 'caption' }],
  });

  const comments = detail.comments || [];
  nodes.push({
    type: 'section', title: t('comments') + (comments.length ? ' · ' + comments.length : ''),
    children: comments.length
      ? comments.slice(0, 10).map((comment) => ({
          type: 'text', style: 'body',
          value: ((comment.author || {}).displayName || '') + ' · ' + ago(comment.created) + '\n' + plain(comment.body),
        }))
      : [{ type: 'text', value: t('noComments'), style: 'caption' }],
  });
  return nodes;
}
