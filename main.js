var jsonboxIdentifier = "v02" + "_"

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

    const regex_uuidv4 = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", "i");

    return regex_uuidv4.test(uuid)
}

function isvalid_boxid(boxid) {
    if (!boxid) return false
    if (typeof boxid != "string") return false
    if (boxid.length < 20) return false
    if (boxid == "local" || boxid == "null" || boxid == "settings" || boxid == "emojiPicker.recent") return false

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

function createRandomWord(length, seed) { //https://jsfiddle.net/amando96/XjUJM/
    function mulberry32(a) { //https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
        return function() {
            a |= 0;
            a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    function getHash(input) { //https://stackoverflow.com/a/40958826
        input = new String(input);
        var hash = 0,
            len = input.length;
        for (var i = 0; i < len; i++) {
            hash = ((hash << 5) - hash) + input.charCodeAt(i);
            hash |= 0; // to 32bit integer
        }
        return hash;
    }


    if (!seed) seed = Math.random()
    let generator = mulberry32(getHash(seed))

    var consonants = 'bcdfghjlmnpqrstv',
        vowels = 'aeiou',
        rand = function(limit) {
            return Math.floor(generator() * limit);
        },
        i, word = '',
        length = parseInt(length, 10),
        consonants = consonants.split(''),
        vowels = vowels.split('');
    for (i = 0; i < length / 2; i++) {
        var randConsonant = consonants[rand(consonants.length)],
            randVowel = vowels[rand(vowels.length)];
        word += (i === 0) ? randConsonant.toUpperCase() : randConsonant;
        word += i * 2 < length - 1 ? randVowel : '';
    }
    return word;
}