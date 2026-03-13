// === SPELL SEARCH MACRO ===
// Fuzzy-searches the D&D 5e API for spells and displays full details.

const apiBase = "https://www.dnd5eapi.co";

// ---- Shared dialog chrome styles ----
function chromeStyles(id, primaryBtn = null) {
  return `
    <style>
      #${id} .window-header {
        background: linear-gradient(135deg, #1a0e00, #2e1a00) !important;
        border-bottom: 2px solid #bfa046 !important;
      }
      #${id} .window-content {
        background: #12100e !important;
        padding: 12px !important;
      }
      #${id} .dialog-buttons {
        display: flex !important;
        gap: 6px !important;
        padding: 8px 12px 12px !important;
        background: #12100e !important;
        border-top: 1px solid #3a2a0b !important;
      }
      #${id} .dialog-buttons button {
        flex: 1;
        padding: 7px 12px !important;
        font-size: 0.95em !important;
        cursor: pointer !important;
        border-radius: 5px !important;
        box-shadow: none !important;
        margin: 0 !important;
        background: #1e1a12 !important;
        color: #a08060 !important;
        border: 1px solid #3a2a0b !important;
        transition: background 0.15s, border-color 0.15s, color 0.15s !important;
      }
      #${id} .dialog-buttons button:hover {
        background: #2a2010 !important;
        border-color: #bfa046 !important;
        color: #e7d7a1 !important;
      }
      ${primaryBtn ? `
      #${id} .dialog-buttons button[data-button="${primaryBtn}"] {
        background: #1a2010 !important;
        color: #90cc70 !important;
        border-color: #3a6622 !important;
      }
      #${id} .dialog-buttons button[data-button="${primaryBtn}"]:hover {
        background: #223018 !important;
        border-color: #55aa33 !important;
        color: #aaffaa !important;
      }` : ''}
    </style>`;
}

// ---- Search dialog ----
const query = await new Promise(resolve => {
  const d = new Dialog({
    title: "📖 Spell Search",
    content: `
      ${chromeStyles('spell-search-dlg', 'search')}
      <div style="display:flex;flex-direction:column;gap:6px;">
        <div style="color:#bfa046;font-family:'Papyrus',serif;font-size:0.8em;letter-spacing:1px;text-transform:uppercase;">
          ✨ Spell Name
        </div>
        <input id="spellQuery" type="text" autofocus
          style="width:100%;padding:8px 10px;background:#1e1a12;color:#e7d7a1;
                 border:1.5px solid #bfa046;border-radius:6px;font-size:1em;
                 box-sizing:border-box;" />
        <p style="color:#7a6a40;font-size:0.85em;margin:2px 0 0;">
          Typos allowed — uses fuzzy matching.
        </p>
      </div>`,
    buttons: {
      search: { label: "🔍 Search", callback: html => resolve(html.find("#spellQuery").val()?.trim().toLowerCase()) },
      cancel: { label: "Cancel",   callback: () => resolve(null) }
    },
    default: "search",
    render: html => html.closest('.app').attr('id', 'spell-search-dlg')
  }, { width: 320 });
  d.render(true);
});

if (!query || query.length < 2) {
  if (query !== null) ui.notifications.warn("Enter at least 2 characters.");
  return;
}

// ---- Fetch all spells ----
ui.notifications.info("🔍 Searching...");
let allSpells;
try {
  allSpells = await (await fetch(`${apiBase}/api/spells`)).json();
} catch (e) {
  ui.notifications.error("Could not reach the D&D 5e API.");
  return;
}

// ---- Levenshtein Distance ----
function levenshtein(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[b.length][a.length];
}

// ---- Fuzzy filter ----
const MAX_DISTANCE = Math.max(1, Math.floor(query.length / 3));

const matches = allSpells.results
  .map(spell => {
    const words = spell.name.toLowerCase().split(" ");
    const bestDistance = Math.min(...words.map(w => levenshtein(w, query)));
    return { spell, distance: bestDistance };
  })
  .filter(r => r.distance <= MAX_DISTANCE)
  .sort((a, b) => a.distance - b.distance)
  .map(r => r.spell);

if (!matches.length) {
  ui.notifications.warn("No spells found.");
  return;
}

// ---- Spell detail content builder ----
function buildDetailContent(spell) {
  const level    = spell.level === 0 ? "Cantrip" : `Level ${spell.level}`;
  const comps    = spell.components.join(", ") + (spell.material ? ` (${spell.material})` : "");
  const classes  = spell.classes?.map(c => c.name).join(", ") || "—";
  const desc     = spell.desc.join("<br><br>");
  const higher   = spell.higher_level?.length
    ? `<hr style="border-color:#5a3e1b;margin:10px 0;" />
       <p style="color:#bfa046;font-family:'Papyrus',serif;font-size:0.8em;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">At Higher Levels</p>
       <p style="color:#ccc0a0;font-size:1em;line-height:1.7;">${spell.higher_level.join("<br><br>")}</p>`
    : "";

  return `
    ${chromeStyles('spell-detail-dlg')}
    <div style="display:flex;flex-direction:column;gap:0;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;
                  background:#1a1208;border:1px solid #3a2a0b;border-radius:6px;
                  padding:8px 12px;margin-bottom:10px;font-size:0.95em;">
        <div><span style="color:#7a6a40;">Level</span><br/><span style="color:#e7d7a1;">${level}</span></div>
        <div><span style="color:#7a6a40;">School</span><br/><span style="color:#e7d7a1;">${spell.school.name}</span></div>
        <div><span style="color:#7a6a40;">Casting Time</span><br/><span style="color:#e7d7a1;">${spell.casting_time}</span></div>
        <div><span style="color:#7a6a40;">Range</span><br/><span style="color:#e7d7a1;">${spell.range}</span></div>
        <div><span style="color:#7a6a40;">Duration</span><br/><span style="color:#e7d7a1;">${spell.duration}</span></div>
        <div><span style="color:#7a6a40;">Classes</span><br/><span style="color:#e7d7a1;">${classes}</span></div>
        <div style="grid-column:1/-1;"><span style="color:#7a6a40;">Components</span><br/><span style="color:#e7d7a1;">${comps}</span></div>
      </div>
      <hr style="border-color:#5a3e1b;margin:0 0 8px;" />
      <div style="max-height:340px;overflow-y:auto;overflow-x:hidden;padding-right:4px;">
        <p style="color:#ccc0a0;font-size:1em;line-height:1.7;margin:0;">${desc}</p>
        ${higher}
      </div>
    </div>`;
}

// ---- Results list dialog ----
const listItems = matches
  .map(s => `<button class="spell-item" data-url="${s.url}">${s.name}</button>`)
  .join("");

new Dialog({
  title: `📖 Results (${matches.length})`,
  content: `
    ${chromeStyles('spell-results-dlg')}
    <style>
      #spell-results-dlg .spell-item {
        width: 100% !important;
        padding: 7px 12px !important;
        text-align: left !important;
        background: #1e1a12 !important;
        color: #ccc0a0 !important;
        border: 1px solid #3a2a0b !important;
        border-radius: 5px !important;
        font-size: 0.95em !important;
        cursor: pointer !important;
        box-shadow: none !important;
        margin: 0 !important;
        transition: background 0.15s, border-color 0.15s, color 0.15s !important;
      }
      #spell-results-dlg .spell-item:hover {
        background: #2e2010 !important;
        border-color: #bfa046 !important;
        color: #ffe08a !important;
      }
    </style>
    <div style="display:flex;flex-direction:column;gap:5px;
                max-height:360px;overflow-y:auto;overflow-x:hidden;padding-right:4px;">
      ${listItems}
    </div>`,
  buttons: { close: { label: "Close" } },
  render: html => {
    html.closest('.app').attr('id', 'spell-results-dlg');

    html.find('.spell-item').on('click', async function () {
      const spellUrl = apiBase + $(this).data('url');
      let spell;
      try {
        spell = await (await fetch(spellUrl)).json();
      } catch (e) {
        ui.notifications.error("Failed to fetch spell details.");
        return;
      }

      new Dialog({
        title: `✨ ${spell.name}`,
        content: buildDetailContent(spell),
        buttons: { close: { label: "Close" } },
        render: html => html.closest('.app').attr('id', 'spell-detail-dlg')
      }, { width: 480 }).render(true);
    });
  }
}, { width: 320 }).render(true);
