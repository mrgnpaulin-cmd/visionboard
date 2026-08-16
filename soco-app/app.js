/* =========================================================
   SO/CO — logique applicative
   Données locales (localStorage) + sauvegarde JSON manuelle.
   Aucun serveur, aucune donnée ne quitte l'appareil.
   ========================================================= */
'use strict';

/* ---------------------------------------------------------
   1. Constantes métier
   --------------------------------------------------------- */

const CLE = 'soco.data.v1';
const SCHEMA = 1;

/* Étapes de production, un jeu par pôle. Ajouter une étape ici
   la propage dans l'app ET dans le poster A3. */
const ETAPES = {
  av: [
    { k: 'brief',   l: 'Brief' },
    { k: 'tournage',l: 'Tournage' },
    { k: 'derush',  l: 'Derush' },
    { k: 'montage', l: 'Montage' },
    { k: 'valide',  l: 'Validé' },
    { k: 'livre',   l: 'Livré' },
    { k: 'facture', l: 'Facturé' }
  ],
  mu: [
    { k: 'prod',    l: 'Prod' },
    { k: 'enreg',   l: 'Enreg.' },
    { k: 'mix',     l: 'Mix' },
    { k: 'master',  l: 'Master' },
    { k: 'artwork', l: 'Artwork' },
    { k: 'distrib', l: 'Distrib.' },
    { k: 'promo',   l: 'Promo' }
  ]
};

const POLES = { av: 'Pôle Audiovisuel', mu: 'Pôle Musique' };
const POLES_SUB = {
  av: 'Podcast · Captation · Régie · Vidéo',
  mu: 'Label · Studio · Mix · Master · Distribution'
};

const PIPE = [
  { k: 'contacte', l: 'Contacté' },
  { k: 'rdv',      l: 'RDV pris' },
  { k: 'devis',    l: 'Devis envoyé' },
  { k: 'signe',    l: 'Signé' }
];

const MOIS_FR = ['janvier','février','mars','avril','mai','juin',
                 'juillet','août','septembre','octobre','novembre','décembre'];
const JOURS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

/* Rappel de sauvegarde au-delà de ce délai (en jours). */
const RAPPEL_JOURS = 3;

/* ---------------------------------------------------------
   2. Utilitaires
   --------------------------------------------------------- */

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function uid() {
  return 'x' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function pad2(n) { return String(n).padStart(2, '0'); }

function dateKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function moisKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }

function moisLabel(mk) {
  const [y, m] = mk.split('-');
  return MOIS_FR[parseInt(m, 10) - 1] + ' ' + y;
}

function joursDansMois(mk) {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/* Formate un nombre en euros. Renvoie '' si vide/invalide. */
function fmtE(n) {
  if (n === '' || n == null || isNaN(n)) return '';
  return Math.round(Number(n)).toLocaleString('fr-FR') + ' €';
}

function nbr(v) {
  const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2200);
}

/* ---------------------------------------------------------
   3. Modèle de données
   Conçu pour accueillir contacts / catalogue en phase 2
   sans migration destructive.
   --------------------------------------------------------- */

function dataVierge() {
  return {
    schema: SCHEMA,
    majLe: new Date().toISOString(),
    sauvegardeLe: null,
    reglages: {
      objectifCaMensuel: 0,
      repartition: { av: 60, mu: 40 } // indicatif, en %
    },
    nord: {
      h3: ['', '', ''],
      h12: ['', '', ''],
      cibles: { ca12m: '', clientsRecurrents: '', sortiesLabel: '' },
      mantra: '',
      valableJusquau: ''
    },
    habitudes: [
      { id: uid(), nom: 'Prospection : 5 contacts', actif: true },
      { id: uid(), nom: 'Deep work 2 h', actif: true },
      { id: uid(), nom: 'Sport', actif: true },
      { id: uid(), nom: 'Coucher avant 23 h', actif: true }
    ],
    checks: {},   // { 'AAAA-MM-JJ': [idHabitude, ...] }
    mois: {},     // { 'AAAA-MM': { focus, caAv, caMu, objectif, tresorerie, aEncaisser, impayes, chargesFixes, revues:[] } }
    pipeline: [], // { id, nom, contact, etape, montant }
    projets: [],  // { id, pole, titre, client, etapes:{}, deadline, bloque, note }
    bloques: [],  // { id, texte }
    // Réservé phase 2 — présents dès maintenant pour éviter une migration
    contacts: [],
    catalogue: []
  };
}

let DB = null;

function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return dataVierge();
    const d = JSON.parse(brut);
    return migrer(d);
  } catch (e) {
    console.error('Lecture des données impossible, repartir à vide', e);
    return dataVierge();
  }
}

/* Point d'entrée des migrations futures : on complète les clés
   manquantes au lieu d'écraser, pour ne jamais perdre de données. */
function migrer(d) {
  const base = dataVierge();
  const out = Object.assign({}, base, d);
  out.reglages = Object.assign({}, base.reglages, d.reglages || {});
  out.nord = Object.assign({}, base.nord, d.nord || {});
  out.nord.cibles = Object.assign({}, base.nord.cibles, (d.nord && d.nord.cibles) || {});
  if (!Array.isArray(out.habitudes) || !out.habitudes.length) out.habitudes = base.habitudes;
  out.checks = d.checks || {};
  out.mois = d.mois || {};
  out.pipeline = Array.isArray(d.pipeline) ? d.pipeline : [];
  out.projets = Array.isArray(d.projets) ? d.projets : [];
  out.bloques = Array.isArray(d.bloques) ? d.bloques : [];
  out.schema = SCHEMA;
  return out;
}

function sauver() {
  DB.majLe = new Date().toISOString();
  try {
    localStorage.setItem(CLE, JSON.stringify(DB));
  } catch (e) {
    toast('Stockage saturé — sauvegarde le fichier');
    console.error(e);
  }
  majBandeau();
}

/* Accès au mois courant, créé à la volée. */
function mois(mk) {
  if (!DB.mois[mk]) {
    DB.mois[mk] = {
      focus: '', caAv: '', caMu: '', objectif: '',
      tresorerie: '', aEncaisser: '', impayes: '', chargesFixes: '',
      revues: [
        { s: 'S1', marche: '', change: '' }, { s: 'S2', marche: '', change: '' },
        { s: 'S3', marche: '', change: '' }, { s: 'S4', marche: '', change: '' },
        { s: 'S5', marche: '', change: '' }
      ]
    };
  }
  const m = DB.mois[mk];
  if (!Array.isArray(m.revues) || m.revues.length !== 5) {
    m.revues = ['S1','S2','S3','S4','S5'].map(s => ({ s: s, marche: '', change: '' }));
  }
  return m;
}

/* ---------------------------------------------------------
   4. État de navigation
   --------------------------------------------------------- */

const state = {
  vue: 'jour',
  mk: moisKey(new Date())
};

/* ---------------------------------------------------------
   5. Sauvegarde / restauration
   --------------------------------------------------------- */

function nomFichier() {
  const d = new Date();
  return 'SOCO_sauvegarde_' + dateKey(d) + '.json';
}

function joursDepuisSauvegarde() {
  if (!DB.sauvegardeLe) return Infinity;
  const diff = Date.now() - new Date(DB.sauvegardeLe).getTime();
  return diff / 86400000;
}

function majBandeau() {
  const b = $('#backupBanner');
  const j = joursDepuisSauvegarde();
  if (j === Infinity) {
    $('#backupMsg').textContent = 'Aucune sauvegarde. Enregistre le fichier dans iCloud Drive.';
    b.classList.remove('hidden');
  } else if (j > RAPPEL_JOURS) {
    $('#backupMsg').textContent = 'Dernière sauvegarde il y a ' + Math.floor(j) + ' jours.';
    b.classList.remove('hidden');
  } else {
    b.classList.add('hidden');
  }
}

/* Sur iPhone/iPad : feuille de partage → « Enregistrer dans Fichiers » → iCloud Drive.
   Sur Mac : téléchargement classique dans le dossier Téléchargements. */
async function sauvegarder() {
  const contenu = JSON.stringify(DB, null, 2);
  const nom = nomFichier();
  const blob = new Blob([contenu], { type: 'application/json' });
  const file = new File([blob], nom, { type: 'application/json' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nom });
      marquerSauvegarde();
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return; // l'utilisateur a annulé
      // sinon on retombe sur le téléchargement
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nom;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  marquerSauvegarde();
}

function marquerSauvegarde() {
  DB.sauvegardeLe = new Date().toISOString();
  sauver();
  toast('Sauvegarde enregistrée');
}

function restaurer(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (!d || typeof d !== 'object' || !('habitudes' in d || 'mois' in d)) {
        throw new Error('format inattendu');
      }
      if (!confirm('Remplacer toutes les données actuelles par ce fichier ?')) return;
      DB = migrer(d);
      sauver();
      rendre();
      toast('Données restaurées');
    } catch (e) {
      alert('Fichier illisible : ' + e.message);
    }
  };
  fr.onerror = () => alert('Lecture du fichier impossible.');
  fr.readAsText(file);
}

/* ---------------------------------------------------------
   6. Vues
   --------------------------------------------------------- */

const TITRES = {
  jour:     ['Jour',     'Une croix le soir. Soixante secondes, pas plus.'],
  pilotage: ['Pilotage', 'Un miroir, pas une comptabilité.'],
  prod:     ['Prod',     'Ce qui ne bouge pas se voit.'],
  nord:     ['Nord',     'Le cap. Il se relit, il ne se modifie pas.'],
  reglages: ['Réglages', 'Sauvegarde, habitudes, objectifs.']
};

function rendre() {
  $('#viewTitle').textContent = TITRES[state.vue][0];
  $('#viewSub').textContent = TITRES[state.vue][1];
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.view === state.vue));

  const v = $('#view');
  if (state.vue === 'jour')     v.innerHTML = vueJour();
  if (state.vue === 'pilotage') v.innerHTML = vuePilotage();
  if (state.vue === 'prod')     v.innerHTML = vueProd();
  if (state.vue === 'nord')     v.innerHTML = vueNord();
  if (state.vue === 'reglages') v.innerHTML = vueReglages();
  majBandeau();
}

/* ---------- sélecteur de mois, partagé ---------- */
function selecteurMois() {
  return '<div class="row" style="margin-bottom:14px">' +
    '<button class="mini" data-act="mois-prec">‹</button>' +
    '<div style="flex:1;text-align:center;font-weight:800;letter-spacing:.06em;text-transform:uppercase;font-size:13px">' +
      esc(moisLabel(state.mk)) + '</div>' +
    '<button class="mini" data-act="mois-suiv">›</button>' +
  '</div>';
}

/* ---------- JOUR ---------- */
function habitudesActives() {
  return DB.habitudes.filter(h => h.actif !== false);
}

function estCoche(dk, id) {
  return (DB.checks[dk] || []).indexOf(id) !== -1;
}

function basculer(dk, id) {
  const l = DB.checks[dk] || (DB.checks[dk] = []);
  const i = l.indexOf(id);
  if (i === -1) l.push(id); else l.splice(i, 1);
  if (!l.length) delete DB.checks[dk];
  sauver();
}

function serie(id) {
  let n = 0;
  const d = new Date();
  // si aujourd'hui n'est pas coché, on démarre le compte à hier
  if (!estCoche(dateKey(d), id)) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 400; i++) {
    if (estCoche(dateKey(d), id)) { n++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return n;
}

function vueJour() {
  const now = new Date();
  const dk = dateKey(now);
  const habs = habitudesActives();

  let h = '<section class="today">' +
    '<div class="d">' + esc(JOURS_FR[now.getDay()] + ' ' + now.getDate() + ' ' + MOIS_FR[now.getMonth()]) + '</div>' +
    '<div class="s">' + habs.filter(x => estCoche(dk, x.id)).length + ' / ' + habs.length + ' aujourd\'hui</div>' +
    '<div class="hab-list">';

  if (!habs.length) {
    h += '<div class="empty">Aucune habitude active.<br>Ajoute-les dans Réglages.</div>';
  }
  habs.forEach(x => {
    const on = estCoche(dk, x.id);
    const s = serie(x.id);
    h += '<div class="hab-item' + (on ? ' done' : '') + '" data-act="check" data-id="' + x.id + '">' +
      '<div class="hab-box">✕</div>' +
      '<div class="hab-name">' + esc(x.nom) + '</div>' +
      (s > 1 ? '<div class="hab-streak">' + s + ' j</div>' : '') +
    '</div>';
  });
  h += '</div></section>';

  /* grille du mois */
  h += '<section class="card"><h2>Le mois<span class="aside">' + esc(moisLabel(state.mk)) + '</span></h2>' +
       selecteurMois() + '<div class="monthgrid">' + grilleMois() + '</div></section>';

  /* revue hebdo */
  const m = mois(state.mk);
  h += '<section class="card"><h2>Revue hebdomadaire</h2>';
  m.revues.forEach((r, i) => {
    h += '<div class="field"><span class="lbl">' + esc(r.s) + ' — ce qui a marché</span>' +
      '<textarea data-set="mois.' + state.mk + '.revues.' + i + '.marche" style="min-height:56px">' + esc(r.marche) + '</textarea></div>' +
      '<div class="field"><span class="lbl">' + esc(r.s) + ' — ce que je change lundi</span>' +
      '<textarea data-set="mois.' + state.mk + '.revues.' + i + '.change" style="min-height:56px">' + esc(r.change) + '</textarea></div>';
  });
  h += '</section>';
  return h;
}

function grilleMois() {
  const nj = joursDansMois(state.mk);
  const habs = habitudesActives();
  const auj = dateKey(new Date());
  let h = '<table class="mg"><tr><th class="h">Habitude</th>';
  for (let d = 1; d <= nj; d++) {
    const dk = state.mk + '-' + pad2(d);
    h += '<th class="d' + (dk === auj ? ' now' : '') + '">' + d + '</th>';
  }
  h += '<th class="d">Σ</th></tr>';

  habs.forEach(x => {
    let tot = 0;
    h += '<tr><td class="n">' + esc(x.nom) + '</td>';
    for (let d = 1; d <= nj; d++) {
      const dk = state.mk + '-' + pad2(d);
      const on = estCoche(dk, x.id);
      if (on) tot++;
      const futur = dk > auj;
      h += '<td class="c' + (on ? ' on' : '') + (futur ? ' fut' : '') + '"' +
           (futur ? '' : ' data-act="cell" data-id="' + x.id + '" data-dk="' + dk + '"') + '></td>';
    }
    h += '<td class="n" style="text-align:center;font-weight:800;color:var(--or)">' + tot + '</td></tr>';
  });
  h += '</table>';
  return h;
}

/* ---------- PILOTAGE ---------- */
function vuePilotage() {
  const m = mois(state.mk);
  const obj = nbr(m.objectif) || nbr(DB.reglages.objectifCaMensuel);
  const av = nbr(m.caAv), mu = nbr(m.caMu), tot = av + mu;
  const pct = obj > 0 ? (tot / obj) * 100 : 0;
  const ecart = tot - obj;

  let h = '<section class="card">' + selecteurMois() +
    '<div class="field"><span class="lbl">Le seul chiffre qui compte ce mois-ci</span>' +
    '<input type="text" data-set="mois.' + state.mk + '.focus" value="' + esc(m.focus) + '" placeholder="Ex. 3 contrats podcast signés"></div>' +
    '</section>';

  h += '<section class="card"><h2>Chiffre d\'affaires</h2>' +
    jauge('tot', 'Total', tot, obj, false) +
    jauge('av', 'Audiovisuel', av, obj, true) +
    jauge('mu', 'Musique', mu, obj, true) +
    '<div class="grid3" style="margin-top:16px">' +
      champ('Objectif du mois', 'mois.' + state.mk + '.objectif', m.objectif, 'number', String(DB.reglages.objectifCaMensuel || 0)) +
      champ('CA Audiovisuel', 'mois.' + state.mk + '.caAv', m.caAv, 'number', '0') +
      champ('CA Musique', 'mois.' + state.mk + '.caMu', m.caMu, 'number', '0') +
    '</div>' +
    '<div class="muted" style="margin-top:12px" id="pil-resume">' + resumeCa(tot, ecart) + '</div>' +
    '</section>';

  /* pipeline */
  h += '<section class="card"><h2>Pipeline B2B<span class="aside">' + DB.pipeline.length + ' en cours</span></h2>';
  PIPE.forEach(st => {
    const l = DB.pipeline.filter(d => d.etape === st.k);
    const somme = l.reduce((a, d) => a + nbr(d.montant), 0);
    h += '<div class="pipe-stage"><div class="pipe-h"><b style="color:' +
      (st.k === 'signe' ? 'var(--or)' : 'var(--txt)') + '">' + esc(st.l) + '</b>' +
      '<span class="cnt">' + l.length + '</span>' +
      (somme ? '<span class="sum">' + fmtE(somme) + '</span>' : '') + '</div>';
    l.forEach(d => {
      const i = PIPE.findIndex(p => p.k === d.etape);
      h += '<div class="deal">' +
        '<div class="dn"><b>' + esc(d.nom) + '</b>' + (d.contact ? '<span>' + esc(d.contact) + '</span>' : '') + '</div>' +
        (nbr(d.montant) ? '<div class="dm">' + fmtE(d.montant) + '</div>' : '') +
        '<div class="dg">' +
          (i > 0 ? '<button class="mini" data-act="deal-prec" data-id="' + d.id + '" title="Reculer">‹</button>' : '') +
          (i < PIPE.length - 1 ? '<button class="mini" data-act="deal-suiv" data-id="' + d.id + '" title="Avancer">›</button>' : '') +
          '<button class="mini del" data-act="deal-suppr" data-id="' + d.id + '" title="Supprimer">✕</button>' +
        '</div></div>';
    });
    h += '</div>';
  });
  h += '<button class="btn btn-full" data-act="deal-add" style="margin-top:6px">+ Ajouter une piste</button></section>';

  /* KPI */
  h += '<section class="card"><h2>Trésorerie<span class="aside">saisie manuelle</span></h2><div class="kpi4">' +
    champ('Trésorerie', 'mois.' + state.mk + '.tresorerie', m.tresorerie, 'number', '0') +
    champ('À encaisser', 'mois.' + state.mk + '.aEncaisser', m.aEncaisser, 'number', '0') +
    champ('Impayés', 'mois.' + state.mk + '.impayes', m.impayes, 'number', '0') +
    champ('Charges fixes', 'mois.' + state.mk + '.chargesFixes', m.chargesFixes, 'number', '0') +
    '</div><div class="muted" style="margin-top:12px">Ces chiffres sont un miroir. ' +
    'Aucune décision de trésorerie ne se prend d\'ici — la vérité reste dans ton outil de facturation.</div></section>';

  return h;
}

function jauge(id, nom, val, obj, petite) {
  const pct = obj > 0 ? (val / obj) * 100 : 0;
  const w = Math.max(0, Math.min(100, pct));
  return '<div class="gauge' + (petite ? ' sm' : '') + '">' +
    '<div class="gh"><span class="gn">' + esc(nom) + '</span>' +
    '<span class="gv" id="gv-' + id + '"><b>' + (fmtE(val) || '0 €') + '</b>' +
      (obj > 0 ? ' · ' + Math.round(pct) + ' %' : '') + '</span></div>' +
    '<div class="track"><div class="fill' + (pct >= 100 ? ' over' : '') + '" id="gf-' + id + '" style="width:' + w + '%"></div></div>' +
    (petite ? '' : '<div class="ticks"><span>0</span><span>25 %</span><span>50 %</span><span>75 %</span><span>100 %</span></div>') +
    '</div>';
}

function resumeCa(tot, ecart) {
  return 'Réalisé <b style="color:var(--txt)">' + (fmtE(tot) || '0 €') + '</b> · Écart ' +
    '<b style="color:' + (ecart >= 0 ? 'var(--ok)' : 'var(--alerte)') + '">' +
    (ecart >= 0 ? '+' : '') + (fmtE(ecart) || '0 €') + '</b>';
}

/* Met à jour les jauges sans reconstruire la vue :
   la saisie en cours n'est jamais interrompue (perte de focus sur mobile). */
function majJauges() {
  if (state.vue !== 'pilotage') return;
  const m = mois(state.mk);
  const obj = nbr(m.objectif) || nbr(DB.reglages.objectifCaMensuel);
  const av = nbr(m.caAv), mu = nbr(m.caMu), tot = av + mu;
  const set = (id, val) => {
    const pct = obj > 0 ? (val / obj) * 100 : 0;
    const f = document.getElementById('gf-' + id);
    const v = document.getElementById('gv-' + id);
    if (f) { f.style.width = Math.max(0, Math.min(100, pct)) + '%'; f.classList.toggle('over', pct >= 100); }
    if (v) v.innerHTML = '<b>' + (fmtE(val) || '0 €') + '</b>' + (obj > 0 ? ' · ' + Math.round(pct) + ' %' : '');
  };
  set('tot', tot); set('av', av); set('mu', mu);
  const r = document.getElementById('pil-resume');
  if (r) r.innerHTML = resumeCa(tot, tot - obj);
}

function champ(label, path, val, type, ph) {
  return '<div class="field"><span class="lbl">' + esc(label) + '</span>' +
    '<input type="' + (type || 'text') + '" inputmode="' + (type === 'number' ? 'decimal' : 'text') + '" ' +
    'data-set="' + path + '"' + (type === 'number' ? ' data-num="1"' : '') +
    ' value="' + esc(val) + '" placeholder="' + esc(ph || '') + '"></div>';
}

/* ---------- PROD ---------- */
function vueProd() {
  let h = '';
  ['av', 'mu'].forEach(p => {
    const l = DB.projets.filter(x => x.pole === p);
    h += '<section class="card"><h2>' + esc(POLES[p]) + '<span class="aside">' + l.length + '</span></h2>';
    if (!l.length) h += '<div class="empty">Aucun projet en cours.</div>';
    l.forEach(pr => h += carteProjet(pr));
    h += '<button class="btn btn-full" data-act="proj-add" data-pole="' + p + '" style="margin-top:6px">+ Ajouter un projet</button>';
    h += '</section>';
  });

  h += '<section class="card"><h2>Bloqué<span class="aside">j\'attends quelqu\'un</span></h2>';
  if (!DB.bloques.length) h += '<div class="empty">Rien en attente. Tant mieux.</div>';
  DB.bloques.forEach(b => {
    h += '<div class="row" style="margin-bottom:8px">' +
      '<input type="text" data-set="bloques#' + b.id + '.texte" value="' + esc(b.texte) + '" placeholder="Qui, quoi, depuis quand">' +
      '<button class="mini del" data-act="bloq-suppr" data-id="' + b.id + '">✕</button></div>';
  });
  h += '<button class="btn btn-ghost btn-full" data-act="bloq-add" style="margin-top:6px">+ Ajouter un blocage</button></section>';
  return h;
}

function carteProjet(pr) {
  const et = ETAPES[pr.pole] || [];
  const faits = et.filter(s => pr.etapes && pr.etapes[s.k]).length;
  let retard = false;
  if (pr.deadline) retard = pr.deadline < dateKey(new Date()) && faits < et.length;

  let h = '<div class="proj' + (pr.bloque ? ' bloque' : '') + '">' +
    '<div class="proj-h"><div class="pt">' +
      '<input type="text" data-set="projets#' + pr.id + '.titre" value="' + esc(pr.titre) + '" placeholder="' +
        (pr.pole === 'av' ? 'Projet' : 'Titre') + '" style="font-weight:700;margin-bottom:6px">' +
      '<input type="text" data-set="projets#' + pr.id + '.client" value="' + esc(pr.client) + '" placeholder="' +
        (pr.pole === 'av' ? 'Client' : 'Artiste') + '" style="font-size:12px;padding:8px 10px">' +
    '</div></div>' +
    '<div class="steps">';
  et.forEach(s => {
    const on = !!(pr.etapes && pr.etapes[s.k]);
    h += '<button class="step' + (on ? ' on' : '') + '" data-act="step" data-id="' + pr.id + '" data-k="' + s.k + '">' + esc(s.l) + '</button>';
  });
  h += '</div><div class="proj-foot">' +
    '<input type="date" data-set="projets#' + pr.id + '.deadline" value="' + esc(pr.deadline || '') + '" style="flex:1;font-size:12px;padding:8px 10px">' +
    '<span class="proj-dl' + (retard ? ' late' : '') + '">' + faits + '/' + et.length + '</span>' +
    '<button class="mini del" data-act="proj-suppr" data-id="' + pr.id + '">✕</button>' +
  '</div></div>';
  return h;
}

/* ---------- NORD ---------- */
function vueNord() {
  const n = DB.nord;
  let h = '<section class="mantra"><div class="k">La phrase que je me répète quand c\'est dur</div>' +
    '<textarea data-set="nord.mantra" placeholder="Écris-la une fois. Ne la change pas tous les mois.">' + esc(n.mantra) + '</textarea></section>';

  h += '<section class="card"><h2>Dans 3 ans</h2>';
  n.h3.forEach((v, i) => h += '<div class="field"><input type="text" data-set="nord.h3.' + i + '" value="' + esc(v) + '" placeholder="Objectif ' + (i + 1) + '"></div>');
  h += '</section>';

  h += '<section class="card"><h2>Dans 12 mois</h2>';
  n.h12.forEach((v, i) => h += '<div class="field"><input type="text" data-set="nord.h12.' + i + '" value="' + esc(v) + '" placeholder="Objectif ' + (i + 1) + '"></div>');
  h += '</section>';

  h += '<section class="card"><h2>Les trois chiffres</h2><div class="grid3">' +
    champ('CA · 12 mois', 'nord.cibles.ca12m', n.cibles.ca12m, 'text', '') +
    champ('Clients récurrents', 'nord.cibles.clientsRecurrents', n.cibles.clientsRecurrents, 'text', '') +
    champ('Sorties label', 'nord.cibles.sortiesLabel', n.cibles.sortiesLabel, 'text', '') +
    '</div>' +
    '<div class="field" style="margin-top:6px"><span class="lbl">Valable jusqu\'au</span>' +
    '<input type="date" data-set="nord.valableJusquau" value="' + esc(n.valableJusquau || '') + '"></div>' +
    '</section>';
  return h;
}

/* ---------- RÉGLAGES ---------- */
function vueReglages() {
  const j = joursDepuisSauvegarde();
  let h = '<section class="card"><h2>Sauvegarde</h2>' +
    '<div class="muted" style="margin-bottom:14px">Tes données vivent uniquement sur cet appareil. ' +
    'Sur iPhone, « Sauvegarder » ouvre la feuille de partage : choisis <b>Enregistrer dans Fichiers → iCloud Drive</b>. ' +
    'Sur Mac, le fichier part dans Téléchargements — dépose-le dans iCloud Drive. ' +
    'C\'est aussi comme ça que tu transfères tes données d\'un appareil à l\'autre.</div>' +
    '<div class="btn-row">' +
      '<button class="btn" data-act="save">Sauvegarder</button>' +
      '<button class="btn btn-ghost" data-act="load">Restaurer un fichier</button>' +
    '</div>' +
    '<div class="kv" style="margin-top:14px"><span>Dernière sauvegarde</span><b>' +
      (j === Infinity ? 'jamais' : new Date(DB.sauvegardeLe).toLocaleString('fr-FR')) + '</b></div>' +
    '<div class="kv"><span>Dernière modification</span><b>' + new Date(DB.majLe).toLocaleString('fr-FR') + '</b></div>' +
    '</section>';

  h += '<section class="card"><h2>Posters A3</h2>' +
    '<div class="muted" style="margin-bottom:14px">Génère les quatre posters remplis avec tes données actuelles, ' +
    'au format A3. Dans la fenêtre d\'impression, choisis « PDF » puis « Enregistrer au format PDF ».</div>' +
    '<button class="btn btn-full" data-act="print">Imprimer les posters</button></section>';

  h += '<section class="card"><h2>Objectif par défaut</h2>' +
    champ('CA mensuel visé (€)', 'reglages.objectifCaMensuel', DB.reglages.objectifCaMensuel, 'number', '0') +
    '<div class="muted">Sert de valeur par défaut pour chaque nouveau mois. Un mois donné peut avoir son propre objectif.</div></section>';

  h += '<section class="card"><h2>Habitudes<span class="aside">' + habitudesActives().length + ' actives</span></h2>';
  DB.habitudes.forEach(x => {
    h += '<div class="hab-edit">' +
      '<button class="mini" data-act="hab-actif" data-id="' + x.id + '" title="Activer / désactiver">' +
        (x.actif !== false ? '●' : '○') + '</button>' +
      '<input type="text" data-set="habitudes#' + x.id + '.nom" value="' + esc(x.nom) + '" placeholder="Nom de l\'habitude">' +
      '<button class="mini del" data-act="hab-suppr" data-id="' + x.id + '">✕</button></div>';
  });
  h += '<button class="btn btn-ghost btn-full" data-act="hab-add" style="margin-top:6px">+ Ajouter une habitude</button>' +
    '<div class="muted" style="margin-top:12px">Six maximum sur le poster A3. Au-delà, la grille devient illisible ' +
    'et tu arrêtes de la remplir.</div></section>';

  h += '<section class="card"><h2>Zone rouge</h2>' +
    '<button class="btn btn-danger btn-full" data-act="reset">Effacer toutes les données</button>' +
    '<div class="muted" style="margin-top:10px">Irréversible. Sauvegarde d\'abord.</div></section>';

  h += '<div class="muted" style="text-align:center;padding:10px 0 20px">SO/CO — v1 · données locales, aucun serveur</div>';
  return h;
}

/* ---------------------------------------------------------
   7. Écriture générique dans le modèle
   Chemins acceptés :
     'nord.mantra'                → DB.nord.mantra
     'nord.h3.0'                  → DB.nord.h3[0]
     'mois.2026-08.caAv'          → DB.mois['2026-08'].caAv
     'projets#id.titre'           → l'objet de DB.projets ayant cet id
   --------------------------------------------------------- */
function ecrire(path, val) {
  if (path.indexOf('#') !== -1) {
    const [coll, reste] = path.split('#');
    const [id, ...champs] = reste.split('.');
    const obj = (DB[coll] || []).find(x => x.id === id);
    if (!obj) return;
    let cur = obj;
    for (let i = 0; i < champs.length - 1; i++) cur = cur[champs[i]];
    cur[champs[champs.length - 1]] = val;
    sauver();
    return;
  }
  const parts = path.split('.');
  let cur = DB;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    // 'mois.2026-08....' : créer le mois si absent
    if (parts[0] === 'mois' && i === 1) { cur = mois(p); continue; }
    if (cur[p] == null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = val;
  sauver();
}

/* ---------------------------------------------------------
   8. Actions
   --------------------------------------------------------- */

function decalerMois(n) {
  const [y, m] = state.mk.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  state.mk = moisKey(d);
  rendre();
}

const ACTIONS = {
  'check': (el) => {
    basculer(dateKey(new Date()), el.dataset.id);
    rendre();
  },
  'cell': (el) => {
    basculer(el.dataset.dk, el.dataset.id);
    rendre();
  },
  'mois-prec': () => decalerMois(-1),
  'mois-suiv': () => decalerMois(1),

  'deal-add': () => {
    const nom = prompt('Nom du prospect ou de l\'entreprise ?');
    if (!nom) return;
    const montant = prompt('Montant estimé en € (facultatif) ?') || '';
    DB.pipeline.push({ id: uid(), nom: nom, contact: '', etape: 'contacte', montant: nbr(montant) || '' });
    sauver(); rendre();
  },
  'deal-suiv': (el) => bougerDeal(el.dataset.id, 1),
  'deal-prec': (el) => bougerDeal(el.dataset.id, -1),
  'deal-suppr': (el) => {
    const d = DB.pipeline.find(x => x.id === el.dataset.id);
    if (d && !confirm('Supprimer « ' + d.nom + ' » ?')) return;
    DB.pipeline = DB.pipeline.filter(x => x.id !== el.dataset.id);
    sauver(); rendre();
  },

  'proj-add': (el) => {
    const p = el.dataset.pole;
    DB.projets.push({ id: uid(), pole: p, titre: '', client: '', etapes: {}, deadline: '', bloque: false, note: '' });
    sauver(); rendre();
  },
  'proj-suppr': (el) => {
    if (!confirm('Supprimer ce projet ?')) return;
    DB.projets = DB.projets.filter(x => x.id !== el.dataset.id);
    sauver(); rendre();
  },
  'step': (el) => {
    const pr = DB.projets.find(x => x.id === el.dataset.id);
    if (!pr) return;
    pr.etapes = pr.etapes || {};
    pr.etapes[el.dataset.k] = !pr.etapes[el.dataset.k];
    sauver(); rendre();
  },

  'bloq-add': () => { DB.bloques.push({ id: uid(), texte: '' }); sauver(); rendre(); },
  'bloq-suppr': (el) => {
    DB.bloques = DB.bloques.filter(x => x.id !== el.dataset.id);
    sauver(); rendre();
  },

  'hab-add': () => { DB.habitudes.push({ id: uid(), nom: '', actif: true }); sauver(); rendre(); },
  'hab-actif': (el) => {
    const x = DB.habitudes.find(h => h.id === el.dataset.id);
    if (x) { x.actif = x.actif === false; sauver(); rendre(); }
  },
  'hab-suppr': (el) => {
    if (!confirm('Supprimer cette habitude ? Son historique de croix est conservé mais ne sera plus affiché.')) return;
    DB.habitudes = DB.habitudes.filter(h => h.id !== el.dataset.id);
    sauver(); rendre();
  },

  'save': () => sauvegarder(),
  'load': () => $('#fileImport').click(),
  'print': () => imprimer(),
  'reset': () => {
    if (!confirm('Effacer TOUTES les données ? Cette action est irréversible.')) return;
    if (!confirm('Vraiment sûr ? Sauvegarde d\'abord si ce n\'est pas fait.')) return;
    DB = dataVierge(); sauver(); rendre(); toast('Données effacées');
  }
};

function bougerDeal(id, dir) {
  const d = DB.pipeline.find(x => x.id === id);
  if (!d) return;
  const i = PIPE.findIndex(p => p.k === d.etape);
  const j = Math.max(0, Math.min(PIPE.length - 1, i + dir));
  d.etape = PIPE[j].k;
  sauver(); rendre();
}

/* ---------------------------------------------------------
   9. Génération des posters A3
   --------------------------------------------------------- */

function imprimer() {
  $('#printroot').innerHTML = posterNord() + posterPilotage() + posterProduction() + posterJours();
  setTimeout(() => window.print(), 120);
}

function enteteP(kicker, titre, sous, meta, sombre) {
  return '<div class="hdr"><img src="assets/logo.png" alt="">' +
    '<div class="tt"><div class="kicker">' + esc(kicker) + '</div><h1>' + esc(titre) + '</h1>' +
    '<div class="sub">' + esc(sous) + '</div></div>' +
    '<div class="meta">' + meta + '</div></div>';
}

function posterNord() {
  const n = DB.nord;
  const ligne = (v) => '<i>' + esc(v || '') + '</i>';
  return '<section class="pp dark">' +
    enteteP('01 — Le cap', 'North', 'Ce poster ne se modifie pas. Il se relit.',
      'Valable jusqu\'au<br>' + esc(n.valableJusquau || '—')) +
    '<div class="p1h">' +
      '<div class="cell"><div class="lab">Dans <span>3 ans</span></div><div class="lines">' +
        n.h3.map(ligne).join('') + '</div></div>' +
      '<div class="cell"><div class="lab">Dans <span>12 mois</span></div><div class="lines">' +
        n.h12.map(ligne).join('') + '</div></div>' +
    '</div>' +
    '<div class="p1n">' +
      '<div class="n"><div class="cap">CA · 12 mois</div><div class="field">' + esc(n.cibles.ca12m) + '</div></div>' +
      '<div class="n"><div class="cap">Clients récurrents</div><div class="field">' + esc(n.cibles.clientsRecurrents) + '</div></div>' +
      '<div class="n"><div class="cap">Sorties label</div><div class="field">' + esc(n.cibles.sortiesLabel) + '</div></div>' +
    '</div>' +
    '<div class="p1m"><div class="lbl">Ce à quoi ça ressemble — coller ici</div><div class="grid">' +
      ['Le studio','Le client rêvé','Le matériel','L\'artiste','La scène / le lieu','Libre']
        .map(t => '<div class="fr"><span>' + esc(t) + '</span></div>').join('') +
    '</div></div>' +
    '<div class="p1p"><div class="k">La phrase que je me répète quand c\'est dur</div>' +
      '<div class="f">' + esc(n.mantra) + '</div></div>' +
    '<div class="p1f"><span>SO/CO — Système mural</span><span>Poster 01 / 04</span></div>' +
  '</section>';
}

function segments(val, obj) {
  const pct = obj > 0 ? (val / obj) * 100 : 0;
  const pleins = Math.max(0, Math.min(20, Math.round(pct / 5)));
  let h = '';
  for (let i = 0; i < 20; i++) h += '<i class="' + (i < pleins ? 'f' : '') + '"></i>';
  return h;
}

function posterPilotage() {
  const m = mois(state.mk);
  const obj = nbr(m.objectif) || nbr(DB.reglages.objectifCaMensuel);
  const av = nbr(m.caAv), mu = nbr(m.caMu), tot = av + mu;
  const ecart = tot - obj;

  const col = (st) => {
    const l = DB.pipeline.filter(d => d.etape === st.k);
    let rows = '';
    for (let i = 0; i < 8; i++) rows += '<i>' + (l[i] ? esc(l[i].nom) : '') + '</i>';
    return '<div class="col' + (st.k === 'signe' ? ' win' : '') + '"><h4>' + esc(st.l) + '</h4>' +
           '<div class="rows">' + rows + '</div></div>';
  };

  return '<section class="pp">' +
    enteteP('02 — Le mois en cours', 'Pilotage', 'Un miroir, pas une comptabilité. La vérité reste dans les livres.',
      esc(moisLabel(state.mk))) +
    '<div class="one"><div class="l">Le seul chiffre<br><em>qui compte ce mois-ci</em></div>' +
      '<div class="r">' + esc(m.focus) + '</div></div>' +
    '<div class="sec" style="height:64mm"><div class="st"><span>Chiffre d\'affaires</span>' +
      '<span class="hint">une case = 5 % de l\'objectif</span></div><div class="bd"><div class="ca">' +
      '<div class="left">' +
        '<div class="row"><div class="nm">Total</div><div class="bar">' + segments(tot, obj) + '</div></div>' +
        '<div class="ticks"><span>0</span><span>25 %</span><span>50 %</span><span>75 %</span><span>100 %</span></div>' +
        '<div class="row"><div class="nm">Pôle Audiovisuel</div><div class="bar sm">' + segments(av, obj) + '</div></div>' +
        '<div class="row"><div class="nm">Pôle Musique</div><div class="bar sm">' + segments(mu, obj) + '</div></div>' +
      '</div>' +
      '<div class="right">' +
        '<div class="fld"><u>Objectif du mois</u><b>' + (fmtE(obj) || '—') + '</b></div>' +
        '<div class="fld"><u>Réalisé à ce jour</u><b>' + (fmtE(tot) || '—') + '</b></div>' +
        '<div class="fld"><u>Écart</u><b>' + (ecart >= 0 ? '+' : '') + (fmtE(ecart) || '—') + '</b></div>' +
      '</div></div></div></div>' +
    '<div class="sec" style="flex:1"><div class="st"><span>Pipeline commercial B2B</span>' +
      '<span class="hint">8 premières pistes par étape</span></div>' +
      '<div class="bd"><div class="pipe">' + PIPE.map(col).join('') + '</div></div></div>' +
    '<div class="kpi">' +
      '<div class="k"><u>Trésorerie</u><b>' + (fmtE(m.tresorerie) || '—') + '</b></div>' +
      '<div class="k"><u>À encaisser</u><b>' + (fmtE(m.aEncaisser) || '—') + '</b></div>' +
      '<div class="k"><u>Impayés</u><b>' + (fmtE(m.impayes) || '—') + '</b></div>' +
      '<div class="k"><u>Charges fixes</u><b>' + (fmtE(m.chargesFixes) || '—') + '</b></div>' +
    '</div>' +
    '<div class="rule"><strong>Règle</strong><span>Ce mur est un miroir. Aucune décision de trésorerie ne se prend depuis un chiffre affiché ici.</span></div>' +
  '</section>';
}

function posterProduction() {
  const bloc = (p, entetePremier, enteteDernier) => {
    const et = ETAPES[p];
    const l = DB.projets.filter(x => x.pole === p).slice(0, 8);
    let h = '<div class="trk"><div class="cap"><b>Pôle <em>' +
      (p === 'av' ? 'Audiovisuel' : 'Musique') + '</em></b><span>' + esc(POLES_SUB[p]) + '</span></div>' +
      '<div class="g3">';
    h += '<div class="hd p c1">' + esc(entetePremier) + '</div>';
    et.forEach(s => h += '<div class="hd">' + esc(s.l) + '</div>');
    h += '<div class="hd d">' + esc(enteteDernier) + '</div>';
    for (let r = 0; r < 8; r++) {
      const pr = l[r];
      const nom = pr ? (pr.titre || '') + (pr.client ? ' · ' + pr.client : '') : '';
      h += '<div class="c1">' + esc(nom) + '</div>';
      et.forEach(s => h += '<div>' + (pr && pr.etapes && pr.etapes[s.k] ? '<span class="x">✕</span>' : '') + '</div>');
      h += '<div class="cd">' + esc(pr && pr.deadline ? pr.deadline.split('-').reverse().slice(0, 2).join('/') : '') + '</div>';
    }
    return h + '</div></div>';
  };

  let bl = '';
  for (let i = 0; i < 3; i++) bl += '<i>' + esc(DB.bloques[i] ? DB.bloques[i].texte : '') + '</i>';

  return '<section class="pp">' +
    enteteP('03 — Ce qui est en cours', 'Production', 'Une croix par étape franchie. Ce qui ne bouge pas se voit.',
      esc(moisLabel(state.mk))) +
    bloc('av', 'Projet / Client', 'Deadline') +
    bloc('mu', 'Artiste / Titre', 'Sortie') +
    '<div class="blk"><div class="l"><b>Bloqué</b><span>J\'attends quelque chose de quelqu\'un. Écris qui — et depuis quand.</span></div>' +
      '<div class="r">' + bl + '</div></div>' +
    '<div class="rule"><strong>Règle</strong><span>Une ligne sans nouvelle croix depuis 14 jours : je la relance lundi, ou je la barre.</span></div>' +
  '</section>';
}

function posterJours() {
  const nj = joursDansMois(state.mk);
  const habs = habitudesActives().slice(0, 7);
  const m = mois(state.mk);

  let g = '<div class="hab"><div class="hh">Habitude</div>';
  for (let d = 1; d <= 31; d++) g += '<div class="hd">' + (d <= nj ? d : '') + '</div>';
  g += '<div class="ht">/' + nj + '</div>';

  for (let r = 0; r < 7; r++) {
    const x = habs[r];
    let tot = 0;
    g += '<div class="lab">' + esc(x ? x.nom : '') + '</div>';
    for (let d = 1; d <= 31; d++) {
      const dk = state.mk + '-' + pad2(d);
      const on = x && d <= nj && estCoche(dk, x.id);
      if (on) tot++;
      g += '<div class="' + (d % 7 === 0 ? 'w7' : '') + '">' + (on ? '<span class="x">✕</span>' : '') + '</div>';
    }
    g += '<div class="tt">' + (x ? tot : '') + '</div>';
  }
  g += '</div>';

  let sem = '<div class="sem"><div class="h">Semaine</div><div class="h">Ce qui a marché</div>' +
            '<div class="h k">Ce que je change lundi</div>';
  m.revues.forEach(r => {
    sem += '<div class="s"><i>' + esc(r.s) + '</i></div><div>' + esc(r.marche) + '</div><div>' + esc(r.change) + '</div>';
  });
  sem += '</div>';

  return '<section class="pp">' +
    enteteP('04 — La discipline', '30 Jours', 'Une croix le soir. Soixante secondes, pas plus.',
      esc(moisLabel(state.mk))) +
    g + sem +
    '<div class="p4f"><div class="l">Règle des<br><em>deux jours</em></div>' +
      '<div class="r">Jamais deux cases vides d\'affilée sur la même ligne. Un jour manqué, c\'est un accident&nbsp;; deux, c\'est une décision.</div></div>' +
  '</section>';
}

/* ---------------------------------------------------------
   10. Câblage
   --------------------------------------------------------- */

function init() {
  DB = charger();

  // navigation
  $$('.tab').forEach(t => t.addEventListener('click', () => { state.vue = t.dataset.view; rendre(); }));
  $('#btnPrint').addEventListener('click', imprimer);
  $('#btnBannerSave').addEventListener('click', sauvegarder);

  // actions déléguées
  $('#view').addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el); }
  });

  // saisie déléguée
  const onSaisie = (e) => {
    const el = e.target.closest('[data-set]');
    if (!el) return;
    const v = el.dataset.num ? (el.value === '' ? '' : nbr(el.value)) : el.value;
    ecrire(el.dataset.set, v);
    if (el.dataset.num) majJauges();
  };
  $('#view').addEventListener('input', onSaisie);
  $('#view').addEventListener('change', onSaisie);

  $('#fileImport').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) restaurer(e.target.files[0]);
    e.target.value = '';
  });

  // raccourcis clavier (Mac)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); imprimer(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); sauvegarder(); }
  });

  rendre();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW non enregistré', err));
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
