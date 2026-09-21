// Заготовка плагина FastAction.
//
// Плагин живёт в песочнице: сети, файлов и таймеров браузера тут нет, наружу
// ведёт только `fa` — и только то, что вы попросили в permissions манифеста
// и что разрешил пользователь. Этот плагин просит один clipboard.
//
// Правка скрипта требует нового хеша, иначе приложение откажется его запускать:
//     tools/fastplugin stamp

// Всё состояние — в модуле: приложение вызывает методы, а не пересоздаёт плагин.
let count = 0;
let greeting = 'Привет';

fa.plugin({
  // Вызывается один раз при запуске. env.settings — то, что пользователь ввёл
  // в настройках плагина по вашему описанию в manifest.json.
  async load(env) {
    greeting = env.settings.greeting || 'Привет';
  },

  // Вызывается по кнопке обновления и по refreshMinutes, если вы его указали.
  async refresh() {},

  // Что показать. Возвращайте узлы описания экрана — список их видов в PLUGINS.md.
  render() {
    return [
      {
        type: 'header',
        title: greeting,
        subtitle: count ? 'нажатий: ' + count : 'нажмите кнопку',
        actions: [{ action: 'reset', icon: 'arrow.counterclockwise', help: 'Сбросить' }],
      },
      {
        type: 'list',
        rows: [
          {
            id: 'greet',
            icon: 'hand.wave',
            title: greeting + '!',
            subtitle: 'Нажмите, чтобы скопировать',
            tap: 'copy',
          },
        ],
      },
      { type: 'note', text: 'Это заготовка. Замените render и action на своё.' },
    ];
  },

  // Ответ на нажатие. Идентификатор — тот, что вы положили в tap или action.
  async action(id) {
    if (id === 'copy') {
      count += 1;
      fa.clipboard.copy(greeting);
      return;
    }
    if (id === 'reset') {
      count = 0;
    }
  },
});
