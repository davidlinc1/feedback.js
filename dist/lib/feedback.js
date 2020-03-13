"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const html2canvas = require("html2canvas");
class Feedback {
    constructor(options, html2canvasOptions) {
        this._options = {
            classPrefix: 'fb-',
            backgroundOpacity: .5,
            allowedTags: [
                'button', 'a', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'p',
                'i', 'strong', 'small', 'sub', 'sup', 'b', 'time', 'img',
                'caption', 'input', 'label', 'legend', 'select', 'textarea',
                'details', 'summary'
            ],
            footnote: 'Click the image above to highlight or obscure areas of the screenshot.',
            endpoint: ''
        };
        this._html2canvasOptions = {
            allowTaint: true
        };
        this._initState = {
            isOpen: false,
            isDragging: false,
            dragged: false,
            canDraw: false,
            includeScreenshot: true,
            highlight: true,
            isDrawing: false,
            sending: false
        };
        this._initArea = {
            startX: 0,
            startY: 0,
            width: 0,
            height: 0
        };
        this._state = Object.assign({}, this._initState);
        this._area = Object.assign({}, this._initArea);
        this._helperElements = [];
        this._helpers = [];
        this._helperIdx = 0;
        this._drawOptionsPos = {
            startX: 0,
            startY: 0,
            currTransform: null,
            nextTransform: null,
            limits: {
                xNeg: 0,
                xPos: 0,
                yNeg: 0,
                yPos: 0
            }
        };
        this._checkedColor = '#4285F4';
        this._uncheckedColor = '#757575';
        this._checkedPath = `M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-`
            + `1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z`;
        this._uncheckedPath = `M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z`;
        this.close = () => {
            document.removeEventListener('mousemove', this._dragDrag);
            document.removeEventListener('mouseup', this._dragStop);
            document.removeEventListener('mouseup', this._drawStop);
            document.removeEventListener('mousemove', this._drawDraw);
            document.removeEventListener('keydown', this._closeListener);
            document.removeEventListener('mousemove', this._highlightElement);
            document.removeEventListener('click', this._addHighlightedElement);
            window.removeEventListener('resize', this._resize);
            // TODO: Should we remove the inner listeners on close?
            // https://stackoverflow.com/a/37096563/1994803
            document.body.removeChild(this._root);
            this._reset();
        };
        this._closeListener = ($event) => {
            if ($event.key === 'Escape') {
                this.close();
            }
        };
        this._toggleScreenshot = ($event) => {
            $event.preventDefault();
            this._state.includeScreenshot = !this._state.includeScreenshot;
            this._checkbox.checked = this._state.includeScreenshot;
            this._checkboxSvg.setAttributeNS(null, 'fill', this._state.includeScreenshot ? this._checkedColor : this._uncheckedColor);
            this._checkboxSvgPath.setAttributeNS(null, 'd', this._state.includeScreenshot ? this._checkedPath : this._uncheckedPath);
            if (!this._state.includeScreenshot) {
                this._form.removeChild(this._screenshotContainer);
            }
            else {
                this._form.insertBefore(this._createScreenshotContainer(), this._footnoteContainer);
                this._genScreenshot();
            }
        };
        this._openDrawer = () => {
            this._state.canDraw = true;
            this._canvas.classList.add('active');
            this._formContainer.style.display = 'none';
            this._root.appendChild(this._createDrawOptions());
            document.addEventListener('mousemove', this._highlightElement);
            document.addEventListener('click', this._addHighlightedElement);
        };
        this._closeDrawer = () => {
            this._state.canDraw = false;
            this._canvas.classList.remove('active');
            this._root.removeChild(this._drawOptions);
            this._formContainer.style.display = 'block';
            document.removeEventListener('mousemove', this._highlightElement);
            document.removeEventListener('click', this._addHighlightedElement);
            this._genScreenshot();
        };
        this._resize = () => {
            const width = document.documentElement.scrollWidth;
            const height = document.documentElement.scrollHeight;
            this._canvas.width = width;
            this._canvas.height = height;
            this._helpersContainer.style.width = `${width}px`;
            this._helpersContainer.style.height = `${height}px`;
            this._redraw();
        };
        this._dragStart = ($event) => {
            if (!this._state.isDragging) {
                this._state.isDragging = true;
                this._drawOptionsPos.startX = $event.clientX;
                this._drawOptionsPos.startY = $event.clientY;
                const rect = this._drawOptions.getBoundingClientRect();
                this._drawOptionsPos.limits.xNeg = -rect.left;
                this._drawOptionsPos.limits.xPos = document.documentElement.clientWidth - rect.right;
                this._drawOptionsPos.limits.yNeg = -rect.top;
                this._drawOptionsPos.limits.yPos = document.documentElement.clientHeight - rect.bottom;
            }
        };
        this._dragDrag = ($event) => {
            if (this._state.isDragging) {
                $event.preventDefault();
                let nextX = $event.clientX - this._drawOptionsPos.startX;
                let nextY = $event.clientY - this._drawOptionsPos.startY;
                if (nextX < this._drawOptionsPos.limits.xNeg) {
                    nextX = this._drawOptionsPos.limits.xNeg;
                }
                if (nextX > this._drawOptionsPos.limits.xPos) {
                    nextX = this._drawOptionsPos.limits.xPos;
                }
                if (nextY < this._drawOptionsPos.limits.yNeg) {
                    nextY = this._drawOptionsPos.limits.yNeg;
                }
                if (nextY > this._drawOptionsPos.limits.yPos) {
                    nextY = this._drawOptionsPos.limits.yPos;
                }
                nextX = Math.round(nextX);
                nextY = Math.round(nextY);
                this._drawOptionsPos.nextTransform = `translate(${nextX}px, ${nextY}px)`;
                this._drawOptions.style.transform = `${this._drawOptionsPos.currTransform} ${this._drawOptionsPos.nextTransform}`;
                this._state.dragged = true;
            }
        };
        this._dragStop = ($event) => {
            this._state.isDragging = false;
            if (this._state.dragged) {
                this._drawOptionsPos.currTransform = `${this._drawOptionsPos.currTransform} ${this._drawOptionsPos.nextTransform}`;
                this._state.dragged = false;
            }
        };
        this._drawStart = ($event) => {
            if (this._state.canDraw) {
                this._state.isDrawing = true;
                this._area = {
                    startX: $event.clientX + document.documentElement.scrollLeft,
                    startY: $event.clientY + document.documentElement.scrollTop,
                    width: 0,
                    height: 0
                };
            }
        };
        this._drawStop = ($event) => {
            if (this._state.canDraw) {
                this._state.isDrawing = false;
                if (Math.abs(this._area.width) < 6 || Math.abs(this._area.height) < 6) {
                    return;
                }
                const helper = Object.assign({}, this._area, { highlight: this._state.highlight, index: this._helperIdx++ });
                if (helper.width < 0) {
                    helper.startX += helper.width;
                    helper.width *= -1;
                }
                if (helper.height < 0) {
                    helper.startY += helper.height;
                    helper.height *= -1;
                }
                this._area = Object.assign({}, this._initArea);
                this._helperElements.push(this._createHelper(helper));
                this._helpers.push(helper);
                this._redraw();
            }
        };
        this._drawDraw = ($event) => {
            $event.preventDefault();
            if (this._state.isDrawing) {
                this._area.width = $event.clientX - this._area.startX + document.documentElement.scrollLeft;
                this._area.height = $event.clientY - this._area.startY + document.documentElement.scrollTop;
                // TODO: constant '4' should be lineWidth - also should be optional
                if (this._area.startX + this._area.width > document.documentElement.scrollWidth) {
                    this._area.width = document.documentElement.scrollWidth - this._area.startX - 4;
                }
                if (this._area.startX + this._area.width < 0) {
                    this._area.width = -this._area.startX + 4;
                }
                if (this._area.startY + this._area.height > document.documentElement.scrollHeight) {
                    this._area.height = document.documentElement.scrollHeight - this._area.startY - 4;
                }
                if (this._area.startY + this._area.height < 0) {
                    this._area.height = -this._area.startY + 4;
                }
                this._resetCanvas();
                this._drawHighlightLines();
                if (this._state.highlight && Math.abs(this._area.width) > 6 && Math.abs(this._area.height) > 6) {
                    this._drawLines(this._area.startX, this._area.startY, this._area.width, this._area.height);
                    this._ctx.clearRect(this._area.startX, this._area.startY, this._area.width, this._area.height);
                }
                this._paintArea();
                this._paintArea(false);
                if (!this._state.highlight && Math.abs(this._area.width) > 6 && Math.abs(this._area.height) > 6) {
                    this._ctx.fillStyle = 'rgba(0,0,0,.5)';
                    this._ctx.fillRect(this._area.startX, this._area.startY, this._area.width, this._area.height);
                }
            }
        };
        this._highlightElement = ($event) => {
            this._highlightedArea = null;
            // We need the 3rd element in the list.
            if (!this._state.canDraw || this._state.isDrawing) {
                return;
            }
            const el = document.elementsFromPoint($event.x, $event.y)[3];
            if (el) {
                if (this._options.allowedTags.indexOf(el.nodeName.toLowerCase()) === -1) {
                    this._redraw();
                    this._canvas.style.cursor = 'crosshair';
                    return;
                }
                this._canvas.style.cursor = 'pointer';
                const rect = el.getBoundingClientRect();
                this._highlightedArea = {
                    startX: rect.left + document.documentElement.scrollLeft,
                    startY: rect.top + document.documentElement.scrollTop,
                    width: rect.width,
                    height: rect.height
                };
                this._redraw();
                if (this._state.highlight) {
                    this._drawLines(this._highlightedArea.startX, this._highlightedArea.startY, this._highlightedArea.width, this._highlightedArea.height);
                    this._ctx.clearRect(this._highlightedArea.startX, this._highlightedArea.startY, this._highlightedArea.width, this._highlightedArea.height);
                }
                this._paintArea();
                if (!this._state.highlight) {
                    this._ctx.fillStyle = 'rgba(0,0,0,.5)';
                    this._ctx.fillRect(this._highlightedArea.startX, this._highlightedArea.startY, this._highlightedArea.width, this._highlightedArea.height);
                }
                this._paintArea(false);
            }
        };
        this._addHighlightedElement = ($event) => {
            if (this._highlightedArea) {
                if (Math.abs(this._highlightedArea.width) < 6 || Math.abs(this._highlightedArea.height) < 6) {
                    return;
                }
                const helper = Object.assign({}, this._highlightedArea, { highlight: this._state.highlight, index: this._helperIdx++ });
                if (helper.width < 0) {
                    helper.startX += helper.width;
                    helper.width *= -1;
                }
                if (helper.height < 0) {
                    helper.startY += helper.height;
                    helper.height *= -1;
                }
                this._helperElements.push(this._createHelper(helper));
                this._helpers.push(helper);
            }
        };
        this._onScroll = () => {
            const x = -document.documentElement.scrollLeft;
            const y = -document.documentElement.scrollTop;
            this._canvas.style.left = `${x}px`;
            this._canvas.style.top = `${y}px`;
            this._helpersContainer.style.left = `${x}px`;
            this._helpersContainer.style.top = `${y}px`;
        };
        if (options) {
            this._options = Object.assign({}, this._options, options);
        }
        if (html2canvasOptions) {
            this._html2canvasOptions = Object.assign({}, this._html2canvasOptions, html2canvasOptions);
        }
    }
    open() {
        if (!this._state.isOpen) {
            this._state.isOpen = true;
            this._root = this._createModal();
            document.body.appendChild(this._root);
            this._onScroll();
            document.addEventListener('keydown', this._closeListener);
            window.addEventListener('scroll', this._onScroll);
            if (this._state.includeScreenshot) {
                this._genScreenshot();
            }
        }
    }
    _reset() {
        this._state = Object.assign({}, this._initState);
        this._helpers = [];
        this._helperElements = [];
        this._helperIdx = 0;
    }
    _createModal() {
        const root = document.createElement('div');
        root.id = 'feedback-js';
        root.appendChild(this._createForm());
        root.appendChild(this._createHelpersContainer());
        root.appendChild(this._createCanvas());
        return root;
    }
    _send() {
        this._state.sending = true;
        this._showSending();
        const headers = new Headers();
        headers.append('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
        const data = {
            description: this._form[0].value,
            screenshot: this._screenshotCanvas.toDataURL(),
            url: window.location.host,
            path: window.location.pathname
        };
        fetch(this._options.endpoint, {
            method: 'POST',
            mode: 'cors',
            headers: headers,
            body: JSON.stringify(data)
        })
            .then(resp => {
            if (resp.ok) {
                this._state.sending = false;
                this._showSent();
            }
            else {
                throw new Error(`failed to post data to ${this._options.endpoint}`);
            }
        })
            .catch(_ => {
            this._state.sending = false;
            this._showError();
        });
    }
    _genScreenshot() {
        this._html2canvasOptions = Object.assign({}, this._html2canvasOptions, { width: window.innerWidth, height: window.innerHeight, scrollX: window.pageXOffset, scrollY: window.pageYOffset, x: window.pageXOffset, y: window.pageYOffset });
        while (this._screenshotContainer.firstChild) {
            this._screenshotContainer.removeChild(this._screenshotContainer.firstChild);
        }
        this._redraw(false);
        html2canvas(document.body, this._html2canvasOptions).then((canvas) => {
            this._screenshotCanvas = canvas;
            this._screenshotContainer.appendChild(canvas);
            this._redraw();
        });
    }
    _createHeader() {
        const header = document.createElement('div');
        header.className = `${this._options.classPrefix}header text-subhead font-aeries font-semi-bold`;
        const headerH1 = document.createElement('h1');
        headerH1.innerText = 'Send feedback';
        header.appendChild(headerH1);
        return header;
    }
    _createForm() {
        const container = document.createElement('div');
        container.className = `${this._options.classPrefix}form-container`;
        container.setAttribute('data-html2canvas-ignore', 'true');
        this._formContainer = container;
        const form = document.createElement('form');
        form.appendChild(this._createHeader());
        form.appendChild(this._createTextarea());
        form.appendChild(this._createCheckboxContainer());
        if (this._state.includeScreenshot) {
            form.appendChild(this._createScreenshotContainer());
        }
        form.appendChild(this._createFootnote());
        form.appendChild(this._createActionsContainer());
        this._form = form;
        container.appendChild(form);
        return container;
    }
    _createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = document.documentElement.scrollWidth;
        canvas.height = document.documentElement.scrollHeight;
        canvas.className = 'draw-area';
        canvas.addEventListener('mousedown', this._drawStart);
        document.addEventListener('mouseup', this._drawStop);
        document.addEventListener('mousemove', this._drawDraw);
        window.addEventListener('resize', this._resize);
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');
        this._resetCanvas();
        return canvas;
    }
    _createTextarea() {
        const textarea = document.createElement('textarea');
        textarea.placeholder = 'Describe your issue or share your ideas.';
        return textarea;
    }
    _createCheckboxContainer() {
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = `${this._options.classPrefix}checkbox`;
        const checkboxLabel = document.createElement('label');
        checkboxLabel.addEventListener('click', this._toggleScreenshot);
        checkboxLabel.htmlFor = 'screenshot';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'screenshot';
        checkbox.checked = this._state.includeScreenshot;
        this._checkbox = checkbox;
        checkboxLabel.appendChild(checkbox);
        const checkboxSvgContainer = document.createElement('div');
        const checkboxSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        checkboxSvg.setAttributeNS(null, 'fill', this._state.includeScreenshot ? this._checkedColor : this._uncheckedColor);
        checkboxSvg.setAttributeNS(null, 'width', '24px');
        checkboxSvg.setAttributeNS(null, 'height', '24px');
        checkboxSvg.setAttributeNS(null, 'viewBox', '0 0 24 24');
        this._checkboxSvg = checkboxSvg;
        const checkboxSvgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        checkboxSvgPath.setAttributeNS(null, 'd', this._state.includeScreenshot ? this._checkedPath : this._uncheckedPath);
        this._checkboxSvgPath = checkboxSvgPath;
        checkboxSvg.appendChild(checkboxSvgPath);
        checkboxSvgContainer.appendChild(checkboxSvg);
        checkboxLabel.appendChild(checkboxSvgContainer);
        const checkboxLabelSpan = document.createElement('span');
        checkboxLabelSpan.innerText = 'Include screenshot';
        checkboxLabel.appendChild(checkboxLabelSpan);
        checkboxContainer.appendChild(checkboxLabel);
        return checkboxContainer;
    }
    _createScreenshotContainer() {
        const screenshotContainer = document.createElement('div');
        screenshotContainer.className = `${this._options.classPrefix}screenshot`;
        screenshotContainer.addEventListener('click', this._openDrawer);
        this._screenshotContainer = screenshotContainer;
        return screenshotContainer;
    }
    _createFootnote() {
        const footnote = document.createElement('small');
        footnote.innerText = this._options.footnote;
        this._footnoteContainer = footnote;
        return footnote;
    }
    _createActionsContainer() {
        const actions = document.createElement('div');
        actions.className = `${this._options.classPrefix}actions`;
        const sendButtonContainer = document.createElement('div');
        sendButtonContainer.classList.add('mat-button');
        const sendButton = document.createElement('button');
        sendButton.className = 'font-body text-blue-500 font-bold';
        sendButton.innerText = 'send';
        sendButton.type = 'submit';
        sendButton.addEventListener('click', ($event) => {
            $event.preventDefault();
            this._send();
        });
        sendButtonContainer.appendChild(sendButton);
        actions.appendChild(sendButtonContainer);
        const cancelButtonContainer = document.createElement('div');
        cancelButtonContainer.classList.add('mat-button');
        const cancelButton = document.createElement('button');
        cancelButton.className = 'font-body';
        cancelButton.innerText = 'cancel';
        cancelButton.type = 'button';
        cancelButton.addEventListener('click', this.close);
        cancelButtonContainer.appendChild(cancelButton);
        actions.appendChild(cancelButtonContainer);
        return actions;
    }
    _createDrawOptions() {
        const drawOptions = document.createElement('div');
        drawOptions.className = `${this._options.classPrefix}draw-options`;
        const draggerContainer = document.createElement('div');
        draggerContainer.className = 'dragger feedback-widget-button feedback-widget-button-border';
        // draggerContainer.innerText = 'dragger';

        draggerContainer.innerHTML = '<svg width="16px" viewBox="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"> <g id="Page-1" stroke="none" stroke-width="1" fill="black" fill-rule="evenodd"> <g id="icon-shape"> <path d="M10,9 C11.1045695,9 12,8.1045695 12,7 C12,5.8954305 11.1045695,5 10,5 C8.8954305,5 8,5.8954305 8,7 C8,8.1045695 8.8954305,9 10,9 Z M10,15 C11.1045695,15 12,14.1045695 12,13 C12,11.8954305 11.1045695,11 10,11 C8.8954305,11 8,11.8954305 8,13 C8,14.1045695 8.8954305,15 10,15 Z" id="Combined-Shape"></path> </g> </g> </svg>'
        draggerContainer.addEventListener('mousedown', this._dragStart);
        document.addEventListener('mousemove', this._dragDrag);
        document.addEventListener('mouseup', this._dragStop);
        this._dragger = draggerContainer;
        drawOptions.appendChild(draggerContainer);
        const highlightButtonContainer = document.createElement('div');
        const highlightButton = document.createElement('button');
        highlightButton.className = 'feedback-widget-button feedback-widget-button-border';
        highlightButton.innerHTML = '<svg style="margin-right: 0.50rem;margin-top: 0.20em;display: inline;" width="18px" viewBox="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"> <g id="Page-1" stroke="none" stroke-width="1" fill="black" fill-rule="evenodd"> <g id="icon-shape"> <path d="M12.2928932,3.70710678 L0,16 L0,20 L4,20 L16.2928932,7.70710678 L12.2928932,3.70710678 Z M13.7071068,2.29289322 L16,0 L20,4 L17.7071068,6.29289322 L13.7071068,2.29289322 Z" id="Combined-Shape"></path> </g> </g> </svg> Highlight';
        highlightButton.type = 'button';
        highlightButton.addEventListener('click', () => this._state.highlight = true);
        highlightButtonContainer.appendChild(highlightButton);
        drawOptions.appendChild(highlightButtonContainer);
        const blackoutButtonContainer = document.createElement('div');
        const blackoutButton = document.createElement('button');
        blackoutButton.className = 'feedback-widget-button feedback-widget-button-border';
        blackoutButton.innerHTML = '<svg style="margin-right: 0.50rem;margin-top: 0.20em;display: inline;" width="18px" viewBox="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"> <g id="Page-1" stroke="none" stroke-width="1" fill="black" fill-rule="evenodd"> <g id="icon-shape"> <path d="M16.6166796,6.21174757 C17.9442722,7.21287251 19.0378031,8.50785377 19.8005808,10 C17.9798698,13.5616759 14.2746855,16 10,16 C9.02896677,16 8.08732049,15.8741795 7.19047483,15.6379523 L8.96391361,13.8645135 C9.29436687,13.9528855 9.64168134,14 10,14 C12.209139,14 14,12.209139 14,10 C14,9.64168134 13.9528855,9.29436687 13.8645135,8.96391361 L16.6166796,6.21174757 Z M12.8095252,4.36204771 C11.9126795,4.12582046 10.9710332,4 10,4 C5.72531453,4 2.02013017,6.43832409 0.199419187,10 C0.962196907,11.4921462 2.05572777,12.7871275 3.38332044,13.7882524 L6.13548648,11.0360864 C6.04711451,10.7056331 6,10.3583187 6,10 C6,7.790861 7.790861,6 10,6 C10.3583187,6 10.7056331,6.04711451 11.0360864,6.13548648 L12.8095252,4.36204771 Z M16.363961,2.22182541 L17.7781746,3.63603897 L3.63603897,17.7781746 L2.22182541,16.363961 L16.363961,2.22182541 Z" id="Combined-Shape"></path> </g> </g> </svg> Blackout';
        blackoutButton.type = 'button';
        blackoutButton.addEventListener('click', () => this._state.highlight = false);
        blackoutButtonContainer.appendChild(blackoutButton);
        drawOptions.appendChild(blackoutButtonContainer);
        const doneButtonContainer = document.createElement('div');
        doneButtonContainer.className = 'feedback-widget-button feedback-widget-button-border';
        const doneButton = document.createElement('button');
        doneButton.className = "font-semi-bold";
        doneButton.innerText = 'Done';
        doneButton.type = 'button';
        doneButtonContainer.addEventListener('click', this._closeDrawer);
        doneButtonContainer.appendChild(doneButton);
        drawOptions.appendChild(doneButtonContainer);
        this._drawOptions = drawOptions;
        this._drawOptionsPos.currTransform = 'translate(-50%, -50%)';
        return drawOptions;
    }
    _createHelpersContainer() {
        const helpersContainer = document.createElement('div');
        helpersContainer.className = 'helpers';
        helpersContainer.style.width = `${document.documentElement.scrollWidth}px`;
        helpersContainer.style.height = `${document.documentElement.scrollHeight}px`;
        this._helpersContainer = helpersContainer;
        return helpersContainer;
    }
    _resetCanvas() {
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        this._ctx.fillStyle = 'rgba(102,102,102,.5)';
        this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
    }
    _drawHighlightLines() {
        this._helpers.filter(helper => helper.highlight).forEach(helper => {
            this._drawLines(helper.startX, helper.startY, helper.width, helper.height);
        });
    }
    _paintArea(highlight = true) {
        if (highlight) {
            this._helpers.filter(helper => helper.highlight).forEach(helper => {
                this._ctx.clearRect(helper.startX, helper.startY, helper.width, helper.height);
            });
        }
        else {
            this._helpers.filter(helper => !helper.highlight).forEach(helper => {
                this._ctx.fillStyle = 'rgba(0,0,0,1)';
                this._ctx.fillRect(helper.startX, helper.startY, helper.width, helper.height);
            });
        }
    }
    _redraw(withBorder = true) {
        this._resetCanvas();
        if (withBorder) {
            this._drawHighlightLines();
        }
        this._paintArea();
        this._paintArea(false);
    }
    _drawLines(x, y, width, height) {
        this._ctx.strokeStyle = '#ffeb3b';
        this._ctx.lineJoin = 'bevel';
        this._ctx.lineWidth = 4;
        this._ctx.strokeRect(x, y, width, height);
        this._ctx.lineWidth = 1;
    }
    _createHelper(helper) {
        const h = document.createElement('div');
        h.className = helper.highlight ? 'highlight' : 'blackout';
        h.style.position = 'absolute';
        h.style.top = `${helper.startY}px`;
        h.style.left = `${helper.startX}px`;
        h.style.height = `${helper.height}px`;
        h.style.width = `${helper.width}px`;
        h.style.zIndex = '20';
        h.setAttribute('idx', `${helper.index}`);
        const inner = document.createElement('div');
        inner.style.width = `${helper.width - 2}px`;
        inner.style.height = `${helper.height - 2}px`;
        inner.style.margin = '1px';
        const removeButton = document.createElement('button');
        removeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" id="Capa_1" x="0px" y="0px" viewBox="0 0 51.976 51.976" style="enable-background:new 0 0 51.976 51.976;" xml:space="preserve" width="512px" height="512px" class=""><g><g> <path d="M44.373,7.603c-10.137-10.137-26.632-10.138-36.77,0c-10.138,10.138-10.137,26.632,0,36.77s26.632,10.138,36.77,0 C54.51,34.235,54.51,17.74,44.373,7.603z M36.241,36.241c-0.781,0.781-2.047,0.781-2.828,0l-7.425-7.425l-7.778,7.778 c-0.781,0.781-2.047,0.781-2.828,0c-0.781-0.781-0.781-2.047,0-2.828l7.778-7.778l-7.425-7.425c-0.781-0.781-0.781-2.048,0-2.828 c0.781-0.781,2.047-0.781,2.828,0l7.425,7.425l7.071-7.071c0.781-0.781,2.047-0.781,2.828,0c0.781,0.781,0.781,2.047,0,2.828 l-7.071,7.071l7.425,7.425C37.022,34.194,37.022,35.46,36.241,36.241z" data-original="#000000" class="active-path" data-old_color="#000000" fill="#da1c1c"/> </g></g> </svg>';
        removeButton.style.position = 'absolute';
        removeButton.style.right = '0';
        removeButton.style.top = '0';
        removeButton.addEventListener('click', ($event) => {
            removeButton.parentNode.parentNode.removeChild(h);
            this._helpers.splice(this._helpers.findIndex(_helper => _helper.index === helper.index), 1);
            this._helperElements.splice(this._helperElements.findIndex(_helper => +_helper.getAttribute('idx') === helper.index), 1);
            this._redraw();
        });
        h.addEventListener('mouseenter', ($event) => {
            if (this._state.canDraw && !this._state.isDrawing) {
                h.appendChild(inner);
                h.appendChild(removeButton);
                if (!helper.highlight) {
                    this._resetCanvas();
                    this._drawHighlightLines();
                    this._paintArea();
                    this._ctx.clearRect(helper.startX, helper.startY, helper.width, helper.height);
                    this._ctx.fillStyle = 'rgba(0,0,0,.75)';
                    this._ctx.fillRect(helper.startX, helper.startY, helper.width, helper.height);
                    this._helpers.filter(_helper => !_helper.highlight && _helper.index !== helper.index).forEach(_helper => {
                        this._ctx.fillStyle = 'rgba(0,0,0,1)';
                        this._ctx.fillRect(_helper.startX, _helper.startY, _helper.width, _helper.height);
                    });
                }
            }
        });
        h.addEventListener('mouseleave', ($event) => {
            if (this._state.canDraw && !this._state.isDrawing && h.hasChildNodes()) {
                h.removeChild(inner);
                h.removeChild(removeButton);
                if (!helper.highlight) {
                    this._redraw();
                }
            }
        });
        this._helpersContainer.appendChild(h);
        return h;
    }
    _showSending() {
        const container = document.createElement('div');
        container.className = 'status';
        container.innerText = 'sending...';
        this._sendingContainer = container;
        this._formContainer.appendChild(container);
        this._form.style.display = 'none';
    }
    _showSent() {
        this._formContainer.removeChild(this._sendingContainer);
        const container = document.createElement('div');
        container.className = 'status';
        container.innerText = 'Your feedback has been sent. Thank you!';
        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('mat-button');
        buttonContainer.classList.add('primary');
        const button = document.createElement('button');
        button.innerText = 'ok';
        button.type = 'button';
        button.addEventListener('click', this.close);
        buttonContainer.appendChild(button);
        container.appendChild(buttonContainer);
        this._sentContainer = container;
        this._formContainer.appendChild(container);
    }
    _showError() {
        this._formContainer.removeChild(this._sendingContainer);
        const container = document.createElement('div');
        container.className = 'status';
        container.innerText = 'error...';
        const actions = document.createElement('div');
        actions.className = 'actions';
        const backButtonContainer = document.createElement('div');
        backButtonContainer.classList.add('mat-button');
        backButtonContainer.classList.add('primary');
        const backButton = document.createElement('button');
        backButton.innerText = 'back';
        backButton.type = 'button';
        backButton.addEventListener('click', () => {
            this._form.style.display = 'flex';
            this._formContainer.removeChild(this._errorContainer);
        });
        backButtonContainer.appendChild(backButton);
        actions.appendChild(backButtonContainer);
        const closeButtonContainer = document.createElement('div');
        closeButtonContainer.classList.add('mat-button');
        const closeButton = document.createElement('button');
        closeButton.innerText = 'close';
        closeButton.type = 'button';
        closeButton.addEventListener('click', this.close);
        closeButtonContainer.appendChild(closeButton);
        actions.appendChild(closeButtonContainer);
        container.appendChild(actions);
        this._errorContainer = container;
        this._formContainer.appendChild(container);
    }
}
exports.Feedback = Feedback;
//# sourceMappingURL=feedback.js.map
