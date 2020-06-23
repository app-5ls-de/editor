function uuid() {
    function b(a) { return a ? (a ^ Math.random() * 16 >> a / 4).toString(16) : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, b) }/* https://gist.github.com/jed/982883 */
    return b()
}

function throttle(callback, delay) {
    let throttleTimeout = null;
    let storedEvent = null;

    const throttledEventHandler = event => {
        storedEvent = event;

        const shouldHandleEvent = !throttleTimeout;
        if (shouldHandleEvent) {

            throttleTimeout = setTimeout(() => {
                throttleTimeout = null;

                if (storedEvent) {
                    callback(storedEvent);
                    storedEvent = null;
                }
            }, delay);
        }
    };

    return throttledEventHandler;
}

var Delta = Quill.import('delta');
var quill = new Quill('#editor-container', {
    modules: {
        toolbar: {
            container: '#toolbar-container',
            handlers: {
                'undo': function (value) { quill.history.undo() },
                'redo': function (value) { quill.history.redo() },
            }
        },
        history: {}
    },
    scrollingContainer: '#scrolling-container',
    placeholder: 'Write...',
    readOnly: false,
    theme: 'snow'
});

const data = localStorage.getItem('content');
if (data) {
    quill.setContents(JSON.parse(data))
}


var change = new Delta();
quill.on('text-change', function (delta) {
    change = change.compose(delta)
    saveToLocalStorage('text-change')
});

var saveToLocalStorage = throttle(function (trigger) {
    if (change.length() > 0) {
        const data = JSON.stringify(quill.getContents())
        localStorage.setItem('content', data);
        change = new Delta();
    }
}, 3000);
