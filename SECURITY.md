# Security Policy / Política de Segurança

## Supported Versions

Security fixes apply to the current `1.x` release line of `dtcg-contrast` (npm package, `voaneves/dtcg-contrast@v1` GitHub Action, and the landing page at `https://voaneves.github.io/dtcg-contrast/`).

| Version | Supported |
| :--- | :--- |
| `1.x` (`main` / `@v1`) | :white_check_mark: |
| `0.x` | :x: |

## Reporting a Vulnerability

**Please do not open a public issue** for security vulnerabilities.

Send a private report by email to **victorneves478@gmail.com** with the subject:

```text
[SECURITY] dtcg-contrast: <short summary>
```

Include as much detail as possible:

- the affected CLI option, parser, reporter, GitHub Action input/step, or file;
- step-by-step reproduction instructions or a minimal sample token/config JSON;
- the security impact you see (for example HTML report or PR comment XSS/injection, SARIF injection, path traversal in `--fix` / `--output`, or ReDoS);
- Node.js version and OS when relevant.

## What to Expect

- Receipt acknowledged within **7 days**.
- Initial assessment (reproducibility and severity) within **14 days**.
- Notification when a patched release is published (with credit if desired).

This is a personal open-source project without a dedicated security team: the timelines above are good-faith targets, not a contractual SLA. There is no bug bounty program.

## Scope

**In scope:** CLI (`bin/`, `src/`), GitHub Action (`action.yml`, sticky PR comment rendering, SARIF 2.1.0 output), HTML Contrast Matrix escaping, token/config file reading and `--fix` / `--output` path handling, the landing page (`https://voaneves.github.io/dtcg-contrast/`), and CI/release workflows.

**Out of scope:**

- vulnerabilities in third-party infrastructure (GitHub, GitHub Pages, npm registry), which should be reported to their respective vendors;
- denial-of-service (DoS/DDoS) against hosted services or social engineering;
- automated scanner output without a concrete, reproducible security impact.

Please allow reasonable time for remediation before any public disclosure.

---

## Resumo em português

Apenas a linha `1.x` do `dtcg-contrast` (pacote npm, Action `voaneves/dtcg-contrast@v1` e página em `https://voaneves.github.io/dtcg-contrast/`) recebe correções de segurança.

**Não abra issue pública.** Envie um relato privado para **victorneves478@gmail.com** com o assunto `[SECURITY] dtcg-contrast: <resumo>`, informando o módulo, opção de CLI ou etapa da Action, passos para reproduzir e impacto (como escape em relatório HTML, injeção em comentário de PR/SARIF ou path traversal em `--fix`/`--output`). Retorno inicial em até **7 dias** e avaliação em até **14 dias**, sem bug bounty. Infraestrutura de terceiros (GitHub, npm), DoS, engenharia social e alertas de scanner sem impacto comprovado estão fora do escopo.
