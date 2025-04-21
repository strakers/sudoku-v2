class Board {
    ref = {};

    constructor(z = 9, options = {}) {
        const r = Math.sqrt(z);
        this.r = r;
        this.x = z;
        this.y = z;
        this.options = options;
        this.cellSize = options?.size ?? '32px';

        this.ref = {
            cells: [],
            matrix: Array.from(Array(this.y)).map(()=>[]),
            board: null,
        };

        this.errors = {
            row: {},
            col: {},
            sec: {},
        };

        this.type = {
            ROW: 'row',
            COLUMN: 'col',
            SECTOR: 'sec',
        };

        this.showErrors = true;
        this.groupSum = (this.x/2)*(1+this.y);

        this.updateCssRoot();
    };

    updateCssRoot() {
        const r = document.querySelector(':root');
        const s = r.style;
        s.setProperty('--matrix-x',this.x);
        s.setProperty('--matrix-y',this.y);
        s.setProperty('--size',this.cellSize);
    };

    build(selector) {
        this.ref.board = document.querySelector(selector);
        if (! this.ref.board) return; // should throw error

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

        // draw board on page
        for (let row = 0, sector = 0; row < this.y; ++row) {
            for (let col = 0; col < this.x; ++col) {
                sector = (Math.floor(row / this.r) * this.r) + Math.floor(col / this.r);

                // build cell
                let cell = createCell(row * this.x + col);
                cell.setAttribute('data-row', row);
                cell.setAttribute('data-col', col);
                cell.setAttribute('data-sec', sector);
                cell.setAttribute('contenteditable', true);

                (Math.floor(Math.random() * 50) % 7 === 0 ? setCellFixedValue(cell, Math.floor(Math.random() * this.y)) : '');

                // load cell
                this.ref.board.appendChild(cell);
                this.ref.cells.push(cell);
                this.ref.matrix[row].push(cell);

                // equip cell with action listeners
                cell.addEventListener('click', e => selectText(e.target));
                cell.addEventListener('input', e => e.target.setAttribute('data-changed', true));
                cell.addEventListener('keypress', e => {
                    (!(e.key > 0 && e.key <= this.x)) && e.preventDefault();
                    (e.key === 'Enter'||e.code === 'Space') && e.target.blur();
                    (e.key === '0') ? e.target.innerText = '' : null;
                    // console.log('press',e)
                });
                cell.addEventListener('focusout', e => {
                    e.target.innerText = e.target.innerText.trim();
                    if (e.target.getAttribute('data-changed') == "true") {
                        this.validateCell(e.target);
                        e.target.setAttribute('data-changed',false);
                        console.log('mouseout view errors', this.errors)
                    }
                });
            }
        }

        // make method chainable
        return this;
    };

    destroy() {
        this.ref.board.classList.remove('completed');

        this.ref.cells = null;
        this.ref.matrix = null;

        this.ref.board.innerHTML = '';
        this.ref.board = null;
    }

    validateCell(cell) {
        this.ref.board.classList.remove('completed');

        const indices = {
            [this.type.ROW]: cell.dataset.row,
            [this.type.COLUMN]: cell.dataset.col,
            [this.type.SECTOR]: cell.dataset.sec,
        }

        const groups = [
            [this.type.ROW,     this.ref.board.querySelectorAll(`.cell[data-row='${indices[this.type.ROW]}']`)],
            [this.type.COLUMN,  this.ref.board.querySelectorAll(`.cell[data-col='${indices[this.type.COLUMN]}']`)],
            [this.type.SECTOR,  this.ref.board.querySelectorAll(`.cell[data-sec='${indices[this.type.SECTOR]}']`)],
        ];
        if (! this.isPerfectSquare()) groups.pop();

        // console.log('validation summary', 'TYPE', "//", 'DUP', 'FILL','MATCH', "ERROR");

        groups.forEach(([type, cells]) => {
            const index = indices[type],
                otherTypes = [this.type.ROW, this.type.COLUMN, this.type.SECTOR].filter(t => t && t !== type);

            // error checking algorythm
            const hasDuplicateValuesInGroup = calcCountsPerValue(cells).filter(n => n > 1).length > 0;
            const hasAllCellsFilledInGroup = [...cells].filter(c => c.innerText.trim()).length === cells.length;
            const hasSumMatchingGroupSum = calcSumOfCells(cells)  === this.groupSum;
            this.errors[type][index] = hasDuplicateValuesInGroup || (hasAllCellsFilledInGroup ? !hasSumMatchingGroupSum : false);

            // console.log('validation summary', type, "//",
            //     hasDuplicateValuesInGroup,
            //     hasAllCellsFilledInGroup,
            //     hasSumMatchingGroupSum,
            //     hasDuplicateValuesInGroup || (hasAllCellsFilledInGroup ? hasSumMatchingGroupSum : false)
            // );

            // report error status per cell
            if (this.errors[type][index]) {
                [...cells].forEach((cell) => cell.classList.add('error'));
                return;
            }

            // clear cells of any error status where applicable
            // loop through each cell and remove error class if cell otherTypes do not have error set.
            [...cells].forEach((cell) => {
                const [otherType1, otherType2] = otherTypes,
                i1 = cell.dataset[otherType1],
                i2 = cell.dataset[otherType2];
                if (!this.errors[otherType1][i1] && !this.errors[otherType2][i2]) {
                    cell.classList.remove('error');
                }
            });
        });

        // mark complete if board is successfully filled with no errors
        if (this.isCompleted()) {
            this.ref.board.classList.add('completed');
            this.lock();
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
            });
            document.querySelector('#loader_btn').focus();
        }
    };

    lock() {
        this.ref.cells.forEach(c => c.hasAttribute('contenteditable') ? c.setAttribute('contenteditable',false) : null);
    };

    unlock() {
        this.ref.cells.forEach(c => c.classList.contains('fixed') ? null : c.setAttribute('contenteditable',true));
    }

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
        return Math.pow(Math.sqrt(this.x),2) === this.x;
    };

    static fromRoot(r, options) {
        const z = Math.pow(r, 2);
        return new this(z, options);
    }
}

function createCell(id) {
    const c = document.createElement('div');
    c.className = 'cell';
    c.setAttribute('id', "c_"+id);
    return c;
}

function setCellFixedValue(cell, val) {
    if (isNaN(val) || val < 1) return;
    cell.removeAttribute('contenteditable');
    cell.classList.add('fixed');
    cell.innerText = val;
}

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