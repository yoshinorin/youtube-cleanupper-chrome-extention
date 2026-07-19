let currentSettings = { ngWords: [], blockedChannels: [] };
let jsonEditorFocused = false;

function t(key) {
  return chrome.i18n.getMessage(key);
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  document.title = t('optionsTitle');
}

function saveSettings(settings) {
  chrome.storage.local.set({ settings });
}

function render() {
  renderNgWords();
  renderBlockedChannels();
  if (!jsonEditorFocused) {
    document.getElementById('json-editor').value = JSON.stringify(currentSettings, null, 2);
  }
}

function targetLabelKey(target) {
  if (target === 'title') return 'targetTitle';
  if (target === 'channel') return 'targetChannel';
  return 'targetBoth';
}

function renderEmptyRow(list) {
  const li = document.createElement('li');
  li.textContent = t('emptyList');
  list.appendChild(li);
}

function renderNgWords() {
  const list = document.getElementById('ng-word-list');
  list.innerHTML = '';

  if (currentSettings.ngWords.length === 0) {
    renderEmptyRow(list);
    return;
  }

  currentSettings.ngWords.forEach((entry, index) => {
    const li = document.createElement('li');

    const label = document.createElement('span');
    label.textContent = `${entry.word} (${t(targetLabelKey(entry.target))})`;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = t('remove');
    removeBtn.addEventListener('click', () => {
      currentSettings.ngWords.splice(index, 1);
      saveSettings(currentSettings);
    });

    li.appendChild(label);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

function renderBlockedChannels() {
  const list = document.getElementById('blocked-list');
  list.innerHTML = '';

  if (currentSettings.blockedChannels.length === 0) {
    renderEmptyRow(list);
    return;
  }

  currentSettings.blockedChannels.forEach((entry, index) => {
    const li = document.createElement('li');

    const label = document.createElement('span');
    label.textContent = entry.handle ? `${entry.name} (${entry.handle})` : entry.name;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = t('remove');
    removeBtn.addEventListener('click', () => {
      currentSettings.blockedChannels.splice(index, 1);
      saveSettings(currentSettings);
    });

    li.appendChild(label);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

function showStatus(key) {
  const el = document.getElementById('status-message');
  el.textContent = t(key);
  setTimeout(() => {
    el.textContent = '';
  }, 2000);
}

function loadSettings() {
  chrome.storage.local.get('settings', (data) => {
    currentSettings = normalizeSettings(data.settings);
    render();
  });
}

document.getElementById('ng-word-add').addEventListener('click', () => {
  const input = document.getElementById('ng-word-input');
  const select = document.getElementById('ng-word-target');
  const word = input.value.trim();
  if (!word) return;

  currentSettings.ngWords.push({ word, target: select.value });
  saveSettings(currentSettings);
  input.value = '';
});

const jsonEditor = document.getElementById('json-editor');
jsonEditor.addEventListener('focus', () => {
  jsonEditorFocused = true;
});
jsonEditor.addEventListener('blur', () => {
  jsonEditorFocused = false;
});

document.getElementById('json-apply').addEventListener('click', () => {
  const errorEl = document.getElementById('json-error');
  try {
    const parsed = JSON.parse(jsonEditor.value);
    const normalized = normalizeSettings(parsed);
    errorEl.textContent = '';
    saveSettings(normalized);
    showStatus('saved');
  } catch {
    errorEl.textContent = t('invalidJson');
  }
});

document.getElementById('export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(currentSettings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'youtube-cleanupper-settings.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('import-input').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const normalized = normalizeSettings(parsed);
      saveSettings(normalized);
      showStatus('saved');
      document.getElementById('json-error').textContent = '';
    } catch {
      document.getElementById('json-error').textContent = t('invalidJson');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    currentSettings = normalizeSettings(changes.settings.newValue);
    render();
  }
});

applyI18n();
loadSettings();
