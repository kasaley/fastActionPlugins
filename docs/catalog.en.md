# The FastAction plugin catalogue

[Русская версия](catalog.md)

Plugins are not part of the app. They are installed in **Settings → Plugins**: the app takes
this list, shows what a plugin asks for, and installs it only with your consent. Every plugin
runs in a sandbox — what that means is described in [PLUGINS.en.md](PLUGINS.en.md).

Descriptions are the authors' own, as written.

<!-- список -->

<!-- This section is generated from plugins.json: tools/fastplugin index page -->

## From the FastAction team

### [Jira](https://github.com/kasaley/FastActionJira)

Jira issues by your own filters: status and priority in the row, description and comments in the panel, a feed of what changed, opening in the browser and copying a key or link.

- Author: FastAction
- Version: 1.4.0
- Asks for: clipboard, network, notifications, openURL, secrets
- Talks to: the address from the plugin's own settings

### [1Password](https://github.com/kasaley/FastAction1Password)

The 1Password items you reach for most: fields, one-click copying and filling through the official op CLI.

- Author: FastAction
- Version: 1.0.0
- Asks for: autofill, clipboard, exec, openURL

## From the community

Nothing yet. Yours could be the first — how to send it is written below.

<!-- /список -->
## How to get on this list

1. Build your plugin and publish the archive in a release of **your own** repository.
   The link must point at a specific release (`/releases/download/v1.0.0/…`), never at
   `latest`: the hash in the entry pins that exact version, and a floating link would stop
   matching it the moment you cut your next release.
2. Get a ready-made entry: `tools/fastplugin entry <plugin> <link to the archive>`.
3. Send a pull request adding that entry to `plugins.json`.

The checks run themselves on the pull request: the archive is downloaded, its hash is compared
with the entry, and the manifest inside is parsed and checked against its own hashes. A red CI
means the entry and the archive disagree, and review does not start until they agree.

**What we look at by eye:** code that is clear rather than obfuscated, every permission
explainable by what the plugin is for, hosts matching the ones declared.

One boundary is worth understanding: the sandbox limits the damage, but nothing stops a plugin
you yourself granted "network" and "secrets" from sending its own token to its own server.
Install what you trust the author of, and look at the list of permissions.
