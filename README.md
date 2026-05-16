# imglegal

**Hospedagem de imagens simples, rápida e segura.**

[![MIT License](https://img.shields.io/badge/licença-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F6821F?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Deploy](https://github.com/nelodvn/imglegal.app/actions/workflows/deploy.yml/badge.svg)](https://github.com/nelo/imglegal.app/actions/workflows/deploy.yml)


- **Formatos suportados** — JPEG, PNG, GIF, WebP, BMP, TIFF, ICO, AVIF/HEIF/HEIC, SVG
- **Limite de 10 MB** por imagem
- **Proteção contra hotlink** — imagens só carregam a partir da própria origem
- **Validação de magic bytes** — verifica o cabeçalho real do arquivo, não apenas a extensão
- **Zero infraestrutura** — serverless na Cloudflare global edge network

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Runtime | [Cloudflare Workers](https://workers.cloudflare.com) |
| Framework | [Hono](https://hono.dev) v4 |
| Storage | [Cloudflare R2](https://developers.cloudflare.com/r2/) |
| Linguagem | TypeScript 5 (strict) |
| Build/Deploy | [Wrangler](https://developers.cloudflare.com/workers/wrangler/) v4 |

---

## Contribuindo

Contribuições são bem-vindas! Abra uma [issue](https://github.com/nelodvn/imglegal.app/issues) para reportar bugs ou sugerir melhorias, ou envie um Pull Request diretamente.

---

## Licença

[MIT](LICENSE) © 2026 nelo
