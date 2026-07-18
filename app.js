import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
import Tesseract from 'tesseract.js';
import JSZip from 'jszip';

const state = {
  fileName: '',
  rawMessages: [],
  listHistory: [],
  finalLists: [],
  transactions: [],
  filteredTransactions: [],
  photoIndex: new Map(),
  photos: new Map(), // Added for Blob URLs mapping
  unmatchedPhotos: [], // Added for unmatched photos
  activeTab: 'transaksi',
  filters: {
    search: '',
    category: '',
    validation: '',
  },
  mutationFileName: '',
  mutations: [],
  reconciliationResults: [],
  unmatchedMutations: [],
  unmatchedTransactions: [],
  reconFilters: {
    search: '',
    status: 'Semua',
    date: '',
    category: ''
  },
  availableMutationDates: [],
  reconDateFilter: {
    mode: 'all', // all, single, range
    single: '',
    rangeStart: '',
    rangeEnd: '',
    tolerance: false
  },
  telegramParseMode: 'final_list', // 'final_list' | 'raw_request_history'
  requestCandidates: [],
};

const kategoriRules = {
  'Refund': ['refund', 'revisi harga', 'pengembalian', 'retur'],
  'Pettycash / Top Up / Mutasi Internal': ['pettycash', 'cardless pettycash', 'top up', 'topup', 'top up dana cg', 'pencairan lemburan', 'reward cg', 'mutasi internal'],
  'Biaya Operasional': ['bensin', 'parkir', 'tol', 'listrik', 'internet', 'galon', 'konsumsi', 'uang makan', 'kebersihan', 'cleaning ac', 'ongkir', 'jne', 'transport', 'lalamove', 'gojek', 'grab', 'selamat trans', 'sample'],
  'Pembelian Aset': ['meja', 'kursi', 'komputer', 'laptop', 'monitor', 'printer', 'mesin', 'scanner', 'alat produksi', 'e-money', 'emoney', 'light box', 'led cafe menu board'],
  'Membeli Perlengkapan': ['cutter', 'lakban', 'double tape', 'lem', 'gunting', 'spidol', 'plastik packing', 'atk', 'perlengkapan', 'alat bantu'],
  'Menambah Persediaan': ['stok', 'stock', 'restock', 'tambah stok', 'persediaan', 'bahan gudang', 'barang stok'],
  'Outsourcing': ['print luar', 'jasa', 'vendor', 'makloon', 'pemasangan', 'dtg', 'textile satin', 'sablon', 'cutting', 'bordir', 'finishing', 'cetak textile', 'azka printing', 'tigatuju', 'primagraphia', 'centro', 'kart'],
  'Membeli Bahan': ['art carton', 'kertas', 'hvs', 'kertas doff', 'flexy', 'vinyl', 'vynil', 'stiker', 'sticker', 'albatros', 'albartos', 'luster', 'duratrans', 'durantrans', 'backlite', 'backlite film', 'kintech', 'doramark', 'ritrama', 'sanblast', 'sunblast', 'tinta', 'laminasi', 'impraboard', 'foamboard', 'tc 120 gsm', 'ncr', 'akrilik', 'bahan banner', 'bahan cetak', 'banner', 'lanyard', 'plakat', 'bingkai', 'kaos', 'hard cover', 'jilid', 'dus']
};

const akunMap = {
  'Outsourcing': 'Biaya Outsourcing / HPP Jasa Pihak Ketiga',
  'Membeli Bahan': 'Persediaan Bahan',
  'Menambah Persediaan': 'Persediaan',
  'Membeli Perlengkapan': 'Perlengkapan',
  'Pembelian Aset': 'Aset Tetap / Peralatan',
  'Biaya Operasional': 'Biaya Operasional',
  'Refund': 'Refund / Koreksi Penjualan',
  'Pettycash / Top Up / Mutasi Internal': 'Mutasi Kas / Pettycash',
  'Perlu Dicek': 'Perlu Dicek'
};

const els = {
  fileInput: document.getElementById('fileInput'),
  fileName: document.getElementById('fileName'),
  fileHint: document.getElementById('fileHint'),
  exportBtn: document.getElementById('exportBtn'),
  exportAllBtn: document.getElementById('exportAllBtn'),
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  validationFilter: document.getElementById('validationFilter'),
  transactionFilters: document.getElementById('transactionFilters'),
  tableHost: document.getElementById('tableHost'),
  panelKicker: document.getElementById('panelKicker'),
  panelTitle: document.getElementById('panelTitle'),
  panelInfo: document.getElementById('panelInfo'),
  mutationInput: document.getElementById('mutationInput'),
  mutationFileName: document.getElementById('mutationFileName'),
  mutationOcrProgress: document.getElementById('mutationOcrProgress'),
  mutationFallbackActions: document.getElementById('mutationFallbackActions'),
  btnOcrCloud: document.getElementById('btnOcrCloud'),
  btnPasteManual: document.getElementById('btnPasteManual'),
  manualPasteCard: document.getElementById('manualPasteCard'),
  manualPasteInput: document.getElementById('manualPasteInput'),
  btnParseManual: document.getElementById('btnParseManual'),
  mutationInputLabel: document.getElementById('mutationInputLabel'),
  pdfReadStatus: document.getElementById('pdfReadStatus'),
  mutationParseStatus: document.getElementById('mutationParseStatus'),
  dateFilterCard: document.getElementById('dateFilterCard'),
  dateModeRadios: document.getElementsByName('dateMode'),
  singleDateContainer: document.getElementById('singleDateContainer'),
  singleDateSelect: document.getElementById('singleDateSelect'),
  rangeDateContainer: document.getElementById('rangeDateContainer'),
  rangeStartDate: document.getElementById('rangeStartDate'),
  rangeEndDate: document.getElementById('rangeEndDate'),
  dateToleranceCheckbox: document.getElementById('dateToleranceCheckbox'),
  btnApplyDateFilter: document.getElementById('btnApplyDateFilter'),
  btnResetDateFilter: document.getElementById('btnResetDateFilter'),
  dateFilterError: document.getElementById('dateFilterError'),
  dateFilterInfo: document.getElementById('dateFilterInfo'),
  dateFilterActiveIndicator: document.getElementById('dateFilterActiveIndicator'),
};

// Safe DOM helpers — prevent crashes when elements are absent after refactor
function setElText(id, value) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) el.textContent = value;
  else console.warn(`[DOM] Element not found: #${id}`);
}
function setElHtml(id, value) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) el.innerHTML = value;
  else console.warn(`[DOM] Element not found: #${id}`);
}
function setElDisplay(id, value) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) el.style.display = value;
  else console.warn(`[DOM] Element not found: #${id}`);
}

els.fileInput.addEventListener('change', handleFileChange);
if (els.mutationInput) {
  els.mutationInput.addEventListener('change', handleMutationChange);
}
if (els.btnOcrCloud) {
  els.btnOcrCloud.addEventListener('click', handleOcrCloudClick);
}
if (els.btnPasteManual) {
  els.btnPasteManual.addEventListener('click', () => {
    if (els.manualPasteCard) els.manualPasteCard.style.display = 'block';
    if (els.manualPasteInput) els.manualPasteInput.focus();
  });
}
if (els.btnParseManual) {
  els.btnParseManual.addEventListener('click', handleManualPasteParse);
}

// Date Filter Events
if (els.dateModeRadios) {
  els.dateModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const mode = e.target.value;
      if (els.singleDateContainer) els.singleDateContainer.style.display = mode === 'single' ? 'block' : 'none';
      if (els.rangeDateContainer) els.rangeDateContainer.style.display = mode === 'range' ? 'flex' : 'none';
      if (els.dateFilterError) els.dateFilterError.style.display = 'none';
    });
  });
}

if (els.btnApplyDateFilter) {
  els.btnApplyDateFilter.addEventListener('click', handleApplyDateFilter);
}

if (els.btnResetDateFilter) {
  els.btnResetDateFilter.addEventListener('click', handleResetDateFilter);
}

if (els.rangeStartDate) {
  els.rangeStartDate.addEventListener('change', (e) => {
    populateRangeEndDate(e.target.value);
    if (els.dateFilterError) els.dateFilterError.style.display = 'none';
  });
}

els.exportBtn.addEventListener('click', () => exportWorkbook(false));
if (els.exportAllBtn) {
  els.exportAllBtn.addEventListener('click', () => exportWorkbook(true));
}
els.searchInput.addEventListener('input', (e) => {
  state.filters.search = e.target.value;
  render();
});
els.categoryFilter.addEventListener('change', (e) => {
  state.filters.category = e.target.value;
  render();
});
els.validationFilter.addEventListener('change', (e) => {
  state.filters.validation = e.target.value;
  render();
});

document.querySelectorAll('.tab-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab-pill').forEach((item) => item.classList.toggle('active', item === btn));
    render();
  });
});

render();

function extractTelegramText(textElement) {
  if (!textElement) return "";

  let html = textElement.innerHTML || "";

  html = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  const textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  let text = textarea.value;

  text = text
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

// ========== ZIP UTILITIES ==========

function normalizeZipPath(value) {
  return decodeURIComponent(String(value || ''))
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/\/+/g, '/');
}

async function findBestTelegramHtml(zip) {
  const entries = Object.values(zip.files);
  const candidates = entries.filter(entry => {
    if (entry.dir) return false;
    const p = normalizeZipPath(entry.name).toLowerCase();
    return p.endsWith('.html') && (
      p === 'messages.html' ||
      p.endsWith('/messages.html') ||
      p.includes('message')
    );
  });

  if (!candidates.length) return null;

  // Score each candidate: prefer those with many .message.default elements
  const scored = await Promise.all(candidates.map(async entry => {
    try {
      const text = await entry.async('text');
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const msgCount = doc.querySelectorAll('.message.default').length;
      const hasHistory = doc.querySelector('.history') ? 100 : 0;
      return { entry, html: text, score: msgCount * 10 + hasHistory, msgCount };
    } catch {
      return { entry, html: '', score: -1, msgCount: 0 };
    }
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0] : null;
}

function buildZipPhotoIndex(zip) {
  const byNormalizedPath = new Map();
  const byBasename = new Map();

  Object.values(zip.files).forEach(f => {
    if (f.dir) return;
    const normalized = normalizeZipPath(f.name);
    const lower = normalized.toLowerCase();
    const isPhoto = lower.includes('/photos/') ||
      /\.(jpg|jpeg|png|webp)$/i.test(lower);
    if (!isPhoto) return;
    byNormalizedPath.set(normalized, f);
    const base = normalized.split('/').pop();
    if (!byBasename.has(base)) {
      byBasename.set(base, f);
    } else {
      byBasename.set(base, null); // ambiguous — multiple files with same basename
    }
  });

  return { byNormalizedPath, byBasename };
}

async function loadZipPhoto(entry) {
  const blob = await entry.async('blob');
  return URL.createObjectURL(blob);
}

// ========== MAIN FILE HANDLER ==========

async function handleFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  state.fileName = file.name;
  if (els.fileName) els.fileName.textContent = file.name;
  if (els.fileHint) els.fileHint.textContent = 'Membaca dan memproses file Telegram...';

  // Clear previous photos
  state.photos.clear();
  state.unmatchedPhotos = [];

  const fileName = file.name.toLowerCase();
  let html = '';
  let sourceType = 'html';
  let photoCount = 0;

  // --- Phase 1: Read file ---
  try {
    if (fileName.endsWith('.zip')) {
      sourceType = 'zip';
      if (els.fileHint) els.fileHint.textContent = 'Mengekstrak ZIP Telegram Export...';
      const zip = await JSZip.loadAsync(file);

      // 1. Find best Telegram HTML
      if (els.fileHint) els.fileHint.textContent = 'Mencari file HTML di dalam ZIP...';
      const best = await findBestTelegramHtml(zip);
      if (!best) throw new Error('ZIP tidak berisi file HTML Telegram yang valid.');
      html = best.html;

      // 2. Index all photos with nested path support
      if (els.fileHint) els.fileHint.textContent = 'Mengindeks foto dari ZIP...';
      const photoIdx = buildZipPhotoIndex(zip);

      // 3. Load photos into state.photos Map (keyed by normalized path)
      for (const [normPath, entry] of photoIdx.byNormalizedPath.entries()) {
        try {
          const url = await loadZipPhoto(entry);
          state.photos.set(normPath, url);
          // Also index by basename for fallback
          const base = normPath.split('/').pop();
          if (photoIdx.byBasename.get(base) !== null) {
            state.photos.set(base, url);
          }
        } catch { /* skip bad file */ }
      }
      photoCount = photoIdx.byNormalizedPath.size;

    } else if (fileName.endsWith('.html')) {
      sourceType = 'html';
      html = await file.text();
    } else {
      throw new Error('File harus berupa messages.html atau ZIP Telegram Export.');
    }
  } catch (error) {
    console.error('Telegram file read failed:', error);
    if (els.fileHint) els.fileHint.textContent = `Gagal membaca file: ${error.message}`;
    return;
  }

  // --- Phase 2: Parse HTML ---
  try {
    if (els.fileHint) els.fileHint.textContent = 'Memparsing HTML chat Telegram...';
    parseTelegramHtml(html);
  } catch (error) {
    console.error('Telegram parsing failed:', error);
    if (els.fileHint) els.fileHint.textContent = 'Gagal membaca isi file Telegram.';
    return;
  }

  // --- Phase 3: Update UI ---
  try {
    const mode = state.telegramParseMode;
    const txCount = state.transactions.length;
    const listCount = state.listHistory.length;
    const rawCount = state.rawMessages.length;
    const candidateCount = state.requestCandidates?.length || 0;
    let statusMsg = '';

    if (mode === 'final_list') {
      const baseMsg = `${txCount} transaksi dari ${listCount} list TF.`;
      if (sourceType === 'zip') {
        statusMsg = `ZIP Telegram berhasil dibaca. ${baseMsg}`;
        statusMsg += photoCount > 0 ? ` ${photoCount} foto tersedia.` : ' Folder photos tidak ditemukan.';
      } else {
        statusMsg = `HTML Telegram berhasil dibaca. ${baseMsg} Foto tidak tersedia pada mode HTML.`;
      }
    } else {
      // raw_request_history
      const baseMsg = `${candidateCount} request ditemukan dari ${rawCount} pesan.`;
      if (sourceType === 'zip') {
        statusMsg = `ZIP Telegram berhasil dibaca. ${baseMsg}`;
        statusMsg += photoCount > 0 ? ` ${photoCount} foto tersedia.` : ' Folder photos tidak ditemukan.';
      } else {
        statusMsg = `HTML Telegram berhasil dibaca. ${baseMsg} Foto tidak tersedia pada mode HTML.`;
      }
      statusMsg += ' (Mode Request Mentah — tidak ada Final List TF ditemukan.)';
    }

    if (els.fileHint) els.fileHint.textContent = statusMsg;
    if (els.exportBtn) els.exportBtn.disabled = txCount === 0 && candidateCount === 0;
    render();
  } catch (error) {
    console.error('Telegram UI rendering failed:', error);
    if (els.fileHint) els.fileHint.textContent = `Data berhasil dibaca (${state.transactions.length} transaksi), tetapi tampilan gagal diperbarui: ${error.message}`;
    if (els.exportBtn) els.exportBtn.disabled = state.transactions.length === 0;
  }
}

// ========== HELPER: PRESERVE BR AS NEWLINES ==========

function htmlElementToText(element) {
  if (!element) return '';
  const clone = element.cloneNode(true);
  clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  return clone.textContent
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ========== CHAT NOISE FILTER ==========

const NOISE_PATTERNS = [
  /^\.{1,3}$/,
  /^(done|wait|oke+|okey|okee|iya|iyes|sip|siap|ok|noted|tq|thx|thanks|makasih|sudah|udah|blm|belum|nanti|cek|ntar|mantap|mantab)$/i,
  /^@[a-z0-9_]+$/i,
  /^[\p{Emoji}\s]+$/u,
  /^(ini blm|udah belum|gimana|sudah belum|belum ngasih|minta inv|ini oke\??)$/i,
];

function isChatNoise(text) {
  const t = (text || '').trim();
  if (!t) return true;
  if (t.length < 3 && !/\d/.test(t)) return true;
  return NOISE_PATTERNS.some(p => p.test(t));
}

// ========== MAIN PARSER ==========

function parseTelegramHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Support both .history > .message and direct .message.default
  const messageNodes = Array.from(
    doc.querySelectorAll('.history .message, .message.default, .message.service')
  );
  // Also include top-level messages not nested in .history
  const allMessageNodes = messageNodes.length > 0 ? messageNodes :
    Array.from(doc.querySelectorAll('.message'));

  let currentServiceDate = '';
  let lastDefaultSender = '';
  let lastDefaultDateTitle = '';
  const rawMessages = [];

  allMessageNodes.forEach((node, index) => {
    // ---- Service date messages ----
    if (node.classList.contains('service')) {
      const bodyEl = node.querySelector('.body.details, .details');
      const serviceText = htmlElementToText(bodyEl) || cleanText(node.textContent || '');
      if (serviceText) currentServiceDate = serviceText;
      return;
    }

    const isJoined = node.classList.contains('joined');
    const id = node.id || `message-${index}`;
    const body = node.querySelector('.body');

    // Date/time from pull_right.date.details title attribute
    const dateEl = node.querySelector('.pull_right.date.details, .date.details');
    const dateTitle = dateEl?.getAttribute('title') || (isJoined ? lastDefaultDateTitle : '');
    const timeText = cleanText(dateEl?.textContent || '');

    // Sender: for joined messages, inherit from last default
    const senderEl = body?.querySelector(':scope > .from_name') || node.querySelector('.from_name');
    const rawSender = cleanText(senderEl?.childNodes?.[0]?.textContent || senderEl?.textContent || '');
    const sender = rawSender || (isJoined ? lastDefaultSender : '');

    if (!isJoined && rawSender) {
      lastDefaultSender = rawSender;
      lastDefaultDateTitle = dateTitle;
    }

    // Text: prefer htmlElementToText for proper BR handling
    const textEl = node.querySelector('.text');
    const text = htmlElementToText(textEl);

    // Photo hrefs (nested paths supported)
    const photoLinks = Array.from(node.querySelectorAll('a.photo_wrap[href], a[href*="photos/"]'))
      .map(a => a.getAttribute('href'))
      .filter(Boolean);

    // Reply target
    const replyEl = node.querySelector('.reply_to a[href^="#go_to_message"]');
    const replyToId = replyEl?.getAttribute('href')?.replace('#go_to_message', '') || null;

    // Timestamps
    const timestamp = parseTelegramTimestamp(dateTitle, currentServiceDate, timeText);
    const messageDate = timestamp.dateLabel || currentServiceDate || '';
    const messageDateKey = timestamp.dateKey || dateLabelToKey(messageDate) || '';

    // Resolve photo blob URLs — try normalized path first, then basename
    const resolvedPhotoLinks = photoLinks.map(href => {
      const normHref = normalizeZipPath(href);
      const blobUrl = state.photos.get(normHref)
        || state.photos.get(href)
        || state.photos.get(href.split('/').pop())
        || null;
      return { href, normHref, blobUrl };
    });

    const type = detectMessageType(text, photoLinks);

    rawMessages.push({
      id,
      index,
      isJoined,
      sender,
      dateTitle,
      timeText,
      serviceDate: currentServiceDate,
      dateLabel: messageDate,
      dateKey: messageDateKey,
      timestampMs: timestamp.ms || index,
      text,
      photoLinks,
      resolvedPhotoLinks,
      replyToId,
      type,
    });
  });

  state.rawMessages = rawMessages;
  state.photoIndex = buildPhotoIndex(rawMessages);
  state.listHistory = buildListHistory(rawMessages);
  state.finalLists = pickFinalLists(state.listHistory);

  if (state.finalLists.length > 0) {
    // FINAL LIST MODE
    state.telegramParseMode = 'final_list';
    state.transactions = buildFinalTransactions(state.finalLists, state.photoIndex);
    state.requestCandidates = [];
  } else {
    // RAW REQUEST HISTORY MODE — no List TF found
    state.telegramParseMode = 'raw_request_history';
    state.requestCandidates = buildRawRequestCandidates(rawMessages);
    // Promote candidates as transactions so existing UI/tables can render them
    state.transactions = state.requestCandidates;
  }

  mapPhotosToTransactions(rawMessages);
  hydrateFilters();

  console.log({
    telegramParseMode: state.telegramParseMode,
    totalMessages: rawMessages.length,
    listMessagesCount: state.listHistory.length,
    finalListsCount: state.finalLists.length,
    requestCandidatesCount: state.requestCandidates?.length || 0,
    firstParsedTransaction: state.transactions[0],
  });
}

// ========== RAW REQUEST HISTORY PARSER ==========

const BANK_PATTERN = /\b(BCA|BRI|BJB|MANDIRI|BSI|SEABANK|DANA|OVO|GOPAY|JAGO|JENIUS|NIAGA|BNI|PERMATA|BUKOPIN)\b/i;
const ACCOUNT_PATTERN = /\b\d{8,16}\b/;
// Note: do NOT use /g flag on module-level regex that are used inside .match()
// or they'll retain lastIndex and produce inconsistent results.
function matchCgCodes(text) {
  return unique((text.match(/\bCG[A-Z]{2,4}\d{10}\b/gi) || []).map(c => c.toUpperCase()));
}
function matchOtCodes(text) {
  return unique((text.match(/\bOT\d{8}CG[A-Z]{2,4}\d{4}\b/gi) || []).map(c => c.toUpperCase()));
}

function isRequestCandidate(msg) {
  const t = msg.text || '';
  if (isChatNoise(t) && !msg.photoLinks?.length) return false;
  return (
    BANK_PATTERN.test(t) ||
    ACCOUNT_PATTERN.test(t) ||
    /\bCG[A-Z]{2,4}\d{10}\b/i.test(t) ||
    /\bOT\d{8}CG[A-Z]{2,4}\d{4}\b/i.test(t) ||
    /(?:Rp\.?|IDR)\s*[\d.]+/i.test(t) ||
    /\d+\s*(rb|ribu|jt|juta)/i.test(t) ||
    /\btransfer\b/i.test(t) ||
    msg.photoLinks?.length > 0
  );
}

function extractRawNominal(text) {
  // Avoid extracting account numbers as nominal
  // Priority 1: explicit Rp / IDR
  let m = text.match(/(?:Rp\.?|IDR)\s*([\d.,]+)/i);
  if (m) {
    const raw = m[1].replace(/\./g, '').replace(/,/g, '');
    const val = Number(raw);
    if (val >= 1000) return val;
  }
  // Priority 2: suffix rb/ribu/jt
  m = text.match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu|jt|juta)/i);
  if (m) {
    const base = Number(m[1].replace(',', '.'));
    const mult = /jt|juta/i.test(m[2]) ? 1_000_000 : 1_000;
    const val = Math.round(base * mult);
    if (val >= 1000) return val;
  }
  return null;
}

function extractRawAccountInfo(text) {
  const lines = text.split('\n');
  let bank = '', noRekening = '', atasNama = '', vendor = '';

  for (const line of lines) {
    const bankMatch = line.match(BANK_PATTERN);
    if (bankMatch && !bank) bank = bankMatch[1].toUpperCase();

    const accMatch = line.match(/\b(\d{8,16})\b/);
    if (accMatch && !noRekening) {
      // Don't grab CG codes as account numbers
      if (!/^CG/i.test(line)) noRekening = accMatch[1];
    }

    // a.n / atas nama / AN
    const anMatch = line.match(/(?:a\.?\s*n\.?|a\/n|an\.?|atas\s+nama)\s*[.:–]?\s*([^()0-9\n]{3,40})/i);
    if (anMatch && !atasNama) atasNama = cleanText(anMatch[1]);

    // vendor in parens
    const vendorMatch = line.match(/\(([^)]{2,30})\)/);
    if (vendorMatch && !vendor) vendor = cleanText(vendorMatch[1]);
  }

  return { bank, noRekening, atasNama, vendor };
}

function buildRawRequestCandidates(messages) {
  const candidates = [];

  messages.forEach((msg, idx) => {
    if (!isRequestCandidate(msg)) return;

    const text = msg.text || '';
    const cgCodes = matchCgCodes(text);
    const otCodes = matchOtCodes(text);
    const nominal = extractRawNominal(text);
    const account = extractRawAccountInfo(text);
    const photoLinks = msg.resolvedPhotoLinks || msg.photoLinks?.map(h => ({ href: h, blobUrl: state.photos.get(normalizeZipPath(h)) || state.photos.get(h) || null })) || [];

    const vendor = account.vendor || account.atasNama || 'Perlu Dicek';
    const category = classifyTransaction(`${vendor} ${text}`);

    let status = 'Lengkap';
    if (!nominal) status = 'Nominal Belum Terbaca';
    else if (!account.noRekening && !account.bank) status = 'Rekening Belum Terbaca';
    else if (!vendor || vendor === 'Perlu Dicek') status = 'Vendor Belum Terbaca';
    else if (!cgCodes.length && !otCodes.length && !account.noRekening) status = 'Perlu Dicek';

    candidates.push({
      id: `raw-${msg.id}-${idx}`,
      tanggal: msg.dateKey || '',
      tanggalLabel: msg.dateLabel || formatDateKey(msg.dateKey) || msg.serviceDate || '',
      jam: msg.timeText || '',
      pengirim: msg.sender || '',
      dateKey: msg.dateKey || '',
      metode: account.bank || 'Perlu Dicek',
      noRekening: account.noRekening || '',
      atasNama: account.atasNama || '',
      vendor,
      nominal: nominal || 0,
      deskripsi: text.slice(0, 200),
      kodeCG: cgCodes,
      kodeOT: otCodes,
      jumlahKodeCG: cgCodes.length,
      kategori: category,
      akunAkuntansi: akunMap[category] || 'Perlu Dicek',
      statusNota: photoLinks.length > 0 ? 'Ada' : 'Kurang Nota',
      statusInvoice: 'Tidak Wajib',
      statusOCR: photoLinks.some(p => p.blobUrl) ? 'Tersedia untuk OCR' : 'Foto Tidak Tersedia',
      statusValidasi: status,
      catatanSistem: `Mode: Request Mentah`,
      catatanAkuntan: '',
      linkFoto: photoLinks,
      photoCount: photoLinks.length,
      sourceMessageId: msg.id,
      teksMentah: text,
      isFallback: false,
      isRawCandidate: true,
    });
  });

  return candidates;
}

function mapPhotosToTransactions(rawMessages) {
  // Extract all photos from messages — use resolvedPhotoLinks if available
  const allPhotos = [];
  rawMessages.forEach(msg => {
    const links = msg.resolvedPhotoLinks || [];
    const rawHrefs = msg.photoLinks || [];

    if (links.length > 0) {
      links.forEach(link => {
        allPhotos.push({
          href: link.href,
          normHref: link.normHref || normalizeZipPath(link.href),
          messageId: msg.id,
          date: msg.dateLabel,
          timestampMs: msg.timestampMs,
          text: msg.text,
          blobUrl: link.blobUrl || state.photos.get(normalizeZipPath(link.href)) || state.photos.get(link.href) || state.photos.get(link.href.split('/').pop()) || null,
        });
      });
    } else if (rawHrefs.length > 0) {
      rawHrefs.forEach(href => {
        const norm = normalizeZipPath(href);
        allPhotos.push({
          href,
          normHref: norm,
          messageId: msg.id,
          date: msg.dateLabel,
          timestampMs: msg.timestampMs,
          text: msg.text,
          blobUrl: state.photos.get(norm) || state.photos.get(href) || state.photos.get(href.split('/').pop()) || null,
        });
      });
    }
  });

  // Collect all already linked photos
  const linkedHrefs = new Set();
  state.transactions.forEach(tx => {
    tx.linkFoto.forEach(p => linkedHrefs.add(p.href));
  });

  // Photos that need to be matched heuristics
  const remainingPhotos = allPhotos.filter(p => !linkedHrefs.has(p.href));
  
  remainingPhotos.forEach(photo => {
    // Basic heuristic: match by OT code first if available in photo text
    const otCodes = extractOtCodes(photo.text);
    let matchedTx = null;
    
    if (otCodes.length > 0) {
      matchedTx = state.transactions.find(tx => tx.kodeOT.includes(otCodes[0]));
    }
    
    // If still no match, match by closest timestamp where Vendor matches or just closest time
    if (!matchedTx && photo.text) {
      const lowerText = photo.text.toLowerCase();
      const possibleTxs = state.transactions.filter(tx => {
        const v = tx.vendor.toLowerCase();
        const r = (tx.noRekening || '').toLowerCase();
        return (v && v !== 'perlu dicek' && lowerText.includes(v)) || (r && lowerText.includes(r));
      });
      if (possibleTxs.length > 0) {
        // Find closest by time
        matchedTx = possibleTxs.reduce((prev, curr) => {
          return (Math.abs(curr.timestampMs - photo.timestampMs) < Math.abs(prev.timestampMs - photo.timestampMs)) ? curr : prev;
        });
      }
    }
    
    if (matchedTx) {
      matchedTx.linkFoto.push(photo);
      matchedTx.photoCount = matchedTx.linkFoto.length;
      matchedTx.statusNota = 'Ada';
      if (photo.blobUrl) matchedTx.statusOCR = 'Tersedia untuk OCR';
      linkedHrefs.add(photo.href);
    } else {
      state.unmatchedPhotos.push(photo);
    }
  });
}

function detectMessageType(text, photos) {
  const lower = (text || '').toLowerCase();
  if (/(list\s*tf\s*cg|list\s*tf|tf\s*cg)/i.test(text)) return 'List TF';
  if (photos?.length && /(cg[a-z0-9]{6,}|ot\d{8}cg[a-z0-9]+)/i.test(text)) return 'Bukti Foto / Request';
  if (/(ke skip|minta inv|cash aja|ditalang|talang|refund|belum ngasih inv|blm ngasih inv)/i.test(text)) return 'Koreksi / Catatan';
  if (photos?.length) return 'Foto';
  return text ? 'Percakapan' : 'Diabaikan';
}

function buildPhotoIndex(messages) {
  const index = new Map();
  messages.forEach((msg) => {
    if (!msg.photoLinks.length) return;
    const codes = extractCgCodes(msg.text);
    codes.forEach((code) => {
      if (!index.has(code)) index.set(code, []);
      index.get(code).push(...msg.photoLinks.map((href) => ({ href, messageId: msg.id, date: msg.dateLabel })));
    });
  });
  return index;
}

function buildListHistory(messages) {
  return messages
    .filter((msg) => /(list\s*tf\s*cg|list\s*tf|tf\s*cg)/i.test(msg.text))
    .map((msg) => {
      const listDate = extractListDate(msg.text) || msg.dateKey;
      const dateKey = normalizeDateKey(listDate) || msg.dateKey || `unknown-${msg.index}`;
      return {
        ...msg,
        listDateRaw: listDate,
        listDateKey: dateKey,
        transactionBlocks: splitTransactionBlocks(msg.text),
        isFinal: false,
      };
    });
}

function pickFinalLists(listHistory) {
  const byDate = new Map();
  listHistory.forEach((item) => {
    const key = item.listDateKey || item.dateKey || `unknown-${item.index}`;
    const current = byDate.get(key);
    if (!current) {
      byDate.set(key, item);
    } else if (item.timestampMs > current.timestampMs) {
      if (item.transactionBlocks.length === 0 && current.transactionBlocks.length > 0) {
        current.isFallback = true;
      } else {
        byDate.set(key, item);
      }
    }
  });

  const finalIds = new Set(Array.from(byDate.values()).map((item) => item.id));
  state.listHistory = listHistory.map((item) => ({ ...item, isFinal: finalIds.has(item.id) }));
  return Array.from(byDate.values()).sort((a, b) => a.timestampMs - b.timestampMs);
}

function buildFinalTransactions(finalLists, photoIndex) {
  const rows = [];
  finalLists.forEach((list) => {
    list.transactionBlocks.forEach((block, blockIndex) => {
      const tx = parseTransactionBlock(block, list, blockIndex);
      if (!tx) return;
      attachEvidenceAndValidation(tx, photoIndex);
      rows.push(tx);
    });
  });
  return rows;
}

function splitTransactionBlocks(text) {
  const lines = normalizeTelegramText(text).split('\n').map((line) => line.trim()).filter(Boolean);
  const startIndex = lines.findIndex((line) => /(list\s*tf\s*cg|list\s*tf|tf\s*cg)/i.test(line));
  const bodyLines = startIndex >= 0 ? lines.slice(startIndex + 1) : lines;
  const blocks = [];
  let current = [];

  bodyLines.forEach((line) => {
    const normalized = line.replace(/^[-–—]\s*/, '').trim();
    if (!normalized) return;
    const starts = isTransactionStart(line);
    if (starts && current.length) {
      blocks.push(current);
      current = [];
    }
    if (starts || current.length) current.push(line);
  });

  if (current.length) blocks.push(current);
  return blocks.filter((block) => block.some((line) => /(rp\.?|idr|\d{5,}|cg[a-z0-9]{6,}|cardless|pettycash)/i.test(line)));
}

function isTransactionStart(line) {
  const cleaned = line.trim().replace(/^[-–—]\s*/, '').replace(/^✅\s*/, '');
  return /^(BCA|BRI|BJB|MANDIRI|Mandiri|Seabank|SeaBank|DANA|Dana|Cardless(?:\s+Pettycash)?|Cash|CO\s+Shopee)\b/i.test(cleaned)
    || /^[-–—]\s*✅?\s*(BCA|BRI|BJB|MANDIRI|Mandiri|Seabank|SeaBank|DANA|Dana|Cardless(?:\s+Pettycash)?|Cash|CO\s+Shopee)\b/i.test(line.trim());
}

function parseTransactionBlock(blockLines, list, blockIndex) {
  const rawBlock = blockLines.join('\n');
  const checked = /✅/.test(rawBlock);
  const lines = blockLines.map((line) => line.replace(/^[-–—]\s*/, '').trim()).filter(Boolean);
  if (!lines.length) return null;

  const accountLineIndex = Math.max(0, lines.findIndex((line) => /(BCA|BRI|BJB|MANDIRI|Mandiri|Seabank|SeaBank|DANA|Dana|Cardless|Cash|CO\s+Shopee)/i.test(line)));
  const accountLine = lines[accountLineIndex].replace(/^✅\s*/, '').trim();
  const account = parseAccountLine(accountLine);
  const nominal = parseNominal(rawBlock);
  const codes = extractCgCodes(rawBlock);
  const otCodes = extractOtCodes(rawBlock);
  const desc = cleanDescription(rawBlock, accountLine);
  const vendor = account.vendor || account.atasNama || account.method || 'Perlu Dicek';
  const category = classifyTransaction(`${vendor} ${desc} ${rawBlock}`);

  return {
    id: `${list.id}-${blockIndex}`,
    tanggal: list.listDateKey || list.dateKey,
    tanggalLabel: formatDateKey(list.listDateKey || list.dateKey) || list.dateLabel,
    jam: list.timeText || '',
    pengirim: list.sender || '',
    statusChecklist: checked ? 'Sudah Dicek' : 'Belum Dicek',
    metode: account.method || 'Perlu Dicek',
    noRekening: account.noRekening || '',
    atasNama: account.atasNama || '',
    vendor,
    nominal,
    deskripsi: desc || 'Perlu Dicek',
    kodeCG: codes,
    kodeOT: otCodes,
    jumlahKodeCG: codes.length,
    kategori: category,
    akunAkuntansi: akunMap[category] || 'Perlu Dicek',
    statusNota: 'Kurang Nota',
    statusInvoice: 'Tidak Wajib',
    statusOCR: 'Tidak Diproses',
    statusValidasi: 'Perlu Dicek',
    catatanSistem: '',
    catatanAkuntan: '',
    linkFoto: [],
    sourceMessageId: list.id,
    teksMentah: rawBlock,
    isFallback: list.isFallback || false,
  };
}

function parseAccountLine(line) {
  const methodMatch = line.match(/\b(BCA|BRI|BJB|MANDIRI|Mandiri|Seabank|SeaBank|DANA|Dana|Cardless\s+Pettycash|Cardless|Cash|CO\s+Shopee)\b/i);
  const method = methodMatch ? normalizeMethod(methodMatch[0]) : '';
  const noRekening = (line.match(/\b\d{5,}\b/) || [''])[0];
  const vendorMatch = line.match(/\(([^)]+)\)/);
  const vendor = vendorMatch ? cleanText(vendorMatch[1]) : '';

  let atasNama = '';
  const nameMatch = line.match(/(?:^|\s)(?:a\.?\s*n\.?|a\/n|an\.?|atas\s+namanya|atas\s+nama)\s*[:.]?\s*([^()]+)/i);
  if (nameMatch) {
    atasNama = nameMatch[1];
  } else if (noRekening) {
    atasNama = line.slice(line.indexOf(noRekening) + noRekening.length);
  }
  atasNama = atasNama
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(BCA|BRI|BJB|MANDIRI|Mandiri|Seabank|SeaBank|DANA|Dana|Cardless|Cash|CO\s+Shopee)\b/gi, '')
    .replace(/[-:]/g, ' ')
    .replace(/\b\d{5,}\b/g, '')
    .replace(/atas\s+namanya\s+nomor/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { method, noRekening, atasNama, vendor };
}

function normalizeMethod(value) {
  const lower = value.toLowerCase();
  if (lower.includes('mandiri')) return 'Mandiri';
  if (lower.includes('seabank')) return 'Seabank';
  if (lower.includes('dana')) return 'DANA';
  if (lower.includes('cardless pettycash')) return 'Cardless Pettycash';
  if (lower.includes('cardless')) return 'Cardless';
  if (lower.includes('cash')) return 'Cash';
  if (lower.includes('co shopee')) return 'CO Shopee';
  return value.toUpperCase();
}

function attachEvidenceAndValidation(tx, photoIndex) {
  const linkedPhotos = [];
  tx.kodeCG.forEach((code) => {
    const photos = photoIndex.get(code) || [];
    linkedPhotos.push(...photos);
  });
  const uniquePhotos = uniqueBy(linkedPhotos, (item) => item.href).map(p => ({
    ...p,
    blobUrl: state.photos.get(p.href) || null
  }));
  
  tx.linkFoto = uniquePhotos;
  tx.photoCount = uniquePhotos.length;
  tx.statusNota = uniquePhotos.length ? 'Ada' : 'Kurang Nota';
  
  if (!uniquePhotos.length) {
    tx.statusOCR = 'Foto Tidak Tersedia';
  } else if (uniquePhotos.some(p => p.blobUrl)) {
    tx.statusOCR = 'Tersedia untuk OCR';
  } else {
    tx.statusOCR = 'Hanya HTML (Tanpa Gambar)';
  }
  
  tx.ocr_text = '';

  const lowerRaw = `${tx.teksMentah} ${tx.deskripsi}`.toLowerCase();
  if (tx.kategori === 'Outsourcing') {
    if (!tx.kodeCG.length || /blm ngasih inv|belum ngasih inv|minta inv|kurang inv/i.test(lowerRaw)) {
      tx.statusInvoice = 'Kurang Invoice';
    } else {
      tx.statusInvoice = 'Ada';
    }
  } else {
    tx.statusInvoice = 'Tidak Wajib';
  }

  const notes = [];
  if (!tx.nominal) notes.push('Nominal kosong/perlu dicek');
  if (!tx.vendor || tx.vendor === 'Perlu Dicek') notes.push('Vendor/rekening perlu dicek');
  if (!tx.kodeCG.length) notes.push('Kode CG tidak ditemukan');
  if (tx.kategori === 'Perlu Dicek') notes.push('Kategori belum yakin');
  if (tx.statusNota === 'Kurang Nota') notes.push('Foto nota belum terhubung');
  if (tx.statusInvoice === 'Kurang Invoice') notes.push('Invoice wajib untuk Outsourcing');
  if (tx.isFallback) notes.push('Fallback: list terbaru gagal diparse, memakai list valid sebelumnya.');

  if (!tx.nominal) tx.statusValidasi = 'Nominal Perlu Dicek';
  else if (!tx.vendor || tx.vendor === 'Perlu Dicek') tx.statusValidasi = 'Vendor Perlu Dicek';
  else if (tx.statusNota === 'Kurang Nota') tx.statusValidasi = 'Kurang Nota';
  else if (tx.statusInvoice === 'Kurang Invoice') tx.statusValidasi = 'Kurang Invoice';
  else if (tx.kategori === 'Perlu Dicek') tx.statusValidasi = 'Perlu Dicek';
  else tx.statusValidasi = 'Lengkap';

  tx.catatanSistem = notes.join('; ');
}

function classifyTransaction(text) {
  const lower = text.toLowerCase();
  const order = ['Refund', 'Pettycash / Top Up / Mutasi Internal', 'Biaya Operasional', 'Pembelian Aset', 'Membeli Perlengkapan', 'Menambah Persediaan', 'Outsourcing', 'Membeli Bahan'];
  for (const category of order) {
    const keywords = kategoriRules[category] || [];
    if (keywords.some((keyword) => lower.includes(keyword))) return category;
  }
  return 'Perlu Dicek';
}

function cleanDescription(rawBlock, accountLine) {
  let text = rawBlock.replace(accountLine, ' ');
  text = text.replace(/✅/g, ' ');
  text = text.replace(/[-–—]/g, ' ');
  text = text.replace(/(?:Rp\.?|IDR)\s*[\d.]+/gi, ' ');
  text = text.replace(/\bOT\d{8}CG[A-Z0-9]+\b/gi, ' ');
  text = text.replace(/\bCG[A-Z0-9]{6,}\b/gi, ' ');
  text = text.replace(/\(\s*\)/g, ' ');
  text = text.replace(/[()]/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text || '';
}

function parseNominal(text) {
  const match = text.match(/(?:Rp\.?|IDR)\s*([\d.]+)/i);
  if (!match) return 0;
  return Number(match[1].replace(/\./g, '')) || 0;
}

function extractCgCodes(text) {
  return unique((text.match(/\bCG[A-Z0-9]+\b/gi) || []).map((code) => code.toUpperCase()));
}

function extractOtCodes(text) {
  return unique((text.match(/\bOT[0-9A-Z]+\b/gi) || []).map((code) => code.toUpperCase()));
}

function extractListDate(text) {
  const match = text.match(/(?:List\s*TF\s*CG|List\s*TF|TF\s*CG)\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  return match ? match[1] : '';
}

function parseTelegramTimestamp(title, serviceDate, timeText) {
  if (title) {
    const match = title.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}:\d{2}:\d{2})/);
    if (match) {
      const [, dd, mm, yyyy, time] = match;
      const iso = `${yyyy}-${mm}-${dd}T${time}+07:00`;
      return {
        ms: Date.parse(iso),
        dateKey: `${yyyy}-${mm}-${dd}`,
        dateLabel: `${Number(dd)} ${monthName(Number(mm))} ${yyyy}`,
      };
    }
  }
  const dateKey = dateLabelToKey(serviceDate);
  return { ms: dateKey ? Date.parse(`${dateKey}T${timeText || '00:00'}:00+07:00`) : 0, dateKey, dateLabel: serviceDate };
}

function dateLabelToKey(label) {
  if (!label) return '';
  const match = label.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!match) return normalizeDateKey(label);
  const day = match[1].padStart(2, '0');
  const month = monthNumber(match[2]).toString().padStart(2, '0');
  const year = match[3];
  return `${year}-${month}-${day}`;
}

function normalizeDateKey(input) {
  if (!input) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const match = String(input).match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (!match) return '';
  let [, dd, mm, yyyy] = match;
  if (yyyy.length === 2) yyyy = `20${yyyy}`;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function formatDateKey(key) {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return key || '';
  const [year, month, day] = key.split('-');
  return `${Number(day)} ${monthName(Number(month))} ${year}`;
}

function monthName(month) {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[month - 1] || '';
}

function monthNumber(name) {
  const map = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, mei: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
  return map[String(name).toLowerCase()] || 1;
}

function hydrateFilters() {
  fillSelect(els.categoryFilter, 'Kategori (Semua)', unique(state.transactions.map((tx) => tx.kategori)).sort());
  fillSelect(els.validationFilter, 'Validasi (Semua)', unique(state.transactions.map((tx) => tx.statusValidasi)).sort());
}

function fillSelect(select, label, options) {
  const oldValue = select.value;
  select.innerHTML = `<option value="">${escapeHtml(label)}</option>` + options.map((value) => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join('');
  select.value = options.includes(oldValue) ? oldValue : '';
}

function render() {
  state.filteredTransactions = filterTransactions(state.transactions);
  renderStats();
  renderPanel();
}

function filterTransactions(rows) {
  const term = state.filters.search.trim().toLowerCase();
  return rows.filter((tx) => {
    const searchable = [tx.vendor, tx.noRekening, tx.atasNama, tx.nominal, tx.deskripsi, tx.kodeCG.join(' '), tx.kategori, tx.statusValidasi].join(' ').toLowerCase();
    const matchSearch = !term || searchable.includes(term);
    const matchCategory = !state.filters.category || tx.kategori === state.filters.category;
    const matchValidation = !state.filters.validation || tx.statusValidasi === state.filters.validation;
    return matchSearch && matchCategory && matchValidation;
  });
}

function renderStats() {
  // These IDs were removed from index.html in the refactor; use safe helpers
  setElText('statTransaksi', state.transactions.length.toLocaleString('id-ID'));
  setElText('statPengeluaran', formatRupiah(state.transactions.reduce((sum, tx) => sum + (tx.nominal || 0), 0)));
  setElText('statPerluDicek', state.transactions.filter((tx) => tx.statusValidasi !== 'Lengkap').length.toLocaleString('id-ID'));
  setElText('statRiwayat', state.listHistory.length.toLocaleString('id-ID'));
}

function renderPanel() {
  if (els.transactionFilters) els.transactionFilters.style.display = state.activeTab === 'transaksi' ? 'grid' : 'none';
  // mutationSummaryGrid was removed from index.html; skip gracefully

  if (state.activeTab === 'transaksi') {
    if (els.panelKicker) els.panelKicker.textContent = 'Transaksi final';
    if (els.panelTitle) els.panelTitle.textContent = 'Data transaksi final';
    if (els.panelInfo) els.panelInfo.textContent = `${state.filteredTransactions.length} dari ${state.transactions.length} transaksi tampil.`;
    renderTransactionTable();
  } else if (state.activeTab === 'mutasi') {
    if (els.panelKicker) els.panelKicker.textContent = 'Mutasi Bank';
    if (els.panelTitle) els.panelTitle.textContent = 'Data hasil ekstraksi mutasi bank';
    if (els.panelInfo) els.panelInfo.textContent = `${state.mutations.length} transaksi mutasi ditemukan.`;
    renderMutasiBank();
  } else if (state.activeTab === 'rekonsiliasi') {
    if (els.panelKicker) els.panelKicker.textContent = 'Rekonsiliasi Mutasi';
    if (els.panelTitle) els.panelTitle.textContent = 'Hasil pencocokan mutasi dengan Telegram';
    if (els.panelInfo) els.panelInfo.textContent = `Menampilkan semua mutasi dan transaksi.`;
    renderRekonsiliasiMutasi();
  } else if (state.activeTab === 'riwayat') {
    if (els.panelKicker) els.panelKicker.textContent = 'Riwayat List TF';
    if (els.panelTitle) els.panelTitle.textContent = 'Riwayat list Telegram';
    if (els.panelInfo) els.panelInfo.textContent = 'List terbaru per tanggal ditandai sebagai Final.';
    renderListHistory();
  } else if (state.activeTab === 'foto') {
    if (els.panelKicker) els.panelKicker.textContent = 'Foto Nota';
    if (els.panelTitle) els.panelTitle.textContent = 'Semua foto terhubung dengan transaksi';
    if (els.panelInfo) els.panelInfo.textContent = 'Menampilkan daftar foto yang berhasil dipetakan ke data transaksi.';
    renderFotoNota();
  } else if (state.activeTab === 'foto-belum') {
    if (els.panelKicker) els.panelKicker.textContent = 'Foto Belum Terhubung';
    if (els.panelTitle) els.panelTitle.textContent = 'Foto tanpa transaksi';
    if (els.panelInfo) els.panelInfo.textContent = 'Menampilkan daftar foto yang belum berhasil dipetakan ke transaksi mana pun.';
    renderFotoBelumTerhubung();
  } else if (state.activeTab === 'mentah') {
    if (els.panelKicker) els.panelKicker.textContent = 'Data mentah';
    if (els.panelTitle) els.panelTitle.textContent = 'Data chat mentah';
    if (els.panelInfo) els.panelInfo.textContent = `${state.rawMessages.length} pesan terbaca dari export HTML.`;
    renderRawMessages();
  } else {
    if (els.panelKicker) els.panelKicker.textContent = 'Master Keyword';
    if (els.panelTitle) els.panelTitle.textContent = 'Aturan klasifikasi kategori';
    if (els.panelInfo) els.panelInfo.textContent = 'Keyword bisa dijadikan acuan untuk pengembangan database master.';
    renderKeywordRules();
  }
}

function renderTransactionTable() {
  const rows = state.filteredTransactions;
  if (!rows.length) {
    els.tableHost.innerHTML = emptyState('Belum ada data transaksi', 'Upload file messages.html untuk mulai memproses data Telegram.');
    return;
  }

  els.tableHost.innerHTML = `
    <div class="table-scroll">
      <table class="ledger-table">
        <thead>
          <tr>
            <th style="width: 150px;">Tanggal & Waktu</th>
            <th style="width: 220px;">Vendor & Rekening</th>
            <th style="width: 140px;">Nominal</th>
            <th>Deskripsi & Kode CG</th>
            <th style="width: 160px;">Kategori</th>
            <th style="width: 160px;">Status Validasi</th>
            <th style="width: 200px;">Foto & OCR</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(renderTransactionRow).join('')}
        </tbody>
      </table>
    </div>
  `;
}

window.runOcr = async function(txId) {
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx || !tx.linkFoto || !tx.linkFoto.length) return;
  const photo = tx.linkFoto.find(p => p.blobUrl);
  if (!photo) return;
  
  tx.ocr_status = 'Memproses OCR...';
  render(); // Trigger re-render to show processing status

  try {
    const worker = await Tesseract.createWorker('ind');
    const ret = await worker.recognize(photo.blobUrl);
    tx.ocr_text = ret.data.text;
    tx.ocr_status = 'Berhasil';
    await worker.terminate();
  } catch (err) {
    console.error(err);
    tx.ocr_status = 'OCR Perlu Dicek';
  }
  
  render();
};

function renderTransactionRow(tx) {
  const codes = tx.kodeCG.length ? tx.kodeCG : ['Kode CG tidak ada'];
  const ot = tx.kodeOT.length ? `<div class="chip-wrap">${tx.kodeOT.map((code) => `<span class="code-chip">${escapeHtml(code)}</span>`).join('')}</div>` : '';
  
  let ocrSection = '';
  if (tx.photoCount > 0) {
    const hasBlob = tx.linkFoto.some(p => p.blobUrl);
    ocrSection = `
      <div class="cell-sub" style="margin-bottom: 4px;">${tx.photoCount} Foto Tersedia</div>
      ${hasBlob ? `<button onclick="runOcr('${tx.id}')" style="padding: 4px 8px; font-size: 11px; cursor: pointer; border-radius: 4px; border: 1px solid #ccc; background: #f9fafb;">Jalankan OCR</button>` : ''}
      <div class="cell-sub" style="margin-top: 4px; color: ${tx.ocr_status === 'Berhasil' ? 'green' : (tx.ocr_status === 'OCR Perlu Dicek' ? 'red' : '#666')}">${tx.ocr_status || tx.statusOCR}</div>
      ${tx.ocr_text ? `<details><summary style="font-size: 11px; cursor: pointer;">Teks OCR</summary><div style="font-size: 11px; padding: 4px; background: #eee; border-radius: 4px; max-height: 100px; overflow-y: auto;">${escapeHtml(tx.ocr_text)}</div></details>` : ''}
    `;
  } else {
    ocrSection = `<div class="cell-sub" style="color: #999;">Tidak Ada Foto</div>`;
  }

  return `
    <tr>
      <td>
        <div class="cell-main">${escapeHtml(tx.tanggalLabel || '-')}</div>
        <div class="cell-sub">${escapeHtml(tx.jam || '-')}</div>
        <div class="cell-sub">oleh ${escapeHtml(tx.pengirim || '-')}</div>
      </td>
      <td>
        <div class="cell-main">${escapeHtml(tx.vendor || '-')}</div>
        <div class="cell-sub">${escapeHtml(tx.metode || '-')} ${escapeHtml(tx.noRekening || '')}</div>
        <div class="cell-sub">a.n ${escapeHtml(tx.atasNama || '-')}</div>
        <div class="chip-wrap">${badge(tx.statusChecklist, tx.statusChecklist === 'Sudah Dicek' ? 'green' : 'amber')}</div>
      </td>
      <td class="money-cell">${formatRupiah(tx.nominal)}</td>
      <td class="desc-cell">
        <div class="desc-text">${escapeHtml(tx.deskripsi || '-')}</div>
        <div class="chip-wrap">${codes.map((code) => `<span class="code-chip">${escapeHtml(code)}</span>`).join('')}</div>
        ${ot}
        <div class="cell-sub">Nota: ${escapeHtml(tx.statusNota)} • Invoice: ${escapeHtml(tx.statusInvoice)}</div>
      </td>
      <td>${categoryBadge(tx.kategori)}</td>
      <td>${validationBadge(tx.statusValidasi)}${tx.catatanSistem ? `<div class="cell-sub">${escapeHtml(tx.catatanSistem)}</div>` : ''}</td>
      <td>${ocrSection}</td>
    </tr>
  `;
}

function renderListHistory() {
  if (!state.listHistory.length) {
    els.tableHost.innerHTML = emptyState('Belum ada riwayat List TF', 'Upload messages.html untuk melihat semua versi List TF CG yang pernah dikirim.');
    return;
  }

  els.tableHost.innerHTML = `
    <div class="table-scroll">
      <table class="mini-table">
        <thead><tr><th>Tanggal List</th><th>Jam Pesan</th><th>Pengirim</th><th>Status</th><th>Jumlah Item</th><th>Preview</th></tr></thead>
        <tbody>
          ${state.listHistory.map((item) => `
            <tr>
              <td>${escapeHtml(formatDateKey(item.listDateKey) || item.listDateKey || '-')}</td>
              <td>${escapeHtml(item.timeText || '-')}</td>
              <td>${escapeHtml(item.sender || '-')}</td>
              <td>${badge(item.isFinal ? 'Final' : 'Versi Lama', item.isFinal ? 'green' : '')}</td>
              <td>${item.transactionBlocks.length}</td>
              <td>${escapeHtml(shorten(item.text, 260))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderFotoNota() {
  const linkedTxs = state.transactions.filter(tx => tx.linkFoto.length > 0);
  if (!linkedTxs.length) {
    els.tableHost.innerHTML = emptyState('Belum ada foto', 'Upload ZIP Telegram yang berisi folder photos.');
    return;
  }

  const html = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px;">
      ${linkedTxs.map(tx => `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #fff; display: flex; flex-direction: column;">
          ${tx.linkFoto.some(p => p.blobUrl) 
            ? `<img src="${tx.linkFoto.find(p => p.blobUrl)?.blobUrl}" style="width: 100%; height: 180px; object-fit: cover; border-bottom: 1px solid #e5e7eb;" />` 
            : `<div style="width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; background: #f3f4f6; color: #9ca3af; border-bottom: 1px solid #e5e7eb;">HTML Saja (Tanpa Foto)</div>`
          }
          <div style="padding: 12px; flex: 1;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${escapeHtml(tx.vendor)}</div>
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${escapeHtml(tx.tanggalLabel)} • ${formatRupiah(tx.nominal)}</div>
            <div style="font-size: 11px; background: #f3f4f6; padding: 6px; border-radius: 4px;">
              ${escapeHtml(shorten(tx.deskripsi, 60))}
            </div>
            ${tx.ocr_text ? `<div style="margin-top: 8px; font-size: 11px; color: #059669; font-weight: 500;">✓ OCR Tersedia</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  els.tableHost.innerHTML = html;
}

function renderFotoBelumTerhubung() {
  if (!state.unmatchedPhotos.length) {
    els.tableHost.innerHTML = emptyState('Tidak ada foto tersisa', 'Semua foto telah berhasil dipetakan ke transaksi, atau tidak ada foto dari upload HTML.');
    return;
  }

  const html = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px;">
      ${state.unmatchedPhotos.map(photo => `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #fff; display: flex; flex-direction: column;">
          ${photo.blobUrl 
            ? `<img src="${photo.blobUrl}" style="width: 100%; height: 180px; object-fit: cover; border-bottom: 1px solid #e5e7eb;" />` 
            : `<div style="width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; background: #f3f4f6; color: #9ca3af; border-bottom: 1px solid #e5e7eb;">HTML Saja (Tanpa Foto)</div>`
          }
          <div style="padding: 12px; flex: 1;">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${escapeHtml(photo.date)}</div>
            <div style="font-size: 11px; background: #f3f4f6; padding: 6px; border-radius: 4px;">
              ${escapeHtml(shorten(photo.text, 100)) || '<i>Tanpa teks</i>'}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  els.tableHost.innerHTML = html;
}

function renderRawMessages() {
  if (!state.rawMessages.length) {
    els.tableHost.innerHTML = emptyState('Belum ada data chat mentah', 'Upload messages.html untuk melihat hasil pembacaan pesan Telegram.');
    return;
  }

  els.tableHost.innerHTML = `
    <div class="table-scroll">
      <table class="mini-table">
        <thead><tr><th>Tanggal</th><th>Jam</th><th>Pengirim</th><th>Jenis</th><th>Foto</th><th>Teks</th></tr></thead>
        <tbody>
          ${state.rawMessages.map((msg) => `
            <tr>
              <td>${escapeHtml(msg.dateLabel || '-')}</td>
              <td>${escapeHtml(msg.timeText || '-')}</td>
              <td>${escapeHtml(msg.sender || '-')}</td>
              <td>${badge(msg.type, msg.type === 'List TF' ? 'blue' : '')}</td>
              <td>${msg.photoLinks.length}</td>
              <td>${escapeHtml(shorten(msg.text, 300))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderKeywordRules() {
  els.tableHost.innerHTML = `
    <p class="notice">Aturan invoice: hanya kategori <strong>Outsourcing</strong> yang wajib invoice. Semua kategori lain cukup nota/bukti pembelian. Pembelian aset juga tidak wajib invoice.</p>
    <div class="table-scroll">
      <table class="mini-table">
        <thead><tr><th>Kategori</th><th>Akun Akuntansi</th><th>Keyword</th></tr></thead>
        <tbody>
          ${Object.entries(kategoriRules).map(([category, keywords]) => `
            <tr>
              <td>${categoryBadge(category)}</td>
              <td>${escapeHtml(akunMap[category] || '-')}</td>
              <td>${keywords.map((keyword) => `<span class="code-chip">${escapeHtml(keyword)}</span>`).join(' ')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function emptyState(title, subtitle) {
  return `
    <div class="empty-state">
      <div class="empty-icon">i</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(subtitle)}</p>
    </div>
  `;
}

function badge(text, tone = '') {
  return `<span class="badge ${tone}">${escapeHtml(text || '-')}</span>`;
}

function categoryBadge(category) {
  const tone = {
    'Outsourcing': 'dark',
    'Membeli Bahan': 'blue',
    'Menambah Persediaan': 'purple',
    'Membeli Perlengkapan': 'amber',
    'Pembelian Aset': 'purple',
    'Biaya Operasional': 'green',
    'Refund': 'red',
    'Pettycash / Top Up / Mutasi Internal': '',
    'Perlu Dicek': 'amber',
  }[category] || '';
  return badge(category || 'Perlu Dicek', tone);
}

function validationBadge(status) {
  let tone = '';
  if (status === 'Lengkap') tone = 'green';
  else if (/Kurang|Nominal|Vendor|Tanggal/i.test(status)) tone = 'red';
  else if (/Perlu|Dicek|OCR/i.test(status)) tone = 'amber';
  return badge(status || 'Perlu Dicek', tone);
}

function exportWorkbook(exportAll = false) {
  if (!state.transactions.length) return;
  
  // If exportAll, temporarily disable filter to calculate all reconciliations
  let originalFilter = null;
  if (exportAll && state.reconDateFilter.mode !== 'all') {
    originalFilter = { ...state.reconDateFilter };
    state.reconDateFilter = { mode: 'all', single: '', rangeStart: '', rangeEnd: '', tolerance: false };
    reconcileTransactions();
  }

  const sheets = buildWorkbookSheets(exportAll);
  const xml = createExcelXml(sheets);
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  
  const filter = exportAll ? { mode: 'all' } : state.reconDateFilter;
  let filenameSuffix = new Date().toISOString().slice(0, 10);
  if (!exportAll && filter && filter.mode !== 'all') {
    if (filter.mode === 'single' && filter.single) {
      filenameSuffix = filter.single.replace(/\//g, '-');
    } else if (filter.mode === 'range' && filter.rangeStart && filter.rangeEnd) {
      filenameSuffix = `${filter.rangeStart.replace(/\//g, '-')}-sampai-${filter.rangeEnd.replace(/\//g, '-')}`;
    }
  }
  
  a.download = `CG-Ledger-Balance-${filenameSuffix}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  
  // Restore filter
  if (originalFilter) {
    state.reconDateFilter = originalFilter;
    reconcileTransactions();
  }
}

function buildWorkbookSheets(exportAll) {
  const filter = state.reconDateFilter;
  let activeTxs = [...state.transactions];
  let activeMutations = [...state.mutations];
  let filterLabel = 'Semua Tanggal';
  
  if (filter && filter.mode !== 'all') {
    activeTxs = state.transactions.filter(tx => {
      if (!tx.dateKey) return false;
      if (filter.mode === 'single') return tx.dateKey === filter.single;
      if (filter.mode === 'range') return tx.dateKey >= filter.rangeStart && tx.dateKey <= filter.rangeEnd;
      return true;
    });
    activeMutations = state.mutations.filter(m => {
      if (!m.tanggalKey) return false;
      if (filter.mode === 'single') return m.tanggalKey === filter.single;
      if (filter.mode === 'range') return m.tanggalKey >= filter.rangeStart && m.tanggalKey <= filter.rangeEnd;
      return true;
    });
    if (filter.mode === 'single') filterLabel = formatDateKey(filter.single);
    else if (filter.mode === 'range') filterLabel = `${formatDateKey(filter.rangeStart)} - ${formatDateKey(filter.rangeEnd)}`;
  }

  const txRows = activeTxs.map(txToRow);
  const totalRequest = activeTxs.reduce((sum, tx) => sum + (tx.nominal || 0), 0);
  const totalMutasiKeluar = activeMutations.reduce((sum, m) => sum + (m.nominal_keluar || 0), 0);
  
  const countMatch = state.reconciliationResults.filter(r => r.status_rekonsiliasi === 'MATCH' || r.status_rekonsiliasi === 'MATCH + BIAYA ADMIN').length;
  const countSalahTransfer = state.unmatchedMutations.filter(r => r.status_rekonsiliasi === 'SALAH TRANSFER').length;
  const countBelumAda = state.unmatchedTransactions.length;
  const countMutasiTanpaRequest = state.unmatchedMutations.filter(r => r.status_rekonsiliasi === 'MUTASI TANPA REQUEST').length;
  
  const activeRecons = state.reconciliationResults;
  const activeUnmatchedTxs = state.unmatchedTransactions;
  const activeUnmatchedMuts = state.unmatchedMutations;
  
  const sumMutasi = activeRecons.reduce((s, r) => s + (r.nominal_mutasi || 0), 0) + activeUnmatchedMuts.reduce((s, r) => s + (r.nominal_mutasi || 0), 0);
  const sumRequest = activeRecons.reduce((s, r) => s + (r.nominal_telegram || 0), 0) + activeUnmatchedTxs.reduce((s, r) => s + (r.nominal_telegram || 0), 0);
  const sumAdmin = activeRecons.reduce((s, r) => s + (r.biaya_admin || 0), 0);
  const isBalanced = (sumMutasi - sumRequest - sumAdmin) === 0 ? "BALANCED" : "NOT BALANCED";

  const sheets = [];
  sheets.push({ name: 'Summary', rows: [
    ['Informasi Rekonsiliasi', ''],
    ['Mode Filter', exportAll ? 'Semua Tanggal' : 'Tanggal Terpilih'],
    ['Tanggal Terpilih', filterLabel],
    ['', ''],
    ['Metrik', 'Nilai'],
    ['Jumlah Request', activeTxs.length],
    ['Jumlah Mutasi DB', activeMutations.filter(m => m.nominal_keluar > 0).length],
    ['Total Nominal List TF', totalRequest],
    ['Total Nominal Mutasi Keluar', totalMutasiKeluar],
    ['', ''],
    ['Total Match', countMatch],
    ['Total Salah Transfer', countSalahTransfer],
    ['Belum Ada di Mutasi', countBelumAda],
    ['Mutasi Tanpa Request', countMutasiTanpaRequest],
    ['', ''],
    ['Status', isBalanced],
    ['Tanggal Export', new Date().toLocaleString('id-ID')]
  ] });
  
  sheets.push({ name: 'Semua Transaksi Final', rows: objectRowsToSheet(txRows) });
  sheets.push({ name: 'List Pemegang Rekening', rows: objectRowsToSheet(activeTxs.map((tx) => ({
    'No Rekening': tx.noRekening,
    'Vendor': tx.vendor,
    'Nominal': tx.nominal,
    'Deskripsi Barang': tx.deskripsi,
    'No Invoice / Kode CG': tx.kodeCG.join('; '),
  }))) });

  ['Outsourcing', 'Membeli Bahan', 'Menambah Persediaan', 'Membeli Perlengkapan', 'Pembelian Aset', 'Biaya Operasional', 'Refund', 'Pettycash / Top Up / Mutasi Internal'].forEach((category) => {
    const name = category === 'Pettycash / Top Up / Mutasi Internal' ? 'Pettycash Top Up' : category;
    sheets.push({ name, rows: objectRowsToSheet(activeTxs.filter((tx) => tx.kategori === category).map(txToRow)) });
  });

  sheets.push({ name: 'Kurang Nota', rows: objectRowsToSheet(activeTxs.filter((tx) => tx.statusValidasi === 'Kurang Nota').map(txToRow)) });
  sheets.push({ name: 'Kurang Invoice', rows: objectRowsToSheet(activeTxs.filter((tx) => tx.statusValidasi === 'Kurang Invoice').map(txToRow)) });
  sheets.push({ name: 'Perlu Dicek', rows: objectRowsToSheet(activeTxs.filter((tx) => tx.statusValidasi !== 'Lengkap').map(txToRow)) });
  
  if (activeMutations.length > 0) {
    sheets.push({ name: 'Mutasi Bank', rows: objectRowsToSheet(activeMutations.map(mutToRow)) });
  }

  if (activeRecons && activeRecons.length > 0) {
    sheets.push({ name: 'Rekonsiliasi Mutasi', rows: objectRowsToSheet(activeRecons.map(reconToRow)) });
    sheets.push({ name: 'Nominal Tidak Match', rows: objectRowsToSheet(activeRecons.filter(r => r.status_rekonsiliasi === 'NOMINAL TIDAK MATCH').map(reconToRow)) });
    sheets.push({ name: 'Selisih Lebih', rows: objectRowsToSheet(activeRecons.filter(r => r.selisih_nominal > 0).map(reconToRow)) });
    sheets.push({ name: 'Selisih Kurang', rows: objectRowsToSheet(activeRecons.filter(r => r.selisih_nominal < 0).map(reconToRow)) });
  }
  if (activeUnmatchedTxs && activeUnmatchedTxs.length > 0) {
    sheets.push({ name: 'Belum Ada di Mutasi', rows: objectRowsToSheet(activeUnmatchedTxs.map(reconToRow)) });
  }
  if (activeUnmatchedMuts && activeUnmatchedMuts.length > 0) {
    sheets.push({ name: 'Mutasi Tanpa Request', rows: objectRowsToSheet(activeUnmatchedMuts.map(reconToRow)) });
  }

  sheets.push({ name: 'Rekap Vendor', rows: objectRowsToSheet(aggregateVendorRecap()) });
  sheets.push({ name: 'Rekap Rekening', rows: objectRowsToSheet(aggregateBy(activeTxs, 'noRekening')) });
  sheets.push({ name: 'Rekap Kategori', rows: objectRowsToSheet(aggregateBy(activeTxs, 'kategori')) });
  sheets.push({ name: 'Riwayat List Telegram', rows: objectRowsToSheet(state.listHistory.map((item) => ({
    'Tanggal List': formatDateKey(item.listDateKey) || item.listDateKey,
    'Jam': item.timeText,
    'Pengirim': item.sender,
    'Status': item.isFinal ? 'Final' : 'Versi Lama',
    'Jumlah Item': item.transactionBlocks.length,
    'Message ID': item.id,
    'Teks Mentah': item.text,
  }))) });
  sheets.push({ name: 'Data Mentah', rows: objectRowsToSheet(state.rawMessages.map((msg) => ({
    'Tanggal': msg.dateLabel,
    'Jam': msg.timeText,
    'Pengirim': msg.sender,
    'Jenis': msg.type,
    'Jumlah Foto': msg.photoLinks.length,
    'Message ID': msg.id,
    'Teks': msg.text,
  }))) });
  sheets.push({ name: 'Keyword Rules', rows: objectRowsToSheet(Object.entries(kategoriRules).map(([category, keywords]) => ({
    'Kategori': category,
    'Akun Akuntansi': akunMap[category] || '',
    'Keyword': keywords.join('; '),
  }))) });

  return sheets;
}

function txToRow(tx) {
  return {
    'Tanggal': tx.tanggalLabel,
    'Jam': tx.jam,
    'Pengirim Telegram': tx.pengirim,
    'Metode Pembayaran': tx.metode,
    'No Rekening': tx.noRekening,
    'Atas Nama': tx.atasNama,
    'Vendor': tx.vendor,
    'Nominal': tx.nominal,
    'Deskripsi Barang': tx.deskripsi,
    'Kode CG': tx.kodeCG.join('; '),
    'Kode OT': tx.kodeOT.join('; '),
    'Kategori': tx.kategori,
    'Akun Akuntansi': tx.akunAkuntansi,
    'Status Checklist': tx.statusChecklist,
    'Status Nota': tx.statusNota,
    'Status Invoice': tx.statusInvoice,
    'Status OCR': tx.statusOCR,
    'Status Validasi': tx.statusValidasi,
    'Catatan Sistem': tx.catatanSistem,
    'Catatan Akuntan': tx.catatanAkuntan,
    'Link Foto Nota': tx.linkFoto.map((item) => item.href).join('; '),
    'Sumber Message ID': tx.sourceMessageId,
    'Teks Mentah': tx.teksMentah,
  };
}

function aggregateBy(rows, key) {
  const map = new Map();
  rows.forEach((tx) => {
    const label = tx[key] || 'Kosong';
    if (!map.has(label)) map.set(label, { 'Nama': label, 'Jumlah Transaksi': 0, 'Total Nominal': 0 });
    const item = map.get(label);
    item['Jumlah Transaksi'] += 1;
    item['Total Nominal'] += tx.nominal || 0;
  });
  return Array.from(map.values()).sort((a, b) => b['Total Nominal'] - a['Total Nominal']);
}

function aggregateVendorRecap() {
  const map = new Map();
  state.transactions.forEach((tx) => {
    const vendor = tx.vendor || 'Kosong';
    if (!map.has(vendor)) {
      map.set(vendor, { 
        'Vendor': vendor, 
        'Jumlah Transaksi': 0, 
        'Total Nominal List': 0,
        'Total Mutasi Keluar': 0,
        'Total Biaya Admin': 0,
        'Selisih Vendor': 0
      });
    }
    const item = map.get(vendor);
    item['Jumlah Transaksi'] += 1;
    item['Total Nominal List'] += tx.nominal || 0;
  });

  state.reconciliationResults.forEach((recon) => {
    const vendor = recon.vendor || 'Kosong';
    if (map.has(vendor)) {
      const item = map.get(vendor);
      item['Total Mutasi Keluar'] += recon.nominal_mutasi || 0;
      item['Total Biaya Admin'] += recon.biaya_admin || 0;
    }
  });

  const results = Array.from(map.values());
  results.forEach(item => {
    item['Selisih Vendor'] = item['Total Mutasi Keluar'] - item['Total Nominal List'] - item['Total Biaya Admin'];
  });
  
  return results.sort((a, b) => b['Total Nominal List'] - a['Total Nominal List']);
}

function objectRowsToSheet(objects) {
  if (!objects.length) return [['Data'], ['Tidak ada data']];
  const headers = Object.keys(objects[0]);
  return [headers, ...objects.map((row) => headers.map((header) => row[header] ?? ''))];
}

function createExcelXml(sheets) {
  const worksheets = sheets.map((sheet) => {
    const rows = sheet.rows.map((row) => `
      <Row>${row.map((cell) => `<Cell><Data ss:Type="${typeof cell === 'number' ? 'Number' : 'String'}">${escapeXml(String(cell ?? ''))}</Data></Cell>`).join('')}</Row>`).join('');
    return `<Worksheet ss:Name="${escapeXml(safeSheetName(sheet.name))}"><Table>${rows}</Table></Worksheet>`;
  }).join('');

  return `<?xml version="1.0"?>
  <?mso-application progid="Excel.Sheet"?>
  <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:html="http://www.w3.org/TR/REC-html40">
    ${worksheets}
  </Workbook>`;
}

function safeSheetName(name) {
  return String(name).replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Sheet';
}

function normalizeTelegramText(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => cleanText(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function formatRupiah(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function shorten(text, limit = 180) {
  const clean = cleanText(text);
  return clean.length > limit ? `${clean.slice(0, limit)}...` : clean;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueBy(values, getter) {
  const seen = new Set();
  return values.filter((item) => {
    const key = getter(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ==========================================
// REKONSILIASI MUTASI BANK LOGIC
// ==========================================

async function handleMutationChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const validPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!validPdf) {
    if (els.pdfReadStatus) els.pdfReadStatus.textContent = 'File bukan PDF';
    if (els.mutationParseStatus) els.mutationParseStatus.textContent = 'Gagal';
    return;
  }

  // Reset existing data
  state.mutations = [];
  state.reconciliationResults = [];
  state.unmatchedMutations = [];
  state.unmatchedTransactions = [];

  state.mutationFileName = file.name;
  if (els.mutationFileName) els.mutationFileName.textContent = file.name;
  if (els.pdfReadStatus) els.pdfReadStatus.textContent = 'Membaca PDF...';
  if (els.mutationParseStatus) els.mutationParseStatus.textContent = 'Menunggu hasil pembacaan...';
  
  if (els.mutationOcrProgress) {
    els.mutationOcrProgress.style.display = 'none';
    els.mutationOcrProgress.textContent = '';
  }
  if (els.mutationFallbackActions) {
    els.mutationFallbackActions.style.display = 'none';
  }
  if (els.mutationInputLabel) {
    els.mutationInputLabel.style.display = 'inline-block';
  }
  
  // Render immediately to reflect empty states before processing
  render();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const loadingTask = pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    let reconstructedLines = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      if (els.pdfReadStatus) els.pdfReadStatus.textContent = `Membaca halaman ${i} dari ${pdf.numPages}`;
      await new Promise(resolve => setTimeout(resolve, 0)); // yield
      
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent({ normalizeWhitespace: true });
      
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
      
      // Reconstruct lines based on y coordinate
      const pageLines = groupTextItemsIntoLines(textContent.items);
      reconstructedLines = reconstructedLines.concat(pageLines);
    }

    if (fullText.trim().length > 200) {
      if (els.pdfReadStatus) els.pdfReadStatus.textContent = `PDF Digital Terbaca • ${pdf.numPages} halaman`;
      if (els.mutationParseStatus) els.mutationParseStatus.textContent = 'Memisahkan transaksi BCA...';
      await new Promise(resolve => setTimeout(resolve, 0)); // yield
      
      // Parse BCA format
      parseBCAMutationLines(reconstructedLines);
      
      if (state.mutations.length > 0) {
        if (els.mutationParseStatus) els.mutationParseStatus.textContent = `${state.mutations.filter(m => m.nominal_keluar > 0).length} transaksi keluar berhasil diparse`;
      } else {
        if (els.mutationParseStatus) els.mutationParseStatus.textContent = 'Teks PDF terbaca, tetapi transaksi belum berhasil diparse';
        if (els.mutationFallbackActions) els.mutationFallbackActions.style.display = 'flex';
      }
    } else {
      if (els.pdfReadStatus) els.pdfReadStatus.textContent = 'PDF Tidak Memiliki Text Layer';
      if (els.mutationParseStatus) els.mutationParseStatus.textContent = 'OCR Diperlukan';
      if (els.mutationFallbackActions) els.mutationFallbackActions.style.display = 'flex';
    }
    
    reconcileTransactions();
    render();
  } catch (error) {
    console.error("Gagal membaca PDF mutasi:", error);
    if (els.pdfReadStatus) els.pdfReadStatus.textContent = 'Gagal Membuka PDF';
    if (els.mutationParseStatus) els.mutationParseStatus.textContent = error?.message || 'Terjadi kesalahan saat memproses PDF';
    if (els.mutationFallbackActions) els.mutationFallbackActions.style.display = 'flex';
    
    state.mutations = [];
    reconcileTransactions();
    render();
  }
}

function groupTextItemsIntoLines(textItems) {
  const linesMap = new Map();
  const tolerance = 3; // y-coordinate tolerance
  
  textItems.forEach(item => {
    if (!item.str.trim()) return;
    const x = item.transform[4];
    const y = item.transform[5];
    
    let matchedY = null;
    for (const key of linesMap.keys()) {
      if (Math.abs(key - y) <= tolerance) {
        matchedY = key;
        break;
      }
    }
    
    if (matchedY === null) {
      linesMap.set(y, [{ str: item.str, x }]);
    } else {
      linesMap.get(matchedY).push({ str: item.str, x });
    }
  });

  // Sort by Y descending (since top is usually higher Y in PDF coordinates, but PDFJS might have it origin bottom-left)
  const sortedYs = Array.from(linesMap.keys()).sort((a, b) => b - a);
  
  const reconstructedLines = [];
  sortedYs.forEach(y => {
    const lineItems = linesMap.get(y);
    lineItems.sort((a, b) => a.x - b.x);
    reconstructedLines.push(lineItems.map(item => item.str).join(' '));
  });
  
  return reconstructedLines;
}

function parseBCAMutationLines(lines) {
  const parsedMutations = [];
  let currentId = 1;
  let currentBlock = [];
  
  // Date pattern for BCA transaction start (e.g., 01/06/2026 or 01/06)
  const datePattern = /^\d{2}\/\d{2}(?:\/\d{4})?$/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check if line starts with a date (start of new block)
    const firstWord = line.split(' ')[0];
    if (datePattern.test(firstWord)) {
      if (currentBlock.length > 0) {
        processBCABlock(currentBlock, parsedMutations, currentId++);
        currentBlock = [];
      }
    }
    
    // Accumulate lines if we are inside a block
    if (currentBlock.length > 0 || datePattern.test(firstWord)) {
      currentBlock.push(line);
    }
  }
  
  // Process last block
  if (currentBlock.length > 0) {
    processBCABlock(currentBlock, parsedMutations, currentId++);
  }

  state.rawMutationText = lines.join('\n');
  state.mutations = parsedMutations;
  extractMutationDates();
}

function normalizeMutationDate(dateStr) {
  if (!dateStr) return '';
  // Try existing normalizer first (handles DD/MM/YYYY)
  const norm = normalizeDateKey(dateStr);
  if (norm) return norm;
  
  // Handle DD/MM format (assume current year if no year provided)
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    const dd = match[1].padStart(2, '0');
    const mm = match[2].padStart(2, '0');
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${mm}-${dd}`;
  }
  return '';
}

function buildDateSelectOptions(dates, placeholder) {
  return `<option value="">${placeholder}</option>` +
    dates.map(d => `<option value="${d}">${formatDateKey(d)}</option>`).join('');
}

function populateRangeEndDate(startValue) {
  if (!els.rangeEndDate) return;
  const dates = state.availableMutationDates;
  const filtered = startValue
    ? dates.filter(d => d >= startValue)
    : dates;
  els.rangeEndDate.innerHTML = buildDateSelectOptions(filtered, '-- Pilih Tanggal Selesai --');
  els.rangeEndDate.disabled = !startValue;
  els.rangeEndDate.value = '';
}

function extractMutationDates() {
  const dates = new Set();
  state.mutations.forEach(m => {
    const norm = normalizeMutationDate(m.tanggal_mutasi || m.tanggal || m.mutationDate || m.date);
    if (norm) {
      m.tanggalKey = norm;
      dates.add(norm);
    }
  });
  state.availableMutationDates = Array.from(dates).sort();

  const allDates = state.availableMutationDates;
  const optionsHtml = buildDateSelectOptions(allDates, '-- Pilih Tanggal --');

  if (els.singleDateSelect) {
    els.singleDateSelect.innerHTML = optionsHtml;
  }
  if (els.rangeStartDate) {
    els.rangeStartDate.innerHTML = buildDateSelectOptions(allDates, '-- Pilih Tanggal Mulai --');
    els.rangeStartDate.value = '';
  }
  populateRangeEndDate('');

  if (allDates.length > 0) {
    if (els.dateFilterInfo) {
      const start = allDates[0];
      const end = allDates[allDates.length - 1];
      els.dateFilterInfo.innerHTML = `
        <div style="margin-bottom: 4px;">Periode PDF terdeteksi: <strong style="color: var(--text-main);">${formatDateKey(start)} sampai ${formatDateKey(end)}</strong></div>
        <div>Jumlah tanggal tersedia: <strong style="color: var(--text-main);">${allDates.length} hari</strong></div>
      `;
    }
    if (els.dateFilterCard) {
      els.dateFilterCard.style.display = 'block';
    }
  }
}

function handleApplyDateFilter() {
  if (els.dateFilterError) els.dateFilterError.style.display = 'none';
  let mode = 'all';
  if (els.dateModeRadios) {
    els.dateModeRadios.forEach(r => { if (r.checked) mode = r.value; });
  }

  const filter = {
    mode: mode,
    single: els.singleDateSelect?.value || '',
    rangeStart: els.rangeStartDate?.value || '',
    rangeEnd: els.rangeEndDate?.value || '',
    tolerance: els.dateToleranceCheckbox?.checked || false
  };

  if (mode === 'single' && !filter.single) {
    if (els.dateFilterError) { els.dateFilterError.textContent = 'Pilih satu tanggal terlebih dahulu.'; els.dateFilterError.style.display = 'block'; }
    return;
  }
  
  if (mode === 'range') {
    if (!filter.rangeStart || !filter.rangeEnd) {
      if (els.dateFilterError) { els.dateFilterError.textContent = 'Pilih tanggal mulai dan selesai.'; els.dateFilterError.style.display = 'block'; }
      return;
    }
    if (filter.rangeStart > filter.rangeEnd) {
      if (els.dateFilterError) { els.dateFilterError.textContent = 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai.'; els.dateFilterError.style.display = 'block'; }
      return;
    }
  }

  state.reconDateFilter = filter;
  
  if (els.dateFilterActiveIndicator) {
    els.dateFilterActiveIndicator.style.display = 'block';
    if (mode === 'all') els.dateFilterActiveIndicator.textContent = 'Menampilkan semua tanggal';
    if (mode === 'single') els.dateFilterActiveIndicator.textContent = `Menampilkan tanggal ${formatDateKey(filter.single)}`;
    if (mode === 'range') els.dateFilterActiveIndicator.textContent = `Menampilkan ${formatDateKey(filter.rangeStart)} sampai ${formatDateKey(filter.rangeEnd)}`;
  }

  reconcileTransactions();
  render();
}

function handleResetDateFilter() {
  if (els.dateFilterError) els.dateFilterError.style.display = 'none';
  if (els.dateModeRadios) {
    els.dateModeRadios.forEach(r => {
      if (r.value === 'all') r.checked = true;
    });
  }
  if (els.singleDateContainer) els.singleDateContainer.style.display = 'none';
  if (els.rangeDateContainer) els.rangeDateContainer.style.display = 'none';
  if (els.singleDateSelect) els.singleDateSelect.value = '';
  if (els.rangeStartDate) els.rangeStartDate.value = '';
  populateRangeEndDate('');
  if (els.dateToleranceCheckbox) els.dateToleranceCheckbox.checked = false;
  if (els.dateFilterActiveIndicator) {
    els.dateFilterActiveIndicator.style.display = 'none';
    els.dateFilterActiveIndicator.textContent = '';
  }

  state.reconDateFilter = { mode: 'all', single: '', rangeStart: '', rangeEnd: '', tolerance: false };
  reconcileTransactions();
  render();
}

function processBCABlock(blockLines, parsedArray, currentId) {
  const rawText = blockLines.join('\n');
  const dateMatch = blockLines[0].match(/^(\d{2}\/\d{2}(?:\/\d{4})?)/);
  const dateStr = dateMatch ? dateMatch[1] : '';
  
  // Look for the specific Branch Amount DB/CR Balance pattern
  // Group 1: Branch, Group 2: Amount, Group 3: DB/CR, Group 4: Balance
  const amountPattern = /\b(\d{4})\s+(\d{1,3}(?:,\d{3})*\.\d{2})\s+(DB|CR)\s+(\d{1,3}(?:,\d{3})*\.\d{2})\b/;
  
  let branchStr = '';
  let amountStr = '';
  let typeStr = '';
  let balanceStr = '';
  let descriptionLines = [];
  
  for (const line of blockLines) {
    const match = line.match(amountPattern);
    if (match) {
      branchStr = match[1];
      amountStr = match[2];
      typeStr = match[3];
      balanceStr = match[4];
      
      // Remove the matching part from the line for the description
      const descPart = line.replace(match[0], '').trim();
      if (descPart) descriptionLines.push(descPart);
    } else {
      // Remove the date from the first line for description
      let cleanLine = line;
      if (line === blockLines[0] && dateStr) {
        cleanLine = line.replace(dateStr, '').trim();
      }
      if (cleanLine) descriptionLines.push(cleanLine);
    }
  }
  
  if (amountStr && typeStr) {
    const amountVal = parseFloat(amountStr.replace(/,/g, ''));
    const balanceVal = parseFloat(balanceStr.replace(/,/g, ''));
    const isDebit = typeStr.toUpperCase() === 'DB';
    const isKredit = typeStr.toUpperCase() === 'CR';
    
    // Attempt to extract account number and recipient from description
    let extractedAccount = '';
    let extractedName = '';
    
    // Sometimes account number is clearly stated, e.g., "KE 1234567890"
    const rekMatch = descriptionLines.join(' ').match(/\b(\d{10,})\b/);
    if (rekMatch) extractedAccount = rekMatch[1];
    
    // In BCA, the last description line is often the recipient name,
    // unless it's a generic word like "TRSF E-BANKING DB"
    if (descriptionLines.length > 0) {
      const lastLine = descriptionLines[descriptionLines.length - 1];
      if (!/(TRSF|E-BANKING|BIAYA|ADMIN|WS\d+)/i.test(lastLine)) {
        extractedName = lastLine;
      }
    }
    
    parsedArray.push({
      id: `mut-bca-pdf-${currentId}`,
      tanggal_mutasi: dateStr,
      keterangan: cleanText(descriptionLines.join(' ')),
      nominal: amountVal,
      nominal_keluar: isDebit ? amountVal : 0,
      nominal_masuk: isKredit ? amountVal : 0,
      saldo: balanceVal,
      bank: 'BCA',
      no_rekening_tujuan: extractedAccount,
      nama_penerima: extractedName,
      sumber_pembacaan: 'bca_pdf',
      status_parse: 'Berhasil',
      raw_text: rawText,
      matched: false
    });
  }
}

async function handleOcrCloudClick() {
  const file = els.mutationInput?.files?.[0];
  if (!file) return;
  
  try {
    await parseMutationWithCloudOcr(file);
  } catch (error) {
    console.warn('OCR cloud not available:', error);
  }
}

async function handleManualPasteParse() {
  const text = els.manualPasteInput?.value;
  if (!text?.trim()) return;
  
  if (els.manualPasteCard) els.manualPasteCard.style.display = 'none';
  
  await parseMutationText(text, 'manual_paste');
  if (state.mutations.length > 0) {
    reconcileTransactions();
    render();
  }
}

async function parseMutationWithCloudOcr(file) {
  // Stub for OCR Cloud
  // For MVP, we just throw an error because API Key is not configured
  throw new Error("OCR cloud belum dikonfigurasi.");
}

async function runOcrOnPdf(pdf) {
  let fullText = '';
  if (els.mutationOcrProgress) els.mutationOcrProgress.style.display = 'block';

  for (let i = 1; i <= pdf.numPages; i++) {
    if (els.mutationOcrProgress) els.mutationOcrProgress.textContent = `OCR halaman ${i} dari ${pdf.numPages}...`;
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = { canvasContext: context, viewport: viewport };
    await page.render(renderContext).promise;
    const dataUrl = canvas.toDataURL('image/png');

    try {
      const { data: { text } } = await Tesseract.recognize(dataUrl, 'ind', {
        logger: m => {
          if (m.status === 'recognizing text' && els.mutationOcrProgress) {
            const pct = Math.round(m.progress * 100);
            els.mutationOcrProgress.textContent = `OCR halaman ${i} dari ${pdf.numPages} (${pct}%)...`;
          }
        }
      });
      fullText += text + '\n';
    } catch (e) {
      console.warn("OCR ind failed, trying eng", e);
      const { data: { text } } = await Tesseract.recognize(dataUrl, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text' && els.mutationOcrProgress) {
            const pct = Math.round(m.progress * 100);
            els.mutationOcrProgress.textContent = `OCR halaman ${i} dari ${pdf.numPages} (${pct}%)...`;
          }
        }
      });
      fullText += text + '\n';
    }
  }
  
  if (els.mutationOcrProgress) els.mutationOcrProgress.style.display = 'none';
  return fullText;
}

async function parseMutationText(fullText, readingMethod) {
  const parsedMutations = [];
  const lines = fullText.split('\n').filter(line => line.trim());
  let currentId = 1;

  for (const line of lines) {
    const amountMatches = [...line.matchAll(/(?:(?:Rp|IDR)\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{4,})/gi)];
    const dateMatch = line.match(/(\d{1,2}[\/\-\s.](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|\d{1,2})(?:[\/\-\s.]\d{2,4})?)/i);
    
    if (amountMatches.length > 0) {
      const amounts = amountMatches.map(m => parseFloat(m[1].replace(/[,.]\d{2}$/, '').replace(/[^0-9]/g, '')));
      const isDebit = /(db|debit|keluar|transfer|trsf|biaya|tarikan|payment|qris|e-banking|mbanking)/i.test(line);
      const isKredit = /(cr|kredit|masuk|setor)/i.test(line);

      let statusParse = 'Berhasil';
      if (!isDebit && !isKredit) {
        statusParse = 'Perlu Dicek';
      }

      const amountVal = amounts[0];
      const saldoVal = amounts.length > 1 ? amounts[amounts.length - 1] : 0;

      if (amountVal > 0) {
        let ket = line.replace(dateMatch ? dateMatch[0] : '', '');
        amountMatches.forEach(m => {
          ket = ket.replace(m[0], '');
        });

        parsedMutations.push({
          id: `mut-manual-${Date.now()}-${currentId++}`,
          tanggal_mutasi: dateMatch ? dateMatch[1] : '',
          keterangan: cleanText(ket),
          nominal: amountVal,
          nominal_keluar: isDebit ? amountVal : (isKredit ? 0 : amountVal), // Default to debit if ambiguous
          nominal_masuk: isKredit ? amountVal : 0,
          saldo: saldoVal,
          no_rekening_tujuan: '',
          nama_penerima: '',
          sumber_pembacaan: readingMethod,
          status_parse: statusParse,
          raw_text: line,
          matched: false
        });
      }
    }
  }

  state.rawMutationText = fullText;
  state.mutations = parsedMutations;
  extractMutationDates();
}

function reconcileTransactions() {
  state.reconciliationResults = [];
  state.unmatchedMutations = [];
  state.unmatchedTransactions = [];

  // Reset matched flag on all mutations first
  state.mutations.forEach(m => m.matched = false);

  const filter = state.reconDateFilter;
  let activeMutations = [...state.mutations];
  let activeTxs = [...state.transactions];

  if (filter.mode !== 'all') {
    activeMutations = state.mutations.filter(m => {
      if (!m.tanggalKey) return false;
      if (filter.mode === 'single') return m.tanggalKey === filter.single;
      if (filter.mode === 'range') return m.tanggalKey >= filter.rangeStart && m.tanggalKey <= filter.rangeEnd;
      return true;
    });
    activeTxs = state.transactions.filter(tx => {
      if (!tx.dateKey) return false;
      if (filter.mode === 'single') return tx.dateKey === filter.single;
      if (filter.mode === 'range') return tx.dateKey >= filter.rangeStart && tx.dateKey <= filter.rangeEnd;
      return true;
    });
  }

  let candidateMutations = [...activeMutations];
  if (filter.tolerance && filter.mode !== 'all') {
    candidateMutations = state.mutations.filter(m => {
      if (!m.tanggalKey) return false;
      const tsM = new Date(m.tanggalKey).getTime();
      const tsS = new Date(filter.mode === 'single' ? filter.single : filter.rangeStart).getTime() - 86400000;
      const tsE = new Date(filter.mode === 'single' ? filter.single : filter.rangeEnd).getTime() + 86400000;
      return tsM >= tsS && tsM <= tsE;
    });
  }

  let totalCocok = 0;
  let totalTidakMatch = 0;
  let totalSelisihBersih = 0;

  const adminFees = [2500, 3000, 5000, 6500, 7500, 10000, 12500, 15000];

  activeTxs.forEach(tx => {
    // 1. Exact match on Nominal Keluar
    const sameNominal = candidateMutations.filter(m => !m.matched && m.nominal_keluar > 0 && m.nominal_keluar === tx.nominal);
    // 2. Match with valid Admin Fee
    const sameWithAdminFee = candidateMutations.filter(m => !m.matched && m.nominal_keluar > 0 && adminFees.includes(m.nominal_keluar - tx.nominal));
    // 3. Match by Description/Vendor
    const sameDesc = candidateMutations.filter(m => !m.matched && m.nominal_keluar > 0 && (m.keterangan.toLowerCase().includes(tx.vendor.toLowerCase()) || m.keterangan.toLowerCase().includes(tx.atasNama.toLowerCase())));

    let bestMatch = null;
    let status = 'BELUM DIBAYAR';
    let selisih = 0;
    let biaya_admin = 0;

    if (sameNominal.length > 0) {
      bestMatch = sameNominal[0];
    } else if (sameWithAdminFee.length > 0) {
      bestMatch = sameWithAdminFee[0];
    } else if (sameDesc.length > 0) {
      bestMatch = sameDesc[0];
    }

    if (bestMatch) {
      bestMatch.matched = true;
      selisih = bestMatch.nominal_keluar - tx.nominal;

      if (selisih === 0) {
        status = 'MATCH';
        biaya_admin = 0;
        totalCocok++;
      } else if (selisih > 0 && adminFees.includes(selisih)) {
        status = 'MATCH + BIAYA ADMIN';
        biaya_admin = selisih;
        totalCocok++;
      } else {
        status = 'NOMINAL TIDAK MATCH';
        biaya_admin = 0;
        totalTidakMatch++;
        totalSelisihBersih += selisih;
      }

      let catatan = '';
      if (status === 'MATCH') catatan = 'Nominal cocok';
      else if (status === 'MATCH + BIAYA ADMIN') catatan = `Cocok dengan biaya admin ${formatRupiah(selisih)}`;
      else catatan = selisih > 0 ? `Mutasi lebih besar dari request Telegram sebesar ${formatRupiah(selisih)}` : (selisih < 0 ? `Mutasi lebih kecil dari request Telegram sebesar ${formatRupiah(Math.abs(selisih))}` : 'Nominal cocok');

      let rekening_tujuan = bestMatch.no_rekening_tujuan || '';
      let nama_penerima = bestMatch.nama_penerima || '';
      
      // Fallbacks
      if (!nama_penerima) {
        if (tx.vendor && tx.vendor !== 'Perlu Dicek') nama_penerima = tx.vendor;
        else if (tx.atasNama) nama_penerima = tx.atasNama;
      }
      
      let keterangan_mutasi_display = '';
      if (rekening_tujuan && nama_penerima) {
        keterangan_mutasi_display = `${rekening_tujuan} - ${nama_penerima}`;
      } else if (nama_penerima) {
        keterangan_mutasi_display = nama_penerima;
      } else if (rekening_tujuan) {
        keterangan_mutasi_display = rekening_tujuan;
      } else {
        keterangan_mutasi_display = "Rekening/Penerima Tidak Terbaca";
      }

      state.reconciliationResults.push({
        ...tx,
        tanggal_request: tx.tanggalLabel,
        tanggal_mutasi: bestMatch.tanggal_mutasi,
        nominal_telegram: tx.nominal,
        nominal_mutasi: bestMatch.nominal_keluar,
        biaya_admin: biaya_admin,
        selisih_nominal: selisih,
        saldo_setelah_transaksi: bestMatch.saldo,
        keterangan_mutasi: keterangan_mutasi_display,
        raw_keterangan_mutasi: bestMatch.raw_text,
        status_rekonsiliasi: status,
        catatan_rekonsiliasi: catatan
      });
    } else {
      state.unmatchedTransactions.push({
        ...tx,
        tanggal_request: tx.tanggalLabel,
        tanggal_mutasi: '-',
        nominal_telegram: tx.nominal,
        nominal_mutasi: 0,
        biaya_admin: 0,
        selisih_nominal: -tx.nominal,
        saldo_setelah_transaksi: 0,
        keterangan_mutasi: '-',
        status_rekonsiliasi: 'BELUM DIBAYAR',
        catatan_rekonsiliasi: 'Belum ada transaksi di mutasi bank yang cocok'
      });
    }
  });

  state.unmatchedMutations = activeMutations.filter(m => !m.matched && m.nominal_keluar > 0).map(m => {
    const isSalahTransfer = activeTxs.some(tx => tx.nominal === m.nominal_keluar);
    let st = isSalahTransfer ? 'SALAH TRANSFER' : 'MUTASI TANPA REQUEST';
    let cat = isSalahTransfer ? 'Nominal cocok dengan request lain tetapi kemungkinan salah transfer' : 'Mutasi keluar ini tidak ada request di Telegram';

    let rekening_tujuan = m.no_rekening_tujuan || '';
    let nama_penerima = m.nama_penerima || '';
    let keterangan_mutasi_display = '';
    if (rekening_tujuan && nama_penerima) {
      keterangan_mutasi_display = `${rekening_tujuan} - ${nama_penerima}`;
    } else if (nama_penerima) {
      keterangan_mutasi_display = nama_penerima;
    } else if (rekening_tujuan) {
      keterangan_mutasi_display = rekening_tujuan;
    } else {
      keterangan_mutasi_display = "Rekening/Penerima Tidak Terbaca";
    }

    return {
      tanggal_request: '-',
      tanggal_mutasi: m.tanggal_mutasi,
      vendor: '-',
      noRekening: '-',
      atasNama: '-',
      nominal_telegram: 0,
      nominal_mutasi: m.nominal_keluar,
      biaya_admin: 0,
      selisih_nominal: m.nominal_keluar,
      saldo_setelah_transaksi: m.saldo,
      deskripsi: '-',
      keterangan_mutasi: keterangan_mutasi_display,
      raw_keterangan_mutasi: m.raw_text,
      status_rekonsiliasi: st,
      catatan_rekonsiliasi: cat,
      kodeCG: [],
      kodeOT: []
    };
  });

  if (els.statMutasiKeluar) els.statMutasiKeluar.textContent = activeMutations.filter(m => m.nominal_keluar > 0).length.toLocaleString('id-ID');
  if (els.statCocok) els.statCocok.textContent = totalCocok.toLocaleString('id-ID');
  if (els.statTidakMatch) els.statTidakMatch.textContent = totalTidakMatch.toLocaleString('id-ID');
  if (els.statSelisihBersih) {
    els.statSelisihBersih.textContent = selisihHtml(totalSelisihBersih, true);
  }
}

function selisihHtml(val, noColor = false) {
  if (val > 0) return noColor ? `+ ${formatRupiah(val)}` : `<span class="text-red">+ ${formatRupiah(val)}</span>`;
  if (val < 0) return noColor ? `- ${formatRupiah(Math.abs(val))}` : `<span class="text-amber">- ${formatRupiah(Math.abs(val))}</span>`;
  return noColor ? formatRupiah(0) : `<span class="text-green">${formatRupiah(0)}</span>`;
}

function reconBadge(status) {
  const tones = {
    'MATCH': 'green',
    'MATCH + BIAYA ADMIN': 'blue',
    'NOMINAL TIDAK MATCH': 'red',
    'BELUM DIBAYAR': 'amber',
    'MUTASI TANPA REQUEST': 'dark',
    'PERLU DICEK': 'orange'
  };
  return badge(status, tones[status] || '');
}

function reconToRow(tx) {
  return {
    'Tanggal Request': tx.tanggal_request || '-',
    'Tanggal Mutasi': tx.tanggal_mutasi || '-',
    'Vendor': tx.vendor || '-',
    'No Rekening': tx.noRekening || '-',
    'Atas Nama': tx.atasNama || '-',
    'Deskripsi List': tx.deskripsi || '-',
    'Keterangan Mutasi': tx.keterangan_mutasi || '-',
    'Nominal List TF': tx.nominal_telegram || 0,
    'Nominal Mutasi Keluar': tx.nominal_mutasi || 0,
    'Biaya Admin': tx.biaya_admin || 0,
    'Total Uang Keluar Bank': tx.nominal_mutasi || 0,
    'Saldo Setelah Transaksi': tx.saldo_setelah_transaksi || 0,
    'Selisih': tx.selisih_nominal || 0,
    'Status Rekonsiliasi': tx.status_rekonsiliasi || '-',
    'Catatan Sistem': tx.catatan_rekonsiliasi || '-'
  };
}

function mutToRow(m) {
  return {
    'Tanggal Mutasi': m.tanggal_mutasi || '-',
    'Keterangan Mutasi': m.keterangan || '-',
    'Debit / Keluar': m.nominal_keluar || 0,
    'Kredit / Masuk': m.nominal_masuk || 0,
    'Saldo': m.saldo || 0,
    'No Rekening Tujuan': m.no_rekening_tujuan || '-',
    'Nama Penerima': m.nama_penerima || '-',
    'Sumber Pembacaan': m.sumber_pembacaan || '-',
    'Status Parse': m.status_parse || '-',
    'Teks Mentah': m.raw_text || '-'
  };
}

function renderReconRow(tx) {
  return `
    <tr>
      <td>${escapeHtml(tx.tanggal_request)}</td>
      <td>${escapeHtml(tx.vendor)}</td>
      <td class="desc-text">${escapeHtml(tx.deskripsi)}</td>
      <td class="money-cell">${formatRupiah(tx.nominal_telegram)}</td>
      <td>${escapeHtml(tx.tanggal_mutasi)}</td>
      <td class="desc-text">
        <div style="font-weight: 500;">${escapeHtml(tx.keterangan_mutasi)}</div>
        ${tx.raw_keterangan_mutasi ? `<details style="font-size: 11px; margin-top: 4px; color: var(--text-muted);"><summary style="cursor: pointer;">Teks Asli</summary><div style="margin-top: 4px; padding: 4px; background: var(--surface-2); border-radius: 4px; white-space: pre-wrap;">${escapeHtml(tx.raw_keterangan_mutasi)}</div></details>` : ''}
      </td>
      <td class="money-cell">${formatRupiah(tx.nominal_mutasi)}</td>
      <td class="money-cell">${selisihHtml(tx.selisih_nominal)}</td>
      <td>${reconBadge(tx.status_rekonsiliasi)}</td>
    </tr>
  `;
}

function getReconTableHtml(rows, emptyTitle, emptyDesc) {
  if (!rows.length) {
    return `
      <div class="reconciliation-empty">
        <div class="empty-icon">📄</div>
        <h3>${escapeHtml(emptyTitle)}</h3>
        <p>${escapeHtml(emptyDesc)}</p>
      </div>
    `;
  }
  return `
    <div class="table-scroll">
      <table class="ledger-table" style="min-width: 1200px;">
        <thead>
          <tr>
            <th>Tanggal Request</th>
            <th>Vendor</th>
            <th>Deskripsi List</th>
            <th>Nominal List TF</th>
            <th>Tanggal Mutasi</th>
            <th>Keterangan Mutasi</th>
            <th>Nominal Mutasi Keluar</th>
            <th>Selisih</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(renderReconRow).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function calculateFinalStatus(telegramLoaded, mutationLoaded, totalRecons, anomalyCount) {
  if (!telegramLoaded && !mutationLoaded) return "BELUM DIPROSES";
  if (!telegramLoaded || !mutationLoaded) return "DATA BELUM LENGKAP";
  if (totalRecons === 0) return "BELUM ADA DATA REKONSILIASI";
  if (anomalyCount > 0) return "NOT BALANCED";
  return "BALANCED";
}

function renderRekonsiliasiMutasi() {
  const allRecons = [...state.reconciliationResults, ...state.unmatchedTransactions, ...state.unmatchedMutations];
  
  let sumRequest = 0;
  let sumMutasi = 0;
  let sumAdmin = 0;
  
  let countMatch = 0;
  let countTidakMatch = 0;
  let countBelum = 0;
  let countTanpaRequest = 0;
  let countSalahTransfer = 0;

  allRecons.forEach(r => {
    sumRequest += r.nominal_telegram || 0;
    sumMutasi += r.nominal_mutasi || 0;
    sumAdmin += r.biaya_admin || 0;
    
    if (r.status_rekonsiliasi === 'MATCH' || r.status_rekonsiliasi === 'MATCH + BIAYA ADMIN') {
      countMatch++;
    } else if (r.status_rekonsiliasi === 'NOMINAL TIDAK MATCH') {
      countTidakMatch++;
    } else if (r.status_rekonsiliasi === 'BELUM DIBAYAR') {
      countBelum++;
    } else if (r.status_rekonsiliasi === 'MUTASI TANPA REQUEST') {
      countTanpaRequest++;
    } else if (r.status_rekonsiliasi === 'SALAH TRANSFER') {
      countSalahTransfer++;
    }
  });
  
  const sumSelisih = sumMutasi - sumRequest - sumAdmin;
  const anomalyCount = countTidakMatch + countBelum + countTanpaRequest + countSalahTransfer;
  
  // Update main summary grid DOM
  if (document.getElementById('statRequest')) document.getElementById('statRequest').textContent = formatRupiah(sumRequest);
  if (document.getElementById('statMutasiKeluar')) document.getElementById('statMutasiKeluar').textContent = formatRupiah(sumMutasi);
  if (document.getElementById('statCocok')) document.getElementById('statCocok').textContent = countMatch;
  if (document.getElementById('statTidakMatch')) document.getElementById('statTidakMatch').textContent = countTidakMatch;
  if (document.getElementById('statSalahTransfer')) document.getElementById('statSalahTransfer').textContent = countSalahTransfer;
  if (document.getElementById('statBelumAdaMutasi')) document.getElementById('statBelumAdaMutasi').textContent = countBelum;
  if (document.getElementById('statMutasiTanpaRequest')) document.getElementById('statMutasiTanpaRequest').textContent = countTanpaRequest;
  if (document.getElementById('statAdmin')) document.getElementById('statAdmin').textContent = formatRupiah(sumAdmin);
  if (document.getElementById('statSelisihBersih')) document.getElementById('statSelisihBersih').innerHTML = selisihHtml(sumSelisih, true);

  // Update Status Akhir Badge
  const telegramLoaded = state.transactions.length > 0;
  const mutationLoaded = state.mutations.length > 0;
  const finalStatus = calculateFinalStatus(telegramLoaded, mutationLoaded, allRecons.length, anomalyCount);
  
  const badgeEl = document.getElementById('finalStatusBadge');
  if (badgeEl) {
    badgeEl.style.display = 'inline-flex';
    badgeEl.textContent = finalStatus;
    badgeEl.className = 'badge'; // reset
    if (finalStatus === 'BALANCED') badgeEl.classList.add('green');
    else if (finalStatus === 'NOT BALANCED') badgeEl.classList.add('red');
    else if (finalStatus === 'DATA BELUM LENGKAP') badgeEl.classList.add('amber');
    else badgeEl.classList.add('dark');
  }

  let filtered = allRecons;
  const s = state.reconFilters.search.toLowerCase();
  if (s) {
    filtered = filtered.filter(r => 
      (r.vendor || '').toLowerCase().includes(s) || 
      (r.noRekening || '').toLowerCase().includes(s) || 
      (r.keterangan_mutasi || '').toLowerCase().includes(s) ||
      (r.deskripsi || '').toLowerCase().includes(s)
    );
  }
  
  const statusFilter = state.reconFilters.status;
  if (statusFilter === 'Hanya Anomali') {
    filtered = filtered.filter(r => r.status_rekonsiliasi !== 'MATCH' && r.status_rekonsiliasi !== 'MATCH + BIAYA ADMIN');
  } else if (statusFilter !== 'Semua') {
    filtered = filtered.filter(r => (r.status_rekonsiliasi || '').toUpperCase() === statusFilter.toUpperCase());
  }

  const toolbarHtml = `
    <div class="reconciliation-toolbar">
      <div class="search-wrapper">
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input type="search" id="reconSearchInput" placeholder="Cari vendor, rekening, keterangan..." value="${escapeAttr(state.reconFilters.search)}">
      </div>
      <div class="status-filters" id="reconStatusFilters">
        ${['Semua', 'Match', 'Match + Biaya Admin', 'Nominal Tidak Match', 'Belum Dibayar', 'Mutasi Tanpa Request', 'Perlu Dicek', 'Hanya Anomali'].map(opt => `
          <button class="code-chip ${statusFilter === opt ? 'active' : ''}" data-recon-status="${opt}" style="cursor: pointer; ${statusFilter === opt ? 'background: var(--black); color: white;' : ''}">
            ${opt}
            ${opt === 'Match' ? `(${countMatch})` : ''}
            ${opt === 'Nominal Tidak Match' ? `(${countTidakMatch})` : ''}
            ${opt === 'Belum Dibayar' ? `(${countBelum})` : ''}
            ${opt === 'Mutasi Tanpa Request' ? `(${countTanpaRequest})` : ''}
          </button>
        `).join('')}
      </div>
    </div>
  `;

  let emptyTitle = 'Belum ada data rekonsiliasi';
  let emptyDesc = 'Upload Telegram dan PDF Mutasi Bank untuk memulai.';
  
  if (!telegramLoaded && mutationLoaded) {
    emptyTitle = 'PDF mutasi sudah terbaca.';
    emptyDesc = 'Upload Telegram Export untuk mulai mencocokkan transaksi.';
  } else if (telegramLoaded && !mutationLoaded) {
    emptyTitle = 'Data Telegram sudah terbaca.';
    emptyDesc = 'Upload PDF Mutasi Bank untuk mulai mencocokkan transaksi.';
  } else if (els.pdfReadStatus && els.pdfReadStatus.textContent.includes('Membaca PDF')) {
    emptyTitle = 'Sedang membaca PDF mutasi...';
    emptyDesc = els.pdfReadStatus.textContent;
  }

  els.tableHost.innerHTML = toolbarHtml + getReconTableHtml(filtered, emptyTitle, emptyDesc);
  
  // Attach listeners
  const searchEl = document.getElementById('reconSearchInput');
  if (searchEl) {
    searchEl.addEventListener('input', (e) => {
      state.reconFilters.search = e.target.value;
      renderRekonsiliasiMutasi();
      const el = document.getElementById('reconSearchInput');
      if (el) {
        el.focus();
        el.selectionStart = el.selectionEnd = el.value.length;
      }
    });
  }

  const chips = document.querySelectorAll('#reconStatusFilters button');
  chips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      state.reconFilters.status = e.currentTarget.getAttribute('data-recon-status');
      renderRekonsiliasiMutasi();
    });
  });
}

function renderMutasiBank() {
  if (state.mutations.length === 0) {
    els.tableHost.innerHTML = emptyState('Belum ada data mutasi', 'Upload file PDF mutasi bank untuk melihat data.');
    
    // Fallback: show raw text if parsing failed but we have text
    if (state.rawMutationText) {
      const rawHtml = `
        <div style="margin-top: 24px; padding: 16px; background: #fafafa; border: 1px solid #eaeaea; border-radius: 8px;">
          <h4 style="margin-bottom: 12px; color: #333;">Teks Mentah dari PDF (Gagal Parsing)</h4>
          <textarea readonly style="width: 100%; height: 300px; padding: 12px; font-family: monospace; font-size: 13px; border: 1px solid #ccc; border-radius: 4px;">${state.rawMutationText}</textarea>
        </div>
      `;
      els.tableHost.innerHTML += rawHtml;
    }
    return;
  }

  const filter = state.reconDateFilter;
  let activeMutations = [...state.mutations];
  let filterInfoText = '';
  
  if (filter && filter.mode !== 'all') {
    activeMutations = state.mutations.filter(m => {
      if (!m.tanggalKey) return false;
      if (filter.mode === 'single') return m.tanggalKey === filter.single;
      if (filter.mode === 'range') return m.tanggalKey >= filter.rangeStart && m.tanggalKey <= filter.rangeEnd;
      return true;
    });
    
    if (filter.mode === 'single') {
      filterInfoText = `Menampilkan transaksi tanggal ${formatDateKey(filter.single)}`;
    } else if (filter.mode === 'range') {
      filterInfoText = `Menampilkan transaksi ${formatDateKey(filter.rangeStart)} sampai ${formatDateKey(filter.rangeEnd)}`;
    }
  }

  let html = '';
  if (filterInfoText) {
    html += `<div style="margin-bottom: 16px; font-weight: 500; color: var(--accent); display: flex; align-items: center; gap: 8px;">
      <span class="icon-bubble" style="width: 24px; height: 24px; font-size: 12px; background: var(--surface-2);">ℹ️</span>
      ${filterInfoText}
    </div>`;
  }

  if (activeMutations.length === 0 && filterInfoText) {
    html += emptyState('Tidak ada transaksi', 'Tidak ada mutasi yang sesuai dengan tanggal terpilih.');
    els.tableHost.innerHTML = html;
    return;
  }

  html += `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Tanggal Mutasi</th>
            <th>Keterangan</th>
            <th class="text-right">Debit (Keluar)</th>
            <th class="text-right">Kredit (Masuk)</th>
            <th>Sumber</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
  `;

  activeMutations.forEach(m => {
    html += `
      <tr>
        <td style="white-space: nowrap;">${m.tanggal_mutasi || '-'}</td>
        <td>${m.keterangan || '-'}</td>
        <td class="text-right font-mono" style="color: var(--accent);">${m.nominal_keluar > 0 ? formatRupiah(m.nominal_keluar) : '-'}</td>
        <td class="text-right font-mono" style="color: var(--success);">${m.nominal_masuk > 0 ? formatRupiah(m.nominal_masuk) : '-'}</td>
        <td>${badge(m.sumber_pembacaan || 'PDF', 'blue')}</td>
        <td>${badge(m.status_parse || 'Berhasil', 'success')}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  
  if (state.rawMutationText) {
      html += `
        <details style="margin-top: 24px; padding: 16px; background: #fafafa; border: 1px solid #eaeaea; border-radius: 8px;">
          <summary style="cursor: pointer; font-weight: 500; color: #333;">Lihat Teks Mentah / OCR Hasil Ekstraksi</summary>
          <textarea readonly style="width: 100%; height: 200px; padding: 12px; font-family: monospace; font-size: 13px; border: 1px solid #ccc; border-radius: 4px; margin-top: 12px;">${state.rawMutationText}</textarea>
        </details>
      `;
  }
  
  els.tableHost.innerHTML = html;
}
