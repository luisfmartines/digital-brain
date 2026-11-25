# Digital Brain

Aplicação Expo e React Native para Android, iOS e web, com TypeScript e Supabase.
As telas usam componentes DOM do Expo e os estilos originais do Digital Brain.
No celular, as telas são incluídas no bundle do aplicativo e usam APIs nativas
para recursos como compartilhamento, área de transferência e vibração.

## Desenvolvimento

Use Node.js 24 e `npm ci`. Crie `.env.local` com:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
EXPO_PUBLIC_EXERCISEDB_URL=https://oss.exercisedb.dev/api/v1
EXPO_PUBLIC_APP_URL=https://SEU-DOMINIO
```

As variáveis públicas `VITE_*` das instalações existentes são aceitas como
alternativa pelos comandos npm. Use `EXPO_PUBLIC_APP_URL` para os links de convite
criados no celular apontarem à versão web.

- `npm run dev` abre a versão web na porta 5190.
- `npm run android` e `npm run ios` iniciam o Metro para o dispositivo ou emulador.
  Use um build de desenvolvimento com o esquema nativo `digitalbrain` para testar
  os retornos de autenticação. O simulador iOS requer macOS e Xcode.
- `npm run build` gera a versão web e o service worker do PWA em `dist`.
- `npm run build:native` exporta os bundles Android e iOS em `dist-native`.
- `npm test`, `npm run lint` e `npm run test:browser` executam as verificações.
  A suíte de navegador usa Microsoft Edge com API e sessão simuladas.

### Configuração da integração no celular

Adicione `digitalbrain://auth/oauth`, `digitalbrain://auth/signup` e
`digitalbrain://auth/reset-password` à lista de redirecionamentos permitidos do
Supabase Auth em **Authentication → URL Configuration → Redirect URLs**.
Preserve a URL do site e as entradas já cadastradas. O retorno do Google Agenda
ao app usa as Edge Functions `google-calendar-connect` e `google-calendar-callback`
desta branch. Os clientes web continuam usando o retorno HTTPS existente.

### Galaxy S22

Use o APK Android do Digital Brain para acessar os fluxos que retornam pelo esquema
`digitalbrain://`. Transfira o arquivo para o celular, abra-o no aplicativo
**Meus Arquivos** e autorize a instalação por essa fonte quando o Android solicitar.
O APK inclui o bundle JavaScript e funciona sem o Metro rodando no computador.

Para gerar o APK no Windows, configure `JAVA_HOME` e `ANDROID_HOME` para as
instalações locais do JDK e do Android SDK, depois execute:

```powershell
npm ci
node scripts/expo.mjs prebuild --platform android --no-install
Set-Location android
.\gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a'
```

O APK sai em `android/app/build/outputs/apk/release/app-release.apk`. O Expo Go
compatível com SDK 58 serve para uma prévia pela rede local usando
`npm start -- --go`. Os retornos de login, recuperação de senha e Google Agenda
precisam do app instalado com o esquema nativo.

## Exercícios

O app usa a [ExerciseDB pública v1](https://oss.exercisedb.dev/docs), sem chave:
busca em `/exercises/search?search=...` e detalhes em `/exercises/:id`.
O seletor “Adicionar exercício” abre o catálogo público automaticamente, com GIFs,
busca por nome, filtros musculares e paginação de 25 itens. Ao selecionar um item,
o app salva um cadastro individual em `exercises` e seu vínculo de demonstração,
reutilizando o mesmo cadastro nas próximas seleções. Exercícios personalizados
continuam disponíveis. Nos exercícios salvos, o botão de informações abre os detalhes.
Os 1.500 exercícios do catálogo capturado têm nomes e instruções traduzidos para
português em uma base local. As traduções são automáticas, com ajustes de terminologia
de musculação; os originais continuam disponíveis na aba Instruções. A busca converte
nomes traduzidos para os termos originais da API. O catálogo público fornece GIFs.
Todos os itens têm botão de informações. Abrir os detalhes de um item do catálogo
não grava dados: a importação acontece somente ao tocar em “Adicionar exercício”.
As miniaturas também aparecem nos exercícios salvos. Se um link de mídia falhar,
o app consulta o detalhe novamente para recuperar um endereço atualizado; quando
o provedor não disponibiliza a imagem, exibe “Sem demonstração”.

As traduções ficam em `src/features/exercisedb/locales/translation-cache.json`;
`translate.ts` mantém os ajustes de terminologia. O snapshot `catalog-source.json`
permite testar a cobertura de todos os nomes e instruções. O Neural consulta um
índice desse snapshot junto com os exercícios salvos na conta. Ao salvar uma
rotina, ele importa os itens escolhidos e vincula suas demonstrações da ExerciseDB.
Para atualizar o catálogo, traduzir textos novos e gerar os índices da busca do app e do Neural,
execute `node scripts/sync-exercise-translations.mjs`.
Esse script consulta serviços externos apenas durante a geração; o app usa a base
local. `--cached` reutiliza o snapshot e `--inspect` apenas baixa e contabiliza textos.
Exercícios futuros ainda não traduzidos preservam o texto original até essa atualização.

Os vínculos são individuais e persistidos em `exercise_media_links`. A migração
`supabase/migrations/20261123000000_exercise_media_links.sql` já foi aplicada ao
projeto Supabase configurado durante esta integração. Em outro ambiente, aplique
essa migração antes de usar os vínculos. Ela inclui RLS e permissões de acesso.
Também foi aplicada `supabase/migrations/20261124014757_exercise_catalog.sql`, que
cria a tabela `exercises` antes ausente e os relacionamentos usados por rotinas e séries.
Em um novo ambiente com as tabelas de treinos já instaladas, aplique ambas as migrações.

As variáveis `EXPO_PUBLIC_*` são incluídas no cliente e devem conter apenas valores públicos.
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
