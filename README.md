# Minhas Contas

App de controle de contas mensais (PWA) com login. Funciona no celular como app, com dados sincronizados entre aparelhos.

## Estrutura

```
index.html          página única
manifest.json       dados para instalar na tela inicial
sw.js               guarda os arquivos para abrir rápido
css/style.css       visual
js/config.js        suas chaves do banco (você edita)
js/db.js            comunicação com o banco
js/app.js           telas e regras
icons/              ícones do app
supabase/schema.sql tabelas do banco
```

## Passo 1: criar o banco (grátis)

1. Entre em https://supabase.com e crie uma conta e um projeto novo.
2. No menu **SQL Editor > New query**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Vá em **Authentication > Providers > Email** e **desligue "Confirm email"**. Assim cada pessoa cria a conta e já entra, sem precisar confirmar por e-mail.
4. Vá em **Project Settings > API**, copie a **Project URL** e a chave **anon public**.
5. Abra `js/config.js` e cole os dois valores.

## Passo 2: subir no GitHub

1. Crie um repositório novo no GitHub e envie todos estes arquivos para ele.
2. No repositório, vá em **Settings > Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)` e salve.
3. Em um ou dois minutos o link aparece (algo como `https://seuusuario.github.io/nome-do-repo/`).

## Passo 3: instalar no iPhone

1. Abra o link no **Safari**.
2. Toque em **Compartilhar** e depois em **Adicionar à Tela de Início**.
3. Abra pelo ícone novo: ele abre em tela cheia, como um app.

## Sua namorada

Ela abre o mesmo link, toca em **Não tenho conta. Criar agora** e usa o próprio e-mail e senha. Os dados dela ficam separados dos seus.

## Avisos de vencimento

- No painel, contas vencidas, que vencem hoje ou em breve aparecem em destaque.
- Em **Config > Exportar para o Calendário**, o app gera um arquivo com todos os lembretes. Ao abrir, adicione ao Calendário do iPhone e ele avisa sozinho, mesmo com o app fechado. Refaça a exportação quando cadastrar contas novas.
