var Delta = Quill.import('delta')

function copyDelta(delta) {
    if (!delta) return delta
    return new Delta(JSON.parse(JSON.stringify(delta)))
}

var jsonboxIdentifier = "7PtWsjtDv4VTB4PStlLF" + "_"
var state = {
    private: {
        key: undefined,
        id: "local",
        LastSyncedId: undefined,
        changeSinceLastUpload: undefined
    },
    public: {
        content: undefined
    }
}


function getRemoteData() {
    if (shared) {
        localChange = copyDelta(state.private.changeSinceLastUpload)
        state.private.changeSinceLastUpload = null
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
            .then(function(response) {
                //console.log('Request succeeded with JSON response', response)
                let changesToUpload = localChange

                if (response.length > 0) {
                    //console.log("should now apply changes: ", response)
                    let remoteChange = new Delta()
                    for (let i = 0; i < response.length; i++) {
                        remoteChange = remoteChange.compose(new Delta(JSON.parse(response[i].delta)))
                        //quill.updateContents(JSON.parse(response[i].delta), 'silent')
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
                setRemoteData(changesToUpload)
            }).catch(function(error) {
                console.log('Request failed', error)
                state.private.changeSinceLastUpload = localChange.compose(state.private.changeSinceLastUpload)
            })
    }
}


function setRemoteData(changesToUpload) {
    if (shared) {
        if (!changesToUpload) {
            if (!state.private.changeSinceLastUpload) return //nothing to do
            changesToUpload = copyDelta(state.private.changeSinceLastUpload)
            state.private.changeSinceLastUpload = null
        }
        if (JSON.stringify(changesToUpload) == JSON.stringify(new Delta())) return // empty delta
        if (!state.private.key) return

        console.log(1234)
        data = {
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
            .then(function(response) {
                //console.log('Request succeeded with JSON response', response)
                state.private.LastSyncedId = data.id
                /* state.private.changeSinceLastUpload = null */
                saveToLocalStorage()
            }).catch(function(error) {
                console.log('Request failed', error)
                state.private.changeSinceLastUpload = changesToUpload.compose(state.private.changeSinceLastUpload)
            })
    }
}


function synchronize() {
    getRemoteData()
}


function parse(data) {
    let parsed = JSON.parse(data)

    parsed.private.changeSinceLastUpload = new Delta(parsed.private.changeSinceLastUpload)
    parsed.public.content = new Delta(parsed.public.content)

    if (JSON.stringify(parsed.private.changeSinceLastUpload) == JSON.stringify(new Delta())) parsed.private.changeSinceLastUpload = null // empty delta
    if (JSON.stringify(parsed.private.content) == JSON.stringify(new Delta())) parsed.private.content = null // empty delta

    return parsed
}


function share() {
    let oldId = state.private.id
    state.private.id = random_boxid()
    state.private.key = random_uuid()
    state.private.changeSinceLastUpload = quill.getContents()
    saveToLocalStorage()
    localStorage.removeItem(oldId)

    window.location.href = window.location.origin + "/shared?id=" + state.private.id + "&pwd=" + state.private.key
}


function saveToLocalStorage() {
    if (!shared && quill.getText() == "\n") {return}
    state.public.content = quill.getContents()
    state.private.LastModified = new Date()
    localStorage.setItem(state.private.id, JSON.stringify(state))
    state.private.LastModified = undefined
}


var saveToLocalStorageHandler = throttle(saveToLocalStorage, 1000 * 1)
var synchronizeHandler = throttle(synchronize, 1000 * 10)


ifvisible.onEvery(15, synchronizeHandler) // If page is visible run this function on every 15 seconds


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
                },
                'share': share,
                'home': function(){
                    location.href = location.origin
                }
            }
        },
        history: {}
    },
    scrollingContainer: '#scrolling-container',
    placeholder: 'Write...',
    readOnly: false,
    theme: 'snow'
}

if (shared) {
    const params = new URL(location.href).searchParams
    state.private.id = params.get('id')
    state.private.key = params.get('pwd')
    if (!state.private.id || state.private.id.length < 20) {
        window.location.href = window.location.origin
    }
} else {
    document.getElementById("shareButton").style.display = "unset"
}


if (localStorage.getItem(state.private.id)) {
    state = parse(localStorage.getItem(state.private.id))
}

document.getElementById("toolbar-container").style.display = "flex"
if (shared && !state.private.key) { // if shared but no write-key 
    quillOptions.readOnly = true
    quillOptions.placeholder = ''
    var sheet = window.document.styleSheets[0];
    sheet.insertRule('.ql-editor>*{cursor:default!important}', sheet.cssRules.length);
    sheet.insertRule('hr.divider{display:none}', sheet.cssRules.length);
    document.getElementById("toolbar-container").style.display = "none"
} else {}

var quill = new Quill('#editor-container', quillOptions)


if (!localStorage.getItem(state.private.id)) {
    saveToLocalStorage()
}


if (state.public.content) {
    quill.setContents(state.public.content, 'silent')
}
if (shared) synchronize()



quill.on('text-change', function(delta) {
    if (shared) {
        if (!state.private.changeSinceLastUpload) {
            state.private.changeSinceLastUpload = new Delta()
        }
        state.private.changeSinceLastUpload = state.private.changeSinceLastUpload.compose(delta)
    }
    saveToLocalStorageHandler()
    synchronizeHandler()
})
