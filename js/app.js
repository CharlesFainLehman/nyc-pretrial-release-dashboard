/**
 * Main application controller - MI-style simplified dashboard.
 */

const App = {
    activeTab: 'overview',
    judgeLoaded: false,
    _judgeSortCol: 'rearrest',
    _judgeSortAsc: false,
    _crimeSortCol: 'rearrest',
    _crimeSortAsc: false,
    selectedJudgeIdx: null,

    async init() {
        const lookups = await DataStore.loadCountyData();
        Filters.init(lookups, () => this.update());

        // Tab switching
        document.querySelectorAll('.tab').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Crime table sorting
        document.querySelectorAll('#crime-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this._crimeSortCol === col) this._crimeSortAsc = !this._crimeSortAsc;
                else { this._crimeSortCol = col; this._crimeSortAsc = col === 'name'; }
                this.updateOverview();
            });
        });

        // Judge table sorting
        document.querySelectorAll('#judge-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this._judgeSortCol === col) this._judgeSortAsc = !this._judgeSortAsc;
                else { this._judgeSortCol = col; this._judgeSortAsc = col === 'name'; }
                this.updateJudgeTable();
            });
        });

        this.update();
    },

    switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.toggle('active', tc.id === `tab-${tab}`));

        if (tab === 'judge' && !this.judgeLoaded) {
            this.loadJudgeData();
        } else if (tab === 'judge') {
            this.updateJudgeTable();
        }
    },

    async loadJudgeData() {
        document.getElementById('judge-loading').style.display = 'block';
        document.getElementById('judge-table-wrap').style.display = 'none';
        await DataStore.loadJudgeData();
        this.judgeLoaded = true;
        document.getElementById('judge-loading').style.display = 'none';
        document.getElementById('judge-table-wrap').style.display = 'block';
        this.updateJudgeTable();
    },

    update() {
        this.updateHeroStats();
        this.updateOverview();
        if (this.activeTab === 'judge' && this.judgeLoaded) {
            this.updateJudgeTable();
        }
    },

    updateHeroStats() {
        const filters = Filters.getFilters();
        const t = DataStore.getCountyTotals(filters);
        const ra = t.rearrest;
        const raKnown = ra[0] + ra[1] + ra[2] + ra[3];
        const rearrestCount = ra[1] + ra[2] + ra[3];
        const vfCount = ra[3];

        // "Released" = ROR + NMR + Bail posted = not remanded, not disposed
        // release indices: 0=ROR, 1=disposed, 2=NMR, 3=bail, 4=unknown, 5=remanded
        const releasedCount = t.release[0] + t.release[2] + t.release[3];
        const releasedPct = t.total > 0 ? (releasedCount / t.total * 100).toFixed(0) : 0;
        const rearrestPct = raKnown > 0 ? (rearrestCount / raKnown * 100).toFixed(1) : 0;
        const vfPct = raKnown > 0 ? (vfCount / raKnown * 100).toFixed(1) : 0;

        document.getElementById('hero-stats').innerHTML = `
            <div class="hero-stat">
                <div class="stat-value">${t.total.toLocaleString()}</div>
                <div class="stat-label">Arraignments</div>
            </div>
            <div class="hero-stat">
                <div class="stat-value">${releasedPct}%</div>
                <div class="stat-label">Released at Arraignment</div>
            </div>
            <div class="hero-stat alert">
                <div class="stat-value">${rearrestCount.toLocaleString()}</div>
                <div class="stat-label">Rearrested Before Disposition</div>
            </div>
            <div class="hero-stat alert">
                <div class="stat-value">${vfPct}%</div>
                <div class="stat-label">Violent Felony Rearrest Rate</div>
            </div>
        `;
    },

    updateOverview() {
        const filters = Filters.getFilters();
        const totals = DataStore.getCountyTotals(filters);

        // Release donut
        Charts.renderReleaseSummary('chart-release-summary', totals);

        // Rearrest by crime chart + table
        const crimeData = this.getCrimeTableData(filters);
        this.renderCrimeTable(crimeData);

        // Rearrest by crime chart - sorted by rearrest rate descending
        const sorted = [...crimeData].sort((a, b) => a.rearrest - b.rearrest); // ascending for horizontal bar (top = highest)
        Charts.renderRearrestByCrime('chart-rearrest-by-crime', {
            labels: sorted.map(d => d.name),
            rearrestRate: sorted.map(d => d.rearrest),
            felonyRate: sorted.map(d => d.felony_ra),
            vfRate: sorted.map(d => d.vf_ra),
        });

        // Note
        const noteEl = document.getElementById('rearrest-note');
        const ra = totals.rearrest;
        const nullCount = ra[4];
        if (nullCount > 0) {
            noteEl.textContent = `${nullCount.toLocaleString()} cases with pending outcomes excluded from rearrest calculations.`;
        } else {
            noteEl.textContent = '';
        }
    },

    getCrimeTableData(filters) {
        const C = DataStore.C;
        const rows = DataStore.filterCounty(filters);
        const cats = DataStore.lookups.categories;

        // Group by category
        const grouped = new Map();
        for (const r of rows) {
            const key = r[C.CAT];
            if (!grouped.has(key)) grouped.set(key, { total: 0, rel: [0,0,0,0,0,0], ra: [0,0,0,0,0] });
            const g = grouped.get(key);
            g.total += r[C.TOTAL];
            for (let i = 0; i < 6; i++) g.rel[i] += r[C.ROR + i];
            for (let i = 0; i < 5; i++) g.ra[i] += r[C.RA_NONE + i];
        }

        const result = [];
        for (const [catIdx, g] of grouped) {
            const raKnown = g.ra[0] + g.ra[1] + g.ra[2] + g.ra[3];
            const rearrestCount = g.ra[1] + g.ra[2] + g.ra[3];
            const felonyCount = g.ra[2] + g.ra[3];
            const released = g.rel[0] + g.rel[2] + g.rel[3]; // ROR + NMR + bail
            result.push({
                name: cats[catIdx],
                total: g.total,
                ror: g.total > 0 ? +(g.rel[0] / g.total * 100).toFixed(1) : 0,
                released: g.total > 0 ? +(released / g.total * 100).toFixed(1) : 0,
                rearrest: raKnown > 0 ? +(rearrestCount / raKnown * 100).toFixed(1) : 0,
                felony_ra: raKnown > 0 ? +(felonyCount / raKnown * 100).toFixed(1) : 0,
                vf_ra: raKnown > 0 ? +(g.ra[3] / raKnown * 100).toFixed(1) : 0,
            });
        }
        return result;
    },

    renderCrimeTable(data) {
        const col = this._crimeSortCol;
        const asc = this._crimeSortAsc;
        data.sort((a, b) => {
            let va = a[col], vb = b[col];
            if (typeof va === 'string') return asc ? va.localeCompare(vb) : vb.localeCompare(va);
            return asc ? va - vb : vb - va;
        });

        // Update sort arrows
        document.querySelectorAll('#crime-table th[data-sort]').forEach(th => {
            const arrow = th.querySelector('.sort-arrow');
            arrow.textContent = th.dataset.sort === col ? (asc ? ' \u25B2' : ' \u25BC') : '';
        });

        const tbody = document.querySelector('#crime-table tbody');
        tbody.innerHTML = data.map(d => `
            <tr>
                <td>${d.name}</td>
                <td>${d.total.toLocaleString()}</td>
                <td>${d.ror.toFixed(1)}</td>
                <td>${d.released.toFixed(1)}</td>
                <td class="${d.rearrest >= 25 ? 'high-rearrest' : ''}">${d.rearrest.toFixed(1)}</td>
                <td class="${d.felony_ra >= 10 ? 'high-rearrest' : ''}">${d.felony_ra.toFixed(1)}</td>
                <td class="${d.vf_ra >= 5 ? 'high-rearrest' : ''}">${d.vf_ra.toFixed(1)}</td>
            </tr>
        `).join('');
    },

    updateJudgeTable() {
        if (!this.judgeLoaded) return;
        const filters = Filters.getFilters();
        const J = DataStore.J;
        const rows = DataStore.filterJudge({ ...filters, judge: 'all' });
        const judges = DataStore.judgeLookups.judges;

        // Group by judge
        const grouped = DataStore.groupBy(rows, J.JUDGE, J.TOTAL, 22);
        const data = [];

        for (const [judgeIdx, m] of grouped) {
            const total = m[0];
            if (total < 100) continue; // min threshold

            const ror = m[1];
            const nmr = m[3];
            const bail = m[4];
            const remand = m[6];
            const released = ror + nmr + bail;
            const raKnown = m[7] + m[8] + m[9] + m[10];
            const rearrestCount = m[8] + m[9] + m[10];
            const felonyCount = m[9] + m[10];
            const vfCount = m[10];

            data.push({
                idx: judgeIdx,
                name: judges[judgeIdx],
                total,
                ror: total > 0 ? +(ror / total * 100).toFixed(1) : 0,
                released: total > 0 ? +(released / total * 100).toFixed(1) : 0,
                rearrest: raKnown > 0 ? +(rearrestCount / raKnown * 100).toFixed(1) : 0,
                felony_ra: raKnown > 0 ? +(felonyCount / raKnown * 100).toFixed(1) : 0,
                vf: raKnown > 0 ? +(vfCount / raKnown * 100).toFixed(1) : 0,
            });
        }

        // Sort
        const col = this._judgeSortCol;
        const asc = this._judgeSortAsc;
        data.sort((a, b) => {
            let va = a[col], vb = b[col];
            if (typeof va === 'string') return asc ? va.localeCompare(vb) : vb.localeCompare(va);
            return asc ? va - vb : vb - va;
        });

        // Update sort arrows
        document.querySelectorAll('#judge-table th[data-sort]').forEach(th => {
            const arrow = th.querySelector('.sort-arrow');
            arrow.textContent = th.dataset.sort === col ? (asc ? ' \u25B2' : ' \u25BC') : '';
        });

        // Compute borough averages for comparison
        const allTotals = data.reduce((a, d) => a + d.total, 0);
        const avgRor = data.length > 0 ? (data.reduce((a, d) => a + d.ror * d.total, 0) / allTotals) : 0;
        const avgReleased = data.length > 0 ? (data.reduce((a, d) => a + d.released * d.total, 0) / allTotals) : 0;
        const avgRearrest = data.length > 0 ? (data.reduce((a, d) => a + d.rearrest * d.total, 0) / allTotals) : 0;
        const avgVf = data.length > 0 ? (data.reduce((a, d) => a + d.vf * d.total, 0) / allTotals) : 0;
        this._avgStats = { ror: avgRor, released: avgReleased, rearrest: avgRearrest, vf: avgVf };

        const tbody = document.querySelector('#judge-table tbody');
        tbody.innerHTML = data.map(d => `
            <tr data-idx="${d.idx}" class="${d.idx === this.selectedJudgeIdx ? 'selected' : ''}">
                <td>${d.name}</td>
                <td>${d.total.toLocaleString()}</td>
                <td>${d.ror.toFixed(1)}</td>
                <td>${d.released.toFixed(1)}</td>
                <td class="${d.rearrest >= 25 ? 'high-rearrest' : ''}">${d.rearrest.toFixed(1)}</td>
                <td class="${d.felony_ra >= 10 ? 'high-rearrest' : ''}">${d.felony_ra.toFixed(1)}</td>
                <td class="${d.vf >= 5 ? 'high-rearrest' : ''}">${d.vf.toFixed(1)}</td>
            </tr>
        `).join('');

        // Click to select
        tbody.querySelectorAll('tr').forEach(tr => {
            tr.addEventListener('click', () => {
                const idx = parseInt(tr.dataset.idx);
                this.selectedJudgeIdx = idx;
                const judge = data.find(d => d.idx === idx);
                if (judge) this.showJudgeComparison(judge);
                // Highlight row
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
                tr.classList.add('selected');
            });
        });

        // If a judge was already selected, refresh comparison
        if (this.selectedJudgeIdx !== null) {
            const judge = data.find(d => d.idx === this.selectedJudgeIdx);
            if (judge) this.showJudgeComparison(judge);
        }
    },

    showJudgeComparison(judge) {
        const el = document.getElementById('judge-compare');
        el.style.display = 'block';
        document.getElementById('judge-compare-name').textContent = judge.name;
        document.getElementById('judge-compare-cases').textContent = `${judge.total.toLocaleString()} cases`;

        const avg = this._avgStats;
        const set = (id, judgeVal, avgVal, higherIsWorse) => {
            const jEl = document.getElementById(id + '-judge');
            const aEl = document.getElementById(id + '-avg');
            jEl.textContent = judgeVal.toFixed(1) + '%';
            aEl.textContent = avgVal.toFixed(1) + '%';
            // Color coding: worse = red, better = muted green
            jEl.classList.remove('worse', 'better');
            if (higherIsWorse) {
                if (judgeVal > avgVal + 2) jEl.classList.add('worse');
                else if (judgeVal < avgVal - 2) jEl.classList.add('better');
            } else {
                if (judgeVal > avgVal + 2) jEl.classList.add('worse');
                else if (judgeVal < avgVal - 2) jEl.classList.add('better');
            }
        };

        set('jc-ror', judge.ror, avg.ror, true);
        set('jc-released', judge.released, avg.released, true);
        set('jc-rearrest', judge.rearrest, avg.rearrest, true);
        set('jc-vf', judge.vf, avg.vf, true);
    },
};

document.addEventListener('DOMContentLoaded', () => App.init());
