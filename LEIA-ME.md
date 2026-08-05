# VipRide Orlando — Fase 1 (somente Diária)

## O QUE VOCÊ PRECISA FAZER

### 1. Número do WhatsApp/SMS
No `index.html`, procure `CONTATO_TELEFONE` (perto do início do script)
e troque `10000000000` pelo número real. Só dígitos, com código do país:

    const CONTATO_TELEFONE = '14071234567';

### 2. E-mail nas páginas legais
`privacidade.html` e `termos.html` usam `suporte@viprideorlando.com`.
Se esse endereço não é seu, troque nos dois arquivos antes de publicar —
a Play Store verifica se o contato funciona.

### 3. NÃO precisa mais do OpenRouteService
Se você chegou a criar o secret `ORS_API_KEY` no Cloudflare, pode apagar.
O código não usa mais.

## ARQUIVOS

GitHub Pages (raiz do site):
index.html, dashboard.html, privacidade.html, termos.html,
manifest.json, sw.js, os 4 ícones

Repositório (deploy do Worker):
worker.js

## O QUE MUDOU NESTA VERSÃO

### Translado removido
- Saíram as abas Diária/Translado — o app abre direto na diária
- Saíram os campos de partida e chegada, o controlador de horas
  e o cálculo por km
- Saiu o mapa e a biblioteca Leaflet (o app ficou mais leve e não
  depende mais de tiles do OpenStreetMap)
- Saiu o endpoint /rota do Worker e toda a integração com o
  OpenRouteService
- O texto do topo agora diz "Reserve sua diária com conforto"

### Campo de voo
Continua no app, agora dentro da diária. Tirei a frase
"monitoraremos seu voo em tempo real", que prometia algo que o app
não faz. No lugar: "Se você chega de avião, informe o voo para
ajustarmos o horário do motorista".

## O QUE JÁ ESTAVA PRONTO E CONTINUA

### Minhas viagens
- Item no menu, lista as reservas feitas naquele aparelho
- Enquanto o motorista não for definido: aviso dos 5 dias
- Depois: nome, telefone, veículo, cor, placa e observações
- A consulta exige código + e-mail juntos, então ninguém varre
  as reservas dos outros chutando códigos

### Painel — dados do motorista
- Formulário dentro dos detalhes da reserva
- Campos: nome, telefone, veículo, cor, placa e observações
- Salvou, o cliente já vê em "Minhas viagens"

### Falar conosco
- Caixa de mensagem com dois botões: WhatsApp ou SMS
- A mensagem já vai montada com o nome do cliente e o código
  da última reserva dele

### Páginas legais
- privacidade.html e termos.html, no visual do app
- Já ajustadas para o serviço só de diária
- São modelos escritos a partir do funcionamento real do app.
  Cláusula de cancelamento e limite de responsabilidade têm
  efeito jurídico — vale revisão de advogado na Flórida.

## COMO TESTAR

1. Abra o app — deve aparecer só a diária, sem abas e sem mapa
2. Escolha o veículo e as datas, veja o total mudar
3. Cadastre o perfil no menu e faça uma reserva
4. Menu → Minhas viagens: aparece com o aviso dos 5 dias
5. No dashboard, abra a reserva, preencha o motorista e salve
6. Volte em Minhas viagens: os dados do motorista aparecem

## PENDENTE (Fase 2 e 3)

- E-mail com os detalhes ao reservar
- Verificação de e-mail
- Push quando os dados do motorista forem preenchidos
- Captura de tela 1080x1920 no manifest, exigida pela Play Store
