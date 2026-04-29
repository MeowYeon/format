# Release Layout

Copy the contents of `release/format/` into your vault at:

```text
.obsidian/plugins/format/
```

The bundled runtime files are:

- `manifest.json`
- `main.js`
- `styles.css`

`main.js` is produced by `npm run build:release` and includes the formatter logic plus third-party dependencies.
