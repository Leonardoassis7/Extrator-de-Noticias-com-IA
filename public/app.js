const form = document.getElementById('extract-form');
const urlInput = document.getElementById('url');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const suggestedUrls = document.getElementById('suggested-urls');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#ff8f8f' : '#a6b0bf';
}

function cardTemplate(item) {
  const tagsHtml = (item.tags || []).map((tag) => `<span class="tag">${tag}</span>`).join('');
  const imageHtml = item.image ? `<img class="thumb" src="${item.image}" alt="Imagem da noticia">` : '';

  return `
    <article class="card">
      ${imageHtml}
      <h3>${item.title}</h3>
      <p>${item.summary}</p>
      <div class="tags">${tagsHtml}</div>
      <small class="meta">Fonte: <a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">${item.sourceUrl}</a></small>
    </article>
  `;
}

function prependResult(item) {
  resultsEl.insertAdjacentHTML('afterbegin', cardTemplate(item));
}

async function processUrl(url) {
  setStatus('Processando noticia...');

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Falha ao processar URL.');
    }

    prependResult(data);
    setStatus('Noticia processada com sucesso.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;

  await processUrl(url);
  form.reset();
  urlInput.focus();
});

suggestedUrls.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-url]');
  if (!button) return;

  urlInput.value = button.dataset.url;
  urlInput.focus();
});