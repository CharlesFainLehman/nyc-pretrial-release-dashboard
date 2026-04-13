/**
 * Main app controller - card-based, minimal-text layout.
 */

// Only show these in the rearrest-by-crime bar chart
const SERIOUS_CRIMES = new Set([
    'Assault', 'Robbery', 'Burglary', 'Criminal Possession of a Weapon',
    'Homicide Related', 'Rape', 'Drug', 'Larceny', 'Other Sex Offense',
]);

// Exclude non-person entries from judge data
const JUDGE_EXCLUDE = new Set([
    'Judge/JHO/Hearing Examiner, Visiting',
    "Office, Clerk's",
]);

const App = {
    activeTab: 'prosecutor',
    judgeLoaded: false,
    selectedCountyIdx: null,
    selectedJudgeIdx: null,
    _avgStats: null,
    _judgeData: null,

    async init() {
        const lookups = await DataStore.loadCountyData();
        Filters.init(lookups, () => this.update());

        document.querySelectorAll('.tab').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        document.getElementById('prosecutor-back').addEventListener('click', () => {
            this.selectedCountyIdx = null;
            this._selectedProseKey = null;
            document.getElementById('prosecutor-detail').style.display = 'none';
            document.querySelectorAll('.prose-card').forEach(c => c.classList.remove('selected'));
        });

        this.update();
    },

    switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.toggle('active', tc.id === `tab-${tab}`));
        if (tab === 'judge' && !this.judgeLoaded) this.loadJudgeData();
        else if (tab === 'judge') this.renderJudgeCards();
    },

    async loadJudgeData() {
        document.getElementById('judge-loading').style.display = 'block';
        document.getElementById('judge-cards-wrap').style.display = 'none';
        await DataStore.loadJudgeData();
        this.judgeLoaded = true;
        document.getElementById('judge-loading').style.display = 'none';
        document.getElementById('judge-cards-wrap').style.display = 'block';

        // Bind borough and search filters
        document.getElementById('judge-borough').addEventListener('change', () => this.renderJudgeCards());
        let searchTimeout;
        document.getElementById('judge-search').addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.renderJudgeCards(), 200);
        });

        this.renderJudgeCards();
    },

    update() {
        this.renderHero();
        this.renderReleaseDonut();
        this.renderProsecutorCards();
        if (this.selectedCountyIdx !== null) this.renderDetail();
        if (this.activeTab === 'judge' && this.judgeLoaded) this.renderJudgeCards();
    },

    renderReleaseDonut() {
        const totals = DataStore.getCountyTotals(Filters.getFilters());
        Charts.renderReleaseSummary('chart-release-donut', totals);
    },

    // ─── Hero ───

    renderHero() {
        const t = DataStore.getCountyTotals(Filters.getFilters());
        const ra = t.rearrest;
        const raKnown = ra[0] + ra[1] + ra[2] + ra[3];
        const rearrestCount = ra[1] + ra[2] + ra[3];
        const releasedCount = t.release[0] + t.release[2] + t.release[3];
        const releasedPct = t.total > 0 ? (releasedCount / t.total * 100).toFixed(0) : 0;
        const rearrestPct = raKnown > 0 ? (rearrestCount / raKnown * 100).toFixed(1) : 0;
        const vfPct = raKnown > 0 ? (ra[3] / raKnown * 100).toFixed(1) : 0;

        document.getElementById('hero-stats').innerHTML = `
            <div class="hero-stat">
                <div class="big-num">${t.total.toLocaleString()}</div>
                <div class="label">Arraignments</div>
            </div>
            <div class="hero-stat">
                <div class="big-num">${releasedPct}%</div>
                <div class="label">Released</div>
            </div>
            <div class="hero-stat alert">
                <div class="big-num">${rearrestCount.toLocaleString()}</div>
                <div class="label">Rearrested</div>
            </div>
            <div class="hero-stat alert">
                <div class="big-num">${vfPct}%</div>
                <div class="label">Violent Felony Rearrest</div>
            </div>
        `;
    },

    // ─── Prosecutor Cards ───

    renderProsecutorCards() {
        const C = DataStore.C;
        const year = Filters.getYear();
        const rows = DataStore.filterCounty({ year, county: 'all', cat: 'all', sev: 'all' });

        // For Manhattan (idx 2) with "All Years", split into Vance (2020-2021) and Bragg (2022+)
        const splitManhattan = (year === 'all');
        const VANCE_YEARS = new Set([2020, 2021]);

        // Key: countyIdx, or "2-vance" / "2-bragg" for split Manhattan
        const grouped = new Map();
        for (const r of rows) {
            const countyIdx = r[C.COUNTY];
            let key;
            if (splitManhattan && countyIdx === 2) {
                key = VANCE_YEARS.has(r[C.YEAR]) ? '2-vance' : '2-bragg';
            } else {
                key = String(countyIdx);
            }
            if (!grouped.has(key)) grouped.set(key, { total: 0, rel: [0,0,0,0,0,0], ra: [0,0,0,0,0] });
            const g = grouped.get(key);
            g.total += r[C.TOTAL];
            for (let i = 0; i < 6; i++) g.rel[i] += r[C.ROR + i];
            for (let i = 0; i < 5; i++) g.ra[i] += r[C.RA_NONE + i];
        }

        const cards = [];
        for (const [key, g] of grouped) {
            const raKnown = g.ra[0] + g.ra[1] + g.ra[2] + g.ra[3];
            const rearrestCount = g.ra[1] + g.ra[2] + g.ra[3];
            const released = g.rel[0] + g.rel[2] + g.rel[3];

            let daName, borough, countyIdx, yearLabel;
            if (key === '2-vance') {
                daName = 'Cyrus Vance Jr.';
                borough = 'Manhattan';
                countyIdx = 2;
                yearLabel = '2020\u20132021';
            } else if (key === '2-bragg') {
                daName = 'Alvin Bragg';
                borough = 'Manhattan';
                countyIdx = 2;
                yearLabel = '2022\u20132025';
            } else {
                countyIdx = parseInt(key);
                const entry = Filters.DA_MAP[countyIdx];
                daName = entry.name || (entry.byYear?.[year] || entry.allYears);
                borough = entry.borough;
                yearLabel = null;
            }

            cards.push({
                key,
                idx: countyIdx,
                daName,
                borough,
                yearLabel,
                total: g.total,
                releasedPct: g.total > 0 ? +(released / g.total * 100).toFixed(1) : 0,
                rorPct: g.total > 0 ? +(g.rel[0] / g.total * 100).toFixed(1) : 0,
                rearrestPct: raKnown > 0 ? +(rearrestCount / raKnown * 100).toFixed(1) : 0,
                vfPct: raKnown > 0 ? +(g.ra[3] / raKnown * 100).toFixed(1) : 0,
            });
        }

        // Sort by rearrest rate descending
        cards.sort((a, b) => b.rearrestPct - a.rearrestPct);

        const container = document.getElementById('prosecutor-cards');
        container.innerHTML = cards.map(c => `
            <div class="prose-card ${c.key === this._selectedProseKey ? 'selected' : ''}" data-key="${c.key}" data-county="${c.idx}">
                <div class="card-name">${c.daName}</div>
                <div class="card-borough">${c.borough}${c.yearLabel ? ' \u00B7 ' + c.yearLabel : ''} &middot; ${c.total.toLocaleString()} cases</div>
                <div class="card-stats">
                    <div class="card-stat">
                        <div class="card-stat-value">${c.releasedPct}%</div>
                        <div class="card-stat-label">Released</div>
                    </div>
                    <div class="card-stat">
                        <div class="card-stat-value alert">${c.rearrestPct}%</div>
                        <div class="card-stat-label">Rearrest Rate</div>
                    </div>
                    <div class="card-stat">
                        <div class="card-stat-value">${c.rorPct}%</div>
                        <div class="card-stat-label">ROR Rate</div>
                    </div>
                    <div class="card-stat">
                        <div class="card-stat-value alert">${c.vfPct}%</div>
                        <div class="card-stat-label">Violent Felony</div>
                    </div>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.prose-card').forEach(card => {
            card.addEventListener('click', () => {
                const key = card.dataset.key;
                const idx = parseInt(card.dataset.county);
                this.selectedCountyIdx = idx;
                this._selectedProseKey = key;
                container.querySelectorAll('.prose-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                const cardData = cards.find(c => c.key === key);
                this.showDetail(cardData);
            });
        });
    },

    _selectedProseKey: null,

    // ─── Prosecutor Detail ───

    showDetail(cardData) {
        document.getElementById('prosecutor-detail-name').textContent =
            `${cardData.daName} (${cardData.borough}${cardData.yearLabel ? ', ' + cardData.yearLabel : ''})`;
        document.getElementById('prosecutor-detail').style.display = 'block';
        this.renderDetail();
    },

    renderDetail() {
        const year = Filters.getYear();
        // For split Manhattan, filter to the DA's specific years
        let yearFilter = year;
        if (this._selectedProseKey === '2-vance') {
            yearFilter = 'vance'; // special handling below
        } else if (this._selectedProseKey === '2-bragg') {
            yearFilter = 'bragg';
        }

        // Get filtered rows directly to handle Vance/Bragg year splits
        const C = DataStore.C;
        const VANCE_YEARS = new Set([2020, 2021]);
        let allRows = DataStore.filterCounty({ year: 'all', county: this.selectedCountyIdx, cat: 'all', sev: 'all' });
        if (yearFilter === 'vance') {
            allRows = allRows.filter(r => VANCE_YEARS.has(r[C.YEAR]));
        } else if (yearFilter === 'bragg') {
            allRows = allRows.filter(r => !VANCE_YEARS.has(r[C.YEAR]));
        } else if (year !== 'all') {
            allRows = allRows.filter(r => r[C.YEAR] === year);
        }

        // Compute totals from filtered rows
        const t = { total: 0, release: [0,0,0,0,0,0], rearrest: [0,0,0,0,0] };
        for (const r of allRows) {
            t.total += r[C.TOTAL];
            for (let i = 0; i < 6; i++) t.release[i] += r[C.ROR + i];
            for (let i = 0; i < 5; i++) t.rearrest[i] += r[C.RA_NONE + i];
        }
        const ra = t.rearrest;
        const raKnown = ra[0] + ra[1] + ra[2] + ra[3];
        const rearrestCount = ra[1] + ra[2] + ra[3];
        const felonyCount = ra[2] + ra[3];
        const released = t.release[0] + t.release[2] + t.release[3];

        document.getElementById('prosecutor-detail-stats').innerHTML = `
            <div class="detail-stat">
                <div class="ds-val">${t.total.toLocaleString()}</div>
                <div class="ds-lbl">Cases</div>
            </div>
            <div class="detail-stat">
                <div class="ds-val">${t.total > 0 ? (released / t.total * 100).toFixed(0) : 0}%</div>
                <div class="ds-lbl">Released</div>
            </div>
            <div class="detail-stat">
                <div class="ds-val alert">${raKnown > 0 ? (rearrestCount / raKnown * 100).toFixed(1) : 0}%</div>
                <div class="ds-lbl">Rearrest Rate</div>
            </div>
            <div class="detail-stat">
                <div class="ds-val alert">${raKnown > 0 ? (ra[3] / raKnown * 100).toFixed(1) : 0}%</div>
                <div class="ds-lbl">Violent Felony</div>
            </div>
        `;

        // Release donut for this prosecutor
        Charts.renderReleaseSummary('chart-detail-donut', t);

        // Chart: rearrest by crime (serious offenses only)
        const crimeData = this.getCrimeDataFromRows(allRows).filter(d => SERIOUS_CRIMES.has(d.name));
        const sorted = [...crimeData].sort((a, b) => a.rearrest - b.rearrest);
        Charts.renderRearrestByCrime('chart-rearrest-by-crime', {
            labels: sorted.map(d => d.name),
            rearrestRate: sorted.map(d => d.rearrest),
            felonyRate: sorted.map(d => d.felony_ra),
            vfRate: sorted.map(d => d.vf_ra),
        });

        const noteEl = document.getElementById('rearrest-note');
        noteEl.textContent = ra[4] > 0
            ? `${ra[4].toLocaleString()} pending cases excluded.`
            : '';
    },

    getCrimeDataFromRows(rows) {
        const C = DataStore.C;
        const cats = DataStore.lookups.categories;
        const grouped = new Map();
        for (const r of rows) {
            const k = r[C.CAT];
            if (!grouped.has(k)) grouped.set(k, { total: 0, rel: [0,0,0,0,0,0], ra: [0,0,0,0,0] });
            const g = grouped.get(k);
            g.total += r[C.TOTAL];
            for (let i = 0; i < 6; i++) g.rel[i] += r[C.ROR + i];
            for (let i = 0; i < 5; i++) g.ra[i] += r[C.RA_NONE + i];
        }
        const result = [];
        for (const [catIdx, g] of grouped) {
            const raKnown = g.ra[0] + g.ra[1] + g.ra[2] + g.ra[3];
            const rearrestCount = g.ra[1] + g.ra[2] + g.ra[3];
            const felonyCount = g.ra[2] + g.ra[3];
            result.push({
                name: cats[catIdx],
                rearrest: raKnown > 0 ? +(rearrestCount / raKnown * 100).toFixed(1) : 0,
                felony_ra: raKnown > 0 ? +(felonyCount / raKnown * 100).toFixed(1) : 0,
                vf_ra: raKnown > 0 ? +(g.ra[3] / raKnown * 100).toFixed(1) : 0,
            });
        }
        return result;
    },

    // ─── Judge Cards ───

    renderJudgeCards() {
        if (!this.judgeLoaded) return;
        const year = Filters.getYear();
        const J = DataStore.J;
        const boroughVal = document.getElementById('judge-borough').value;
        const county = boroughVal === 'all' ? 'all' : parseInt(boroughVal);
        const searchTerm = (document.getElementById('judge-search').value || '').toLowerCase().trim();

        const rows = DataStore.filterJudge({ year, county, cat: 'all', sev: 'all', judge: 'all' });
        const judges = DataStore.judgeLookups.judges;
        const grouped = DataStore.groupBy(rows, J.JUDGE, J.TOTAL, 22);

        const data = [];
        for (const [judgeIdx, m] of grouped) {
            const name = judges[judgeIdx];
            if (JUDGE_EXCLUDE.has(name)) continue;
            const total = m[0];
            if (total < 100) continue;
            if (searchTerm && !name.toLowerCase().includes(searchTerm)) continue;
            const ror = m[1], nmr = m[3], bail = m[4];
            const released = ror + nmr + bail;
            const raKnown = m[7] + m[8] + m[9] + m[10];
            const rearrestCount = m[8] + m[9] + m[10];
            const vfCount = m[10];

            data.push({
                idx: judgeIdx,
                name,
                total,
                ror: total > 0 ? +(ror / total * 100).toFixed(1) : 0,
                released: total > 0 ? +(released / total * 100).toFixed(1) : 0,
                rearrest: raKnown > 0 ? +(rearrestCount / raKnown * 100).toFixed(1) : 0,
                vf: raKnown > 0 ? +(vfCount / raKnown * 100).toFixed(1) : 0,
            });
        }

        // Sort by rearrest rate descending
        data.sort((a, b) => b.rearrest - a.rearrest);

        // Compute averages
        const allTotals = data.reduce((a, d) => a + d.total, 0);
        this._avgStats = {
            ror: allTotals > 0 ? data.reduce((a, d) => a + d.ror * d.total, 0) / allTotals : 0,
            released: allTotals > 0 ? data.reduce((a, d) => a + d.released * d.total, 0) / allTotals : 0,
            rearrest: allTotals > 0 ? data.reduce((a, d) => a + d.rearrest * d.total, 0) / allTotals : 0,
            vf: allTotals > 0 ? data.reduce((a, d) => a + d.vf * d.total, 0) / allTotals : 0,
        };

        const container = document.getElementById('judge-cards');
        container.innerHTML = data.map(d => `
            <div class="judge-card ${d.idx === this.selectedJudgeIdx ? 'selected' : ''}" data-idx="${d.idx}">
                <div class="jc-name">${d.name}</div>
                <div class="jc-cases">${d.total.toLocaleString()} cases</div>
                <div class="jc-stats">
                    <div class="jc-stat">
                        <div class="jc-val">${d.released}%</div>
                        <div class="jc-lbl">Released</div>
                    </div>
                    <div class="jc-stat">
                        <div class="jc-val alert">${d.rearrest}%</div>
                        <div class="jc-lbl">Rearrest</div>
                    </div>
                    <div class="jc-stat">
                        <div class="jc-val alert">${d.vf}%</div>
                        <div class="jc-lbl">Violent Fel.</div>
                    </div>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.judge-card').forEach(card => {
            card.addEventListener('click', () => {
                const idx = parseInt(card.dataset.idx);
                this.selectedJudgeIdx = idx;
                container.querySelectorAll('.judge-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                const judge = data.find(d => d.idx === idx);
                if (judge) this.showJudgeComparison(judge);
            });
        });

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
        const set = (id, jVal, aVal) => {
            const jEl = document.getElementById(id + '-judge');
            const aEl = document.getElementById(id + '-avg');
            jEl.textContent = jVal.toFixed(1) + '%';
            aEl.textContent = aVal.toFixed(1) + '%';
            jEl.classList.remove('worse', 'better');
            if (jVal > aVal + 2) jEl.classList.add('worse');
            else if (jVal < aVal - 2) jEl.classList.add('better');
        };

        set('jc-ror', judge.ror, avg.ror);
        set('jc-released', judge.released, avg.released);
        set('jc-rearrest', judge.rearrest, avg.rearrest);
        set('jc-vf', judge.vf, avg.vf);

        // Rearrest by crime chart for this judge
        this.renderJudgeCrimeChart(judge.idx);
    },

    renderJudgeCrimeChart(judgeIdx) {
        const year = Filters.getYear();
        const boroughVal = document.getElementById('judge-borough').value;
        const county = boroughVal === 'all' ? 'all' : parseInt(boroughVal);
        const J = DataStore.J;
        const rows = DataStore.filterJudge({ year, county, cat: 'all', sev: 'all', judge: judgeIdx });
        const cats = DataStore.judgeLookups.categories;

        const grouped = new Map();
        for (const r of rows) {
            const k = r[J.CAT];
            if (!grouped.has(k)) grouped.set(k, { ra: [0,0,0,0,0] });
            const g = grouped.get(k);
            for (let i = 0; i < 5; i++) g.ra[i] += r[J.RA_NONE + i];
        }

        const crimeData = [];
        for (const [catIdx, g] of grouped) {
            const name = cats[catIdx];
            if (!SERIOUS_CRIMES.has(name)) continue;
            const raKnown = g.ra[0] + g.ra[1] + g.ra[2] + g.ra[3];
            const rearrestCount = g.ra[1] + g.ra[2] + g.ra[3];
            const felonyCount = g.ra[2] + g.ra[3];
            if (raKnown < 10) continue; // skip tiny samples
            crimeData.push({
                name,
                rearrest: raKnown > 0 ? +(rearrestCount / raKnown * 100).toFixed(1) : 0,
                felony_ra: raKnown > 0 ? +(felonyCount / raKnown * 100).toFixed(1) : 0,
                vf_ra: raKnown > 0 ? +(g.ra[3] / raKnown * 100).toFixed(1) : 0,
            });
        }

        const chartWrap = document.getElementById('judge-chart-wrap');
        if (crimeData.length === 0) {
            chartWrap.style.display = 'none';
            return;
        }

        chartWrap.style.display = 'block';
        const sorted = [...crimeData].sort((a, b) => a.rearrest - b.rearrest);
        Charts.renderRearrestByCrime('chart-judge-rearrest-by-crime', {
            labels: sorted.map(d => d.name),
            rearrestRate: sorted.map(d => d.rearrest),
            felonyRate: sorted.map(d => d.felony_ra),
            vfRate: sorted.map(d => d.vf_ra),
        });
    },
};

document.addEventListener('DOMContentLoaded', () => App.init());
