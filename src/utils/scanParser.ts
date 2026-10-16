import { Article, InventoryEntry } from '../types/inventory';

export interface ParsedScannedInfo {
  code_article: string;
  designation: string;
  reference: string;
  emplacement?: string;
  machine?: string;
  famille?: string;
  quantite?: number;
  unite?: string;
}

export interface ScanMatchResult {
  matchedArticle?: Article;
  matchType: 'code' | 'reference' | 'designation' | 'token' | 'normalized' | 'qr_code' | 'none';
  matchScore: number; // 0 to 100
  matchDescription: string;
  parsedData: ParsedScannedInfo;
  rawText: string;
  candidateArticles: Article[];
  existingEntry?: InventoryEntry;
}

/**
 * Normalizes an alphanumeric string for robust fuzzy comparison
 * (strips spaces, dashes, dots, underscores, case)
 */
export function normalizeCode(str?: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[\s\-_.:;/\\#]/g, '').trim();
}

/**
 * Parses raw text from a QR code, barcode, or OCR capture into structured article data.
 * Supports:
 * - JSON format: {"code_article": "...", "designation": "...", "reference": "..."}
 * - Key-Value format: "Code: X | Desig: Y | Ref: Z" or multi-line
 * - Delimited format: "CODE;DESIGNATION;REFERENCE" (or commas, pipes, tabs)
 * - Single value: "CODE_OU_REF"
 */
export function parseScannedText(rawText: string, knownArticles: Article[] = []): ParsedScannedInfo {
  const clean = rawText.trim();
  if (!clean) {
    return { code_article: '', designation: '', reference: '' };
  }

  // 1. Try parsing JSON format
  if ((clean.startsWith('{') && clean.endsWith('}')) || (clean.startsWith('[') && clean.endsWith(']'))) {
    try {
      const obj = JSON.parse(clean);
      const target = Array.isArray(obj) ? obj[0] : obj;
      if (typeof target === 'object' && target !== null) {
        return {
          code_article: String(
            target.code_article ||
            target.code ||
            target.art ||
            target.article ||
            target.id ||
            ''
          ).trim(),
          designation: String(
            target.designation ||
            target.desig ||
            target.nom ||
            target.libelle ||
            target.description ||
            target.label ||
            ''
          ).trim(),
          reference: String(
            target.reference ||
            target.ref ||
            target.pn ||
            target.part_number ||
            target.modele ||
            target.model ||
            ''
          ).trim(),
          emplacement: target.emplacement || target.loc || target.location,
          machine: target.machine || target.equipement,
          famille: target.famille || target.categorie,
          unite: target.unite || target.unit,
          quantite: target.quantite !== undefined ? Number(target.quantite) : undefined
        };
      }
    } catch {
      // not valid JSON, proceed to other formats
    }
  }

  // 2. Check for explicit Key-Value tags (e.g., Code: ..., Designation: ..., Ref: ...)
  // Supports multi-line or single-line separated by ;, |, etc.
  const codeRegex = /(?:^|[\r\n;,|])\s*(?:code\s*(?:art(?:icle)?)?|art(?:icle)?|c\.art)\s*[:=]\s*([^\r\n;,|]+)/i;
  const desigRegex = /(?:^|[\r\n;,|])\s*(?:d[eé]signation|libell[eé]|nom|desc(?:ription)?|label)\s*[:=]\s*([^\r\n;,|]+)/i;
  const refRegex = /(?:^|[\r\n;,|])\s*(?:r[eé]f(?:[eé]rence)?|p\/?n|part\s*n[o°]?|modele?|mod[eè]le)\s*[:=]\s*([^\r\n;,|]+)/i;
  const emplRegex = /(?:^|[\r\n;,|])\s*(?:empl(?:acement)?|loc(?:ation)?|rayon|bac)\s*[:=]\s*([^\r\n;,|]+)/i;
  const machineRegex = /(?:^|[\r\n;,|])\s*(?:machine|equip(?:ement)?|ligne)\s*[:=]\s*([^\r\n;,|]+)/i;
  const familleRegex = /(?:^|[\r\n;,|])\s*(?:famille|cat[eé]gorie)\s*[:=]\s*([^\r\n;,|]+)/i;
  const qtyRegex = /(?:^|[\r\n;,|])\s*(?:qt[eé]|quantit[eé]|count)\s*[:=]\s*([0-9.,]+)/i;

  const codeMatch = clean.match(codeRegex);
  const desigMatch = clean.match(desigRegex);
  const refMatch = clean.match(refRegex);
  const emplMatch = clean.match(emplRegex);
  const machineMatch = clean.match(machineRegex);
  const familleMatch = clean.match(familleRegex);
  const qtyMatch = clean.match(qtyRegex);

  if (codeMatch || desigMatch || refMatch) {
    return {
      code_article: codeMatch ? codeMatch[1].trim() : '',
      designation: desigMatch ? desigMatch[1].trim() : '',
      reference: refMatch ? refMatch[1].trim() : '',
      emplacement: emplMatch ? emplMatch[1].trim() : undefined,
      machine: machineMatch ? machineMatch[1].trim() : undefined,
      famille: familleMatch ? familleMatch[1].trim() : undefined,
      quantite: qtyMatch ? parseFloat(qtyMatch[1].replace(',', '.')) : undefined
    };
  }

  // 3. Delimited string (separated by semicolon, pipe, tab, or double space)
  // Example: "ART-001;Roulement 6204;SKF-6204" or "ART-001 | Roulement | SKF"
  const delimiterMatch = clean.includes(';')
    ? ';'
    : clean.includes('|')
    ? '|'
    : clean.includes('\t')
    ? '\t'
    : clean.includes('\n')
    ? '\n'
    : clean.includes(',') && clean.split(',').length >= 3
    ? ','
    : null;

  if (delimiterMatch) {
    const rawParts = clean
      .split(delimiterMatch)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (rawParts.length >= 2) {
      // Try to intelligently deduce which field is which by checking against known articles
      let identifiedCode = '';
      let identifiedDesig = '';
      let identifiedRef = '';
      const remaining: string[] = [];

      for (const part of rawParts) {
        const norm = normalizeCode(part);
        const matchCode = knownArticles.find((a) => normalizeCode(a.code_article) === norm);
        const matchRef = knownArticles.find((a) => normalizeCode(a.reference) === norm);
        const matchDesig = knownArticles.find((a) => a.designation.toLowerCase() === part.toLowerCase());

        if (matchCode && !identifiedCode) {
          identifiedCode = part;
        } else if (matchRef && !identifiedRef) {
          identifiedRef = part;
        } else if (matchDesig && !identifiedDesig) {
          identifiedDesig = part;
        } else {
          remaining.push(part);
        }
      }

      // If not all identified from DB, use positional fallback
      // Typical order in inventory systems: [Code, Designation, Reference]
      // Or [Code, Reference, Designation]
      if (!identifiedCode && remaining.length > 0) {
        identifiedCode = remaining.shift() || '';
      }
      if (!identifiedDesig && remaining.length > 0) {
        identifiedDesig = remaining.shift() || '';
      }
      if (!identifiedRef && remaining.length > 0) {
        identifiedRef = remaining.shift() || '';
      }

      return {
        code_article: identifiedCode,
        designation: identifiedDesig,
        reference: identifiedRef
      };
    }
  }

  // 4. Single value string (just a code or reference)
  return {
    code_article: clean,
    designation: '',
    reference: clean
  };
}

/**
 * Compares the scanned information with the article database (base d'articles).
 * Returns the best matching article, match description, and parsed fields.
 */
export function matchScannedDataWithArticles(
  rawText: string,
  articles: Article[],
  entries: InventoryEntry[] = []
): ScanMatchResult {
  const parsed = parseScannedText(rawText, articles);
  const rawClean = rawText.trim();
  const rawNorm = normalizeCode(rawClean);

  const parsedCodeNorm = normalizeCode(parsed.code_article);
  const parsedRefNorm = normalizeCode(parsed.reference);
  const parsedDesigLower = parsed.designation.trim().toLowerCase();

  // Helper to find existing inventory entry for a given article
  const getExistingEntry = (art?: Article) => {
    if (!art) return undefined;
    return entries.find(
      (e) =>
        e.code_article.toLowerCase() === art.code_article.toLowerCase() ||
        (e.articleId && e.articleId === art.id)
    );
  };

  // Helper to collect candidates
  const candidatesMap = new Map<string, Article>();
  const addCandidate = (art: Article) => {
    if (!candidatesMap.has(art.id)) {
      candidatesMap.set(art.id, art);
    }
  };

  // Check 1: Exact match on Code Article
  if (parsedCodeNorm) {
    const matchByCode = articles.find(
      (a) => normalizeCode(a.code_article) === parsedCodeNorm
    );
    if (matchByCode) {
      return {
        matchedArticle: matchByCode,
        matchType: 'code',
        matchScore: 100,
        matchDescription: `Correspondance exacte par Code Article : ${matchByCode.code_article}`,
        parsedData: {
          code_article: matchByCode.code_article,
          designation: matchByCode.designation,
          reference: matchByCode.reference,
          emplacement: matchByCode.emplacement,
          machine: matchByCode.machine,
          famille: matchByCode.famille,
          unite: matchByCode.unite
        },
        rawText,
        candidateArticles: [matchByCode],
        existingEntry: getExistingEntry(matchByCode)
      };
    }
  }

  // Check 2: Exact match on Reference
  if (parsedRefNorm) {
    const matchByRef = articles.find(
      (a) => normalizeCode(a.reference) === parsedRefNorm
    );
    if (matchByRef) {
      return {
        matchedArticle: matchByRef,
        matchType: 'reference',
        matchScore: 95,
        matchDescription: `Correspondance exacte par Référence : ${matchByRef.reference}`,
        parsedData: {
          code_article: matchByRef.code_article,
          designation: matchByRef.designation,
          reference: matchByRef.reference,
          emplacement: matchByRef.emplacement,
          machine: matchByRef.machine,
          famille: matchByRef.famille,
          unite: matchByRef.unite
        },
        rawText,
        candidateArticles: [matchByRef],
        existingEntry: getExistingEntry(matchByRef)
      };
    }
  }

  // Check 3: Exact match on QR Code field
  if (rawClean) {
    const matchByQr = articles.find(
      (a) => a.qr_code && normalizeCode(a.qr_code) === rawNorm
    );
    if (matchByQr) {
      return {
        matchedArticle: matchByQr,
        matchType: 'qr_code',
        matchScore: 95,
        matchDescription: `Correspondance par QR Code associé : ${matchByQr.code_article}`,
        parsedData: {
          code_article: matchByQr.code_article,
          designation: matchByQr.designation,
          reference: matchByQr.reference,
          emplacement: matchByQr.emplacement,
          machine: matchByQr.machine,
          famille: matchByQr.famille,
          unite: matchByQr.unite
        },
        rawText,
        candidateArticles: [matchByQr],
        existingEntry: getExistingEntry(matchByQr)
      };
    }
  }

  // Check 4: Exact match on Designation
  if (parsedDesigLower && parsedDesigLower.length >= 3) {
    const matchByDesig = articles.find(
      (a) => a.designation.trim().toLowerCase() === parsedDesigLower
    );
    if (matchByDesig) {
      return {
        matchedArticle: matchByDesig,
        matchType: 'designation',
        matchScore: 90,
        matchDescription: `Correspondance exacte par Désignation : "${matchByDesig.designation}"`,
        parsedData: {
          code_article: matchByDesig.code_article,
          designation: matchByDesig.designation,
          reference: matchByDesig.reference,
          emplacement: matchByDesig.emplacement,
          machine: matchByDesig.machine,
          famille: matchByDesig.famille,
          unite: matchByDesig.unite
        },
        rawText,
        candidateArticles: [matchByDesig],
        existingEntry: getExistingEntry(matchByDesig)
      };
    }
  }

  // Check 5: Multi-word / token search in raw text (especially for OCR scans or multiline labels)
  // Split raw text into words, codes, and serials
  const tokens = rawText
    .split(/[\s,;:|/\n\r]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);

  for (const token of tokens) {
    const tokenNorm = normalizeCode(token);
    if (!tokenNorm || tokenNorm.length < 3) continue;

    // Check if token matches a code_article
    const artByCode = articles.find((a) => normalizeCode(a.code_article) === tokenNorm);
    if (artByCode) {
      addCandidate(artByCode);
    }

    // Check if token matches a reference
    const artByRef = articles.find((a) => normalizeCode(a.reference) === tokenNorm);
    if (artByRef) {
      addCandidate(artByRef);
    }
  }

  // Check 6: Substring match on designation
  if (parsedDesigLower && parsedDesigLower.length >= 4) {
    articles.forEach((a) => {
      const artDesig = a.designation.toLowerCase();
      if (artDesig.includes(parsedDesigLower) || parsedDesigLower.includes(artDesig)) {
        addCandidate(a);
      }
    });
  }

  const candidateList = Array.from(candidatesMap.values());

  if (candidateList.length > 0) {
    const bestMatch = candidateList[0];
    return {
      matchedArticle: bestMatch,
      matchType: 'token',
      matchScore: 80,
      matchDescription: `Article identifié dans la base : ${bestMatch.code_article} (${bestMatch.designation})`,
      parsedData: {
        code_article: bestMatch.code_article,
        designation: bestMatch.designation,
        reference: bestMatch.reference,
        emplacement: bestMatch.emplacement,
        machine: bestMatch.machine,
        famille: bestMatch.famille,
        unite: bestMatch.unite
      },
      rawText,
      candidateArticles: candidateList,
      existingEntry: getExistingEntry(bestMatch)
    };
  }

  // Check 7: Partial match on raw text containing any known code_article
  const partialCodeMatch = articles.find((a) => {
    const cNorm = normalizeCode(a.code_article);
    return cNorm.length >= 3 && rawNorm.includes(cNorm);
  });

  if (partialCodeMatch) {
    return {
      matchedArticle: partialCodeMatch,
      matchType: 'normalized',
      matchScore: 75,
      matchDescription: `Code article ${partialCodeMatch.code_article} détecté dans le scan`,
      parsedData: {
        code_article: partialCodeMatch.code_article,
        designation: partialCodeMatch.designation,
        reference: partialCodeMatch.reference,
        emplacement: partialCodeMatch.emplacement,
        machine: partialCodeMatch.machine,
        famille: partialCodeMatch.famille,
        unite: partialCodeMatch.unite
      },
      rawText,
      candidateArticles: [partialCodeMatch],
      existingEntry: getExistingEntry(partialCodeMatch)
    };
  }

  // No match in database -> return structured parsed data so user can create/inventory immediately
  return {
    matchedArticle: undefined,
    matchType: 'none',
    matchScore: 0,
    matchDescription: "Non trouvé dans la base d'articles",
    parsedData: {
      code_article: parsed.code_article || rawClean,
      designation: parsed.designation || `Article ${parsed.code_article || rawClean}`,
      reference: parsed.reference || parsed.code_article || rawClean,
      emplacement: parsed.emplacement,
      machine: parsed.machine,
      famille: parsed.famille,
      quantite: parsed.quantite || 1,
      unite: parsed.unite || 'Pièce'
    },
    rawText,
    candidateArticles: [],
    existingEntry: undefined
  };
}
