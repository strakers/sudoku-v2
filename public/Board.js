class Board {
    ref = {
        cells: [],
        matrix: [],
        board: null,
    };

    errors = {
        row: {},
        col: {},
        sec: {},
    };

    static type = {
        ROW: 'row',
        COLUMN: 'col',
        SECTOR: 'sec',
    };

    static vectors = [
        this.type.ROW,
        this.type.COLUMN,
        this.type.SECTOR,
    ];

    static __defaults = {
        difficulty: 3,
    };

    constructor(z = 9, options = {}) {
        this.setDimensions(z, z);
        const r = Math.sqrt(z);
        this.r = r;

        this.options = this.processOptions(options);
        this.cellSize = options?.size ?? '32px';

        this.ref.matrix = new Matrix();
        this.showErrors = options?.showErrors ?? true;
        this.groupSum = (this.x/2)*(1+this.y);

        this.updateCssRoot();
    };

    /**
     *
     * @param {string} selector
     * @returns
     */
    build(selector) {
        this.setBoard(selector);

        // draw board on page
        this.drawBoardContents();

        // resize and reposition board depending on board size and viewport size
        // always keeps it within viewport
        this.resize();

        // keep this
        console.log('signature:', location.origin + location.pathname + '?s=' + this.getSignature());
        console.log('level:', this.options.difficulty);

        // make method chainable
        return this;
    };

    setDimensions(x, y) {
        this.x = x;
        this.y = y;
    }

    setBoard(selector) {
        this.ref.board = document.querySelector(selector);
        if (!this.ref.board) throw new Error(`Element with selector "${selector}" was not found.`);

        // remove any prior instances of boards for garbage collection
        if (this.ref.board?.instance) {
            this.ref.board?.instance.destroy();
        }

        // assocate element with current board
        this.ref.board.instance = this;

        // apply option settings
        if (this.showErrors) {
            this.ref.board.classList.add('show-errors');
        }
    }

    updateCssRoot() {
        const r = document.querySelector(':root');
        const s = r.style;
        s.setProperty('--matrix-x',this.x);
        s.setProperty('--matrix-y',this.y);
        s.setProperty('--size',this.cellSize);
    };

    drawBoardContents() {
        // draw board on page
        for (let row = 0, index = 0, sector = 0; row < this.y; ++row) {
            for (let col = 0; col < this.x; ++col) {
                sector = (Math.floor(row / this.r) * this.r) + Math.floor(col / this.r);

                // build cell
                let cell = this.drawCell(index, row, col, sector);
                index++;

                // equip cell with action listeners
                this.addCellInteractionEventListeners(cell);
            }
        }

        // set fixed values from signature, else calculate them using algorythm
        this.generateGivens();
    }

    drawCell(index, x, y, group) {
        const cell = createCell(x * this.x + y);
        cell.setAttribute('data-index', index);
        cell.setAttribute('data-row', x);
        cell.setAttribute('data-col', y);
        cell.setAttribute('data-sec', group);
        cell.setAttribute('contenteditable', true);

        // index cells for later referencing
        this.ref.board.appendChild(cell);
        this.ref.cells.push(cell);
        this.ref.matrix.add(x, y, cell);

        // draws highlights when dimensions are perfect square
        this.drawSectorHighlights(cell, group);

        return cell;
    }

    drawSectorHighlights(cell, sector) {
        if (!this.isPerfectSquare()) return;
        if (!isOddSector(sector, this.r)) return;
        cell.classList.add('sector-highlight');
    }

    addCellInteractionEventListeners(cell) {
        cell.addEventListener('click', e => selectText(e.target));
        cell.addEventListener('input', e => e.target.setAttribute('data-changed', true));
        cell.addEventListener('keypress', e => {
            if (!(e.key > 0 && e.key <= this.x)) e.preventDefault();
            if (e.key === 'Enter' || e.code === 'Space') e.target.blur();
        });
        cell.addEventListener('focusout', e => {
            e.target.innerText = e.target.innerText.trim();
            if (e.target.getAttribute('data-changed') == "true") {
                this.validateCell(e.target);
                e.target.setAttribute('data-changed',false);
            }
        });
    }

    generateGivens() {
        const flag = this.isPerfectSquare();
        const signature = this.options.signature;

        // populate givens based on signature
        if (signature) {
            for (let i in signature) {
                setCellToFixedValue(this.ref.cells[i], signature[i]);
            }
        }
        // calculate random givens based on difficulty level
        else {
            this.ref.cells.forEach((cell) => {
                if (this.x <= 1) return;
                processCellForPossibleFixedValue(cell, flag, this.x, this.options.difficulty);
            });
        }
    };

    resize() {
        // resize and reposition board depending on board size and viewport size
        // always keeps it within viewport
        const sizeLimit = Math.floor(Math.min(window.innerWidth, window.innerHeight - 250) / 32) - 3;
        setTimeout(() => {
            document.getElementById('mesh').style.transform = `scale(${this.x > sizeLimit ? sizeLimit / (this.x + 1) : 1}) translateY(0%)`;
            const sh = document.getElementById('mesh').scrollHeight, wh = window.innerHeight, step = 20, dur = 1000;
            if (sh <= wh) return;
            for (let i = 0; i < sh; i += step) {
                setTimeout(() => {
                    window.scrollTo({
                        top: (sh / (dur / step)) * i ,
                        behavior: 'smooth',
                    });
                }, i)
            }
        }, 500);
    }

    destroy() {
        this.ref.cells = null;
        this.ref.matrix = null;

        if (this.ref.board) {
            this.ref.board.classList.remove('completed');
            this.ref.board.innerHTML = '';
            this.ref.board = null;
        }
    }

    /**
     *
     * @param {Node} cell
     */
    validateCell(cell) {
        this.ref.board.classList.remove('completed');

        // only check sectors if board dimensions are perfect square
        const vectors = Board.vectors.slice();
        if (!this.isPerfectSquare()) vectors.pop();

        // check cells for errors by vector
        const [cellsForCleaning, cellsWithErrors] = this.checkCellErrorsByVector(cell, vectors);

        // loop through cells to try to clear them
        this.cleanUpNonErrorCells(cellsForCleaning, vectors);

        // mark complete if board is successfully filled with no errors
        if (this.isCompleted()) {
            this.markCompleted();
        }
    };

    /**
     *
     * @param {Node} cell
     * @param {typeof Board.vectors} vectors
     * @returns {[Node[],Node[]]}
     */
    checkCellErrorsByVector(cell, vectors) {
        let cellsWithErrors = [];
        let cellsForCleaning = [];

        // check cell for errors on each vector
        vectors.forEach((t) => {
            let index = cell.dataset[t];
            let cellGroup = this.ref.board.querySelectorAll(`.cell[data-${t}='${index}']`);

            // error checking algorythm
            this.errors[t][index] = this.checkCellsHaveErrors(cellGroup);

            // report error status per cell
            if (this.errors[t][index]) {
                this.markCellsAsError(cellGroup);
                cellsWithErrors = [...cellsWithErrors, ...cellGroup];
                return;
            }

            // make list of cells for clearing
            cellsForCleaning = [...cellsForCleaning, ...cellGroup];
        });

        return [cellsForCleaning, cellsWithErrors];
    }

    /**
     *
     * @param {Node[]} cellsForCleaning
     * @param {typeof Board.vectors} vectors
     */
    cleanUpNonErrorCells(cellsForCleaning, vectors) {
        (new Set(cellsForCleaning)).forEach(cell => {
            if (vectors.reduce(
                (hasErrors, vector) => this.errors[vector][cell.dataset[vector]] | hasErrors,
                false,
            )) return;
            // when no error found, clear error class
            cell.classList.remove('error');
        });
    }

    /**
     *
     * @param {NodeList} cells
     */
    markCellsAsError(cells) {
        [...cells].forEach((cell) => cell.classList.add('error'));
    }

    /**
     *
     * @param {NodeList} cells
     * @returns
     */
    checkCellsHaveErrors(cells) {
        const hasDuplicateValuesInGroup = calcCountsPerValue(cells).filter(n => n > 1).length > 0;
        const hasAllCellsFilledInGroup = [...cells].filter(c => c.innerText.trim()).length === cells.length;
        const hasSumMatchingGroupSum = calcSumOfCells(cells)  === this.groupSum;
        return hasDuplicateValuesInGroup || (hasAllCellsFilledInGroup ? !hasSumMatchingGroupSum : false);
    }

    markCompleted() {
        this.ref.board.classList.add('completed');
        this.lock();
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
        });
        document.querySelector('#loader_btn').focus();
    }

    lock() {
        this.ref.cells.forEach(
            c => c.hasAttribute('contenteditable')
                ? c.setAttribute('contenteditable', false)
                : null
        );
    };

    unlock() {
        this.ref.cells.forEach(
            c => c.classList.contains('fixed')
                ? null
                : c.setAttribute('contenteditable', true)
        );
    };

    // prevents the passing of unsafe options
    // because i'm paranoid
    processOptions(options = {}) {
        const {
            difficulty = Board.__defaults.difficulty,
            signature = null,
            showErrors = true,
        } = options;
        return {
            difficulty,
            signature,
            showErrors,
        }
    };

    isCompleted() {
        if (this.ref.cells.filter(c => c.innerText.trim()).length !== this.ref.cells.length) return false;
        for(let type in this.errors) {
            for(let index in this.errors[type]) {
                if (this.errors[type][index]) return false;
            }
        }
        return true;
    };

    hasEqualSides() {
        return this.x === this.y;
    };

    isPerfectSquare() {
        if (! this.hasEqualSides()) return false;
        return Math.pow(Math.floor(Math.sqrt(this.x)),2) === this.x;
    };

    // get hash() {
    //     return [
    //         0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0,
    //         ...('abcdefghijklmnopqrstuvwxyz').split(''),
    //         ...('~!@#$%^&*()<>?[]{}\\/').split('')
    //     ];
    // };

    /**
     *
     * @returns {string}
     */
    getSignature() {
        const cells = this.ref.board.querySelectorAll('.cell');
        const givens = [];
        for (let i = 0, c = null, t = ''; i < cells.length; ++i) {
            c = cells[i];
            if (!(c.classList.contains('fixed') && c.dataset.index == i)) continue;
            t = c.innerText.trim();
            givens.push(`${i},${t}`);
        }
        return btoa(this.x + ':' + givens.join(';'));
    };


    /**
     *
     * @param {string} param
     * @param {object} options
     * @returns {Board}
     */
    static fromSearchQueryParam(param, options = {}) {
        if (!param) return null;
        const q = new URLSearchParams(window.location.search),
            p = q.get(param);
        if (!p) return null;
        return Board.fromSignature(p, options);
    }

    /**
     *
     * @param {string} signature
     * @returns {Board}
     */
    static fromSignature(encryptedSignature, options = {}) {
        const [size, pattern] = Board.parseSignature(encryptedSignature);
        if (!size) return;
        return new Board(size * 1, {...options, signature: pattern})
    };

    /**
     *
     * @param {string} encryptedSignature
     * @returns {[?string, ?object]}
     */
    static parseSignature(encryptedSignature) {
        const signature = atob(encryptedSignature), n = {};
        if (!signature.match(/^\d+\:(\d+,\d+;?)+/)) return [null, null];
        const [z, sig] = signature.split(':');
        sig.split(';').forEach(s => {
            const [i, x] = s.split(',');
            n[i] = x;
        });
        return [z, n];
    };

    /**
     *
     * @param {number} r
     * @param {object} options
     * @returns {Board}
     */
    static fromRoot(r, options) {
        const z = Math.pow(r, 2);
        return new this(z * 1, options);
    };
}

/**
 *
 * @param {number} id
 * @returns {HTMLDivElement}
 */
function createCell(id) {
    const c = document.createElement('div');
    c.className = 'cell';
    c.setAttribute('id', "c_"+id);
    return c;
}

/**
 *
 * @param {Node} cell
 * @param {boolean} isPerfectSquare
 * @param {number} max
 * @param {number} difficulty
 * @returns
 */
function processCellForPossibleFixedValue(cell, isPerfectSquare, max, difficulty = 3) {
    const nfactor = 10, ofactor = 3;
    if (difficulty / 3 >= max) return;
    const chance = Math.floor(Math.random() * nfactor * (difficulty+1) * max) % (ofactor * difficulty + max) === 0;
    if (!chance) return;

    generateAndCheckValue(cell, isPerfectSquare, max);
}

/**
 *
 * @param {Node} cell
 * @param {boolean} isPerfectSquare
 * @param {number} max
 * @returns
 */
function generateAndCheckValue(cell, isPerfectSquare, max) {

    const tolerance = 10;

    // check value agains existing dataset
    const groups = [
        Board.type.ROW,
        Board.type.COLUMN,
        isPerfectSquare ? Board.type.SECTOR : null,
    ].filter(t => t);

    // generate value
    let val = generateRandomCellValue(max);

    // cycle to produce valid next number (or else exit)
    let n = 0, k = 0;
    while (n === 0 && k < tolerance) {
        k++; // prevents infinite loops if something goes wrong

        const errorGroups = groups.filter(type => {
            const list = getCellGroupDataArray(type, cell.dataset[type]);
            list.push(val);
            const filteredList = list.filter(x => x * 1);
            const numCounts = {};
            filteredList.forEach(v => {
                numCounts[v] = (numCounts[v] || 0) + 1;
            });

            const hasDuplicates = Object.values(numCounts).filter(x => x > 1).length > 0;
            return hasDuplicates;
        });

        if (errorGroups.length) {
            val = generateRandomCellValue(max);
        }
        else {
            n = val;
        }
    }

    // do not process zeros
    if (n === 0) return;

    // set value and set fixed status
    setCellToFixedValue(cell, n);
    // console.log('generate value', n, cell.dataset.row, cell.dataset.col, cell.dataset.sec);
}

/**
 *
 * @param {string} type
 * @param {number} index
 * @returns
 */
function getCellGroupDataArray(type, index) {
    const group = document.querySelectorAll(`.cell[data-${type}='${index}']`);
    return [...group].map(c => c.innerText.trim());
}

/**
 *
 * @param {number} max
 * @returns
 */
function generateRandomCellValue(max) {
    let n = 0;
    while (n === 0) n = Math.floor(Math.random() * max);
    return n;
}

/**
 *
 * @param {Node} cell
 * @param {string} val
 */
function setCellToFixedValue(cell, val) {
    cell.removeAttribute('contenteditable');
    cell.classList.add('fixed');
    cell.innerText = val;
}

/**
 *
 * @param {Node} elem
 */
function selectText(elem) {
    if (document.body.createTextRange) {
        const range = document.body.createTextRange();
        range.moveToElementText(elem);
        range.select();
    } else if (window.getSelection) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(elem);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        console.warn("Could not select text in node: Unsupported browser.");
    }
}

function calcSumOfCells(elems) {
    return [...elems].reduce((a,x) => a + x.innerText * 1,0);
}

function calcCountsPerValue(elems) {
    const counts = {};
    const nonEmptyElems = [...elems].filter(el => el.innerText.trim());
    nonEmptyElems.forEach(el => {
        const v = el.innerText.trim();
        counts[v] = (counts[v] || 0) + 1;
    })
    return Object.values(counts);
}

function isOddSector(n, base) {
    return (
        (n % 2) + ((base + 1) % 2) * Math.floor(n / base)
    ) % 2;
}

class Matrix {
    _data = {};

    has(x, y) {
        return (x in this._data && y in x in this._data[x]);
    }

    add(x, y, value) {
        if (!(x in this._data)) {
            this._data[x] = {};
        }
        this._data[x][y] = value;
    };

    get(x, y) {
        if (this.has(x,y)) return this._data[x][y];
        return null;
    };

    remove(x, y) {
        if (this.has(x,y)) this._data[x][y] = null;
    };

    getListX(x) {
        if (x in this._data) {
            return this._data[x];
        }
        return {};
    }

    getListY(y) {
        const o = {};
        for (let x in this._data) {
            if (this.has(x, y)) {
                o[y] = this.get(x, y);
            }
        }
        return o;
    }

    all() {
        return this._data;
    }

    * iterator() {
        for (let x in this._data) {
            for (let y in this._data[x]) {
                yield this._data[x][y];
            }
        }
    }
}