# The FastAction plugin catalogue

[Русская версия](README.md)

This is where [FastAction](https://github.com/kasaley/fastActionVersions) takes its list of
plugins from. The author's guide and the tool that builds and publishes plugins live here too.

- **[The catalogue](docs/catalog.en.md)** — what exists and what each plugin asks for.
- **[How to write a plugin](docs/PLUGINS.en.md)** — the API, the sandbox, the screen
  description, examples.
- **[plugins.json](plugins.json)** — the very list the app downloads.

No plugin code lives here: each plugin has its own repository and its own releases. Ours —
[Jira](https://github.com/kasaley/FastActionJira) and
[1Password](https://github.com/kasaley/FastAction1Password) — follow the same rules as anyone
else's.

## Getting into the catalogue

1. Build your plugin and publish the archive in a release of **your own** repository —
   a link to a specific tag, never to `latest`.
2. `tools/fastplugin entry <plugin> <link to the archive>` prints a ready-made entry.
3. Send a pull request adding that entry to `plugins.json`.

The checks run themselves: the archive is downloaded, its hash is compared with the entry, and
the manifest inside is parsed and checked against its own hashes. A red CI means the entry and
the archive disagree, and review does not start until they agree.

## The tool

Python 3 is all you need — no dependencies. The same single file works here and in a
single-plugin repository: it finds plugins in `plugins/` or at the root by itself, and takes
the repository address from git.

```sh
tools/fastplugin new weather --title Weather   # a plugin to start from
tools/fastplugin stamp weather                 # required after every edit to the script
tools/fastplugin check weather                 # permissions, hosts, settings, exec
tools/fastplugin package weather               # archive + sha256
tools/fastplugin entry weather <url>           # a ready-made entry for the pull request
tools/fastplugin index audit                   # download the archives and compare hashes
tools/fastplugin index page                    # rebuild both catalogue pages from the index
tools/fastplugin release weather               # tag, release, and the entry for the catalogue
```

Copy `tools/fastplugin` into your own plugin repository — it stands on its own.

## How this is checked

Plugins are not signed. Trust rests on two hashes, and both are required:

**The sha256 of each script** lives in the manifest's `integrity`. The app checks it on every
launch, so a plugin edited after installation simply will not run. Hence the rule: edit the
script, then `stamp`.

**The sha256 of the whole archive** lives in the catalogue entry. The app computes it before
installing, so a published zip cannot be swapped after review: until the entry is updated
through a pull request, the app will refuse to install the new archive.

Declaring one hash in the entry while publishing a different archive is the one way to get
someone else's code past review, and `index audit` in CI is exactly the check that catches it.

## What this does not give you

The sandbox limits the damage: a plugin has no files, no network beyond the addresses it
declared, no way to start an arbitrary program. But nothing stops a plugin the user granted
"network" and "secrets" from sending its own token to its own server. The checks catch a
swapped archive, not an author's bad intent — which is why review looks at the code, and at
whether every permission asked for is explained by what the plugin is for.
