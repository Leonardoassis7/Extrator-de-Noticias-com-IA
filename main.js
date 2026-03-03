require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function getMetaContent($, selectors) {
  for (const selector of selectors) {
    const content = $(selector).attr('content');
    if (content && content.trim()) {
      return content.trim();
    }
  }
  return '';
}

function extractRawArticle(html, sourceUrl) {
  const $ = cheerio.load(html);

  const title =
    getMetaContent($, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
    $('h1').first().text().trim() ||
    $('title').first().text().trim();

  const image =
    getMetaContent($, ['meta[property="og:image"]', 'meta[name="twitter:image"]']) || '';

  const paragraphSelectors = [
    'article p',
    '[data-content-type="body"] p',
    '.content-text__container p',
    '.materia-conteudo p',
    '.c-news__body p',
    'main p'
  ];

  let paragraphs = [];
  for (const selector of paragraphSelectors) {
    paragraphs = $(selector)
      .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean);

    if (paragraphs.length >= 3) {
      break;
    }
  }

  if (paragraphs.length === 0) {
    paragraphs = $('p')
      .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean)
      .slice(0, 30);
  }

  const bodyText = paragraphs.join('\n');

  return {
    sourceUrl,
    title,
    image,
    paragraphs,
    bodyText
  };
}

function fallbackStructuredData(raw) {
  const summary = raw.paragraphs.slice(0, 2).join(' ').slice(0, 420);
  const keywordMatches = (raw.bodyText.toLowerCase().match(/\b[a-zA-ZÀ-ÿ]{5,}\b/g) || []);

  const frequency = new Map();
  for (const word of keywordMatches) {
    if ([
      'sobre', 'entre', 'apenas', 'tambem', 'depois', 'quando', 'onde',
      'como', 'porque', 'ainda', 'foram', 'serao', 'noticia', 'disse'
    ].includes(word)) {
      continue;
    }

    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  const tags = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  return {
    title: raw.title || 'Sem titulo',
    summary: summary || 'Nao foi possivel gerar resumo automaticamente.',
    image: raw.image,
    tags
  };
}

async function structureWithAI(raw) {
  if (!openai) {
    return fallbackStructuredData(raw);
  }

  const prompt = `Voce e um extrator de noticias. Retorne SOMENTE JSON valido com as chaves: title, summary, image, tags.\n\nRegras:\n- title: string curta\n- summary: ate 320 caracteres\n- image: URL da imagem principal ou string vazia\n- tags: array com 3 a 6 tags em portugues, sem #\n- Nunca retorne markdown\n\nURL: ${raw.sourceUrl}\nTitulo bruto: ${raw.title}\nImagem bruta: ${raw.image}\nConteudo:\n${raw.bodyText.slice(0, 12000)}`;

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'Extraia dados estruturados de noticias em JSON.' },
      { role: 'user', content: prompt }
    ]
  });

  const content = response.choices?.[0]?.message?.content?.trim() || '{}';
  const parsed = JSON.parse(content);

  return {
    title: String(parsed.title || raw.title || 'Sem titulo').trim(),
    summary: String(parsed.summary || '').trim() || fallbackStructuredData(raw).summary,
    image: String(parsed.image || raw.image || '').trim(),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 6)
      : fallbackStructuredData(raw).tags
  };
}

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', ai: Boolean(openai) });
});

app.post('/api/extract', async (req, res) => {
  const { url } = req.body || {};

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'URL invalida. Envie http(s)://...' });
  }

  try {
    const { data: html } = await axios.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });

    const raw = extractRawArticle(html, url);
    const structured = await structureWithAI(raw);

    return res.json({
      sourceUrl: url,
      extractedAt: new Date().toISOString(),
      ...structured
    });
  } catch (error) {
    const message = error?.response?.status
      ? `Falha ao buscar URL (status ${error.response.status}).`
      : 'Falha ao processar URL.';

    return res.status(500).json({
      error: message,
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});