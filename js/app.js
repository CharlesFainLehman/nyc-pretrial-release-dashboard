/**
 * Main application controller.
 */

const App = {
    activeTab: 'borough',
    judgeLoaded: false,
    releaseMode: 'pct',
    rearrestMode: 'pct',
    use180: false,

    async init() {
        // Load county data
        const lookups = await DataStore.loadCountyData();

        // Init filters
        Filters.init(lookups, () => this.update());

        // Tab switching
        document.querySelectorAll('.tab').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Chart mode toggles
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleToggle(btn));
        });

        // 180-day toggle
        document.getElementById('toggle-180').addEventListener('change', (e) => {
            this.use180 = e.target.checked;
            this.updateBoroughView();
        });

        // Judge input
        document.getElementById('filter-judge').addEventListener('change', () => this.updateJudgeView());
        document.getElementById('filter-judge').addEventListener('input', () => {
            // Debounce
            clearTimeout(this._judgeTimeout);
            this._judgeTimeout = setTimeout(() => this.updateJudgeView(), 300);
        });

        // Min cases filter
        document.getElementById('min-cases').addEventListener('change', () => this.updateJudgeView());

        // Judge table sorting
        document.querySelectorAll('#judge-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.sortJudgeTable(th.dataset.sort));
        });

        // Initial render
        this.update();
    },

    switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.toggle('active', tc.id === `tab-${tab}`));

        if (tab === 'judge' && !this.judgeLoaded) {
            this.loadJudgeData();
        } else if (tab === 'judge') {
            this.updateJudgeView();
        }
    },

    async loadJudgeData() {
        document.getElementById('judge-loading').style.display = 'block';
        document.getElementById('judge-charts').style.display = 'none';

        await DataStore.loadJudgeData();
        this.judgeLoaded = true;

        document.getElementById('judge-loading').style.display = 'none';
        document.getElementById('judge-charts').style.display = 'block';

        const filters = Filters.getFilters();
        Filters.populateJudges(DataStore.judgeLookups.judges, filters);
        this.updateJudgeView();
    },

    handleToggle(btn) {
        const chart = btn.dataset.chart;
        const mode = btn.dataset.mode;

        // Update button states
        btn.parentElement.querySelectorAll('.toggle-btn').forEach(b => {
            b.classList.toggle('active', b === btn);
        });

        if (chart === 'release') {
            this.releaseMode = mode;
        } else if (chart === 'rearrest') {
            this.rearrestMode = mode;
        }

        this.updateBoroughView();
    },

    update() {
        if (this.activeTab === 'borough') {
            this.updateBoroughView();
        } else {
            if (this.judgeLoaded) {
                const filters = Filters.getFilters();
                Filters.populateJudges(DataStore.judgeLookups.judges, filters);
                this.updateJudgeView();
            }
        }
    },

    updateBoroughView() {
        const filters = Filters.getFilters();
        const totals = DataStore.getCountyTotals(filters);

        // Stats cards
        this.renderStats(totals, filters);

        // Release decisions chart
        const releaseData = DataStore.getReleaseByCategory(filters);
        Charts.renderReleaseChart('chart-release', releaseData, this.releaseMode);

        // Rearrest outcomes chart
        const rearrestData = DataStore.getRearrestByCategory(filters, this.use180);
        Charts.renderRearrestChart('chart-rearrest', rearrestData, this.rearrestMode);

        // Rearrest note
        const noteEl = document.getElementById('rearrest-note');
        if (this.use180 && (filters.year === 'all' || filters.year === 2020)) {
            noteEl.textContent = 'Note: 180-day rearrest data is not available for 2020. Values for 2020 are shown as zero.';
        } else {
            const nullCount = totals.rearrest[4];
            if (nullCount > 0) {
                noteEl.textContent = `${nullCount.toLocaleString()} cases with unknown rearrest status (pending cases) excluded from percentages.`;
            } else {
                noteEl.textContent = '';
            }
        }

        // Rearrest by release type (overall breakdown)
        Charts.renderRearrestByRelease('chart-rearrest-by-release', totals);

        // Disable 180-day toggle if only 2020
        const toggle180 = document.getElementById('toggle-180');
        if (filters.year === 2020) {
            toggle180.disabled = true;
            toggle180.checked = false;
            this.use180 = false;
        } else {
            toggle180.disabled = false;
        }
    },

    renderStats(totals, filters) {
        const container = document.getElementById('stats-cards');
        const ra = totals.rearrest;
        const raKnown = ra[0] + ra[1] + ra[2] + ra[3];
        const rearrestCount = ra[1] + ra[2] + ra[3];
        const rorRate = totals.total > 0 ? (totals.release[0] / totals.total * 100).toFixed(1) : '0';
        const rearrestRate = raKnown > 0 ? (rearrestCount / raKnown * 100).toFixed(1) : '0';
        const vfRate = raKnown > 0 ? (ra[3] / raKnown * 100).toFixed(1) : '0';
        const firearmRate = (totals.firearm[0] + totals.firearm[1]) > 0
            ? (totals.firearm[1] / (totals.firearm[0] + totals.firearm[1]) * 100).toFixed(1) : '0';

        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${totals.total.toLocaleString()}</div>
                <div class="stat-label">Arraignments</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${rorRate}%</div>
                <div class="stat-label">ROR Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${rearrestRate}%</div>
                <div class="stat-label">Rearrest Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${vfRate}%</div>
                <div class="stat-label">Violent Felony Rearrest</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${firearmRate}%</div>
                <div class="stat-label">Firearm Rearrest</div>
            </div>
        `;
    },

    updateJudgeView() {
        if (!this.judgeLoaded) return;

        const filters = Filters.getFilters();
        const minCases = parseInt(document.getElementById('min-cases').value) || 30;

        // Update judge table
        const tableData = DataStore.getJudgeTable(filters, minCases);
        this.renderJudgeTable(tableData, minCases);

        // Update judge comparison charts
        const judgeIdx = Filters.getSelectedJudge();
        const caseCountEl = document.getElementById('judge-case-count');

        if (judgeIdx !== null) {
            const comparison = DataStore.getJudgeComparison(filters, judgeIdx);
            if (comparison) {
                caseCountEl.textContent = `${comparison.judge.total.toLocaleString()} cases`;
                Charts.renderJudgeReleaseComparison('chart-judge-release', comparison);
                Charts.renderJudgeRearrestComparison('chart-judge-rearrest', comparison);
            }
        } else {
            caseCountEl.textContent = '';
            Charts.destroy('chart-judge-release');
            Charts.destroy('chart-judge-rearrest');
        }
    },

    _judgeSortCol: 'total',
    _judgeSortAsc: false,

    sortJudgeTable(col) {
        if (this._judgeSortCol === col) {
            this._judgeSortAsc = !this._judgeSortAsc;
        } else {
            this._judgeSortCol = col;
            this._judgeSortAsc = col === 'name'; // alpha ascending by default, numbers descending
        }
        this.updateJudgeView();
    },

    renderJudgeTable(data, minCases) {
        const tbody = document.querySelector('#judge-table tbody');

        // Sort
        const col = this._judgeSortCol;
        const asc = this._judgeSortAsc;
        data.sort((a, b) => {
            let va = a[col], vb = b[col];
            if (typeof va === 'string') {
                return asc ? va.localeCompare(vb) : vb.localeCompare(va);
            }
            return asc ? va - vb : vb - va;
        });

        // Update sort arrows
        document.querySelectorAll('#judge-table th[data-sort]').forEach(th => {
            const arrow = th.querySelector('.sort-arrow');
            if (th.dataset.sort === col) {
                arrow.textContent = asc ? ' \u25B2' : ' \u25BC';
            } else {
                arrow.textContent = '';
            }
        });

        tbody.innerHTML = data.map(j => `
            <tr class="${j.lowCount ? 'low-count' : ''} ${j.idx === Filters.getSelectedJudge() ? 'selected' : ''}"
                data-judge="${j.name}">
                <td>${j.name}</td>
                <td>${j.total.toLocaleString()}</td>
                <td>${j.ror.toFixed(1)}</td>
                <td>${j.bail.toFixed(1)}</td>
                <td>${j.nmr.toFixed(1)}</td>
                <td>${j.remand.toFixed(1)}</td>
                <td>${j.rearrest.toFixed(1)}</td>
                <td>${j.vf.toFixed(1)}</td>
            </tr>
        `).join('');

        // Click to select judge
        tbody.querySelectorAll('tr').forEach(tr => {
            tr.addEventListener('click', () => {
                document.getElementById('filter-judge').value = tr.dataset.judge;
                this.updateJudgeView();
            });
        });
    },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
