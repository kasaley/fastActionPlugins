# How to write a FastAction plugin

[Русская версия](PLUGINS.md)

A plugin is a tab in the notch, written in JavaScript. It gets no access to files, to the
network, or to other plugins: everything it has is the `fa` object, and every call there is
checked twice — is it declared in the manifest, and did the user allow it?

Plugins are not part of the app. "Jira" and "1Password" are published by us — they install from
**Settings → Plugins** with a single click, are written against this same API and run in the same
sandbox: they hold no special privileges.

## Contents

- [Quick start](#quick-start)
- [manifest.json](#manifestjson)
- [Lifecycle](#lifecycle)
- [Describing the screen](#describing-the-screen)
- [The `fa` API](#the-fa-api)
- [Security model](#security-model)
- [Development and installation](#development-and-installation)

## Quick start

```
weather.fastplugin/
  manifest.json
  plugin.js
```

`manifest.json`:

```json
{
  "id": "com.example.weather",
  "name": "Weather",
  "caption": "WEATHER",
  "icon": "cloud.sun",
  "summary": "The weather outside, in the notch.",
  "version": "1.0.0",
  "author": "Example",
  "permissions": { "network": ["api.open-meteo.com"] },
  "settings": [
    { "key": "city", "type": "string", "title": "City", "default": "London" }
  ],
  "refreshMinutes": 15
}
```

`plugin.js`:

```js
let temperature = null;

fa.plugin({
  async load(env) {
    this.city = env.settings.city || 'London';
    await this.refresh();
  },

  async refresh() {
    const response = await fa.http.get(
      'https://api.open-meteo.com/v1/forecast?latitude=51.51&longitude=-0.13&current=temperature_2m'
    );
    temperature = response.json && response.json.current
      ? response.json.current.temperature_2m : null;
  },

  render() {
    return [
      { type: 'header', title: this.city, actions: [{ action: 'refresh', icon: 'arrow.clockwise' }] },
      { type: 'text', value: temperature === null ? '—' : temperature + ' °C', style: 'title' },
    ];
  },

  async action(id) {
    if (id === 'refresh') { await this.refresh(); }
  },
});
```

Pick the folder (or a zip archive of it) in **Settings → Plugins → Install plugin…** and grant
what it asks for — the tab shows up in the panel. Installed plugins live in
`~/Library/Application Support/FastAction/Plugins/`.

## manifest.json

| Field | Required | Description |
|---|---|---|
| `id` | yes | Lowercase Latin letters, digits, dots and hyphens only. Becomes the namespace in the keychain and the name of the data folder. |
| `name` | yes | The name shown in settings and in the tab list. |
| `icon` | yes | An SF Symbol name. A name that does not exist is replaced with a neutral icon. |
| `caption` | no | The caption in the panel header, usually in caps. Defaults to `name` in caps. |
| `summary` | no | A one-line description for the settings page. |
| `version`, `author` | no | Shown to the user. |
| `apiVersion` | no | The API version the plugin was written against (currently `1`). A plugin asking for a higher number will not start. |
| `entry` | no | The script name; `plugin.js` by default. |
| `integrity` | no, but recommended | `{"plugin.js": "sha256-<hash>"}`. If the file does not match the hash, the plugin will not load. |
| `permissions` | no | See below. Whatever is not in the manifest, the plugin will never get. |
| `settings` | no | The schema of the settings form; the host draws the form itself. |
| `refreshMinutes` | no | How often to call `refresh()` in the background. One minute is the minimum. |

### permissions

```json
"permissions": {
  "network": ["*.atlassian.net", "$setting:site"],
  "secrets": true,
  "clipboard": true,
  "notifications": true,
  "openURL": true,
  "autofill": false,
  "exec": [{ "tool": "op", "reason": "Read items through the official CLI" }]
}
```

- **`network`** — a list of hosts. The `*.example.com` wildcard is supported, as is
  `$setting:<key>` — a host the user types in themselves in a setting of type `host`. Only `https`
  is allowed. A redirect to a host outside the list is cut off.
- **`secrets`** — a namespace of its own in the keychain (`app.fastaction.plugin.<id>`). Other plugins' entries are invisible.
- **`clipboard`** — writing to the clipboard. Nobody gets to read it.
- **`notifications`** — notifications in the notch; they obey the app's global settings
  (display duration, sound, Focus mode).
- **`openURL`** — open an `http(s)` link in the browser in response to a user click.
- **`exec`** — running a program from a short list the host knows about (currently only `op`).
  No shell involved: arguments are passed as argv.
- **`autofill`** — typing a username and password into the frontmost app on an explicit user command.

### settings

```json
{ "key": "site", "type": "host", "title": "Jira address", "placeholder": "company.atlassian.net",
  "help": "The only address this plugin is allowed to talk to" }
```

Types: `string`, `secret`, `host`, `bool`, `number` (with `min`/`max`), `select` (an `options`
array whose elements look like `"value|Label"`), `jql` (a multi-line field).

Values arrive in `load(env)` as `env.settings`. The exception is `secret`: such fields
never reach `env.settings`, and are read through `fa.secrets.get(<key>)`.

## Lifecycle

A plugin registers itself once:

```js
fa.plugin({ load, refresh, render, action });
```

| Method | When it is called | May be async |
|---|---|---|
| `load(env)` | at startup and after the settings change | yes |
| `refresh()` | when the tab is opened and on the `refreshMinutes` timer | yes |
| `render()` | after every `load`, `refresh` and `action` | no, and it must be fast |
| `action(id, payload)` | on a click or on input in the search field | yes |

`env` contains: `settings` (the form values), `locale` (`ru`, `en`, `es`, `de`, `fr`),
`tools` (which of the declared programs are installed), and `apiVersion`.

A plugin keeps its state in its own module; to carry it across runs, save it through `fa.storage`.

## Describing the screen

`render()` returns an array of nodes. The host draws them with its own widgets — a plugin cannot
draw an arbitrary interface, a popup window, or anything resembling a system password prompt.

```js
{ type: 'header', title: 'My issues', subtitle: '12',
  actions: [{ action: 'refresh', icon: 'arrow.clockwise', help: 'Refresh' }] }
{ type: 'search', placeholder: 'Search', value: query, action: 'search' }   // payload: { query }
{ type: 'input', label: 'Link', placeholder: 'https://…', value: '', submit: 'Add',
  action: 'link', secret: false }                                          // payload: { text }
{ type: 'text', value: 'Any text', style: 'title' | 'body' | 'caption' | 'mono' }
{ type: 'section', title: 'Comments', children: [ ... ] }
{ type: 'list', rows: [ {
    id: 'ABC-1', icon: 'circle.fill', iconTint: 'orange',
    title: 'ABC-1', subtitle: 'Fix the panel', trailing: '2 h',
    badges: [{ text: 'In Progress', tint: 'blue' }],
    tap: 'open:ABC-1',
    actions: [{ action: 'copyKey:ABC-1', icon: 'number', help: 'Copy the key' }],
} ] }
{ type: 'field', label: 'Password', value: '…', secret: true, copy: 'copyField:password' }
{ type: 'button', title: 'Autofill', icon: 'keyboard', action: 'autofill' }
{ type: 'buttons', items: [ ... ] }
{ type: 'empty', icon: 'key', title: 'No items', subtitle: '…',
  action: { title: 'Show', action: 'unlock' } }
{ type: 'progress', text: 'Loading…' }
{ type: 'note', icon: 'info.circle', text: 'An explanation', tint: 'gray' }
{ type: 'spacer' }
```

Colors come from a palette: `accent`, `gray`, `blue`, `green`, `orange`, `red`, `purple`, `teal`, `yellow`.
A field with `secret: true` is shown as dots; the value is revealed only by pressing a button, and
copying goes through `fa.clipboard.copy(..., { sensitive: true })`.

Limits: up to 400 nodes, up to 300 rows in a list, up to 4000 characters in a string — anything beyond that is truncated.

## The `fa` API

```js
// Network — declared hosts only, https only.
await fa.http.request({ url, method, headers, body })   // → { status, headers, body }
await fa.http.get(url, options)                          // → { status, headers, body, json }
await fa.http.post(url, bodyObject, options)

// Your own secrets (the keychain), your own namespace only.
fa.secrets.get('token'); fa.secrets.set('token', '…'); fa.secrets.remove('token');

// Your own storage: any JSON up to 256 KB.
fa.storage.get(); fa.storage.set({ seen: {} });

fa.clipboard.copy('text', { sensitive: true, clearAfter: 45 });
fa.notify({ title, subtitle, trailing, icon, tint });
fa.openURL('https://example.com/');
await fa.exec('op', ['item', 'list', '--format=json'], { timeout: 60 });  // → { status, stdout, stderr }
fa.isInstalled('op');
fa.autofill({ username, password });
fa.base64('string');
// Redraw the tab right now: show "loading", and only then make the slow call.
fa.update();
// Fill in one of your own settings. A field of type host takes effect only after the user
// confirms it — that address decides where the plugin is allowed to go at all.
fa.settings.set('site', 'company.atlassian.net');
fa.log('anything you like');     // visible in Settings → Plugins → Plugin log
```

If the permission is missing, the call throws (`fa.exec` and `fa.http` reject their promise). You can
catch that and show a message that makes sense.

Limits: request body ≤ 1 MB, response ≤ 5 MB, a 20 s request timeout, up to 20 headers; `exec` — up to 24
arguments, a timeout of up to 60 s, output up to 2 MB; storage ≤ 256 KB; a single plugin call — no longer than 45 s.

What the sandbox does not have at all: `fetch`, `XMLHttpRequest`, `require`, `process`, `setTimeout`,
`localStorage`, access to the file system, and access to the app's own objects.

## Security model

| What | How it is limited |
|---|---|
| Execution | A separate JavaScriptCore virtual machine per plugin. Plugins cannot see one another. |
| Hangs | JavaScript running uninterrupted for more than 2 s is aborted; a call taking longer than 45 s is treated as unanswered. |
| Network | `https` only, manifest hosts only, no cookies; redirects outside the list are cut off, and `Set-Cookie` never reaches the plugin. |
| Secrets | The keychain, namespaced by the plugin's `id`. Secrets from the settings form never reach `env.settings`. |
| Clipboard | Write only. Secret values are marked `org.nspasteboard.ConcealedType` (so they stay out of clipboard history) and are cleared on a timer. |
| Programs | A short list of known programs, absolute paths, argv with no shell, empty stdin, a stripped-down environment, no way to substitute the configuration, and a timeout that force-terminates the process. |
| Interface | The plugin sends data, the host draws it. It cannot draw its own window, a password field, or a system prompt. |
| Integrity | The script's hash in the manifest is verified at load time; a package that has changed loses the permissions it was granted and asks for consent again. |
| Consent | Granted item by item and revocable at any moment in **Settings → Plugins**. A disabled plugin does not run at all. |
| Provenance | A plugin from the catalog and a plugin installed by hand are labelled differently; before installing anything that did not come from the catalog, the app warns that we have not reviewed it. |
| Log | Every request to a host is visible to the user in the plugin log. |
| Addresses set by the plugin | `fa.settings.set` on a field of type `host` changes nothing by itself: the user confirms the new address in the tab. |

You can check all of this yourself: a debug build launched with `-debugPluginSelfTest YES`
runs 78 checks covering the sandbox, both bundled plugins, real program launches,
and the access rules.

## Development and installation

Run every command from the root of this repository; there is nothing to install, Python 3 is enough.

```
tools/fastplugin new weather --title Weather  # a scaffold in plugins/weather.fastplugin
tools/fastplugin stamp weather                # the script's hash → into the manifest
tools/fastplugin check weather                # the manifest parses and makes sense
tools/fastplugin package weather              # build/weather.fastplugin.zip + sha256
```

1. `tools/fastplugin new <latin-name> --title "What to call it"` — you get a folder
   `name.fastplugin` with a working manifest and a skeleton `plugin.js`.
2. Fix `id` and `author` in the manifest: the `id` must be yours, not `com.example.…`.
3. **Settings → Plugins → Install plugin…**, pick the folder or the zip, and grant what it asks for.
4. After every edit to the script — `tools/fastplugin stamp <name>` and **Restart**
   on the plugin's card. Without that the app will refuse to run the plugin: the hash in the
   manifest no longer matches the script.

Handy while debugging: `fa.log(...)` writes to the plugin log (Settings → Plugins → Plugin log),
and runtime errors are shown right in the tab.

A plugin's data lives in `~/Library/Application Support/FastAction/PluginData/<id>/`, its secrets
in the keychain, its permissions in `plugin-grants.json`. Removing a plugin erases all of that.

## Updates

Once a day, and after every update of its own, the app checks the installed plugins
against the catalog. If a newer version is out and the set of requested permissions is the same, the
plugin updates itself (you can turn this off in **Settings → Plugins**). If the plugin has started
asking for more, it waits: settings show "Update to …" marked "requests new permissions".

This is why an honest `version` matters in a catalog entry: it is how the app knows something new has come out.

## Catalog

The list of published plugins lives in [`plugins.json`](../plugins.json) in this repository;
the app downloads it and shows it in **Settings → Plugins**. The human-readable version of the same
list is [docs/catalog.md](catalog.md): descriptions from the authors, links to repositories, who asks for what.

To get listed there:

1. Publish the plugin's archive in a release of **your own** repository — as a link to a specific tag,
   not to `latest`.
2. `tools/fastplugin entry <plugin> <link to the archive>` will print a ready-made entry.
3. Send a pull request adding that entry to `plugins.json`.

The PR checks run on their own: the archive is downloaded, its hash is compared against the entry, and the
manifest inside is parsed and checked against its own hashes. Swapping the published archive after review
will not work — the app computes the hash before installing and will refuse to install the wrong thing.

## What's next

- Plugin updates straight from the catalog, and package signing by authors.
- Extending the list of programs available to `exec` as dependable use cases emerge.
- Notifications with actions, and a more flexible schedule for background tasks.
