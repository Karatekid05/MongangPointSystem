# MonGang Points System

Um sistema de pontos para Discord com integração MongoDB e Google Sheets, focado em competição entre gangs.

## Funcionalidades

- Sistema de pontos baseado em gangs
- Rastreamento de atividades em canais específicos
- Leaderboards semanais e totais
- Reset automático semanal com backup no Google Sheets
- Sistema de categorização de pontos (atividade em mensagens, games, arte/memes)
- Cooldown e detecção de mensagens duplicadas
- Dashboard web para visualização de estatísticas (em desenvolvimento)

## Comandos

### Comandos de Usuário
- `/leaderboard [gang]` - Ver o ranking geral ou de uma gang específica
- `/weeklyLeaderboard [gang]` - Ver o ranking semanal
- `/ganginfo [gang]` - Ver informações detalhadas sobre uma gang
- `/userinfo [user]` - Ver pontos e estatísticas de um usuário
- `/help` - Mostra todos os comandos disponíveis

### Comandos de Administrador
- `/awardpoints user:@user points:10 [reason]` - Atribuir pontos a um usuário
- `/simulateweeklyreset` - Simula o reset semanal (apenas para testes)
- `/resetallpoints` - Reseta todos os pontos (use com cautela)

## Como os Pontos Funcionam

### Pontos por Mensagens
- Usuários ganham pontos enviando mensagens no canal de sua gang
- Cada mensagem válida dá 1 ponto (contabilizado como "Message Activity")
- Mensagens precisam ter pelo menos 5 caracteres
- Saudações comuns e mensagens duplicadas não contam
- Cooldown de 5 minutos entre mensagens que dão pontos

### Categorias de Pontos
- Message Activity: pontos por mensagens nos canais
- Games: pontos por participação em jogos e competições
- Art & Memes: pontos por contribuições artísticas
- Other: pontos por outras atividades

## Reset Semanal Automático

- Acontece todo domingo à meia-noite (00:00 UTC)
- Exporta os rankings para uma nova aba no Google Sheets
- Reseta os pontos semanais de usuários e gangs
- Mantém o histórico de todas as semanas

## Requisitos de Sistema

1. Node.js 16+
2. MongoDB 4.4+
3. Conta Google com API Sheets habilitada
4. Bot do Discord com as seguintes permissões:
   - Manage Roles
   - Send Messages
   - Read Message History
   - View Channels

## Configuração

1. Clone o repositório
2. Instale as dependências: `npm install`
3. Configure as variáveis de ambiente no arquivo `.env`:
```env
DISCORD_TOKEN=seu_token_do_discord
MONGODB_URI=sua_uri_do_mongodb
GOOGLE_SHEET_ID=id_da_sua_planilha
GUILD_ID=id_do_seu_servidor
```
4. Configure as credenciais do Google Sheets:
   - Coloque o arquivo `google-credentials.json` na raiz do projeto
5. Configure as gangs em `config/gangs.js`
6. Deploy dos comandos: `npm run deploy`
7. Inicie o bot: `npm start`

## Estrutura do Banco de Dados

### Coleção Users
- username: Nome do usuário
- points: Pontos totais
- weeklyPoints: Pontos semanais
- gangPoints: Array com pontos em cada gang
- currentGangId: ID da gang atual

### Coleção Gangs
- name: Nome da gang
- points: Pontos totais
- weeklyPoints: Pontos semanais
- memberCount: Número de membros
- pointsBreakdown: Detalhamento dos pontos

## Integração com Google Sheets

- Cada reset semanal cria uma nova aba (Week_1, Week_2, etc.)
- Armazena ranking de usuários e gangs
- Mantém histórico completo de pontuações
- Inclui breakdown de pontos por categoria

## Contribuindo

1. Fork o repositório
2. Crie uma branch para sua feature: `git checkout -b feature/nova-feature`
3. Commit suas mudanças: `git commit -m 'Adiciona nova feature'`
4. Push para a branch: `git push origin feature/nova-feature`
5. Abra um Pull Request

## Licença

ISC

---

Desenvolvido por Karatekid05 