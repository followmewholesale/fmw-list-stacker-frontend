/****************************************************
 * Follow Me Wholesale – List Stacker Engine
 * v4.6 (Stable, Blocked Matching, DirectSkip Ready)
 ****************************************************/

/* ============================
   LOCKED CONFIG
============================ */
const OWNER_THRESHOLD = 0.85;
const ADDRESS_THRESHOLD = 0.90;
const MIN_LIST_HITS = 2;

const ENTITY_WORDS = new Set([
  "llc","inc","corp","company","co","trust","estate","ltd","holdings","group"
]);

/* ============================
   NORMALIZATION
============================ */
function normalizeText(v) {
  if (!v) return "";
  return String(v)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOwner(name) {
  const clean = normalizeText(name);
  if (!clean) return null;

  const parts = clean
    .split(" ")
    .filter(p => !ENTITY_WORDS.has(p) && p.length > 1)
    .sort();

  return parts.join(" ");
}

/* ============================
   OWNER DISPLAY PARSER
============================ */
function parseOwnerDisplay(raw) {
  if (!raw) return { first: "", last: "", type: "unknown" };

  const text = String(raw).trim();
  const lower = text.toLowerCase();

  for (const w of ENTITY_WORDS) {
    if (lower.includes(w)) {
      return { first: "", last: text.toUpperCase(), type: "entity" };
    }
  }

  if (text.includes(",")) {
    const [last, first] = text.split(",").map(s => s.trim());
    return {
      first: (first || "").toUpperCase(),
      last: (last || "").toUpperCase(),
      type: "individual"
    };
  }

  const parts = text.split(/\s+/);
  if (parts.length === 1) {
    return { first: "", last: parts[0].toUpperCase(), type: "individual" };
  }

  return {
    first: parts[0].toUpperCase(),
    last: parts.slice(1).join(" ").toUpperCase(),
    type: "individual"
  };
}

/* ============================
   ADDRESS NORMALIZATION
============================ */
const STREET_MAP = {
  north:"n", south:"s", east:"e", west:"w",
  northeast:"ne", northwest:"nw",
  southeast:"se", southwest:"sw",
  street:"st", avenue:"ave", drive:"dr",
  road:"rd", boulevard:"blvd", lane:"ln",
  court:"ct", place:"pl"
};

function normalizeAddress(addr) {
  const clean = normalizeText(addr);
  if (!clean) return null;

  let out = clean;
  for (const k in STREET_MAP) {
    out = out.replace(new RegExp(`\\b${k}\\b`, "g"), STREET_MAP[k]);
  }
  return out;
}

function normalizeParcel(p) {
  if (!p) return null;
  return String(p).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/* ============================
   CITY / STATE / ZIP EXTRACTION
============================ */
const STATE_MAP = {
  al:"AL", ak:"AK", az:"AZ", ar:"AR", ca:"CA", co:"CO", ct:"CT", de:"DE",
  fl:"FL", ga:"GA", hi:"HI", id:"ID", il:"IL", in:"IN", ia:"IA", ks:"KS",
  ky:"KY", la:"LA", me:"ME", md:"MD", ma:"MA", mi:"MI", mn:"MN", ms:"MS",
  mo:"MO", mt:"MT", ne:"NE", nv:"NV", nh:"NH", nj:"NJ", nm:"NM", ny:"NY",
  nc:"NC", nd:"ND", oh:"OH", ok:"OK", or:"OR", pa:"PA", ri:"RI", sc:"SC",
  sd:"SD", tn:"TN", tx:"TX", ut:"UT", vt:"VT", va:"VA", wa:"WA", wv:"WV",
  wi:"WI", wy:"WY"
};

function extractCityStateZip(raw) {
  if (!raw) return { city:"", state:"", zip:"" };
  const text = String(raw);

  const zip = (text.match(/\b\d{5}(?:-\d{4})?\b/) || [""])[0];

  let state = "";
  for (const [abbr, code] of Object.entries(STATE_MAP)) {
    if (new RegExp(`\\b${abbr}\\b|\\b${code}\\b`, "i").test(text)) {
      state = code;
      break;
    }
  }

  let city = "";
  if (state && text.includes(",")) {
    const parts = text.split(",");
    city = parts[parts.length - 2].trim().toUpperCase();
  }

  return { city, state, zip };
}

/* ============================
   FUZZY TOKEN MATCH
============================ */
function tokenSetSimilarity(a, b) {
  if (!a || !b) return 0;
  const sa = new Set(a.split(" "));
  const sb = new Set(b.split(" "));
  const common = [...sa].filter(x => sb.has(x));
  return common.length / Math.max(sa.size, sb.size);
}

/* ============================
   UNION FIND
============================ */
class UnionFind {
  constructor(n) {
    this.p = Array.from({ length: n }, (_, i) => i);
  }
  find(x) {
    if (this.p[x] !== x) this.p[x] = this.find(this.p[x]);
    return this.p[x];
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.p[rb] = ra;
  }
}

/* ============================
   MAIN STACK FUNCTION
============================ */
function stackLists(listInputs) {

  const records = [];

  listInputs.forEach(list => {
    list.rows.forEach(r => {
      const mailing = r.mailing || r.property || "";
      const mailExtract = extractCityStateZip(mailing);
      const propExtract = extractCityStateZip(r.property);

      records.push({
        listName: list.name,

        ownerRaw: r.owner || "",
        ownerNorm: normalizeOwner(r.owner),

        propertyRaw: r.property || "",
        propertyNorm: normalizeAddress(r.property),

        parcelNorm: normalizeParcel(r.parcel),

        mailingRaw: mailing,
        mailingCity: r.mailingCity || mailExtract.city,
        mailingState: r.mailingState || mailExtract.state,
        mailingZip: r.mailingZip || mailExtract.zip,

        propertyCity: r.propertyCity || propExtract.city,
        propertyState: r.propertyState || propExtract.state,
        propertyZip: r.propertyZip || propExtract.zip
      });
    });
  });

  const uf = new UnionFind(records.length);

  const ownerBlocks = {};
  const addressBlocks = {};
  const parcelBlocks = {};

  records.forEach((r, i) => {
    if (r.ownerNorm) (ownerBlocks[r.ownerNorm] ||= []).push(i);
    if (r.propertyNorm) (addressBlocks[r.propertyNorm] ||= []).push(i);
    if (r.parcelNorm) (parcelBlocks[r.parcelNorm] ||= []).push(i);
  });

  function matchBlock(block) {
    for (let i = 0; i < block.length; i++) {
      for (let j = i + 1; j < block.length; j++) {
        const A = records[block[i]];
        const B = records[block[j]];
        let match = false;

        if (A.parcelNorm && A.parcelNorm === B.parcelNorm) match = true;
        if (!match && tokenSetSimilarity(A.propertyNorm, B.propertyNorm) >= ADDRESS_THRESHOLD) match = true;
        if (!match && tokenSetSimilarity(A.ownerNorm, B.ownerNorm) >= OWNER_THRESHOLD) match = true;

        if (match) uf.union(block[i], block[j]);
      }
    }
  }

  Object.values(parcelBlocks).forEach(matchBlock);
  Object.values(addressBlocks).forEach(matchBlock);
  Object.values(ownerBlocks).forEach(matchBlock);

  const clusters = {};
  records.forEach((_, i) => {
    const root = uf.find(i);
    (clusters[root] ||= []).push(i);
  });

  const output = [];

  Object.values(clusters).forEach(group => {
    const listSources = [...new Set(group.map(i => records[i].listName))];
    if (listSources.length < MIN_LIST_HITS) return;

    const byProperty = {};
    group.forEach(i => {
      const r = records[i];
      if (!r.propertyNorm) return;
      (byProperty[r.propertyNorm] ||= []).push(r);
    });

    Object.values(byProperty).forEach(rows => {
      const ownerSource = rows.find(r => r.ownerRaw) || rows[0];
      const owner = parseOwnerDisplay(ownerSource.ownerRaw);

      const prop = rows[0];

      output.push({
        "Owner First Name": owner.first,
        "Owner Last Name": owner.last,
        "Owner Type": owner.type,

        "Mailing Address": ownerSource.mailingRaw,
        "Mailing City": ownerSource.mailingCity,
        "Mailing State": ownerSource.mailingState,
        "Mailing Zip": ownerSource.mailingZip,

        "Property Address": prop.propertyRaw,
        "Property City": prop.propertyCity,
        "Property State": prop.propertyState,
        "Property Zip": prop.propertyZip,

        "Hit Count": listSources.length,
        "List Sources": listSources.join(", ")
      });
    });
  });

  return output;
}

/* ============================
   GLOBAL EXPORT
============================ */
window.stackLists = stackLists;
