# Digital Brain

Aplicação React, TypeScript e Vite com autenticação e dados no Supabase.

## Desenvolvimento

Use Node.js 24 e `npm ci`. Crie `.env.local` com:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
VITE_EXERCISEDB_URL=https://oss.exercisedb.dev/api/v1
```

Execute `npm run dev` (porta 5190), `npm test` para os testes de regressão e
`npm run build` para compilar o app e o PWA. `npm run lint` verifica o projeto inteiro.

## Exercícios

O app usa a [ExerciseDB pública v1](https://oss.exercisedb.dev/docs), sem chave:
busca em `/exercises/search?search=...` e detalhes em `/exercises/:id`.
O seletor “Adicionar exercício” abre o catálogo público automaticamente, com GIFs,
busca por nome, filtros musculares e paginação de 25 itens. Ao selecionar um item,
o app salva um cadastro individual em `exercises` e seu vínculo de demonstração,
reutilizando o mesmo cadastro nas próximas seleções. Exercícios personalizados
continuam disponíveis. Nos exercícios salvos, o botão de informações abre os detalhes.
As buscas sugerem termos em inglês a partir do nome em português; as instruções
fornecidas pela API permanecem em inglês. O catálogo público fornece GIFs.

Os vínculos são individuais e persistidos em `exercise_media_links`. A migração
`supabase/migrations/20261123000000_exercise_media_links.sql` já foi aplicada ao
projeto Supabase configurado durante esta integração. Em outro ambiente, aplique
essa migração antes de usar os vínculos. Ela inclui RLS e permissões de acesso.
Também foi aplicada `supabase/migrations/20261124014757_exercise_catalog.sql`, que
cria a tabela `exercises` antes ausente e os relacionamentos usados por rotinas e séries.
Em um novo ambiente com as tabelas de treinos já instaladas, aplique ambas as migrações.

Não coloque chaves privadas em variáveis `VITE_*`: elas são incluídas no navegador.
O proxy do pacote de referência era destinado à versão paga e não é necessário
para a API pública configurada neste projeto.

## Finanças

Disponível em `/finance`, com lançamentos de despesas e receitas extras, categorias,
seleção de mês, ajuste de renda e exclusão lógica. A Home e a página compartilham
o cálculo `renda mensal + receitas extras − despesas`, sem duplicar salário.

A integração preserva o esquema existente: `description` é apresentada como título,
`source = app` identifica lançamentos manuais e despesas variáveis usam `kind = other`.
`category` determina o grupo visual. A migração de finanças do pacote de referência
não é necessária e não foi aplicada. Meses anteriores usam a renda configurada
atualmente; ainda não há histórico mensal de alterações de renda.

## Referência do template React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
