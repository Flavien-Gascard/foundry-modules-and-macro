// === DAMAGE / HEAL MACRO ===
// Applies damage or healing to all controlled tokens.

const controlled = canvas.tokens.controlled;
if (!controlled.length) {
  ui.notifications.warn("Select one or more tokens first.");
  return;
}

const tokenNames = controlled.map(t => t.name).join(', ');

const content = `
  <style>
    #dmg-heal-dialog .window-header {
      background: linear-gradient(135deg, #1a0e00, #2e1a00) !important;
      border-bottom: 2px solid #bfa046 !important;
    }
    #dmg-heal-dialog .window-content {
      background: #12100e !important;
      padding: 12px !important;
    }
    #dmg-heal-dialog .section-label {
      color: #bfa046;
      font-family: 'Papyrus', serif;
      font-size: 0.8em;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    #dmg-heal-dialog .target-names {
      color: #ccc0a0;
      font-size: 0.9em;
      font-style: italic;
      margin-bottom: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #dmg-heal-dialog .mode-toggle {
      display: flex;
      gap: 0;
      margin-bottom: 12px;
      border-radius: 6px;
      overflow: hidden;
      border: 1.5px solid #3a2a0b;
    }
    #dmg-heal-dialog .mode-btn {
      flex: 1;
      padding: 7px 8px;
      font-size: 0.95em;
      cursor: pointer;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      margin: 0 !important;
      background: #1e1a12 !important;
      color: #888 !important;
      transition: background 0.15s, color 0.15s !important;
    }
    #dmg-heal-dialog .mode-btn.active-damage {
      background: #3a1010 !important;
      color: #ff8080 !important;
      border-bottom: 2px solid #cc3333 !important;
    }
    #dmg-heal-dialog .mode-btn.active-heal {
      background: #0e2a10 !important;
      color: #80cc80 !important;
      border-bottom: 2px solid #339933 !important;
    }
    #dmg-heal-dialog .mode-btn:hover:not(.active-damage):not(.active-heal) {
      background: #2a2010 !important;
      color: #ccc0a0 !important;
    }
    #dmg-heal-dialog #dmg-amount {
      width: 100%;
      padding: 10px;
      font-size: 2em;
      text-align: center;
      background: #1e1a12;
      color: #e7d7a1;
      border: 1.5px solid #bfa046;
      border-radius: 6px;
      margin-bottom: 8px;
      box-sizing: border-box;
      -moz-appearance: textfield;
    }
    #dmg-heal-dialog #dmg-amount::-webkit-inner-spin-button,
    #dmg-heal-dialog #dmg-amount::-webkit-outer-spin-button {
      opacity: 1;
    }
    #dmg-heal-dialog .half-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 12px;
      color: #ccc0a0;
      font-size: 0.9em;
      cursor: pointer;
    }
    #dmg-heal-dialog .half-row input[type="checkbox"] {
      accent-color: #bfa046;
      width: 14px;
      height: 14px;
    }
    #dmg-heal-dialog #apply-btn {
      width: 100%;
      padding: 9px 12px;
      font-size: 1em;
      cursor: pointer;
      border-radius: 6px !important;
      box-shadow: none !important;
      margin: 0 !important;
      transition: background 0.15s, border-color 0.15s, color 0.15s !important;
    }
    #dmg-heal-dialog #apply-btn.apply-damage {
      background: #3a1010 !important;
      color: #ff8080 !important;
      border: 1.5px solid #cc3333 !important;
    }
    #dmg-heal-dialog #apply-btn.apply-damage:hover {
      background: #4e1818 !important;
      border-color: #ff4444 !important;
      color: #ffaaaa !important;
    }
    #dmg-heal-dialog #apply-btn.apply-heal {
      background: #0e2a10 !important;
      color: #80cc80 !important;
      border: 1.5px solid #339933 !important;
    }
    #dmg-heal-dialog #apply-btn.apply-heal:hover {
      background: #183a18 !important;
      border-color: #44bb44 !important;
      color: #aaffaa !important;
    }
  </style>
  <div style="display:flex;flex-direction:column;gap:0;">
    <div class="section-label">🎯 Targets</div>
    <div class="target-names">${tokenNames}</div>
    <div class="mode-toggle">
      <button class="mode-btn active-damage" data-mode="damage">⚔️ Damage</button>
      <button class="mode-btn" data-mode="heal">💚 Heal</button>
    </div>
    <div class="section-label">Amount</div>
    <input id="dmg-amount" type="number" min="0" value="0" />
    <label class="half-row" id="half-row" style="">
      <input type="checkbox" id="half-check" /> Half (round down)
    </label>
    <button id="apply-btn" class="apply-damage">⚔️ Apply Damage</button>
  </div>`;

new Dialog({
  title: "⚔️ Damage / Heal",
  content,
  buttons: {},
  render: html => {
    html.closest('.app').attr('id', 'dmg-heal-dialog');

    let mode = 'damage';

    function updateUI() {
      const applyBtn = html.find('#apply-btn');
      const halfRow  = html.find('#half-row');
      if (mode === 'damage') {
        applyBtn.removeClass('apply-heal').addClass('apply-damage').text('⚔️ Apply Damage');
        halfRow.show();
      } else {
        applyBtn.removeClass('apply-damage').addClass('apply-heal').text('💚 Apply Healing');
        halfRow.hide();
      }
    }

    html.find('.mode-btn').on('click', function () {
      mode = $(this).data('mode');
      html.find('.mode-btn').removeClass('active-damage active-heal');
      $(this).addClass(mode === 'damage' ? 'active-damage' : 'active-heal');
      updateUI();
    });

    html.find('#apply-btn').on('click', function () {
      let amount = parseInt(html.find('#dmg-amount').val()) || 0;
      if (amount <= 0) {
        ui.notifications.warn("Enter an amount greater than 0.");
        return;
      }
      const half = mode === 'damage' && html.find('#half-check').is(':checked');
      if (half) amount = Math.floor(amount / 2);

      for (const token of controlled) {
        const actor = token.actor;
        if (!actor) continue;
        const hp = actor.system?.attributes?.hp;
        if (!hp) continue;
        const current = hp.value ?? 0;
        const max     = hp.max   ?? current;
        const min     = hp.min   ?? 0;
        const newVal  = mode === 'damage'
          ? Math.max(current - amount, min)
          : Math.min(current + amount, max);
        actor.update({ "system.attributes.hp.value": newVal });
      }

      const verb = mode === 'damage' ? 'Dealt' : 'Healed';
      const icon = mode === 'damage' ? '⚔️' : '💚';
      ui.notifications.info(`${icon} ${verb} ${amount} to ${controlled.map(t => t.name).join(', ')}`);
    });

    // Focus amount input on open
    setTimeout(() => html.find('#dmg-amount').focus().select(), 50);
  },
  default: "close"
}, { width: 300 }).render(true);
