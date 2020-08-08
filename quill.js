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


function saveToLocalStorage() {
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
var last_selection
quill.on('selection-change', function(range, oldRange, source) {
    if (range) {
        last_selection = range
    }
})

emoji_picker.on('emoji', emoji => {
    quill.deleteText(last_selection)
    let delta = quill.insertText(last_selection.index, emoji)
    quill.setSelection(delta.transformPosition(last_selection.index), 0);
})
document.getElementById("emoji-button").addEventListener('click', () => {
    emoji_picker.togglePicker(toolbar);
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


document.getElementById("font-color").onclick = ColorPickrButtonPress
document.getElementById("background-color").onclick = ColorPickrButtonPress

if (shared) {
    const params = new URL(location.href).searchParams
    state.private.id = params.get('id')
    state.private.key = params.get('pwd')
    if (!state.private.id || state.private.id.length < 20) {
        window.location.href = window.location.origin
    }
}


if (localStorage.getItem(state.private.id)) {
    state = parse(localStorage.getItem(state.private.id))
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
