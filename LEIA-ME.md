# VipRide Orlando — o que mudou e o que fazer agora

## 1. O motivo do PWABuilder não puxar nome nem ícone

No `index.html` a linha do manifest estava assim:

```html
<link rel="manifest" href=manifest.json">
```

Faltava a aspa de abertura. O navegador leu o endereço como `manifest.json"`
(com a aspa no final), que não existe no servidor. Resultado: o manifest nunca
carregava, e o PWABuilder não encontrava `name`, `short_name` nem `icons`.
Agora está `href="manifest.json"`.

## 2. Arquivos que vão para o GitHub Pages (pasta do site)

```
index.html
dashboard.html
manifest.json
sw.js                     <- novo (service worker)
icon-192.png
icon-512.png
icon-maskable-192.png     <- novo
icon-maskable-512.png     <- novo
```

O `worker.js` NÃO vai para o GitHub — ele é colado no editor do Cloudflare.

## 3. Antes de gerar o APK no PWABuilder

1. Suba tudo para o repositório e espere o GitHub Pages publicar.
2. Abra `https://rodrigocostaalves.github.io/vipride-app/manifest.json` no
   navegador. Se aparecer o JSON, está certo.
3. No PWABuilder, use a URL com a barra no final:
   `https://rodrigocostaalves.github.io/vipride-app/`
4. Se ainda mostrar dados antigos, é cache do PWABuilder — troque a URL para
   `.../?v=2` uma vez.

Para publicar na Play Store, o PWABuilder também vai pedir pelo menos uma
captura de tela do app (1080x1920). Tire uma do celular e adicione depois no
`manifest.json` no campo `screenshots`.

## 4. Cloudflare — configuração obrigatória

No painel do Worker, em Settings → Variables:

- **Secret** `ADMIN_TOKEN` = uma senha longa que só você conhece.
  É o que protege a lista de clientes.
- **Variável** `ALLOWED_ORIGINS` = `https://rodrigocostaalves.github.io`
- **Binding D1** `DB` = seu banco (já existia).

Depois disso, ao abrir o `dashboard.html` vai aparecer uma tela pedindo o token.

## 5. Correções aplicadas

**index.html**
- Link do manifest corrigido; metas de tema, ícone Apple e cor da barra.
- Registro do `sw.js` (o app agora abre offline e é instalável de verdade).
- Perfil salvo no aparelho (`localStorage`) — antes o "Salvar dados" só dava
  um alerta e a reserva ia para o banco como "Cliente não cadastrado".
- Validação antes de enviar: nome, e-mail (com conferência dos dois campos),
  telefone, endereços no translado e datas coerentes.
- Botão "Reservar" trava enquanto envia — evita reserva duplicada no toque duplo.
- A tela de confirmação mostra o **código real** devolvido pela API.
- Removido o alerta falso de "lembretes agendados" (nada era agendado).
- Datas usam o fuso local; antes, depois das 20h na Flórida, o app já marcava
  o dia seguinte por causa do UTC.
- Campos de data não aceitam mais datas passadas.
- Botão "Sair" e "Excluir perfil" agora funcionam de fato.
- Atribuição do OpenStreetMap no mapa (exigência da licença dos tiles).

**worker.js**
- `GET /reservas` e `PATCH` agora exigem o `X-Admin-Token`. Antes, qualquer
  pessoa com o endereço do Worker baixava nome, e-mail e telefone de todos
  os clientes.
- CORS restrito à sua origem em vez de `*`.
- Validação dos campos recebidos, com limite de tamanho.
- `/debug` protegido.
- Código da reserva gerado com `crypto` em vez de `Math.random`.
- `CREATE TABLE` sai do caminho de toda requisição.
- Mensagens de erro genéricas para o cliente (sem expor detalhes do banco).

**dashboard.html**
- Tela de acesso com token.
- **Correção de XSS**: os dados vinham do banco direto para `innerHTML`. Um
  cliente podia se cadastrar com um nome contendo código e ele rodaria no seu
  painel. Agora tudo passa por escape.
- Busca não quebra mais com campos vazios.
- Atualiza a lista sozinha a cada 30 segundos.

## 6. O que ainda está pendente

- **O preço do translado é fixo.** `kmEstimado` está travado em 20 km; os
  endereços digitados e o mapa não influenciam o valor. Precisa de uma API de
  rotas (Google Directions, Mapbox ou OpenRouteService) para calcular de verdade.
- **Nenhum lembrete é enviado.** Precisa de um Cron Trigger no Cloudflare + um
  serviço de e-mail ou WhatsApp Business.
- **O motorista é fixo no código** ("Michael Anderson", placa ORL-2024).
- **O monitoramento de voo não existe** — o campo é salvo, mas nada é feito.
- **Termos de Uso e Política de Privacidade** estão como `#`. A Play Store
  exige uma política de privacidade acessível para apps que coletam e-mail
  e telefone.
- Os tiles do OpenStreetMap são gratuitos mas têm política de uso restritiva
  para aplicativos. Com volume real, migre para Mapbox ou MapTiler.
