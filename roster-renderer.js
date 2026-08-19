// The names editor. Main owns the list and every rule about it; this window
// just draws what it's given and sends intentions back.

(() => {
  const listEl = document.getElementById('list');
  const formEl = document.getElementById('add');
  const inputEl = document.getElementById('input');
  const noteEl = document.getElementById('note');

  let noteTimer = 0;

  function note(message) {
    noteEl.textContent = message;
    clearTimeout(noteTimer);
    if (message) noteTimer = setTimeout(() => (noteEl.textContent = ''), 2600);
  }

  // Built with DOM calls rather than innerHTML: these strings are typed by the
  // user, and one of them containing markup shouldn't mean anything.
  function row(entry, { lastChecked, onlyEntry }) {
    const li = document.createElement('li');

    const label = document.createElement('label');

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = entry.enabled;
    // Unchecking the last checked name would leave nothing to pick.
    box.disabled = lastChecked;
    box.addEventListener('change', () => window.roster.toggle(entry.name));

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = entry.name;

    label.append(box, name);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = '×';
    remove.title = onlyEntry ? 'The list can’t be empty' : `Delete ${entry.name}`;
    remove.disabled = onlyEntry;
    remove.addEventListener('click', () => window.roster.remove(entry.name));

    li.append(label, remove);
    return li;
  }

  function render(entries) {
    const checkedCount = entries.filter((entry) => entry.enabled).length;

    listEl.replaceChildren(
      ...entries.map((entry) =>
        row(entry, {
          lastChecked: entry.enabled && checkedCount === 1,
          onlyEntry: entries.length === 1,
        })
      )
    );
  }

  formEl.addEventListener('submit', async (event) => {
    event.preventDefault();

    const value = inputEl.value.trim();
    const result = await window.roster.add(value);

    if (result === 'duplicate') {
      note(`“${value}” is already on the list.`);
      inputEl.select();
      return;
    }

    if (result === 'ok') {
      inputEl.value = '';
      note('');
    }

    inputEl.focus(); // straight on to the next one
  });

  window.roster.onChange(render);

  // Asked for rather than waited for, so there's no race with the first push.
  window.roster.get().then(render);

  inputEl.focus();
})();
