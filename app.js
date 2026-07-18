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
  }
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
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  validationFilter: document.getElementById('validationFilter'),
  transactionFilters: document.getElementById('transactionFilters'),
  tableHost: document.getElementById('tableHost'),
  panelKicker: document.getElementById('panelKicker'),
  panelTitle: document.getElementById('panelTitle'),
  panelInfo: document.getElementById('panelInfo'),
  statTransaksi: document.getElementById('statTransaksi'),
  statPengeluaran: document.getElementById('statPengeluaran'),
  statPerluDicek: document.getElementById('statPerluDicek'),
  statRiwayat: document.getElementById('statRiwayat'),
  mutationInput: document.getElementById('mutationInput'),
  mutationFileName: document.getElementById('mutationFileName'),
  mutationFileHint: document.getElementById('mutationFileHint'),
  mutationSummaryGrid: document.getElementById('mutationSummaryGrid'),
  statMutasiKeluar: document.getElementById('statMutasiKeluar'),
  statCocok: document.getElementById('statCocok'),
  statTidakMatch: document.getElementById('statTidakMatch'),
  statSelisihBersih: document.getElementById('statSelisihBersih'),
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
};

els.fileInput.addEventListener('change', handleFileChange);
if (els.mutationInput) {
  els.mutationInput.addEventListener('change', handleMutationChange);
}
if (els.btnOcrCloud) {
  els.btnOcrCloud.addEventListener('click', handleOcrCloudClick);
}
if (els.btnPasteManual) {
  els.btnPasteManual.addEventListener('click', () => {
    els.manualPasteCard.style.display = 'block';
    els.manualPasteInput.focus();
  });
}
if (els.btnParseManual) {
  els.btnParseManual.addEventListener('click', handleManualPasteParse);
}
els.exportBtn.addEventListener('click', exportWorkbook);
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

async function handleFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  state.fileName = file.name;
  els.fileName.textContent = file.name;
  els.fileHint.textContent = 'Membaca dan memproses file Telegram...';
  
  state.photos.clear();
  state.unmatchedPhotos = [];

  try {
    let html = '';
    if (file.name.toLowerCase().endsWith('.zip')) {
      els.fileHint.textContent = 'Mengekstrak ZIP Telegram Export...';
      const zip = await JSZip.loadAsync(file);
      
      const htmlFile = Object.values(zip.files).find(f => f.name.endsWith('messages.html'));
      if (!htmlFile) throw new Error("Tidak menemukan messages.html di dalam ZIP.");
      html = await htmlFile.async('text');

      const photoFiles = Object.values(zip.files).filter(f => !f.dir && f.name.includes('photos/'));
      for (const photoFile of photoFiles) {
        const blob = await photoFile.async('blob');
        const url = URL.createObjectURL(blob);
        // store by relative path like "photos/photo_1.jpg"
        const pathMatch = photoFile.name.match(/(photos\/.*)$/i);
        const relativePath = pathMatch ? pathMatch[1] : photoFile.name;
        state.photos.set(relativePath, url);
      }
    } else {
      html = await file.text();
    }

    els.fileHint.textContent = 'Memparsing HTML chat Telegram...';
    parseTelegramHtml(html);
    els.fileHint.textContent = `${state.transactions.length} transaksi final ditemukan dari ${state.listHistory.length} riwayat List TF. ${state.photos.size ? `(${state.photos.size} foto ter-load)` : '(Tanpa foto)'}`;
    els.exportBtn.disabled = state.transactions.length === 0;
    render();
  } catch (error) {
    console.error(error);
    els.fileHint.textContent = 'Gagal membaca file. Pastikan file adalah messages.html atau ZIP hasil export Telegram.';
  }
}

function parseTelegramHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const messageNodes = Array.from(doc.querySelectorAll('.message'));
  let currentServiceDate = '';
  const rawMessages = [];

  messageNodes.forEach((node, index) => {
    if (node.classList.contains('service')) {
      const serviceText = cleanText(node.textContent || '');
      if (serviceText) currentServiceDate = serviceText;
      return;
    }

    const id = node.id || `message-${index}`;
    const body = node.querySelector('.body');
    const dateEl = node.querySelector('.pull_right.date.details');
    const dateTitle = dateEl?.getAttribute('title') || '';
    const timeText = cleanText(dateEl?.textContent || '');
    const senderEl = body?.querySelector(':scope > .from_name') || node.querySelector('.from_name');
    const sender = cleanText(senderEl?.childNodes?.[0]?.textContent || senderEl?.textContent || '');
    const textEls = Array.from(node.querySelectorAll('.text'));
    const text = textEls.map((el) => extractTelegramText(el)).filter(Boolean).join('\n');
    const photoLinks = Array.from(node.querySelectorAll('a.photo_wrap[href]')).map((a) => a.getAttribute('href')).filter(Boolean);
    const timestamp = parseTelegramTimestamp(dateTitle, currentServiceDate, timeText);
    const messageDate = timestamp.dateLabel || currentServiceDate || '';
    const messageDateKey = timestamp.dateKey || dateLabelToKey(messageDate) || '';
    const type = detectMessageType(text, photoLinks);

    rawMessages.push({
      id,
      index,
      sender,
      dateTitle,
      timeText,
      serviceDate: currentServiceDate,
      dateLabel: messageDate,
      dateKey: messageDateKey,
      timestampMs: timestamp.ms || index,
      text,
      photoLinks,
      type,
    });
  });

  state.rawMessages = rawMessages;
  state.photoIndex = buildPhotoIndex(rawMessages);
  state.listHistory = buildListHistory(rawMessages);
  state.finalLists = pickFinalLists(state.listHistory);
  state.transactions = buildFinalTransactions(state.finalLists, state.photoIndex);
  
  mapPhotosToTransactions(rawMessages);
  hydrateFilters();

  console.log({
    totalMessages: rawMessages.length,
    listMessagesCount: state.listHistory.length,
    finalListsCount: state.finalLists.length,
    firstListTextSample: state.listHistory[0] ? state.listHistory[0].text.substring(0, 100) : null,
    firstParsedTransaction: state.transactions[0]
  });
}

function mapPhotosToTransactions(rawMessages) {
  // Extract all photos from messages
  const allPhotos = [];
  rawMessages.forEach(msg => {
    if (msg.photoLinks && msg.photoLinks.length > 0) {
      msg.photoLinks.forEach(href => {
        allPhotos.push({
          href,
          messageId: msg.id,
          date: msg.dateLabel,
          timestampMs: msg.timestampMs,
          text: msg.text,
          blobUrl: state.photos.get(href) || null
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
  els.statTransaksi.textContent = state.transactions.length.toLocaleString('id-ID');
  els.statPengeluaran.textContent = formatRupiah(state.transactions.reduce((sum, tx) => sum + (tx.nominal || 0), 0));
  els.statPerluDicek.textContent = state.transactions.filter((tx) => tx.statusValidasi !== 'Lengkap').length.toLocaleString('id-ID');
  els.statRiwayat.textContent = state.listHistory.length.toLocaleString('id-ID');
}

function renderPanel() {
  els.transactionFilters.style.display = state.activeTab === 'transaksi' ? 'grid' : 'none';
  
  if (['rekonsiliasi', 'mutasi'].includes(state.activeTab)) {
    els.mutationSummaryGrid.style.display = 'grid';
  } else {
    els.mutationSummaryGrid.style.display = 'none';
  }

  if (state.activeTab === 'transaksi') {
    els.panelKicker.textContent = 'Transaksi final';
    els.panelTitle.textContent = 'Data transaksi final';
    els.panelInfo.textContent = `${state.filteredTransactions.length} dari ${state.transactions.length} transaksi tampil.`;
    renderTransactionTable();
  } else if (state.activeTab === 'mutasi') {
    els.panelKicker.textContent = 'Mutasi Bank';
    els.panelTitle.textContent = 'Data hasil ekstraksi mutasi bank';
    els.panelInfo.textContent = `${state.mutations.length} transaksi mutasi ditemukan.`;
    renderMutasiBank();
  } else if (state.activeTab === 'rekonsiliasi') {
    els.panelKicker.textContent = 'Rekonsiliasi Mutasi';
    els.panelTitle.textContent = 'Hasil pencocokan mutasi dengan Telegram';
    els.panelInfo.textContent = `Menampilkan semua mutasi dan transaksi.`;
    renderRekonsiliasiMutasi();
  } else if (state.activeTab === 'riwayat') {
    els.panelKicker.textContent = 'Riwayat List TF';
    els.panelTitle.textContent = 'Riwayat list Telegram';
    els.panelInfo.textContent = 'List terbaru per tanggal ditandai sebagai Final.';
    renderListHistory();
  } else if (state.activeTab === 'foto') {
    els.panelKicker.textContent = 'Foto Nota';
    els.panelTitle.textContent = 'Semua foto terhubung dengan transaksi';
    els.panelInfo.textContent = 'Menampilkan daftar foto yang berhasil dipetakan ke data transaksi.';
    renderFotoNota();
  } else if (state.activeTab === 'foto-belum') {
    els.panelKicker.textContent = 'Foto Belum Terhubung';
    els.panelTitle.textContent = 'Foto tanpa transaksi';
    els.panelInfo.textContent = 'Menampilkan daftar foto yang belum berhasil dipetakan ke transaksi mana pun.';
    renderFotoBelumTerhubung();
  } else if (state.activeTab === 'mentah') {
    els.panelKicker.textContent = 'Data mentah';
    els.panelTitle.textContent = 'Data chat mentah';
    els.panelInfo.textContent = `${state.rawMessages.length} pesan terbaca dari export HTML.`;
    renderRawMessages();
  } else {
    els.panelKicker.textContent = 'Master Keyword';
    els.panelTitle.textContent = 'Aturan klasifikasi kategori';
    els.panelInfo.textContent = 'Keyword bisa dijadikan acuan untuk pengembangan database master.';
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

function exportWorkbook() {
  if (!state.transactions.length) return;
  const sheets = buildWorkbookSheets();
  const xml = createExcelXml(sheets);
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `CG-Telegram-Ledger-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function buildWorkbookSheets() {
  const txRows = state.transactions.map(txToRow);
  const total = state.transactions.reduce((sum, tx) => sum + tx.nominal, 0);
  const nonComplete = state.transactions.filter((tx) => tx.statusValidasi !== 'Lengkap').length;

  const sheets = [];
  sheets.push({ name: 'Ringkasan', rows: [
    ['Metrik', 'Nilai'],
    ['Total Transaksi', state.transactions.length],
    ['Total Pengeluaran', total],
    ['Perlu Dicek', nonComplete],
    ['Riwayat List', state.listHistory.length],
    ['Tanggal Export', new Date().toLocaleString('id-ID')],
  ] });
  sheets.push({ name: 'Semua Transaksi Final', rows: objectRowsToSheet(txRows) });
  sheets.push({ name: 'List Pemegang Rekening', rows: objectRowsToSheet(state.transactions.map((tx) => ({
    'No Rekening': tx.noRekening,
    'Vendor': tx.vendor,
    'Nominal': tx.nominal,
    'Deskripsi Barang': tx.deskripsi,
    'No Invoice / Kode CG': tx.kodeCG.join('; '),
  }))) });

  ['Outsourcing', 'Membeli Bahan', 'Menambah Persediaan', 'Membeli Perlengkapan', 'Pembelian Aset', 'Biaya Operasional', 'Refund', 'Pettycash / Top Up / Mutasi Internal'].forEach((category) => {
    const name = category === 'Pettycash / Top Up / Mutasi Internal' ? 'Pettycash Top Up' : category;
    sheets.push({ name, rows: objectRowsToSheet(state.transactions.filter((tx) => tx.kategori === category).map(txToRow)) });
  });

  sheets.push({ name: 'Kurang Nota', rows: objectRowsToSheet(state.transactions.filter((tx) => tx.statusValidasi === 'Kurang Nota').map(txToRow)) });
  sheets.push({ name: 'Kurang Invoice', rows: objectRowsToSheet(state.transactions.filter((tx) => tx.statusValidasi === 'Kurang Invoice').map(txToRow)) });
  sheets.push({ name: 'Perlu Dicek', rows: objectRowsToSheet(state.transactions.filter((tx) => tx.statusValidasi !== 'Lengkap').map(txToRow)) });
  
  if (state.mutations.length > 0) {
    sheets.push({ name: 'Mutasi Bank', rows: objectRowsToSheet(state.mutations.map(mutToRow)) });
  }

  if (state.reconciliationResults.length > 0) {
    sheets.push({ name: 'Rekonsiliasi Mutasi', rows: objectRowsToSheet(state.reconciliationResults.map(reconToRow)) });
    sheets.push({ name: 'Nominal Tidak Match', rows: objectRowsToSheet(state.reconciliationResults.filter(r => r.status_rekonsiliasi === 'Nominal Tidak Match').map(reconToRow)) });
    sheets.push({ name: 'Selisih Lebih', rows: objectRowsToSheet(state.reconciliationResults.filter(r => r.selisih_nominal > 0).map(reconToRow)) });
    sheets.push({ name: 'Selisih Kurang', rows: objectRowsToSheet(state.reconciliationResults.filter(r => r.selisih_nominal < 0).map(reconToRow)) });
  }
  if (state.unmatchedTransactions.length > 0) {
    sheets.push({ name: 'Belum Ada di Mutasi', rows: objectRowsToSheet(state.unmatchedTransactions.map(reconToRow)) });
  }
  if (state.unmatchedMutations.length > 0) {
    sheets.push({ name: 'Mutasi Tanpa Request', rows: objectRowsToSheet(state.unmatchedMutations.map(reconToRow)) });
  }

  sheets.push({ name: 'Rekap Vendor', rows: objectRowsToSheet(aggregateVendorRecap()) });
  sheets.push({ name: 'Rekap Rekening', rows: objectRowsToSheet(aggregateBy(state.transactions, 'noRekening')) });
  sheets.push({ name: 'Rekap Kategori', rows: objectRowsToSheet(aggregateBy(state.transactions, 'kategori')) });
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

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    els.mutationFileHint.textContent = 'File mutasi harus dalam format PDF.';
    return;
  }

  state.mutationFileName = file.name;
  els.mutationFileName.textContent = file.name;
  els.mutationFileHint.style.display = 'none';
  els.pdfReadStatus.textContent = 'Membaca PDF...';
  els.mutationParseStatus.textContent = 'Belum Diparse';
  
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

  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const loadingTask = pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    let readingMethod = 'pdf_text';
    let reconstructedLines = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      els.pdfReadStatus.textContent = `Membaca halaman ${i} dari ${pdf.numPages}`;
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
      els.pdfReadStatus.textContent = `PDF Digital Terbaca (${pdf.numPages} halaman)`;
      els.mutationParseStatus.textContent = 'Memproses transaksi BCA...';
      await new Promise(resolve => setTimeout(resolve, 0)); // yield
      
      // Parse BCA format
      parseBCAMutationLines(reconstructedLines);
      
      if (state.mutations.length > 0) {
        els.mutationParseStatus.textContent = `${state.mutations.length} transaksi mutasi berhasil diparse`;
        reconcileTransactions();
        render();
      } else {
        els.mutationParseStatus.textContent = 'Teks PDF terbaca, tetapi format transaksi belum berhasil diparse';
        if (els.mutationFallbackActions) els.mutationFallbackActions.style.display = 'flex';
      }
    } else {
      els.pdfReadStatus.textContent = 'PDF Scan / Tidak Ada Text Layer';
      els.mutationParseStatus.textContent = 'Gagal memparse karena teks kosong';
      if (els.mutationFallbackActions) els.mutationFallbackActions.style.display = 'flex';
    }
  } catch (error) {
    console.error("PDF extraction failed:", error);
    els.pdfReadStatus.textContent = 'Gagal Membuka PDF';
    els.mutationParseStatus.textContent = 'Error pada file PDF.';
    if (els.mutationFallbackActions) els.mutationFallbackActions.style.display = 'flex';
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
}

function processBCABlock(blockLines, parsedArray, currentId) {
  const rawText = blockLines.join('\n');
  const dateMatch = blockLines[0].match(/^(\d{2}\/\d{2}(?:\/\d{4})?)/);
  const dateStr = dateMatch ? dateMatch[1] : '';
  
  // Look for the specific Amount DB/CR Balance pattern
  // Group 1: Amount, Group 2: DB/CR, Group 3: Balance
  const amountPattern = /((?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2})\s+(DB|CR)\s+((?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2})/;
  
  let amountStr = '';
  let typeStr = '';
  let balanceStr = '';
  let descriptionLines = [];
  
  for (const line of blockLines) {
    const match = line.match(amountPattern);
    if (match) {
      amountStr = match[1];
      typeStr = match[2];
      balanceStr = match[3];
      
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
      tanggal: dateStr,
      keterangan: cleanText(descriptionLines.join(' ')),
      nominal: amountVal,
      nominal_keluar: isDebit ? amountVal : 0,
      nominal_masuk: isKredit ? amountVal : 0,
      saldo: balanceVal,
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
  els.mutationFileHint.textContent = 'Mencoba OCR Cloud...';
  const file = els.mutationInput.files?.[0];
  if (!file) return;
  
  try {
    await parseMutationWithCloudOcr(file);
  } catch (error) {
    els.mutationFileHint.textContent = 'OCR cloud belum aktif. Gunakan Paste Mutasi Manual atau upload PDF digital.';
  }
}

async function handleManualPasteParse() {
  const text = els.manualPasteInput.value;
  if (!text.trim()) return;
  
  els.manualPasteCard.style.display = 'none';
  els.mutationFileHint.textContent = 'Memproses teks mutasi manual...';
  
  await parseMutationText(text, 'manual_paste');
  if (state.mutations.length > 0) {
    els.mutationFileHint.textContent = `${state.mutations.length} data mutasi dari paste manual ditemukan.`;
    reconcileTransactions();
    render();
  } else {
    els.mutationFileHint.textContent = 'Gagal memparse mutasi dari teks manual.';
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
          id: `mut-${readingMethod.toLowerCase().replace(/\s/g, '-')}-${currentId++}`,
          tanggal: dateMatch ? dateMatch[1] : '',
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
}

function reconcileTransactions() {
  state.reconciliationResults = [];
  state.unmatchedMutations = [];
  state.unmatchedTransactions = [];

  const mutations = [...state.mutations];
  const txs = [...state.transactions];

  let totalCocok = 0;
  let totalTidakMatch = 0;
  let totalSelisihBersih = 0;

  const adminFees = [2500, 3000, 5000, 6500, 7500, 10000, 12500, 15000];

  txs.forEach(tx => {
    // 1. Exact match on Nominal Keluar
    const sameNominal = mutations.filter(m => !m.matched && m.nominal_keluar > 0 && m.nominal_keluar === tx.nominal);
    // 2. Match with valid Admin Fee
    const sameWithAdminFee = mutations.filter(m => !m.matched && m.nominal_keluar > 0 && adminFees.includes(m.nominal_keluar - tx.nominal));
    // 3. Match by Description/Vendor
    const sameDesc = mutations.filter(m => !m.matched && m.nominal_keluar > 0 && (m.keterangan.toLowerCase().includes(tx.vendor.toLowerCase()) || m.keterangan.toLowerCase().includes(tx.atasNama.toLowerCase())));

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
        tanggal_mutasi: bestMatch.tanggal,
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

  state.unmatchedMutations = mutations.filter(m => !m.matched && m.nominal_keluar > 0).map(m => ({
    tanggal_request: '-',
    tanggal_mutasi: m.tanggal,
    vendor: '-',
    noRekening: '-',
    atasNama: '-',
    nominal_telegram: 0,
    nominal_mutasi: m.nominal_keluar,
    biaya_admin: 0,
    selisih_nominal: m.nominal_keluar,
    saldo_setelah_transaksi: m.saldo,
    deskripsi: '-',
    keterangan_mutasi: m.raw_text,
    status_rekonsiliasi: 'MUTASI TANPA REQUEST',
    catatan_rekonsiliasi: 'Mutasi keluar ini tidak ada request di Telegram',
    kodeCG: [],
    kodeOT: []
  }));

  if (els.statMutasiKeluar) els.statMutasiKeluar.textContent = state.mutations.length.toLocaleString('id-ID');
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
    'Tanggal Mutasi': m.tanggal || '-',
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
    return emptyState(emptyTitle, emptyDesc);
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

function renderRekonsiliasiMutasi() {
  const allRecons = [...state.reconciliationResults, ...state.unmatchedTransactions, ...state.unmatchedMutations];
  
  let sumRequest = 0;
  let sumMutasi = 0;
  let sumAdmin = 0;
  
  let countMatch = 0;
  let countTidakMatch = 0;
  let countBelum = 0;
  let countTanpaRequest = 0;

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
    }
  });
  
  const sumSelisih = sumMutasi - sumRequest - sumAdmin;
  const isBalanced = sumSelisih === 0 && countTidakMatch === 0 && countBelum === 0 && countTanpaRequest === 0;

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

  const summaryHtml = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px;">
      <div class="stat-card">
        <div class="stat-label">Total Request</div>
        <div class="stat-value">${formatRupiah(sumRequest)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Mutasi Keluar</div>
        <div class="stat-value">${formatRupiah(sumMutasi)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Biaya Admin</div>
        <div class="stat-value">${formatRupiah(sumAdmin)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Selisih Bersih</div>
        <div class="stat-value">${selisihHtml(sumSelisih, true)}</div>
      </div>
      <div class="stat-card" style="border: 2px solid ${isBalanced ? '#10b981' : '#ef4444'};">
        <div class="stat-label">Status Akhir</div>
        <div class="stat-value" style="color: ${isBalanced ? '#10b981' : '#ef4444'}">${isBalanced ? 'BALANCED' : 'NOT BALANCED'}</div>
      </div>
    </div>
    
    <div style="display: flex; gap: 16px; margin-bottom: 16px; align-items: center; flex-wrap: wrap;">
      <div class="input-wrap" style="flex: 1; min-width: 250px; margin-bottom: 0;">
        <svg class="input-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="position: absolute; left: 12px; top: 11px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="text" id="reconSearchInput" placeholder="Cari vendor, rekening, keterangan..." value="${escapeAttr(state.reconFilters.search)}" style="width: 100%; padding: 10px 10px 10px 40px; border-radius: 6px; border: 1px solid #d1d5db;">
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;" id="reconStatusFilters">
        ${['Semua', 'Match', 'Match + Biaya Admin', 'Nominal Tidak Match', 'Belum Dibayar', 'Mutasi Tanpa Request', 'Perlu Dicek', 'Hanya Anomali'].map(opt => `
          <button class="chip-filter ${statusFilter === opt ? 'active' : ''}" data-recon-status="${opt}" style="padding: 6px 12px; border-radius: 20px; border: 1px solid #e5e7eb; background: ${statusFilter === opt ? '#2563eb' : '#fff'}; color: ${statusFilter === opt ? '#fff' : '#4b5563'}; cursor: pointer; font-size: 13px;">
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

  els.tableHost.innerHTML = summaryHtml + getReconTableHtml(filtered, 'Belum ada data rekonsiliasi', 'Silakan tunggu proses atau upload file yang diperlukan.');
  
  // Attach listeners
  const searchEl = document.getElementById('reconSearchInput');
  if (searchEl) {
    searchEl.addEventListener('input', (e) => {
      state.reconFilters.search = e.target.value;
      renderRekonsiliasiMutasi();
      document.getElementById('reconSearchInput').focus();
    });
  }

  const chips = document.querySelectorAll('#reconStatusFilters .chip-filter');
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

  let html = `
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

  state.mutations.forEach(m => {
    html += `
      <tr>
        <td style="white-space: nowrap;">${m.tanggal || '-'}</td>
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
