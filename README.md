# Roleta de Vendas – Jorlan

Aplicação responsiva em HTML, CSS e JavaScript, hospedada no GitHub Pages. A roleta é pública; vendedores e supervisores não precisam de conta. Giros, vendedores, prêmios e histórico são armazenados no Supabase. Somente uma conta autorizada no Supabase Auth pode abrir o Painel do Gestor e fazer alterações administrativas.

## Antes de migrar os dados locais

Não limpe o armazenamento do navegador nem substitua os dados locais antes de preservar e conferir um backup JSON. O backup deve conter as três configurações de 40 fatias, 16 vendedores e o histórico existente. Guarde uma cópia fora da pasta publicada no GitHub Pages; backups podem conter dados pessoais e administrativos.

O painel importa o backup para o Supabase sem apagar registros existentes. Os 16 vendedores iniciais inseridos pela migration são sincronizados uma única vez com os dados do backup; outros IDs já existentes no banco são preservados. Se houver conflito de ID/posição entre o backup e dados já gravados, a transação é cancelada; investigue o conflito em vez de apagar dados. Faça a primeira importação antes de editar vendedores ou prêmios no banco.

## Configuração do Supabase

1. Crie um projeto Supabase e mantenha o projeto disponível durante a configuração.
2. No **SQL Editor** de um projeto novo, execute [supabase/migrations/20261108000000_jorlan_wheel.sql](./supabase/migrations/20261108000000_jorlan_wheel.sql). A migration cria as tabelas, RLS, funções, limites básicos de giros e as três lojas com 16 vendedores iniciais. Ela não inclui as configurações de prêmio do backup local.
3. Crie a conta do gerente em **Authentication → Users** usando e-mail e senha próprios. Copie o UUID desse usuário e registre-o no **SQL Editor**:

   ```sql
   insert into public.manager_accounts (user_id)
   values ('UUID-DO-USUARIO-AUTH')
   on conflict (user_id) do update set active = true;
   ```

4. Configure os destinos de redirecionamento em **Authentication → URL Configuration** para o endereço do GitHub Pages do projeto, incluindo `login.html` e `painel.html`.
5. Edite [js/supabase-config.js](./js/supabase-config.js) com a URL do projeto, sua chave pública `anon`/publishable e o e-mail usado para autenticar o gerente. O usuário digitado na tela continua sendo `gerente`; a senha é criada e verificada pelo Supabase Auth, não fica no repositório.

   ```js
   window.JORLAN_SUPABASE_CONFIG = Object.freeze({
     url: "https://SEU-PROJETO.supabase.co",
     anonKey: "SUA_CHAVE_PUBLICA_ANON",
     managerEmail: "email-do-gerente@exemplo.com"
   });
   ```

   A URL, a chave pública `anon` e o e-mail de autenticação são usados no frontend e não são segredos. **Nunca** inclua a chave `service_role`, senha de gerente ou segredo de rate limit em arquivos públicos.

6. Instale/configure a Supabase CLI conforme a documentação oficial. No terminal, vincule o projeto, configure os segredos da função e publique-a:

   ```powershell
   supabase login
   supabase link --project-ref SEU_PROJECT_REF
   supabase secrets set SUPABASE_URL=https://SEU-PROJETO.supabase.co SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY SPIN_RATE_LIMIT_SALT=UM_SEGREDO_ALEATORIO_FORTE ALLOWED_ORIGINS=https://SEU_USUARIO.github.io
   supabase functions deploy public-spin
   ```

   Adicione em `ALLOWED_ORIGINS` a origem do GitHub Pages (e domínio próprio, se houver), separadas por vírgula. A origem não inclui o caminho `/nome-do-repositorio`. Os segredos ficam no ambiente do Supabase, não no repositório.
7. Antes da importação real, rode [supabase/tests/jorlan_wheel_migration_test.sql](./supabase/tests/jorlan_wheel_migration_test.sql) no SQL Editor. Crie antes o usuário/registro do gerente. O teste requer o estado inicial com 16 marcadores seed intactos, testa os IDs diferentes, importação repetida, permissões e um giro idempotente, e termina com `ROLLBACK`. Não use o teste depois da importação real: ele exige o estado anterior ao backup e executa operações temporárias dentro de uma transação.
8. Abra `login.html`, entre como `gerente` usando a senha criada no Supabase Auth e importe o backup JSON pela opção **IMPORTAR BACKUP**. Confira os totais do resultado da migração. Não publique o site para os giros públicos até confirmar que cada loja tem 40 posições e que os vendedores e histórico esperados estão presentes.
9. Publique os arquivos estáticos no GitHub Pages. A integração remota falha de forma explícita se o Supabase ainda não estiver configurado; a roleta não registra silenciosamente giros locais como se fossem giros online.

O cliente usa somente a chave pública. RLS restringe leitura e alterações administrativas; o endpoint público valida loja/vendedor, limita requisições por IP e registra cada giro atomicamente no banco. O sorteio e o índice exato são calculados no PostgreSQL; o snapshot das 40 posições usado no giro acompanha o registro para que a animação mostre o prêmio correto mesmo que a configuração seja editada depois. O RPC de gravação do giro só tem `EXECUTE` para `service_role`; o cliente público chama somente a Edge Function. A função de giro identifica o schema onde `pgcrypto` foi instalado antes de chamar `gen_random_bytes`, em vez de depender de uma localização fixa.

## Publicação do código

O repositório pode conter a URL, a chave pública `publishable` e o e-mail público de configuração do Supabase em `js/supabase-config.js`; esses valores são usados pelo frontend e não substituem as políticas RLS. Nunca adicione `service_role`, senha, segredo de rate limit, arquivos `.env` ou backups locais. O `.gitignore` exclui arquivos locais e credenciais comuns, mas não remove segredos que já tenham sido commitados: confira também o histórico do repositório remoto e revogue/rotacione qualquer segredo que tenha sido exposto.

O código inicial contém nomes dos vendedores em `js/app.js` e na migration SQL. Como o repositório será público, esses nomes ficarão visíveis no código e no histórico do GitHub; confirme que há autorização para essa publicação antes do primeiro push.

A gravação das 40 posições usa uma transação com bloqueio exclusivo da linha da loja. Giros e importações usam bloqueios compatíveis/exclusivos na mesma linha, então um giro vê a configuração completa anterior ou posterior à edição, nunca uma lista parcial. O histórico guarda snapshots e não tem FK para as posições mutáveis.

A importação é aditiva e idempotente: posições iguais, vendedores existentes e rodadas com o mesmo ID/chave não são inseridos novamente; conflitos divergentes abortam a transação. Para vendedores seed, o importador reconcilia primeiro por ID e depois por loja/nome original, atualizando o ID para o ID do backup quando ainda não existe histórico referenciando o seed. Cadastros existentes fora desse conjunto não são renomeados nem sobrescritos.

Como o giro é intencionalmente público, não é possível confirmar que quem selecionou um vendedor é realmente um supervisor. CORS e limite por IP são proteções básicas contra abuso, não uma garantia contra ataques distribuídos. Monitore o uso e ajuste o limite da função se necessário.

## Login do gerente

O formulário exige o nome fixo `gerente` e autentica por e-mail/senha usando Supabase Auth. O `managerEmail` em `js/supabase-config.js` é público; a senha não deve ser compartilhada nem adicionada ao código. A conta também precisa estar registrada em `manager_accounts`. O painel consulta `is_manager()` antes de exibir a interface e as operações administrativas são novamente verificadas por RLS/funções no banco. **Sair** encerra a sessão Supabase.

O nome digitado como usuário (`gerente`) é associado ao e-mail configurado em `managerEmail`; a autenticação envia esse e-mail e a senha digitada ao Supabase Auth. A tela diferencia credenciais inválidas, e-mail não confirmado, falha de conexão/configuração e conta autenticada sem autorização de gerente. Confira a confirmação do e-mail e se o UUID do mesmo usuário Auth está ativo em `manager_accounts`.

## Funcionalidades

- Roleta Canvas com exatamente 40 fatias por loja, nomes, cores, desaceleração de 5 a 8 segundos e confetes.
- Efeitos sonoros originais gerados pela Web Audio API: cliques suaves de ruído filtrado sincronizados durante a rotação e uma vinheta na vitória, com controle para ativar ou silenciar.
- Testes isolados dos cliques e da vinheta em `index.html?test-sounds=1`; esses botões apenas reproduzem áudio e não iniciam giros.
- Seleção de uma das lojas e vendedor ativo. O backend retorna a fatia escolhida e o snapshot visual da configuração usado naquele giro.
- Identificador de idempotência e gravação atômica no servidor para retries; o bloqueio de interface evita cliques duplicados na mesma página.
- Painel do Gestor com vendedores (criar, editar, transferir, ativar/desativar e excluir sem histórico), configuração independente das três roletas e histórico.
- Histórico centralizado com snapshots de vendedor/prêmio, custo, data/hora, situação da entrega, filtros e exportação CSV.
- Importação do backup JSON sem limpeza do armazenamento original e exportação de um novo backup com os dados do banco.
- Clientes públicos atualizam configurações periodicamente e ao retornar à página; o painel sincroniza alterações por Supabase Realtime.

## Testes e validação

Verificações locais disponíveis sem credenciais:

```powershell
node --check js/app.js
node --check js/login.js
node --check js/panel-auth.js
node --check js/supabase-client.js
```

Após configurar Supabase, valide manualmente: login inválido/válido, acesso direto a `painel.html` sem sessão, logout, três lojas e 16 vendedores, 40 fatias por loja, persistência de configuração, transferência/desativação, importação/exportação de backup, giros simultâneos, retry com a mesma chave idempotente, alinhamento da fatia sob a seta, entrega, CSV e sincronização entre dois dispositivos. O teste SQL acima também executa o caminho do limitador de giros para detectar erros PL/pgSQL em tempo de execução. Ele é executável no SQL Editor, mas ainda precisa ser rodado num projeto Supabase. Para verificar a serialização entre sessões, mantenha uma edição da roleta aberta dentro de uma transação e dispare um giro pela Edge Function em outra sessão: o giro deve aguardar o commit/rollback e então registrar o snapshot completo. Nenhum teste Supabase foi executado neste ambiente.

Para ouvir os efeitos sem fazer um giro, abra `index.html?test-sounds=1` e use os botões **Cliques** e **Vitória**. A preferência de som deve estar ativada; os botões de teste não chamam a função de giro nem registram premiações.

## Estrutura principal

- `index.html`, `login.html`, `painel.html` — roleta pública, login e contêiner autorizado do painel.
- `css/style.css` — tema responsivo.
- `js/app.js` — roleta, gestão, histórico, backup e sincronização.
- `js/login.js`, `js/panel-auth.js` — login Supabase e autorização do painel.
- `js/supabase-client.js`, `js/supabase-config.js` — adaptador e configuração pública.
- `supabase/migrations/` — schema, dados iniciais, RLS e funções SQL.
- `supabase/functions/public-spin/` — endpoint público de giro e rate limit.
