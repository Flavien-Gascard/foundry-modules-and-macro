// === TOKEN LIGHT PICKER MACRO ===
// Sets light source on all controlled tokens.

function tokenUpdate(data) {
  canvas.tokens.controlled.forEach(token => token.document.update({ light: data }));
}

const lightSources = {
  none:          { label: "None",                    dim: 0,   bright: 0 },
  torch:         { label: "Torch",                   dim: 40,  bright: 20, animation: { type: "torch",   speed: 8, intensity: 5 }, color: "#ff9900" },
  light:         { label: "Light Cantrip",            dim: 40,  bright: 20, animation: { type: "none" } },
  lamp:          { label: "Lamp",                    dim: 45,  bright: 15, animation: { type: "torch",   speed: 1, intensity: 1 } },
  bullseye:      { label: "Bullseye Lantern",        dim: 120, bright: 60, angle: 45, animation: { type: "flicker", speed: 1, intensity: 1 } },
  hoodedOpen:    { label: "Hooded Lantern (Open)",   dim: 60,  bright: 30, animation: { type: "torch",   speed: 1, intensity: 1 } },
  hoodedClosed:  { label: "Hooded Lantern (Closed)", dim: 5,   bright: 0,  animation: { type: "torch",   speed: 1, intensity: 1 } },
  darkness:      { label: "Darkness Spell",          dim: 0,   bright: 15, luminosity: -0.5, animation: { type: "none" } }
};

const content = `
  <style>
    #token-light-dialog .window-header {
      background: linear-gradient(135deg, #1a0e00, #2e1a00) !important;
      border-bottom: 2px solid #bfa046 !important;
    }
    #token-light-dialog .window-content {
      background: #12100e !important;
      padding: 12px !important;
    }
    #token-light-dialog .light-hint {
      color: #bfa046;
      font-family: 'Papyrus', serif;
      font-size: 0.8em;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    #token-light-dialog .dialog-buttons {
      display: flex !important;
      flex-direction: column !important;
      gap: 5px !important;
      padding: 8px 12px 12px !important;
      background: #12100e !important;
      border-top: 1px solid #3a2a0b !important;
    }
    #token-light-dialog .dialog-buttons button {
      width: 100% !important;
      padding: 7px 12px !important;
      text-align: left !important;
      background: #1e1a12 !important;
      color: #ccc0a0 !important;
      border: 1px solid #3a2a0b !important;
      border-radius: 5px !important;
      font-size: 0.95em !important;
      cursor: pointer !important;
      transition: background 0.15s, border-color 0.15s, color 0.15s !important;
      box-shadow: none !important;
      margin: 0 !important;
    }
    #token-light-dialog .dialog-buttons button:hover {
      background: #2e2010 !important;
      border-color: #bfa046 !important;
      color: #ffe08a !important;
    }
    #token-light-dialog .dialog-buttons button:active {
      background: #3a2800 !important;
      color: #fff !important;
    }
    #token-light-dialog .dialog-buttons button[data-button="close"] {
      border-color: #5a2a2a !important;
      color: #a08080 !important;
    }
    #token-light-dialog .dialog-buttons button[data-button="close"]:hover {
      background: #2e1010 !important;
      border-color: #bf4646 !important;
      color: #ffaaaa !important;
    }
  </style>
  <div class="light-hint">🕯️ Light Source</div>
  <p style="color:#ccc0a0;font-size:0.95em;margin:0 0 4px;">Select a light source for all controlled tokens.</p>`;

const buttons = Object.fromEntries(
  Object.entries(lightSources).map(([key, data]) => [
    key, { label: data.label, callback: () => tokenUpdate({ angle: 360, luminosity: 0.5, ...data }) }
  ])
);
buttons.close = { icon: "<i class='fas fa-times'></i>", label: "Close" };

new Dialog({
  title: "🕯️ Token Light Picker",
  content,
  buttons,
  default: "close",
  render: html => {
    html.closest('.app').attr('id', 'token-light-dialog');
  },
  close: () => {}
}, { width: 280 }).render(true);
