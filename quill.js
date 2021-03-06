//#region functions
var Delta = Quill.import('delta')

function copyDelta(delta) {
    if (!delta) return delta
    return new Delta(JSON.parse(JSON.stringify(delta)))
}


function getRemoteData(callback) {
    let sortQuery = ""
    if (state.LastSyncedId) { //typeof state.LastSyncedId == "number"
        sortQuery = "&q=id:>" + state.LastSyncedId
    }

    fetch(jsonboxOrigin + '/' + state.jsonboxIdentifier + state.id + "?limit=1000&sort=id" + sortQuery)
        .then((response) => {
            if (response.ok) {
                return Promise.resolve(response)
            } else {
                return Promise.reject(new Error(response.statusText))
            }
        })
        .then((response) => {
            return response.json()
        })
        .then(callback)
        .catch((error) => {
            console.log('Request failed', error)
            syncStatus.set("error")
            state.changeSinceLastUpload = localChange.compose(state.changeSinceLastUpload)
        })
}


function setRemoteData(changesToUpload, callback) {
    let data
    if (!changesToUpload || JSON.stringify(changesToUpload) == JSON.stringify(new Delta())) {
        if (state.titleUpdate) {
            data = {
                type: "title",
                title: state.title
            }
            state.titleUpdate = undefined
        } else {
            if (state.changeSinceLastUpload) {
                syncStatus.set("neutral")
            } else {
                syncStatus.set("success")
            }
            return // empty delta
        }
    } else {
        data = {
            type: "delta",
            delta: JSON.stringify(changesToUpload)
        }
    }

    

    if (!state.key) {
        syncStatus.set("error")
        return
    }

    if (state.LastSyncedId) { //typeof state.LastSyncedId == "number"
        data.id = state.LastSyncedId
    } else {
        data.id = 0
    }
    data.id += Math.floor(Math.random() * 1000) + 1

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': state.key
        },
        body: JSON.stringify(data)
    }

    fetch(jsonboxOrigin + '/' + state.jsonboxIdentifier + state.id, options)
        .then((response) => {
            if (response.ok) {
                return Promise.resolve(response)
            } else {
                return Promise.reject(new Error(response.statusText))
            }
        })
        .then((response) => {
            return response.json()
        })
        .then(callback)
        .catch((error) => {
            console.log('Request failed', error)
            syncStatus.set("error")
            state.changeSinceLastUpload = changesToUpload.compose(state.changeSinceLastUpload)
        })
}


function synchronize() {
    if (shared && syncStatus.isReady()) {
        syncStatus.set("running")

        changesToUpload = copyDelta(state.changeSinceLastUpload)
        state.changeSinceLastUpload = null
        getRemoteData((data) => {
            if (data.length > 0) {
                let remoteChange = new Delta()
                let LastId
                for (let i = 0; i < data.length; i++) {
                    if (data[i].type) {
                        if (data[i].type == "delta") {
                            remoteChange = remoteChange.compose(new Delta(JSON.parse(data[i].delta)))
                        } else if (data[i].type == "title") {
                            state.title = data[i].title
                        }
                        LastId = data[i].id
                    }
                }

                if (changesToUpload) {
                    let remoteChangeTransformed = changesToUpload.transform(remoteChange)
                    quill.updateContents(remoteChangeTransformed, 'silent')

                    changesToUpload = remoteChange.transform(changesToUpload, true)
                } else {
                    quill.updateContents(remoteChange, 'silent')
                }

                if (LastId) {
                    state.LastSyncedId = LastId
                    saveToLocalStorage()
                }
            }
            

            if (!changesToUpload) {
                if (!state.changeSinceLastUpload && !state.titleUpdate) {
                    syncStatus.set("success")
                    return //nothing to do
                }
                changesToUpload = copyDelta(state.changeSinceLastUpload)
                state.changeSinceLastUpload = null
            } else if (state.changeSinceLastUpload) {
                changesToUpload = changesToUpload.compose(state.changeSinceLastUpload)
                state.changeSinceLastUpload = null
            }

            setRemoteData(changesToUpload, (data) => {
                state.LastSyncedId = data.id
                saveToLocalStorage()

                if (state.changeSinceLastUpload) {
                    syncStatus.set("neutral")
                } else {
                    syncStatus.set("success")
                }
            })
        })
    }
}


function parse(data) {
    let parsed = JSON.parse(data)

    parsed.changeSinceLastUpload = new Delta(parsed.changeSinceLastUpload)
    parsed.content = new Delta(parsed.content)

    if (JSON.stringify(parsed.changeSinceLastUpload) == JSON.stringify(new Delta())) parsed.changeSinceLastUpload = null // empty delta
    if (JSON.stringify(parsed.content) == JSON.stringify(new Delta())) parsed.content = null // empty delta

    return parsed
}


function saveToLocalStorage() {
    if (!shared && !localStorage.hasOwnProperty("local") && quill.getText() == "\n") return
    state.content = quill.getContents()
    state.LastModified = new Date()
    localStorage.setItem(state.id, JSON.stringify(state))
    state.LastModified = undefined
}

var saveToLocalStorageThrottled = throttle(saveToLocalStorage, 1000 * 1)
var synchronizeThrottled = throttle(synchronize, 1000 * 1)

ifvisible.setIdleDuration(30)
var synchronizeInterval

ifvisible.idle(function() {
    clearInterval(synchronizeInterval)
    synchronizeInterval = null
});

ifvisible.wakeup(function() {
    synchronizeThrottled()
    if (synchronizeInterval) {
        clearInterval(synchronizeInterval)
        synchronizeInterval = null
    }

    synchronizeInterval = setInterval(synchronizeThrottled, 30 * 1000) // If page is visible run this function on every 30 seconds
});

var syncStatus = {
    button: document.getElementById("sync-button"),
    isReady: function() {
        if (this.status == "neutral" || this.status == "success") return true
        return false
    },
    isEnabled: function() {
        return this.status != "disabled"
    },
    status: "neutral",
    set: function(newStatus) {
        if (this.status == newStatus) return

        if (!["neutral", "success", "error", "running", "offline", "disabled"].includes(newStatus)) {
            console.error("unkown status:" + newStatus)
            return
        }

        this.button.classList = newStatus
        this.status = newStatus
    }
}

function handleConnection() { // https://stackoverflow.com/a/44766737
    function isReachable(url) {
        /**
         * Note: fetch() still "succeeds" for 404s on subdirectories,
         * which is ok when only testing for domain reachability.
         *
         * Example:
         *   https://google.com/noexist does not throw
         *   https://noexist.com/noexist does throw
         */
        return fetch(url, {
                method: 'HEAD',
                mode: 'no-cors'
            })
            .then(function(resp) {
                return resp && (resp.ok || resp.type === 'opaque');
            })
            .catch(function(err) {
                console.warn('[conn test failure]:', err);
                syncStatus.set("offline")
            });
    }

    if (navigator.onLine) {
        isReachable(jsonboxOrigin).then(function(online) {
            if (online) {
                // handle online status
                console.log('online');
                ifvisible.wakeup()
                syncStatus.set("neutral")
            } else {
                isReachable("https://detectportal.firefox.com/success.txt").then(function(online) {
                    if (online) {
                        // firefox isReachable but jsonbox is not
                        console.log('error');
                        syncStatus.set("error")
                    } else {
                        console.log('no connectivity');
                        syncStatus.set("offline")
                    }
                });

                console.log('no connectivity');
                syncStatus.set("offline")
            }
        });
    } else {
        // handle offline status
        console.log('offline');
        syncStatus.set("offline")
    }
}


//#endregion functions

//#region setup


let quillOptions = {
    modules: {
        toolbar: {
            container: '#toolbar-container',
            handlers: {
                'undo': function() {
                    quill.history.undo()
                },
                'redo': function() {
                    quill.history.redo()
                }
            }
        },
        history: {}
    },
    placeholder: 'Write...',
    readOnly: false,
    theme: 'snow'
}
var quill = new Quill('#editor-container', quillOptions)

document.getElementById("print-button").addEventListener('click', () => {
    window.print()
})

window.addEventListener("beforeprint", function(e) { quill.blur() })

var mediaQueryList = window.matchMedia('print');
mediaQueryList.addListener(function(mql) {
  if(mql.matches) {
    // webkit equivalent of onbeforeprint
    quill.blur()
  }
})


let toolbar = document.getElementById("toolbar-container")
var emoji_picker = new EmojiButton({
    'position': 'bottom-end',
    'autoHide': false,
    'autoFocusSearch': false
})

var LastSelection = {
    index: 0,
    length: 0
}
quill.on('editor-change', (eventName, range, oldRange, source) => {
    if (eventName === 'selection-change') {
        if (range) {
            LastSelection = range
        }
    }
})

function insertText(text) {
    console.log(text)
    quill.deleteText(LastSelection)
    let Selection = LastSelection // after quill.insertText 'editor-change' is emited -> save selection to transform with delta
    let delta = quill.insertText(LastSelection.index, text)
    quill.setSelection(delta.transformPosition(Selection.index), 0)
}

emoji_picker.on('emoji', function (e){ insertText(e.emoji)})
document.getElementById("emoji-button").addEventListener('click', () => {
    emoji_picker.togglePicker(toolbar)
})


var color_picker = {}

color_picker.options = {
    useAsButton: true,
    theme: 'nano',
    position: 'bottom-middle',
    adjustableNumbers: false,
    padding: 8,

    swatches: [
        '#001f3f',
        '#0074D9',
        '#7FDBFF',
        '#39CCCC',
        '#3D9970',
        '#2ECC40',
        '#01FF70',
        '#FFDC00',
        '#FF851B',
        '#FF4136',
        '#85144b',
        '#F012BE',
        '#B10DC9',
        '#111111',
        '#AAAAAA',
        '#DDDDDD',
        '#FFFFFF'
    ],

    components: {
        preview: true,
        lockOpacity: true,
        hue: true,
        interaction: {
            input: true
        }
    }
}





function ColorPickrButtonPress() {
    color_picker.id = this.id
    color_picker.options.el = '#' + this.id

    color_picker.pickr = Pickr.create(color_picker.options)

    color_picker.pickr.on('save', (color, instance) => {
        ColorPickrSet(instance)
    }).on('changestop', instance => {
        ColorPickrSet(instance)
    }).on('swatchselect', (color, instance) => {
        ColorPickrSet(instance)
    }).on('hide', (color, instance) => {
        instance.destroyAndRemove()
    })


    color_picker.pickr.show()


    function ColorPickrSet(instance) {
        let hex = instance._color.toHEXA().toString()
        let format
        if (color_picker.id == "background-color") {
            format = "background"
        } else if (color_picker.id == "font-color") {
            format = "color"
        } else return
        quill.format(format, hex);
    }
}

document.getElementById("font-color").addEventListener('click', ColorPickrButtonPress)
document.getElementById("background-color").addEventListener('click', ColorPickrButtonPress)

quill.on('text-change', function(delta) {
    if (syncStatus.isReady()) syncStatus.set("neutral")
    if (shared) {
        if (!state.changeSinceLastUpload) {
            state.changeSinceLastUpload = new Delta()
        }
        state.changeSinceLastUpload = state.changeSinceLastUpload.compose(delta)
    }
    saveToLocalStorageThrottled()
})

syncStatus.button.addEventListener('click', () => {
    ifvisible.wakeup()
    if (syncStatus.isReady()) syncStatus.set("neutral")
})

document.onkeydown = function(e) {
    if (e.ctrlKey && e.key == "s") {
        console.log("Strg+s")
        ifvisible.wakeup()
        if (syncStatus.isReady()) syncStatus.set("neutral")
        return false;
    }
};

//#endregion setup

//#region init

var jsonboxOrigin = "https://jsonbox.io"
var state = {
    jsonboxIdentifier: jsonboxIdentifier,
    key: undefined,
    id: "local",
    LastSyncedId: undefined,
    changeSinceLastUpload: undefined,
    title: undefined,
    content: undefined
}


if (shared) {
    const params = new URL(location.href).searchParams
    state.id = params.get('id')

    if (!isvalid_boxid(state.id)) {
        localStorage.removeItem(state.id)
        window.location.href = window.location.origin + "?error=invalidId"
    }

    if (localStorage.getItem(state.id)) {
        oldState = parse(localStorage.getItem(state.id))
        oldState.id = state.id
        if (!oldState.jsonboxIdentifier || oldState.jsonboxIdentifier != state.jsonboxIdentifier) {
            syncStatus.set("disabled")
            if (oldState.public) {
                oldState.content = oldState.public.content
            }
            oldState.public = undefined
            oldState.private = undefined
            oldState.key = undefined
        }
        state = oldState
    }

    let key = params.get('pwd')
    if (isvalid_uuid(key) && syncStatus.isEnabled()) {
        state.key = key
    }

    if (key) {
        window.history.replaceState({}, document.title, "/shared?id=" + state.id);
    }
} else {
    if (localStorage.getItem(state.id)) {
        state = parse(localStorage.getItem(state.id))
    }
    syncStatus.set("disabled")
}

if (syncStatus.isEnabled()) {
    window.addEventListener('online', handleConnection);
    window.addEventListener('offline', handleConnection);
    handleConnection()
}


if (shared && !state.key) { // if shared but no write-key 
    quill.disable()
} else {
    let element = document.getElementById("main-content")
    element.classList.remove("readonly")
    element.classList.add("readwrite")
}



if (!localStorage.getItem(state.id)) {
    state.title = createRandomWord(6, state.id)
    saveToLocalStorage()
}


if (state.title) {
    window.document.title += ' | ' + state.title
} else {
    window.document.title += ' | ' + state.id
}


if (state.content) {
    quill.setContents(state.content, 'silent')
}


//#endregion init
