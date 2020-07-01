function random_uuid() {
    function b(a) { return a ? (a ^ Math.random() * 16 >> a / 4).toString(16) : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, b) }/* https://gist.github.com/jed/982883 */
    return b()
}


function random_boxid() {
    let length = 20
    let result = [], characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < length; i++) {
        result.push(characters.charAt(Math.floor(Math.random() * characters.length)))
    }
    return result.join('')
}


function throttle(callback, delay) {
    let throttleTimeout = null
    let storedEvent = null

    const throttledEventHandler = event => {
        if (event) {
            storedEvent = event
        } else {
            storedEvent = null
        }

        const shouldHandleEvent = !throttleTimeout
        if (shouldHandleEvent) {
            throttleTimeout = setTimeout(() => {
                throttleTimeout = null

                if (storedEvent || storedEvent === null) {
                    callback(storedEvent)
                    storedEvent = undefined
                }
            }, delay)
        }
    }
    return throttledEventHandler
}


var jsonboxIdentifier = "6TNXdKYzJG6rfO9KEl6b" + "_"
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
        let sortQuery = ""
        if (state.private.LastSyncedId) { //typeof state.private.LastSyncedId == "number"
            sortQuery = "&q=id:>" + state.private.LastSyncedId
        }

        fetch('https://jsonbox.io/' + jsonboxIdentifier + state.private.id + "?sort=id" + sortQuery)
            .then((response) => {
                if (response.ok) {
                    return Promise.resolve(response)
                } else {
                    return Promise.reject(new Error(response.statusText))
                }
            })
            .then((response) => { return response.json() })
            .then(function (response) {
                //console.log('Request succeeded with JSON response', response)
                if (response.length > 0) {
                    //console.log("should now apply changes: ", response)
                    for (let i = 0; i < response.length; i++) {
                        quill.updateContents(JSON.parse(response[i].delta), 'silent')
                    }
                    state.private.LastSyncedId = response[response.length - 1].id
                    saveToLocalStorage()
                }
            }).catch(function (error) {
                console.log('Request failed', error)
            })
    }
}


function setRemoteData() {
    if (shared) {
        if (!state.private.changeSinceLastUpload) return //nothing to do
        if (JSON.stringify(state.private.changeSinceLastUpload) == JSON.stringify(new Delta())) {
            state.private.changeSinceLastUpload = null
            return
        } // empty delta

        data = {
            delta: JSON.stringify(state.private.changeSinceLastUpload)
        }
        if (state.private.LastSyncedId) { //typeof state.private.LastSyncedId == "number"
            data.id = state.private.LastSyncedId + 1
        } else {
            data.id = 1
        }

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
            .then((response) => { return response.json() })
            .then(function (response) {
                //console.log('Request succeeded with JSON response', response)
                state.private.LastSyncedId = data.id
                state.private.changeSinceLastUpload = null
                saveToLocalStorage()
            }).catch(function (error) {
                console.log('Request failed', error)
            })
    }
}


function synchronize(reloaded) {
    if (state.private.changeSinceLastUpload) {
        setRemoteData()
    } else {
        if (reloaded) {
            getRemoteData()
        }
    }
}


function parse(data) {
    let parsed = JSON.parse(data)
    //console.log('before', parsed)
    parsed.private.changeSinceLastUpload = new Delta(parsed.private.changeSinceLastUpload)
    state.public.content = new Delta(parsed.public.content)
    //console.log('after', parsed)
    return parsed
}


function init() {
    if (shared) {
        const params = new URL(location.href).searchParams
        state.private.id = params.get('id')
        state.private.key = params.get('pwd')
        if (!state.private.id || state.private.id.length < 20) { window.location.href = window.location.origin }

        document.getElementById("syncButtons").style.display = "unset"
    } else {
        document.getElementById("shareButton").style.display = "unset"
    }

    const data = localStorage.getItem(state.private.id)
    if (data) {
        state = parse(data)
    } else {
        saveToLocalStorage()
    }
    // if read-only only show download button
    // if write-only (read-only master) only show upload button

    if (state.public.content) {
        quill.setContents(state.public.content, 'silent')
    }
    if (shared) synchronize(true)
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
    state.public.content = quill.getContents()
    localStorage.setItem(state.private.id, JSON.stringify(state))
}


var saveToLocalStorageHandler = throttle(saveToLocalStorage, 1000)
var downloadHandler = throttle(getRemoteData, 10000)
var uploadHandler = throttle(setRemoteData, 10000)
var synchronizeHandler = throttle(synchronize, 10000)


var Delta = Quill.import('delta')
var quill = new Quill('#editor-container', {
    modules: {
        toolbar: {
            container: '#toolbar-container',
            handlers: {
                'undo': function () { quill.history.undo() },
                'redo': function () { quill.history.redo() },
                'download': downloadHandler,
                'upload': uploadHandler,
                'synchronize': synchronizeHandler,
                'share': share
            }
        },
        history: {}
    },
    scrollingContainer: '#scrolling-container',
    placeholder: 'Write...',
    readOnly: false,
    theme: 'snow'
})
init()


quill.on('text-change', function (delta) {
    //console.log('text-change event')
    if (shared) {
        if (!state.private.changeSinceLastUpload) {
            state.private.changeSinceLastUpload = new Delta()
        }
        state.private.changeSinceLastUpload = state.private.changeSinceLastUpload.compose(delta)
    }
    saveToLocalStorageHandler()
    synchronizeHandler()
})
