/**
 * Data loading, parsing, filtering, and aggregation for the dashboard.
 */

const DataStore = {
    countyRaw: null,
    judgeRaw: null,
    metadata: null,
    lookups: null,
    judgeLookups: null,

    /** Column offsets for county data rows: [year, county, cat, sev, total, ...metrics] */
    C: {
        YEAR: 0, COUNTY: 1, CAT: 2, SEV: 3, TOTAL: 4,
        ROR: 5, DISPOSED: 6, NMR: 7, BAIL: 8, UNKNOWN: 9, REMANDED: 10,
        RA_NONE: 11, RA_MISD: 12, RA_NVF: 13, RA_VF: 14, RA_NULL: 15,
        RA180_NONE: 16, RA180_MISD: 17, RA180_NVF: 18, RA180_VF: 19, RA180_NULL: 20,
        RAF_NO: 21, RAF_YES: 22, RAF_NULL: 23,
        SUP_NO: 24, SUP_YES: 25,
        FTA_NO: 26, FTA_YES: 27
    },

    /** Column offsets for judge data rows: [year, county, judge, cat, sev, total, ...metrics] */
    J: {
        YEAR: 0, COUNTY: 1, JUDGE: 2, CAT: 3, SEV: 4, TOTAL: 5,
        ROR: 6, DISPOSED: 7, NMR: 8, BAIL: 9, UNKNOWN: 10, REMANDED: 11,
        RA_NONE: 12, RA_MISD: 13, RA_NVF: 14, RA_VF: 15, RA_NULL: 16,
        RA180_NONE: 17, RA180_MISD: 18, RA180_NVF: 19, RA180_VF: 20, RA180_NULL: 21,
        RAF_NO: 22, RAF_YES: 23, RAF_NULL: 24,
        SUP_NO: 25, SUP_YES: 26,
        FTA_NO: 27, FTA_YES: 28
    },

    async loadCountyData() {
        const res = await fetch('data/county_agg.json?v=2');
        const raw = await res.json();
        this.countyRaw = raw.data;
        this.lookups = {
            counties: raw.counties,
            boroughs: raw.borough_names,
            categories: raw.categories,
            severities: raw.severities,
            releases: raw.releases,
            rearrests: raw.rearrests,
        };
        return this.lookups;
    },

    async loadJudgeData() {
        if (this.judgeRaw) return this.judgeLookups;
        const res = await fetch('data/judge_agg.json?v=2');
        const raw = await res.json();
        this.judgeRaw = raw.data;
        this.judgeLookups = {
            judges: raw.judges,
            counties: raw.counties,
            boroughs: raw.borough_names,
            categories: raw.categories,
            severities: raw.severities,
        };
        return this.judgeLookups;
    },

    /**
     * Filter county data rows by criteria.
     * @param {Object} filters - { year:'all'|number, county:'all'|idx, cat:'all'|idx, sev:'all'|idx }
     * @returns {number[][]} matching rows
     */
    filterCounty(filters) {
        const C = this.C;
        return this.countyRaw.filter(r => {
            if (filters.year !== 'all' && r[C.YEAR] !== filters.year) return false;
            if (filters.county !== 'all' && r[C.COUNTY] !== filters.county) return false;
            if (filters.cat !== 'all' && r[C.CAT] !== filters.cat) return false;
            if (filters.sev !== 'all' && r[C.SEV] !== filters.sev) return false;
            return true;
        });
    },

    /**
     * Filter judge data rows.
     */
    filterJudge(filters) {
        const J = this.J;
        return this.judgeRaw.filter(r => {
            if (filters.year !== 'all' && r[J.YEAR] !== filters.year) return false;
            if (filters.county !== 'all' && r[J.COUNTY] !== filters.county) return false;
            if (filters.judge !== undefined && filters.judge !== 'all' && r[J.JUDGE] !== filters.judge) return false;
            if (filters.cat !== 'all' && r[J.CAT] !== filters.cat) return false;
            if (filters.sev !== 'all' && r[J.SEV] !== filters.sev) return false;
            return true;
        });
    },

    /**
     * Sum metric columns across rows, starting from a given offset.
     */
    sumRows(rows, startCol, count) {
        const sums = new Array(count).fill(0);
        for (const r of rows) {
            for (let i = 0; i < count; i++) {
                sums[i] += r[startCol + i];
            }
        }
        return sums;
    },

    /**
     * Group rows by a dimension column and sum metrics.
     * @returns {Map<number, number[]>} dimension_value -> summed metrics from startCol
     */
    groupBy(rows, dimCol, startCol, count) {
        const groups = new Map();
        for (const r of rows) {
            const key = r[dimCol];
            if (!groups.has(key)) groups.set(key, new Array(count).fill(0));
            const sums = groups.get(key);
            for (let i = 0; i < count; i++) {
                sums[i] += r[startCol + i];
            }
        }
        return groups;
    },

    /**
     * Get aggregate totals from county data for current filters.
     * Returns an object with release, rearrest, rearrest180, firearm, supervision totals.
     */
    getCountyTotals(filters) {
        const rows = this.filterCounty(filters);
        const C = this.C;
        const total = rows.reduce((s, r) => s + r[C.TOTAL], 0);
        const release = this.sumRows(rows, C.ROR, 6);
        const rearrest = this.sumRows(rows, C.RA_NONE, 5);
        const rearrest180 = this.sumRows(rows, C.RA180_NONE, 5);
        const firearm = this.sumRows(rows, C.RAF_NO, 3);
        const supervision = this.sumRows(rows, C.SUP_NO, 2);
        return { total, release, rearrest, rearrest180, firearm, supervision };
    },

    /**
     * Get release decisions grouped by charge category for county view.
     * Returns { labels[], datasets[] } ready for Chart.js stacked bar.
     */
    getReleaseByCategory(filters) {
        const C = this.C;
        const rows = this.filterCounty(filters);
        const grouped = this.groupBy(rows, C.CAT, C.TOTAL, 7); // total + 6 release
        const cats = this.lookups.categories;

        // Sort categories by total descending
        const entries = [...grouped.entries()].sort((a, b) => b[1][0] - a[1][0]);

        const labels = entries.map(([idx]) => cats[idx]);
        const totals = entries.map(([, m]) => m[0]);
        const releaseData = {
            ror: entries.map(([, m]) => m[1]),
            disposed: entries.map(([, m]) => m[2]),
            nmr: entries.map(([, m]) => m[3]),
            bail: entries.map(([, m]) => m[4]),
            unknown: entries.map(([, m]) => m[5]),
            remanded: entries.map(([, m]) => m[6]),
        };

        return { labels, totals, releaseData };
    },

    /**
     * Get rearrest outcomes grouped by charge category.
     */
    getRearrestByCategory(filters, use180 = false) {
        const C = this.C;
        const rows = this.filterCounty(filters);
        const startCol = use180 ? C.RA180_NONE : C.RA_NONE;
        const grouped = this.groupBy(rows, C.CAT, C.TOTAL, 1); // just total
        const rearrGrouped = this.groupBy(rows, C.CAT, startCol, 5);

        const cats = this.lookups.categories;
        // Sort by total
        const totalMap = this.groupBy(rows, C.CAT, C.TOTAL, 1);
        const entries = [...rearrGrouped.entries()].sort((a, b) => {
            const ta = totalMap.get(a[0])?.[0] || 0;
            const tb = totalMap.get(b[0])?.[0] || 0;
            return tb - ta;
        });

        const labels = entries.map(([idx]) => cats[idx]);
        const data = {
            none: entries.map(([, m]) => m[0]),
            misd: entries.map(([, m]) => m[1]),
            nvf: entries.map(([, m]) => m[2]),
            vf: entries.map(([, m]) => m[3]),
            null_: entries.map(([, m]) => m[4]),
        };

        return { labels, data };
    },

    /**
     * Get rearrest breakdown grouped by release decision type.
     */
    getRearrestByRelease(filters) {
        const C = this.C;
        const rows = this.filterCounty(filters);

        // We need to group by release decision, but release decision is spread across columns
        // Each row may have cases in multiple release categories.
        // We need to think of this differently: for each release decision type,
        // gather the rearrest outcomes of cases with that decision.
        // But our data is aggregated by (year, county, cat, sev) not by release decision.
        // So we can't directly cross-tabulate release x rearrest from the county_agg.

        // WORKAROUND: Use the judge data or accept the limitation.
        // Actually, let's add this cross-tab to the preprocessing.
        // For now, we can only show overall rearrest rates, not broken out by release decision,
        // unless we restructure the aggregation.

        // Let's return the overall rearrest rates as a simplified view.
        const totals = this.getCountyTotals(filters);
        return totals;
    },

    /**
     * Get judge summary stats for the table.
     */
    getJudgeTable(filters, minCases = 30) {
        if (!this.judgeRaw) return [];
        const J = this.J;
        const rows = this.filterJudge({ ...filters, judge: 'all' });
        const grouped = this.groupBy(rows, J.JUDGE, J.TOTAL, 22);

        const judges = this.judgeLookups.judges;
        const result = [];

        for (const [judgeIdx, m] of grouped) {
            const total = m[0];
            const ror = m[1];
            const bail = m[4];
            const nmr = m[3];
            const remand = m[6];
            const raTotal = m[7] + m[8] + m[9] + m[10]; // none + misd + nvf + vf (excl null)
            const raMisd = m[8];
            const raNvf = m[9];
            const raVf = m[10];
            const raKnown = m[7] + m[8] + m[9] + m[10];
            const rearrestCount = m[8] + m[9] + m[10]; // misd + nvf + vf

            result.push({
                idx: judgeIdx,
                name: judges[judgeIdx],
                total,
                ror: total > 0 ? (ror / total * 100) : 0,
                bail: total > 0 ? (bail / total * 100) : 0,
                nmr: total > 0 ? (nmr / total * 100) : 0,
                remand: total > 0 ? (remand / total * 100) : 0,
                rearrest: raKnown > 0 ? (rearrestCount / raKnown * 100) : 0,
                vf: raKnown > 0 ? (raVf / raKnown * 100) : 0,
                lowCount: total < minCases,
            });
        }

        return result;
    },

    /**
     * Get comparison data for a specific judge vs borough average.
     */
    getJudgeComparison(filters, judgeIdx) {
        if (!this.judgeRaw) return null;
        const J = this.J;

        // Judge data
        const judgeRows = this.filterJudge({ ...filters, judge: judgeIdx });
        const judgeTotal = judgeRows.reduce((s, r) => s + r[J.TOTAL], 0);
        const judgeRelease = this.sumRows(judgeRows, J.ROR, 6);
        const judgeRearrest = this.sumRows(judgeRows, J.RA_NONE, 5);

        // Borough average (all judges)
        const allRows = this.filterJudge({ ...filters, judge: 'all' });
        const allTotal = allRows.reduce((s, r) => s + r[J.TOTAL], 0);
        const allRelease = this.sumRows(allRows, J.ROR, 6);
        const allRearrest = this.sumRows(allRows, J.RA_NONE, 5);

        return {
            judge: {
                total: judgeTotal,
                release: judgeRelease,
                rearrest: judgeRearrest,
            },
            borough: {
                total: allTotal,
                release: allRelease,
                rearrest: allRearrest,
            },
        };
    },
};
