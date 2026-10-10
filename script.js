/**
 * QuantumCalc - Main Application Logic & Event Handlers
 */

class QuantumCalculator {
    constructor() {
        // Core State
        this.expression = '';
        this.currentValue = '0';
        this.previousResult = null;
        this.memory = 0;
        this.isDegMode = true; // Angle mode for trigonometric functions (DEG vs RAD)
        this.soundEnabled = true;
        this.history = [];
        this.justCalculated = false;

        // Web Audio API Context for tactile feedback
        this.audioCtx = null;

        // DOM Element Cache
        this.initDOM();

        // Load Persisted Preferences & History
        this.loadPreferences();

        // Bind Event Listeners
        this.bindEvents();

        // Initial Render
        this.updateDisplay();
    }

    initDOM() {
        this.elements = {
            mainDisplay: document.getElementById('main-display'),
            expressionDisplay: document.getElementById('expression-display'),
            livePreview: document.getElementById('live-preview'),
            memoryBadge: document.getElementById('memory-badge'),
            btnCopy: document.getElementById('btn-copy'),
            btnThemeToggle: document.getElementById('btn-theme-toggle'),
            btnSoundToggle: document.getElementById('btn-sound-toggle'),
            btnSciToggle: document.getElementById('btn-sci-toggle'),
            btnHistoryToggle: document.getElementById('btn-history-toggle'),
            btnShortcutsToggle: document.getElementById('btn-shortcuts-toggle'),
            btnDegRad: document.getElementById('btn-deg-rad'),
            scientificPanel: document.getElementById('scientific-panel'),
            historyDrawer: document.getElementById('history-drawer'),
            btnCloseHistory: document.getElementById('btn-close-history'),
            btnClearHistory: document.getElementById('btn-clear-history'),
            historyList: document.getElementById('history-list'),
            modalShortcuts: document.getElementById('modal-shortcuts'),
            btnCloseShortcuts: document.getElementById('btn-close-shortcuts'),
            toastContainer: document.getElementById('toast-container'),
            sunIcon: document.querySelector('.sun-icon'),
            moonIcon: document.querySelector('.moon-icon'),
            soundOnIcon: document.querySelector('.sound-on-icon'),
            soundOffIcon: document.querySelector('.sound-off-icon')
        };
    }

    loadPreferences() {
        // Theme Persistence
        const savedTheme = localStorage.getItem('quantum_calc_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcons(savedTheme);

        // Sound Preference Persistence
        const savedSound = localStorage.getItem('quantum_calc_sound');
        if (savedSound !== null) {
            this.soundEnabled = savedSound === 'true';
            this.updateSoundIcons();
        }

        // History Log Persistence
        const savedHistory = localStorage.getItem('quantum_calc_history');
        if (savedHistory) {
            try {
                this.history = JSON.parse(savedHistory);
                this.renderHistory();
            } catch (e) {
                this.history = [];
            }
        }
    }

    bindEvents() {
        // Keypad button clicks
        document.querySelector('.keypad-grid').addEventListener('click', (e) => {
            const btn = e.target.closest('.btn');
            if (!btn) return;

            this.playClickSound();
            this.handleButtonPress(btn);
        });

        // Scientific panel clicks
        document.querySelector('.sci-grid').addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-sci');
            if (!btn) return;

            this.playClickSound();
            this.handleSciButtonPress(btn);
        });

        // Memory bar clicks
        document.querySelector('.memory-bar').addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-mem');
            if (!btn) return;

            this.playClickSound();
            this.handleMemoryAction(btn.dataset.action);
        });

        // Keyboard listener
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Header Control Actions
        this.elements.btnThemeToggle.addEventListener('click', () => this.toggleTheme());
        this.elements.btnSoundToggle.addEventListener('click', () => this.toggleSound());
        this.elements.btnSciToggle.addEventListener('click', () => this.toggleScientificPanel());
        this.elements.btnHistoryToggle.addEventListener('click', () => this.toggleHistoryDrawer(true));
        this.elements.btnCloseHistory.addEventListener('click', () => this.toggleHistoryDrawer(false));
        this.elements.btnClearHistory.addEventListener('click', () => this.clearHistory());
        this.elements.btnShortcutsToggle.addEventListener('click', () => this.toggleShortcutsModal(true));
        this.elements.btnCloseShortcuts.addEventListener('click', () => this.toggleShortcutsModal(false));
        this.elements.btnCopy.addEventListener('click', () => this.copyToClipboard());

        // Modal backdrop click close
        this.elements.modalShortcuts.addEventListener('click', (e) => {
            if (e.target === this.elements.modalShortcuts) {
                this.toggleShortcutsModal(false);
            }
        });
    }

    /* --------------------------------------------------------------------------
       Input Processing & Button Routing
       -------------------------------------------------------------------------- */
    handleButtonPress(btn) {
        const action = btn.dataset.action;
        const val = btn.dataset.value;

        if (action) {
            switch (action) {
                case 'ac':
                    this.clearAll();
                    break;
                case 'ce':
                    this.clearEntry();
                    break;
                case 'backspace':
                    this.handleBackspace();
                    break;
                case 'equals':
                    this.evaluateExpression();
                    break;
                case 'negate':
                    this.toggleSign();
                    break;
            }
        } else if (val !== undefined) {
            this.appendInput(val);
        }

        this.updateDisplay();
    }

    handleSciButtonPress(btn) {
        const sci = btn.dataset.sci;
        const val = btn.dataset.value;

        if (sci === 'deg-rad') {
            this.isDegMode = !this.isDegMode;
            btn.textContent = this.isDegMode ? 'DEG' : 'RAD';
            this.showToast(`Angle Mode: ${this.isDegMode ? 'Degrees' : 'Radians'}`);
            this.updateLivePreview();
            return;
        }

        if (val) {
            this.appendInput(val);
        } else if (sci) {
            switch (sci) {
                case 'sin':
                case 'cos':
                case 'tan':
                case 'log':
                case 'ln':
                case 'sqrt':
                    this.appendFunction(`${sci}(`);
                    break;
                case 'square':
                    this.appendInput('^2');
                    break;
                case 'cube':
                    this.appendInput('^3');
                    break;
                case 'pi':
                    this.appendInput('π');
                    break;
                case 'e':
                    this.appendInput('e');
                    break;
                case 'factorial':
                    this.appendInput('!');
                    break;
            }
        }

        this.updateDisplay();
    }

    appendInput(str) {
        if (this.justCalculated) {
            // If an operator is typed right after result, reuse previous result
            if (['+', '-', '*', '/', '%', '^'].includes(str)) {
                this.expression = this.currentValue;
            } else {
                this.expression = '';
            }
            this.justCalculated = false;
        }

        // Prevent invalid double decimals in a single term
        if (str === '.') {
            const lastNumberMatch = this.expression.match(/(\d+\.?\d*)$/);
            if (lastNumberMatch && lastNumberMatch[0].includes('.')) {
                return;
            }
            if (this.expression === '' || /[+\-*\/%(^]$/.test(this.expression)) {
                this.expression += '0';
            }
        }

        this.expression += str;
        this.updateLivePreview();
    }

    appendFunction(funcStr) {
        if (this.justCalculated) {
            this.expression = '';
            this.justCalculated = false;
        }
        this.expression += funcStr;
        this.updateLivePreview();
    }

    handleBackspace() {
        if (this.justCalculated) {
            this.clearAll();
            return;
        }
        
        // Remove trailing multi-char functions if present (e.g., sin(, cos()
        const multiCharFuncs = ['sin(', 'cos(', 'tan(', 'log(', 'sqrt('];
        for (const func of multiCharFuncs) {
            if (this.expression.endsWith(func)) {
                this.expression = this.expression.slice(0, -func.length);
                this.updateLivePreview();
                return;
            }
        }

        if (this.expression.endsWith('ln(')) {
            this.expression = this.expression.slice(0, -3);
            this.updateLivePreview();
            return;
        }

        this.expression = this.expression.slice(0, -1);
        this.updateLivePreview();
    }

    clearAll() {
        this.expression = '';
        this.currentValue = '0';
        this.justCalculated = false;
        this.elements.livePreview.textContent = '';
    }

    clearEntry() {
        if (this.justCalculated) {
            this.clearAll();
            return;
        }

        // Remove the last operand or operator block
        const lastOpIndex = Math.max(
            this.expression.lastIndexOf('+'),
            this.expression.lastIndexOf('-'),
            this.expression.lastIndexOf('*'),
            this.expression.lastIndexOf('/')
        );

        if (lastOpIndex !== -1) {
            this.expression = this.expression.substring(0, lastOpIndex + 1);
        } else {
            this.expression = '';
        }
        this.updateLivePreview();
    }

    toggleSign() {
        if (this.expression === '' && this.currentValue !== '0') {
            this.expression = this.currentValue;
        }
        
        if (this.expression === '') return;

        if (this.expression.startsWith('-(') && this.expression.endsWith(')')) {
            this.expression = this.expression.slice(2, -1);
        } else if (this.expression.startsWith('-')) {
            this.expression = this.expression.slice(1);
        } else {
            this.expression = `-(${this.expression})`;
        }
        this.updateLivePreview();
    }

    /* --------------------------------------------------------------------------
       Mathematical Evaluation Engine
       -------------------------------------------------------------------------- */
    evaluateExpression() {
        if (!this.expression && this.currentValue === '0') return;
        const exprToEval = this.expression || this.currentValue;

        try {
            const rawResult = this.parseAndCompute(exprToEval);

            if (isNaN(rawResult)) {
                throw new Error('Invalid calculation');
            }

            if (!isFinite(rawResult)) {
                this.currentValue = 'Cannot divide by 0';
                this.elements.expressionDisplay.textContent = `${this.formatDisplayExpression(exprToEval)} =`;
                this.justCalculated = true;
                this.updateDisplay();
                return;
            }

            // High Precision Formatting (prevents 0.1 + 0.2 = 0.30000000000000004)
            const formattedResult = this.formatNumber(rawResult);

            // Add to history
            this.addHistoryEntry(this.formatDisplayExpression(exprToEval), formattedResult);

            // Update state
            this.elements.expressionDisplay.textContent = `${this.formatDisplayExpression(exprToEval)} =`;
            this.currentValue = formattedResult;
            this.expression = '';
            this.justCalculated = true;
            this.elements.livePreview.textContent = '';
        } catch (err) {
            this.currentValue = 'Syntax Error';
            this.justCalculated = true;
        }

        this.updateDisplay();
    }

    updateLivePreview() {
        if (!this.expression) {
            this.elements.livePreview.textContent = '';
            return;
        }

        try {
            const rawResult = this.parseAndCompute(this.expression);
            if (!isNaN(rawResult) && isFinite(rawResult)) {
                this.elements.livePreview.textContent = `= ${this.formatNumber(rawResult)}`;
            } else {
                this.elements.livePreview.textContent = '';
            }
        } catch (e) {
            this.elements.livePreview.textContent = '';
        }
    }

    parseAndCompute(expr) {
        if (!expr) return 0;

        // Sanitization and Symbol Substitutions
        let sanitized = expr
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/−/g, '-')
            .replace(/π/g, 'Math.PI')
            .replace(/\be\b/g, 'Math.E');

        // Replace Factorials (e.g. 5! -> factorial(5))
        sanitized = sanitized.replace(/(\d+(\.\d+)?|\([^)]+\))!/g, (match, num) => {
            return `this.factorial(${num})`;
        });

        // Replace Power (e.g. 2^3 -> Math.pow(2,3))
        sanitized = sanitized.replace(/([0-9.Math.PIMath.E]+|\([^\)]+\))\^([0-9.Math.PIMath.E]+|\([^\)]+\))/g, 'Math.pow($1, $2)');

        // Replace Percentage (e.g. 50% -> (50/100))
        sanitized = sanitized.replace(/(\d+(\.\d+)?)(%)/g, '($1/100)');

        // Handle Trigonometric & Logarithmic functions
        const isDeg = this.isDegMode;
        
        // Custom wrapper functions injected for safety
        const sin = (x) => Math.sin(isDeg ? (x * Math.PI) / 180 : x);
        const cos = (x) => Math.cos(isDeg ? (x * Math.PI) / 180 : x);
        const tan = (x) => Math.tan(isDeg ? (x * Math.PI) / 180 : x);
        const log = (x) => Math.log10(x);
        const ln = (x) => Math.log(x);
        const sqrt = (x) => Math.sqrt(x);

        // Safe Function Evaluator Scope
        const safeEval = new Function(
            'sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'Math', 'factorial',
            `"use strict"; return (${sanitized});`
        );

        return safeEval(
            sin, cos, tan, log, ln, sqrt, Math, (n) => this.factorial(n)
        );
    }

    factorial(n) {
        n = Number(n);
        if (n < 0) return NaN;
        if (n === 0 || n === 1) return 1;
        if (!Number.isInteger(n)) return NaN; // Simple integer factorial
        let result = 1;
        for (let i = 2; i <= n; i++) result *= i;
        return result;
    }

    formatNumber(num) {
        if (typeof num !== 'number') return num;
        
        // Precision fixing
        const cleanNum = Math.round((num + Number.EPSILON) * 1e12) / 1e12;
        
        // Use scientific notation for extremely large or small numbers
        if (Math.abs(cleanNum) > 1e11 || (Math.abs(cleanNum) < 1e-7 && cleanNum !== 0)) {
            return cleanNum.toExponential(6);
        }

        return cleanNum.toLocaleString('en-US', { maximumFractionDigits: 10 });
    }

    formatDisplayExpression(expr) {
        return expr
            .replace(/\*/g, ' × ')
            .replace(/\//g, ' ÷ ')
            .replace(/-/g, ' − ')
            .replace(/\+/g, ' + ');
    }

    /* --------------------------------------------------------------------------
       Display & UI Updates
       -------------------------------------------------------------------------- */
    updateDisplay() {
        if (this.expression && !this.justCalculated) {
            this.elements.mainDisplay.textContent = this.formatDisplayExpression(this.expression);
        } else {
            this.elements.mainDisplay.textContent = this.currentValue;
        }

        // Adjust font size dynamically if text is long
        const len = this.elements.mainDisplay.textContent.length;
        if (len > 14) {
            this.elements.mainDisplay.style.fontSize = '1.4rem';
        } else if (len > 9) {
            this.elements.mainDisplay.style.fontSize = '1.8rem';
        } else {
            this.elements.mainDisplay.style.fontSize = '2.5rem';
        }

        // Memory badge indicator
        if (this.memory !== 0) {
            this.elements.memoryBadge.classList.remove('hidden');
        } else {
            this.elements.memoryBadge.classList.add('hidden');
        }
    }

    /* --------------------------------------------------------------------------
       Memory Bar Operations
       -------------------------------------------------------------------------- */
    handleMemoryAction(action) {
        const currentNum = parseFloat(this.currentValue.replace(/,/g, '')) || 0;

        switch (action) {
            case 'mc':
                this.memory = 0;
                this.showToast('Memory Cleared (MC)');
                break;
            case 'mr':
                this.expression += this.formatNumber(this.memory);
                this.showToast(`Memory Recalled: ${this.formatNumber(this.memory)}`);
                break;
            case 'm-plus':
                this.memory += currentNum;
                this.showToast(`Added to Memory (M+)`);
                break;
            case 'm-minus':
                this.memory -= currentNum;
                this.showToast(`Subtracted from Memory (M-)`);
                break;
            case 'ms':
                this.memory = currentNum;
                this.showToast(`Stored in Memory: ${this.formatNumber(this.memory)}`);
                break;
        }

        this.updateDisplay();
    }

    /* --------------------------------------------------------------------------
       Keyboard Integration & Shortcuts
       -------------------------------------------------------------------------- */
    handleKeyDown(e) {
        // Ignore key events if modal or active text input is focused
        if (document.activeElement.tagName === 'INPUT') return;

        const key = e.key;

        // Number Keys (0-9) & Decimal
        if (/^[0-9]$/.test(key)) {
            this.triggerButtonHighlight(`[data-key="${key}"]`);
            this.appendInput(key);
            this.playClickSound();
        } else if (key === '.') {
            this.triggerButtonHighlight('[data-key="."]');
            this.appendInput('.');
            this.playClickSound();
        } 
        // Basic Arithmetic Operators
        else if (key === '+') {
            this.triggerButtonHighlight('#btn-key-add');
            this.appendInput('+');
            this.playClickSound();
        } else if (key === '-') {
            this.triggerButtonHighlight('#btn-key-subtract');
            this.appendInput('-');
            this.playClickSound();
        } else if (key === '*') {
            this.triggerButtonHighlight('#btn-key-multiply');
            this.appendInput('*');
            this.playClickSound();
        } else if (key === '/') {
            e.preventDefault(); // Prevent Firefox quick find
            this.triggerButtonHighlight('#btn-key-divide');
            this.appendInput('/');
            this.playClickSound();
        } else if (key === '%') {
            this.appendInput('%');
            this.playClickSound();
        }
        // Equals & Enter
        else if (key === 'Enter' || key === '=') {
            e.preventDefault();
            this.triggerButtonHighlight('#btn-key-equals');
            this.evaluateExpression();
            this.playClickSound();
        }
        // Backspace & Escape
        else if (key === 'Backspace') {
            this.triggerButtonHighlight('#btn-key-backspace');
            this.handleBackspace();
            this.playClickSound();
        } else if (key === 'Escape') {
            this.triggerButtonHighlight('#btn-key-ac');
            this.clearAll();
            this.playClickSound();
        }
        // Parentheses & Exponent
        else if (key === '(' || key === ')') {
            this.appendInput(key);
            this.playClickSound();
        } else if (key === '^') {
            this.appendInput('^');
            this.playClickSound();
        }

        this.updateDisplay();
    }

    triggerButtonHighlight(selector) {
        const btn = document.querySelector(selector);
        if (btn) {
            btn.classList.add('pressed');
            setTimeout(() => btn.classList.remove('pressed'), 150);
        }
    }

    /* --------------------------------------------------------------------------
       History Log Manager
       -------------------------------------------------------------------------- */
    addHistoryEntry(expression, result) {
        const item = {
            id: Date.now(),
            expression,
            result,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        this.history.unshift(item);
        if (this.history.length > 30) this.history.pop(); // Max 30 entries

        localStorage.setItem('quantum_calc_history', JSON.stringify(this.history));
        this.renderHistory();
    }

    renderHistory() {
        if (this.history.length === 0) {
            this.elements.historyList.innerHTML = `
                <div class="empty-history">
                    <p>No calculation history yet.</p>
                    <small>Your completed calculations will appear here.</small>
                </div>
            `;
            return;
        }

        this.elements.historyList.innerHTML = this.history.map(item => `
            <div class="history-item" data-res="${item.result}" data-exp="${item.expression}">
                <div class="hist-exp">${item.expression}</div>
                <div class="hist-res">= ${item.result}</div>
            </div>
        `).join('');

        // Attach click listeners to history entries to recall result
        this.elements.historyList.querySelectorAll('.history-item').forEach(el => {
            el.addEventListener('click', () => {
                const res = el.dataset.res;
                this.expression += res.replace(/,/g, '');
                this.updateDisplay();
                this.toggleHistoryDrawer(false);
                this.showToast(`Recalled ${res} to calculator`);
            });
        });
    }

    clearHistory() {
        this.history = [];
        localStorage.removeItem('quantum_calc_history');
        this.renderHistory();
        this.showToast('Calculation history cleared');
    }

    /* --------------------------------------------------------------------------
       Web Audio API Tactile Sound Synthesis
       -------------------------------------------------------------------------- */
    playClickSound() {
        if (!this.soundEnabled) return;

        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }

            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, this.audioCtx.currentTime + 0.04);

            gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.04);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.04);
        } catch (e) {
            // Audio API restricted or unsupported
        }
    }

    /* --------------------------------------------------------------------------
       Theme & UI Toggles
       -------------------------------------------------------------------------- */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('quantum_calc_theme', newTheme);

        this.updateThemeIcons(newTheme);
        this.showToast(`Switched to ${newTheme.toUpperCase()} theme`);
    }

    updateThemeIcons(theme) {
        if (theme === 'dark') {
            this.elements.moonIcon.classList.remove('hidden');
            this.elements.sunIcon.classList.add('hidden');
        } else {
            this.elements.moonIcon.classList.add('hidden');
            this.elements.sunIcon.classList.remove('hidden');
        }
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('quantum_calc_sound', this.soundEnabled);
        this.updateSoundIcons();
        this.showToast(`Sound feedback ${this.soundEnabled ? 'Enabled' : 'Muted'}`);
    }

    updateSoundIcons() {
        if (this.soundEnabled) {
            this.elements.soundOnIcon.classList.remove('hidden');
            this.elements.soundOffIcon.classList.add('hidden');
        } else {
            this.elements.soundOnIcon.classList.add('hidden');
            this.elements.soundOffIcon.classList.remove('hidden');
        }
    }

    toggleScientificPanel() {
        this.elements.scientificPanel.classList.toggle('hidden');
    }

    toggleHistoryDrawer(open) {
        if (open) {
            this.elements.historyDrawer.classList.add('open');
        } else {
            this.elements.historyDrawer.classList.remove('open');
        }
    }

    toggleShortcutsModal(open) {
        if (open) {
            this.elements.modalShortcuts.classList.remove('hidden');
        } else {
            this.elements.modalShortcuts.classList.add('hidden');
        }
    }

    /* --------------------------------------------------------------------------
       Copy to Clipboard & Toast System
       -------------------------------------------------------------------------- */
    copyToClipboard() {
        const textToCopy = this.currentValue.replace(/,/g, '');
        if (!textToCopy || textToCopy === '0') return;

        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                this.showToast('Copied result to clipboard! 📋');
            })
            .catch(() => {
                this.showToast('Failed to copy');
            });
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;

        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 2200);
    }
}

// Instantiate Calculator on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    window.calculator = new QuantumCalculator();
});

