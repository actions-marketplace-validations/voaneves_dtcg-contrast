<div align="center">

<p><a href="./README.md">🇺🇸 English</a> · 🇧🇷 <strong>Português (PT-BR)</strong></p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/hero-pt-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/hero-pt-light.svg" />
  <img alt="dtcg-contrast — Gate WCAG 2.2 & APCA e corretor automático em OKLCH para tokens W3C DTCG." src="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/hero-pt-light.svg" width="100%" />
</picture>

<br />

<p>
  <a href="https://github.com/voaneves/dtcg-contrast/actions/workflows/ci.yml"><img src="https://github.com/voaneves/dtcg-contrast/actions/workflows/ci.yml/badge.svg" alt="Status do CI" /></a>
  <a href="https://www.npmjs.com/package/dtcg-contrast"><img src="https://img.shields.io/npm/v/dtcg-contrast?style=flat-square&color=b80000&logo=npm&logoColor=white" alt="Versão no npm" /></a>
  <a href="https://www.npmjs.com/package/dtcg-contrast"><img src="https://img.shields.io/npm/dm/dtcg-contrast?style=flat-square&color=0A0A0A" alt="Downloads mensais no npm" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/licença-MIT-0A0A0A?style=flat-square" alt="Licença MIT" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D22-0A0A0A?style=flat-square&logo=node.js&logoColor=white" alt="Node >=22" />
  <img src="https://img.shields.io/badge/dependências-0-5C5446?style=flat-square" alt="Zero Dependências" />
  <img src="https://img.shields.io/badge/spec-W3C%20DTCG%202025.10-b80000?style=flat-square" alt="W3C DTCG 2025.10" />
</p>

<p>
  <a href="#por-que-usar-o-dtcg-contrast">Visão Geral</a> ·
  <a href="#uso-rápido">Uso Rápido</a> ·
  <a href="#github-action--comentário-no-pr--sarif">GitHub Action</a> ·
  <a href="#consultoria-auditoria-de-acessibilidade--design-systems">Consultoria</a> ·
  <a href="./README.md">Documentação Completa (EN)</a>
</p>

<img src="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/demo.svg" alt="Demonstração do dtcg-contrast no terminal com WCAG 2.2, APCA e correção automática em OKLCH" width="820" />

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/voaneves/voaneves/main/assets/brand/rule-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/voaneves/voaneves/main/assets/brand/rule-light.svg" />
  <img alt="" src="https://raw.githubusercontent.com/voaneves/voaneves/main/assets/brand/rule-light.svg" width="100%" />
</picture>

## Por que usar o `dtcg-contrast`?

A maioria das auditorias de acessibilidade acontece **tarde demais** — depois que o CSS foi compilado ou o app já está no browser. O `dtcg-contrast` valida diretamente a fonte JSON no padrão **W3C Design Tokens Community Group (DTCG) 2025.10** em ~15ms, sem nenhuma dependência externa:

- **Parser nativo W3C DTCG 2025.10** — suporta `$root`, `$deprecated`, `srgb`, `oklch`, `hsl`, `display-p3`, CSS `color(...)`, fallback `hex`, herança de `$type`, diretórios recursivos e aliases `{caminho.do.token}`.
- **Multi-tema + globs em pares + JSON Schema** — avalia modos via `$extensions` (ex.: `vn.dark`, `com.figma.modes.dark`) ou overlay, expande wildcards (`color.text*` em `color.surface*` com `exclude`) e entrega autocomplete via `dtcg-contrast.schema.json`.
- **WCAG 2.2 + APCA-W3** — calcula razão WCAG (`AA`, `AA-large`, `UI`, `AAA`) e escore perceptual APCA `Lc` com composição alpha automática.
- **Correção inteligente em OKLCH (`--fix` / `--dry-run`)** — ajusta `L` preservando matiz `H` e croma `C` no gamut sRGB e grava a correção direto no token semântico ou `$extensions` sem alterar tokens primitivos compartilhados.
- **5 formatos + GitHub Action pronta** — terminal ANSI 24-bit (`pretty`), resumo e comentário fixo em PR (`markdown` / `comment-pr`), CI (`json`), matriz visual filtrável (`html`) e `sarif` 2.1.0 com linha/coluna exatas para GitHub Code Scanning.

## Uso Rápido

```bash
# Testar duas cores na hora pelo terminal
npx dtcg-contrast check "#f50000" "#f4ead4" --level=AA

# Gerar dtcg-contrast.config.json com $schema, temas e pares descobertos automaticamente
npx dtcg-contrast init ./tokens

# Simular e aplicar correções OKLCH nos tokens reprovados
npx dtcg-contrast --config=dtcg-contrast.config.json --fix --dry-run
npx dtcg-contrast --config=dtcg-contrast.config.json --fix

# Showcase do @voaneves/brand
npx dtcg-contrast --config examples/voaneves-brand/dtcg-contrast.config.json
```

### GitHub Action + Comentário no PR + SARIF

```yaml
- name: Gate de Contraste nos Design Tokens
  uses: voaneves/dtcg-contrast@v1
  with:
    config: dtcg-contrast.config.json
    comment-pr: 'true'
    html-report: contrast-matrix.html
    sarif-report: contrast.sarif
    fail-on-error: 'false'

- name: Enviar SARIF para GitHub Code Scanning
  if: always()
  uses: github/codeql-action/upload-sarif@v4
  with:
    sarif_file: contrast.sarif
```

Consulte o [README em inglês](./README.md) para a tabela completa de flags, inputs/outputs da Action e API JavaScript/TypeScript.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/voaneves/voaneves/main/assets/brand/rule-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/voaneves/voaneves/main/assets/brand/rule-light.svg" />
  <img alt="" src="https://raw.githubusercontent.com/voaneves/voaneves/main/assets/brand/rule-light.svg" width="100%" />
</picture>

## Consultoria, Auditoria de Acessibilidade & Design Systems

Precisa estruturar um Design System no padrão **W3C DTCG**, adequar produtos à **WCAG 2.2 AA / LBI** ou implantar pipelines automatizados de qualidade (Lighthouse CI, Playwright, GitOps)?

- 🌐 **Portfólio e Contato:** [voaneves.com](https://voaneves.com/)
- 💼 **LinkedIn:** [linkedin.com/in/voaneves](https://www.linkedin.com/in/voaneves/)
- 💖 **Apoie no GitHub Sponsors:** [github.com/sponsors/voaneves](https://github.com/sponsors/voaneves)

## Licença

[MIT](./LICENSE) © 2026 [Victor Neves](https://github.com/voaneves)

<br />

<a href="https://voaneves.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/voaneves/voaneves/main/assets/brand/footer-pt-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/voaneves/voaneves/main/assets/brand/footer-pt-light.svg" />
    <img alt="VOANEVES. — Sinal, não ruído. Consultoria em voaneves.com" src="https://raw.githubusercontent.com/voaneves/voaneves/main/assets/brand/footer-pt-light.svg" width="100%" />
  </picture>
</a>
