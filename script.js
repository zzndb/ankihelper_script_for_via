// Polyfill caretRangeFromPoint() using the newer caretPositionFromPoint()
if (!document.caretRangeFromPoint){
    document.caretRangeFromPoint = function polyfillcaretRangeFromPoint(x,y){
        let range = document.createRange();
        let position = document.caretPositionFromPoint(x,y);
        if (!position) {
            return null;
        }
        range.setStart(position.offsetNode, position.offset);
        range.setEnd(position.offsetNode, position.offset);
        return range;
    };
}

class TextSourceElement {
    constructor(element, length=-1) {
        this.element = element;
        this.length = length;
    }

    clone() {
        return new TextSourceElement(this.element, this.length);
    }

    text() {
        const text = this.textRaw();
        return this.length < 0 ? text : text.substring(0, this.length);
    }

    textRaw() {
        switch (this.element.nodeName) {
            case 'BUTTON':
                return this.element.innerHTML;
            case 'IMG':
                return this.element.getAttribute('alt');
            default:
                return this.element.value;
        }
    }

    setStartOffset(length) {
        // NOP
        return 0;
    }

    setEndOffset(length) {
        this.length = length;
        return length;
    }

    containsPoint(point) {
        const rect = this.getRect();
        return point.x >= rect.left && point.x <= rect.right;
    }

    getRect() {
        return this.element.getBoundingClientRect();
    }

    select() {
        // NOP
    }

    deselect() {
        // NOP
    }

    equals(other) {
        return other.element && other.textRaw() == this.textRaw();
    }
}

class TextSourceRange {
    constructor(range) {
        this.rng = range;
    }

    clone() {
        return new TextSourceRange(this.rng.cloneRange());
    }

    text() {
        return this.rng.toString();
    }

    //set English words offset by words count (not character count)
    setWordsOffset(){
        var a=this.rng;
        do if(a){
            var g=a.cloneRange();
            if(a.startContainer.data){

                function isAlpha(a){
                    return /[\u0030-\u024F]/.test(a);
                }

                function getStartPos(backward_count){
                    var count=0, b='', pos=a.startOffset;
                    for(;pos>=1;){
                        g.setStart(a.startContainer,--pos);
                        b=g.toString();
                        if(!isAlpha(b.charAt(0))){
                            count++;
                            if(count==backward_count){
                                break
                            }
                        }
                    }

                    return pos;
                }

                function getEndPos(forward_count){
                    var count=0, b='', pos=a.endOffset;
                    for(;pos<a.endContainer.data.length;){
                        g.setEnd(a.endContainer,++pos);
                        b=g.toString();
                        if(!isAlpha(b.charAt(b.length-1))){
                            count++;
                            if(count==forward_count){
                                break
                            }
                        }
                    }

                    return pos;
                }

                var startPos = getStartPos(1);
                var endPos = getEndPos(2);

                this.rng.setStart(a.startContainer,startPos==0?0:startPos+1);
                this.rng.setEnd(a.endContainer,endPos==a.endContainer.data.length?endPos:endPos-1);
            }

        }while(0);

        return null;
    }

    setEndOffset(length) {
        const lengthAdj = length + this.rng.startOffset;
        const state = TextSourceRange.seekForward(this.rng.startContainer, lengthAdj);
        this.rng.setEnd(state.node, state.offset);
        return length - state.length;
    }

    setStartOffset(length) {
        const lengthAdj = length + (this.rng.startContainer.length - this.rng.startOffset);
        const state = TextSourceRange.seekBackward(this.rng.startContainer, lengthAdj);
        this.rng.setStart(state.node, state.offset);
        return length - state.length;
    }

    containsPoint(point) {
        const rect = this.getPaddedRect();
        return point.x >= rect.left && point.x <= rect.right;
    }

    getRect() {
        return this.rng.getBoundingClientRect();
    }

    getPaddedRect() {
        const range = this.rng.cloneRange();
        const startOffset = range.startOffset;
        const endOffset = range.endOffset;
        const node = range.startContainer;

        range.setStart(node, Math.max(0, startOffset - 1));
        range.setEnd(node, Math.min(node.length, endOffset + 1));

        return range.getBoundingClientRect();
    }

    select() {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(this.rng);
    }

    deselect() {
        const selection = window.getSelection();
        selection.removeAllRanges();
    }

    equals(other) {
        return other.rng && other.rng.compareBoundaryPoints(Range.START_TO_START, this.rng) == 0;
    }

    static seekForward(node, length) {
        const state = {node, offset: 0, length};
        if (!TextSourceRange.seekForwardHelper(node, state)) {
            return state;
        }

        for (let current = node; current !== null; current = current.parentElement) {
            for (let sibling = current.nextSibling; sibling !== null; sibling = sibling.nextSibling) {
                if (!TextSourceRange.seekForwardHelper(sibling, state)) {
                    return state;
                }
            }
        }

        return state;
    }

    static seekForwardHelper(node, state) {
        if (node.nodeType === 3) {
            const consumed = Math.min(node.length, state.length);
            state.node = node;
            state.offset = consumed;
            state.length -= consumed;
        } else {
            for (let i = 0; i < node.childNodes.length; ++i) {
                if (!TextSourceRange.seekForwardHelper(node.childNodes[i], state)) {
                    break;
                }
            }
        }

        return state.length > 0;
    }

    static seekBackward(node, length) {
        const state = {node, offset: node.length, length};
        if (!TextSourceRange.seekBackwardHelper(node, state)) {
            return state;
        }

        for (let current = node; current !== null; current = current.parentElement) {
            for (let sibling = current.previousSibling; sibling !== null; sibling = sibling.previousSibling) {
                if (!TextSourceRange.seekBackwardHelper(sibling, state)) {
                    return state;
                }
            }
        }

        return state;
    }

    static seekBackwardHelper(node, state) {
        if (node.nodeType === 3) {
            const consumed = Math.min(node.length, state.length);
            state.node = node;
            state.offset = node.length - consumed;
            state.length -= consumed;
        } else {
            for (let i = node.childNodes.length - 1; i >= 0; --i) {
                if (!TextSourceRange.seekBackwardHelper(node.childNodes[i], state)) {
                    break;
                }
            }
        }

        return state.length > 0;
    }
}

var cursorXXX;
var cursorYYY;
document.addEventListener("touchstart", function(e){
    cursorXXX = e.touches[0].clientX;
    cursorYYY = e.touches[0].clientY;
    //cursorXXX = e.clientX;
    //cursorYYY = e.clientY;
    console.log([cursorXXX,cursorYYY]);
});

function textSourceFromPoint(point) {
        const element = document.elementFromPoint(point.x, point.y);
        if (element !== null) {
            const names = ['IMG', 'INPUT', 'BUTTON', 'TEXTAREA'];
            if (names.indexOf(element.nodeName) !== -1) {
                return new TextSourceElement(element);
            }
        }

        const range = document.caretRangeFromPoint(point.x, point.y);
        if (range !== null) {
            return new TextSourceRange(range);
        }

        return null;
    }

function getSelectionText() {
    var text = "";
    if (window.getSelection) {
        text = window.getSelection().toString();
    } else if (document.selection && document.selection.type != "Control") {
        text = document.selection.createRange().text;
    }
    console.log("selection changed");
    return text;
}

function extractSentence(source, extent) {
        //const quotesFwd = {'「': '」', '『': '』', "'": "'", '"': '"'};
        //const quotesBwd = {'」': '「', '』': '『', "'": "'", '"': '"'};
        const quotesFwd = {'「': '」', '『': '』'};
        const quotesBwd = {'」': '「', '』': '『'};
        const terminators = '…。．.？?！!\n';

        const sourceLocal = source.clone();
        const position = sourceLocal.setStartOffset(extent);
        sourceLocal.setEndOffset(position + extent);
        const content = sourceLocal.text();

        let quoteStack = [];

        let startPos = 0;
        for (let i = position; i >= startPos; --i) {
            const c = content[i];

            if (quoteStack.length === 0 && (terminators.indexOf(c) !== -1 || c in quotesFwd)) {
                startPos = i + 1;
                break;
            }

            if (quoteStack.length > 0 && c === quoteStack[0]) {
                quoteStack.pop();
            } else if (c in quotesBwd) {
                quoteStack = [quotesBwd[c]].concat(quoteStack);
            }
        }

        quoteStack = [];

        let endPos = content.length;
        for (let i = position; i < endPos; ++i) {
            const c = content[i];

            if (quoteStack.length === 0) {
                if (terminators.indexOf(c) !== -1) {
                    endPos = i + 1;
                    break;
                }
                else if (c in quotesBwd) {
                    endPos = i;
                    break;
                }
            }

            if (quoteStack.length > 0 && c === quoteStack[0]) {
                quoteStack.pop();
            } else if (c in quotesFwd) {
                quoteStack = [quotesFwd[c]].concat(quoteStack);
            }
        }

        return content.substring(startPos, endPos).trim();
    }

var showPopup = function(){
    var selection = getSelectionText();
    if(selection)
    {
        if(selection.indexOf(" ") > -1)
        {
            //selection = selection.replace(/(\r\n|\n|\r)/gm,"");
            //ankihelper.showToast(selection, "", window.location.href);
            button_com_mmjang_ankihelper.style.display = "block";
            button_com_mmjang_ankihelper.href = getUrlIntent(selection, "", window.location.href);
        }
        else{
            var textSource = textSourceFromPoint({x:cursorXXX, y:cursorYYY});
                	var sentence = extractSentence(textSource, 400);
                	//console.log(sentence);
                	//sentence = sentence.replace(/(\r\n|\n|\r)/gm,"");
                	//ankihelper.showToast(sentence, selection, window.location.href);
            button_com_mmjang_ankihelper.style.display = "block";
            button_com_mmjang_ankihelper.href = getUrlIntent(sentence, selection, window.location.href);
        }

    }
    else{
        button_com_mmjang_ankihelper.style.display = "none";
    }
}

var timeout;

document.addEventListener("selectionchange", function(e) {
    if(timeout){
        clearTimeout(timeout);
    }
    timeout = setTimeout(showPopup, 500);
    //window.alert("touchend");
    //showPopup();
});


function getUrlIntent(sentence, target, url){
    var intent_url = "intent:#Intent;action=android.intent.action.SEND;" +
    "category=android.intent.category.DEFAULT;"+
    "type=text/plain;component=com.mmjang.ankihelper/com.mmjang.ankihelper.ui.PopupActivity;" +
    "S.android.intent.extra.TEXT=" + sentence + ";" + 
    "S.com.mmjang.ankihelper.target_word=" + target + ";" + 
    "S.com.mmjagn.ankihelper.url=" + url + ";" +   
    "end;";
    return intent_url;
}
//console.log("javascript injected");
var button_com_mmjang_ankihelper = document.createElement("Button");
button_com_mmjang_ankihelper.innerHTML = "Anki";
button_com_mmjang_ankihelper.style = "bottom:5%;right:40%;position:fixed;z-index:9999;font-size:150%;"
document.body.appendChild(button_com_mmjang_ankihelper);
