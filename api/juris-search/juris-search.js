const axios = require('axios');
const cheerio = require('cheerio');
const Fuse = require('fuse.js');
const puppeteer = require('puppeteer-core');
const chrome = require('chrome-aws-lambda');

const PAGE_URL = 'https://www.te.gob.mx/iuse_old2025/front/compilacion';

function fetchAndParsePage() {
  return new Promise(async (resolve, reject) => {
    let browser;
    try {
      browser = await puppeteer.launch({
        args: chrome.args,
        executablePath: await chrome.executablePath,
        headless: chrome.headless,
      });
      const page = await browser.newPage();
      await page.goto(PAGE_URL, { waitUntil: 'networkidle0' });  // Espera JS load
      const html = await page.content();  // HTML rendered
      await browser.close();

      const $ = cheerio.load(html);
      
      // Parsea tabla de índices vigentes (verbatim de <tr><td>)
      const blocks = [];
      $('table tr').each((i, row) => {
        const cols = $(row).find('td');
        if (cols.length >= 3) {
          const num = $(cols[0]).text().trim();
          const rubro = $(cols[1]).text().trim();
          const clave = $(cols[2]).text().trim();
          if (rubro && clave && rubro.length > 20 && !blocks.some(b => b.clave === clave)) {  // Unicidad por clave
            const full_text = rubro;  // Verbatim rubro como resumen; full si hay detalle
            blocks.push({
              clave,
              rubro,
              fecha: null,  // Extrae si hay columna fecha
              full_text
            });
          }
        }
      });
      
      // Parsea bloques full-text abajo (si existen, verbatim)
      let text = $('body').text().replace(/\s+/g, ' ').trim();
      const lines = text.split('\n').filter(line => line.length > 10);
      text = lines.join('\n');
      const blockPattern = /([A-Z\s]{3,50})\s+((?:.|\n)*?)(?=[A-Z\s]{3,50}|$)/g;
      let match;
      while ((match = blockPattern.exec(text)) !== null) {
        const title = match[1].trim();
        let content = match[2].trim();
        if (content.length > 200 && !blocks.some(b => b.rubro.includes(title))) {
          const claveMatch = content.match(/(\d{2}\/\d{4})/);
          const clave = claveMatch ? claveMatch[1] : null;
          const fechaMatch = content.match(/(\d{1,2}\s+de\s+[a-zA-Z]+\s+de\s+\d{4})/);
          const fecha = fechaMatch ? fechaMatch[1] : null;
          const rubroMatch = content.match(/^([A-Z].*?)(?=\n[A-Z]|$)/mi);
          const rubro = rubroMatch ? rubroMatch[1].trim() : title;
          
          if (clave && !blocks.some(b => b.clave === clave)) {  // Unicidad
            blocks.push({
              clave,
              rubro,
              fecha,
              full_text: content.length > 2000 ? content.substring(0, 2000) + '...' : content
            });
          }
        }
      }
      
      console.log(`Parsed ${blocks.length} blocks from table/full-text`);  // Debug
      resolve(blocks);
    } catch (error) {
      if (browser) await browser.close();
      console.error('Error fetching page:', error);
      reject(error);
    }
  });
}

function generateVariations(userQuery) {
  const variations = [userQuery];
  const lowerQuery = userQuery.toLowerCase();
  if (!lowerQuery.includes('electoral')) {
    variations.push(userQuery + ' electoral');
  }
  if (lowerQuery.includes('contra') || lowerQuery.includes('por')) {
    variations.push(userQuery + ' política');
  } else {
    variations.push(userQuery + ' por razones de');
  }
  variations.push(userQuery.replace(/\s/g, ' OR '));
  return variations.slice(0, 4);
}

function searchBlocks(blocks, variations, full) {
  const fuse = new Fuse(blocks, {
    keys: ['rubro', 'full_text'],
    threshold: 0.4,  // Loose para sinónimos
    includeScore: true
  });

  const matches = [];
  const seenClaves = new Set();

  for (const varQuery of variations) {
    const results = fuse.search(varQuery);
    for (const result of results) {
      const block = result.item;
      if (block.clave && !seenClaves.has(block.clave)) {
        seenClaves.add(block.clave);
        const match = {
          clave: block.clave,
          rubro: block.rubro,
          fecha: block.fecha,
          resumen: block.rubro,  // Verbatim exacto
          completo: full ? block.full_text : ''
        };
        matches.push(match);
        if (matches.length >= 3) break;
      }
    }
    if (matches.length >= 3) break;
  }

  return matches.slice(0, 3);
}

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST permitido' });
  }

  const { query: userQuery, full_text: full } = req.body;

  if (!userQuery) {
    return res.status(400).json({ error: 'Query requerida' });
  }

  fetchAndParsePage()
    .then(blocks => {
      const variations = generateVariations(userQuery);
      const matches = searchBlocks(blocks, variations, full);

      if (matches.length === 0) {
        const suggestion = variations[0] + ' (intenta con sinónimos como "electoral" o "política")';
        return res.json({ matches: [], sugerencia: suggestion });
      }

      const output = matches.map(match => {
        let out = `Clave: ${match.clave}\nRubro: ${match.rubro}\nFecha: ${match.fecha}\nResumen: ${match.resumen}\n`;
        if (full && match.completo) {
          out += `Completo: ${match.completo}\n`;
        } else {
          out += `Completo: Bloque full en sitio oficial: https://www.te.gob.mx/iuse_old2025/front/compilacion\n`;
        }
        return out;
      });

      res.json({ matches: output });
    })
    .catch(error => {
      res.status(500).json({ error: error.message });
    });
};