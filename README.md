# MedPlant — interface (Next.js + Vercel)

Aplicativo web para médicos: calendário de plantões com valor automático por local, dashboard financeiro e visão pessoal / família / consolidado.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Deploy automático na Vercel

### Caminho mais simples (recomendado)

1. No PowerShell, na pasta do projeto:

   ```powershell
   .\scripts\configurar-vercel.ps1
   ```

   O script cria o repo no GitHub (se ainda não existir), envia o código e **abre o navegador** na importação do projeto na Vercel.

2. Na Vercel, clique em **Deploy** (Next.js é detectado sozinho).

3. Pronto: **cada `git push` na branch `main` gera um deploy novo** — sem subir arquivo manualmente.

### Pelo terminal (após `npx vercel login` uma vez)

```bash
npm run deploy          # produção
npm run deploy:preview  # preview
```

### GitHub Actions (opcional)

O workflow `.github/workflows/vercel-deploy.yml` publica via Actions se você configurar no GitHub → Settings → Secrets:

| Secret | Onde achar |
|--------|------------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Arquivo `.vercel/project.json` após `npx vercel link` |
| `VERCEL_PROJECT_ID` | Mesmo arquivo |

## Estrutura

| Rota        | Conteúdo                          |
| ----------- | --------------------------------- |
| `/`         | Dashboard e visão por escopo      |
| `/carteira` | Análise da carteira de investimentos |
| `/plantoes` | Calendário mensal de plantões     |
| `/locais`   | Hospitais/clínicas e valor padrão |
| `/gastos`   | Extrato pessoal e familiar        |
| `/cartoes`  | Faturas de cartão (mock)          |
| `/cadastro/pessoas` | Cadastro de pessoas           |
| `/cadastro/familia` | Inclusão da família           |

Os dados atuais são **mock** em `src/lib/mock-data.ts`. Próxima etapa: API + banco de dados.
