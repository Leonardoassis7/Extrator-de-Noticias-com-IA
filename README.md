# Extrator de Noticias com IA

Aplicacao web com fluxo completo:

- Frontend recebe URL da noticia.
- Backend faz fetch do HTML da pagina.
- Backend extrai conteudo bruto.
- IA (OpenAI) estrutura os dados em `title`, `summary`, `image`, `tags`.
- Frontend exibe a noticia processada.

## Requisitos

- Node.js 18+

## Como rodar abre o terminal e digita

```bash
npm install
copy .env.example .env
npm run dev
```

Abra `http://localhost:3000`.

## Endpoints

- `GET /api/health`
- `POST /api/extract`

Exemplo payload:

```json
{
  "url": "https://g1.globo.com/..."
}
```
