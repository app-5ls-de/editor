//#region functions
var Delta = Quill.import('delta')

function copyDelta(delta) {
    if (!delta) return delta
    return new Delta(JSON.parse(JSON.stringify(delta)))
}


function getRemoteData(callback) {
        let sortQuery = ""
        if (state.private.LastSyncedId) { //typeof state.private.LastSyncedId == "number"
            sortQuery = "&q=id:>" + state.private.LastSyncedId
        }

        fetch('https://jsonbox.io/' + jsonboxIdentifier + state.private.id + "?limit=1000&sort=id" + sortQuery)
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
                state.private.changeSinceLastUpload = localChange.compose(state.private.changeSinceLastUpload)
            })
}


function setRemoteData(changesToUpload,callback) {
        if (!changesToUpload) {
            if (!state.private.changeSinceLastUpload) {
                syncStatus.set("neutral")
                return //nothing to do
            }
            changesToUpload = copyDelta(state.private.changeSinceLastUpload)
            state.private.changeSinceLastUpload = null
        }
        if (JSON.stringify(changesToUpload) == JSON.stringify(new Delta())){
            syncStatus.set("neutral")
            return // empty delta
        }
        if (!state.private.key) {
            syncStatus.set("error")
            return 
        }

        data = {
            type: "delta",
            delta: JSON.stringify(changesToUpload)
        }
        if (state.private.LastSyncedId) { //typeof state.private.LastSyncedId == "number"
            data.id = state.private.LastSyncedId
        } else {
            data.id = 0
        }
        data.id += Math.floor(Math.random() * 1000) + 1

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': state.private.key
            },
            body: JSON.stringify(data)
        }

        fetch('https://jsonbox.io/' + jsonboxIdentifier + state.private.id, options)
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
                state.private.changeSinceLastUpload = changesToUpload.compose(state.private.changeSinceLastUpload)
        })
}


function synchronize() {
    if (shared && syncStatus.isReady()) {
        syncStatus.set("running")

        localChange = copyDelta(state.private.changeSinceLastUpload)
        state.private.changeSinceLastUpload = null
        getRemoteData((data) => {
            response = data
            let changesToUpload = localChange

            if (response.length > 0) {
                let remoteChange = new Delta()
                for (let i = 0; i < response.length; i++) {
                    if (!response[i].type || response[i].type == "delta") {
                        remoteChange = remoteChange.compose(new Delta(JSON.parse(response[i].delta)))
                    }
                }

                if (localChange) {
                    let remoteChangeTransformed = localChange.transform(remoteChange)
                    quill.updateContents(remoteChangeTransformed, 'silent')

                    changesToUpload = remoteChange.transform(localChange, true) //localChange.compose(remoteChangeTransformed)
                } else {
                    quill.updateContents(remoteChange, 'silent')
                }

                state.private.LastSyncedId = response[response.length - 1].id
                saveToLocalStorage()
            }
            
            setRemoteData(changesToUpload, (data) => {
                state.private.LastSyncedId = data.id
                saveToLocalStorage()
                syncStatus.set("neutral")
            })
        })
    }
}


function parse(data) {
    let parsed = JSON.parse(data)

    parsed.private.changeSinceLastUpload = new Delta(parsed.private.changeSinceLastUpload)
    parsed.public.content = new Delta(parsed.public.content)

    if (JSON.stringify(parsed.private.changeSinceLastUpload) == JSON.stringify(new Delta())) parsed.private.changeSinceLastUpload = null // empty delta
    if (JSON.stringify(parsed.private.content) == JSON.stringify(new Delta())) parsed.private.content = null // empty delta

    return parsed
}


function saveToLocalStorage() {
    if (!shared && !localStorage.hasOwnProperty("local") && quill.getText() == "\n") return
    state.public.content = quill.getContents()
    state.private.LastModified = new Date()
    localStorage.setItem(state.private.id, JSON.stringify(state))
    state.private.LastModified = undefined
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
    isReady: function () {
        if (this.status == "neutral" || this.status == "success") return true
        return false
    },
    status: "neutral",
    set: function(newStatus) {
        if (this.status == newStatus) return

        if (!["neutral", "success", "error", "running", "offline"].includes(newStatus)){
            console.error("unkown status:" + newStatus)
            return
        }
        
        this.button.classList = newStatus
        this.status = newStatus
    }
}
    
if (shared) {
    window.addEventListener('online', handleConnection);
    window.addEventListener('offline', handleConnection);
    handleConnection()
    function handleConnection() { // https://stackoverflow.com/a/44766737
        function isReachable() {
            /**
             * Note: fetch() still "succeeds" for 404s on subdirectories,
             * which is ok when only testing for domain reachability.
             *
             * Example:
             *   https://google.com/noexist does not throw
             *   https://noexist.com/noexist does throw
             */
            return fetch("https://detectportal.firefox.com/success.txt", { method: 'HEAD', mode: 'no-cors' })
                .then(function(resp) {
                    return resp && (resp.ok || resp.type === 'opaque');
                })
                .catch(function(err) {
                    console.warn('[conn test failure]:', err);
                    syncStatus.set("offline")
                });
        }

        if (navigator.onLine) {
            isReachable().then(function(online) {
                if (online) {
                    // handle online status
                    console.log('online');
                    syncStatus.set("neutral")
                } else {
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

document.getElementById("print-button").addEventListener('click', () => { window.print() })

let toolbar = document.getElementById("toolbar-container")
var emoji_picker = new EmojiButton({
    'position': 'bottom-end',
    'autoHide': false,
    'autoFocusSearch': false
})

var LastSelection = { index: 0, length: 0 }
quill.on('editor-change', (eventName, range, oldRange, source) => {
    if (eventName === 'selection-change') {
        if (range) {
            LastSelection = range
        }
    }
})

function insertText(text) {
    quill.deleteText(LastSelection)
    let Selection = LastSelection // after quill.insertText 'editor-change' is emited -> save selection to transform with delta
    let delta = quill.insertText(LastSelection.index, text)
    quill.setSelection(delta.transformPosition(Selection.index), 0)
}

emoji_picker.on('emoji', insertText)
document.getElementById("emoji-button").addEventListener('click', () => { emoji_picker.togglePicker(toolbar) })


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





function ColorPickrButtonPress(){
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


    function ColorPickrSet(instance){
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
    if (shared) {
        if (!state.private.changeSinceLastUpload) {
            state.private.changeSinceLastUpload = new Delta()
        }
        state.private.changeSinceLastUpload = state.private.changeSinceLastUpload.compose(delta)
    }
    saveToLocalStorageThrottled()
})

document.getElementById("sync-button").addEventListener('click', () => { ifvisible.wakeup() })

//#endregion setup

//#region init

var jsonboxIdentifier = "imANthQVo4v4WZaGnpoC" + "_"
var state = {
    private: {
        key: undefined,
        id: "local",
        LastSyncedId: undefined,
        changeSinceLastUpload: undefined,
        title: undefined
    },
    public: {
        content: undefined
    }
}


if (shared) {
    const params = new URL(location.href).searchParams
    state.private.id = params.get('id')
    
    if (!isvalid_boxid(state.private.id)) {
        localStorage.removeItem(state.private.id)
        window.location.href = window.location.origin + "?error=invalidId"
    }

    if (localStorage.getItem(state.private.id)) {
        state = parse(localStorage.getItem(state.private.id))
    }

    let key = params.get('pwd')
    if (isvalid_uuid(key)) {
        state.private.key = key        
    }

    if (key){
        window.history.replaceState({}, document.title, "/shared?id=" + state.private.id );
    }
} else {
    if (localStorage.getItem(state.private.id)) {
        state = parse(localStorage.getItem(state.private.id))
    }
    syncStatus.button.style.display = "none"
}

if (state.private.title) {
    window.document.title += ' | ' + state.private.title
} else {
    window.document.title += ' | ' + state.private.id
}


if (shared && !state.private.key) { // if shared but no write-key 
    quill.disable()
} else {
    let element=document.getElementById("main-content")
    element.classList.remove("readonly")
    element.classList.add("readwrite")
}




if (!localStorage.getItem(state.private.id)) {
    saveToLocalStorage()
}


if (state.public.content) {
    quill.setContents(state.public.content, 'silent')
}

ifvisible.wakeup()


//#endregion init