# @nera-static/plugin-utils

🛠 Utility helpers for developing plugins for the [Nera](https://github.com/seebaermichi/nera) static site generator.

---

## 📦 Installation

```bash
npm install @nera-static/plugin-utils
```

---

## 📚 Features

Currently includes:

### `getConfig(filePath: string): object`

Reads and parses a YAML config file, returning its contents as a JavaScript object.

#### Example usage:

```js
import { getConfig } from '@nera/plugin-utils'

const config = getConfig('./path/to/config.yaml')
console.log(config.title)
```

Returns `{}` if the file does not exist or is empty.

---

## 🧱 Use Case

This package is intended for use inside Nera plugins to simplify configuration loading from YAML files.

Example in a plugin:

```js
import { getConfig } from '@nera/plugin-utils'

const config = getConfig(`${__dirname}/config/navigation.yaml`)
```

---

## 🧑‍💻 Maintainers

Created and maintained by [@seebaermichi](https://github.com/seebaermichi)

---

## 📄 License

MIT
