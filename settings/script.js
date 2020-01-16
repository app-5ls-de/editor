
let storage = 'settings';
let json;

let cb_option = [];
cb_option[0] = document.getElementById("option1");
let div_options = document.getElementById("options");
let cb_master = document.getElementById("master");
let cb_autosave = document.getElementById("option1");

try {
  json = JSON.parse(window.localStorage.getItem(storage));
}
catch (err) {
  console.error(err);
  window.localStorage.clear();
}

if (json == null) {
  json = { 'enabled': false }
  window.localStorage.setItem(storage, JSON.stringify(json));
}

if (json.enabled) {
  cb_master.checked = true;
  if (json.autosave) {
    cb_autosave.checked = true;
  }
}
else {
  div_options.classList.add('disabled');
  for (opt of cb_option) {
    opt.disabled = true;
  }
}

function toggle_master() {
  if (cb_master.checked == true) {
    json.enabled = true;
    div_options.classList.remove('disabled');
    for (opt of cb_option) {
      opt.disabled = false;
    }
  } else {
    json = { 'enabled': false }
    div_options.classList.add('disabled');
    for (opt of cb_option) {
      opt.disabled = true;
      opt.checked = false;
    }
  }
  window.localStorage.setItem(storage, JSON.stringify(json));
}

function toggle_option() {
  if (cb_option[0].checked == true) {
    json.autosave = true;
  } else {
    json.autosave = false;
    window.localStorage.removeItem('smde_editor-autosave');
  }
  window.localStorage.setItem(storage, JSON.stringify(json));
}

cb_master.onclick = toggle_master;
for (opt of cb_option) {
  opt.onclick = toggle_option;
}

