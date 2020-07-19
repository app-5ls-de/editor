if ("Quill" in window) {
    var Delta = Quill.import('delta')
}

let noscript = document.getElementById("noscript");
noscript.parentNode.removeChild(noscript);

function random_uuid() {
    function b(a) {
        return a ? (a ^ Math.random() * 16 >> a / 4).toString(16) : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, b)
    } /* https://gist.github.com/jed/982883 */
    return b()
}

function random_boxid() {
    let length = 20
    let result = [],
        characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < length; i++) {
        result.push(characters.charAt(Math.floor(Math.random() * characters.length)))
    }
    return result.join('')
}

function isvalid_uuid(uuid) {
    if (!uuid) return false
    if (typeof uuid != "string") return false
    if (uuid.length = 0) return false

    /* const regex = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", "i"); */
    const regex_uuidv4 = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", "i");

    return regex_uuidv4.test(uuid)
}

function isvalid_boxid(boxid) {
    if (!boxid) return false
    if (typeof boxid != "string") return false
    if (boxid.length == 0) return false
    if (boxid == "local" || boxid == "null" || boxid == "settings") return false

    return true
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

function copyDelta(delta) {
    if (!delta) return delta
    return new Delta(JSON.parse(JSON.stringify(delta)))
}