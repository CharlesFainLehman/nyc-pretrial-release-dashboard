/**
 * Chart creation and update logic using Chart.js.
 */

const Charts = {
    instances: {},

    COLORS: {
        release: {
            ror: '#22c55e',
            disposed: '#9ca3af',
            nmr: '#3b82f6',
            bail: '#f59e0b',
            unknown: '#d1d5db',
            remanded: '#ef4444',
        },
        rearrest: {
            none: '#22c55e',
            misd: '#facc15',
            nvf: '#f59e0b',
            vf: '#ef4444',
            null_: '#d1d5db',
        },
    },

    destroy(id) {
        if (this.instances[id]) {
            this.instances[id].destroy();
            delete this.instances[id];
        }
    },

    /** Set canvas parent height based on number of bars for horizontal charts. */
    sizeContainer(canvasId, numBars, barHeight = 28) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const height = Math.max(200, numBars * barHeight + 80); // 80 for legend/padding
        canvas.parentElement.style.height = height + 'px';
    },

    /**
     * Stacked horizontal bar for release decisions by charge category.
     */
    renderReleaseChart(canvasId, data, mode = 'pct') {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const { labels, totals, releaseData } = data;
        this.sizeContainer(canvasId, labels.length);
        const isPct = mode === 'pct';

        const convert = (arr) => {
            if (!isPct) return arr;
            return arr.map((v, i) => totals[i] > 0 ? +(v / totals[i] * 100).toFixed(1) : 0);
        };

        const datasets = [
            { label: 'ROR', data: convert(releaseData.ror), backgroundColor: this.COLORS.release.ror },
            { label: 'Nonmonetary Release', data: convert(releaseData.nmr), backgroundColor: this.COLORS.release.nmr },
            { label: 'Bail Set', data: convert(releaseData.bail), backgroundColor: this.COLORS.release.bail },
            { label: 'Remanded', data: convert(releaseData.remanded), backgroundColor: this.COLORS.release.remanded },
            { label: 'Disposed at Arraign', data: convert(releaseData.disposed), backgroundColor: this.COLORS.release.disposed },
            { label: 'Unknown', data: convert(releaseData.unknown), backgroundColor: this.COLORS.release.unknown },
        ];

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label(ctx) {
                                const val = ctx.parsed.x;
                                if (isPct) return `${ctx.dataset.label}: ${val}%`;
                                return `${ctx.dataset.label}: ${val.toLocaleString()}`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        stacked: true,
                        max: isPct ? 100 : undefined,
                        ticks: {
                            callback: v => isPct ? v + '%' : v.toLocaleString(),
                        },
                    },
                    y: { stacked: true },
                },
            },
        });
    },

    /**
     * Stacked horizontal bar for rearrest outcomes by charge category.
     */
    renderRearrestChart(canvasId, data, mode = 'pct') {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const { labels, data: rd } = data;
        this.sizeContainer(canvasId, labels.length);
        const isPct = mode === 'pct';

        // Exclude NULLs from percentage base
        const known = labels.map((_, i) => rd.none[i] + rd.misd[i] + rd.nvf[i] + rd.vf[i]);

        const convert = (arr) => {
            if (!isPct) return arr;
            return arr.map((v, i) => known[i] > 0 ? +(v / known[i] * 100).toFixed(1) : 0);
        };

        const datasets = [
            { label: 'No Rearrest', data: convert(rd.none), backgroundColor: this.COLORS.rearrest.none },
            { label: 'Misdemeanor Rearrest', data: convert(rd.misd), backgroundColor: this.COLORS.rearrest.misd },
            { label: 'Non-Violent Felony Rearrest', data: convert(rd.nvf), backgroundColor: this.COLORS.rearrest.nvf },
            { label: 'Violent Felony Rearrest', data: convert(rd.vf), backgroundColor: this.COLORS.rearrest.vf },
        ];

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label(ctx) {
                                const val = ctx.parsed.x;
                                if (isPct) return `${ctx.dataset.label}: ${val}%`;
                                return `${ctx.dataset.label}: ${val.toLocaleString()}`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        stacked: true,
                        max: isPct ? 100 : undefined,
                        ticks: {
                            callback: v => isPct ? v + '%' : v.toLocaleString(),
                        },
                    },
                    y: { stacked: true },
                },
            },
        });
    },

    /**
     * Summary rearrest rate bar chart by release decision type.
     * Since we don't have cross-tab data, show overall rearrest breakdown as a bar.
     */
    renderRearrestByRelease(canvasId, totals) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        ctx.parentElement.style.height = '300px';

        const ra = totals.rearrest;
        const known = ra[0] + ra[1] + ra[2] + ra[3]; // excl null

        const labels = ['No Rearrest', 'Misdemeanor', 'Non-Violent Felony', 'Violent Felony'];
        const values = [ra[0], ra[1], ra[2], ra[3]];
        const pcts = values.map(v => known > 0 ? +(v / known * 100).toFixed(1) : 0);
        const colors = [
            this.COLORS.rearrest.none,
            this.COLORS.rearrest.misd,
            this.COLORS.rearrest.nvf,
            this.COLORS.rearrest.vf,
        ];

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: pcts,
                    backgroundColor: colors,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label(ctx) {
                                return `${ctx.parsed.y}% (${values[ctx.dataIndex].toLocaleString()} cases)`;
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        ticks: { callback: v => v + '%' },
                        beginAtZero: true,
                    },
                },
            },
        });
    },

    /**
     * Side-by-side bar comparing judge vs borough average for release decisions.
     */
    renderJudgeReleaseComparison(canvasId, comparison) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx || !comparison) return;
        ctx.parentElement.style.height = '350px';

        const labels = ['ROR', 'NMR', 'Bail Set', 'Remanded', 'Disposed', 'Unknown'];
        const jTotal = comparison.judge.total;
        const bTotal = comparison.borough.total;

        const jPcts = comparison.judge.release.map(v => jTotal > 0 ? +(v / jTotal * 100).toFixed(1) : 0);
        const bPcts = comparison.borough.release.map(v => bTotal > 0 ? +(v / bTotal * 100).toFixed(1) : 0);

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Selected Judge', data: jPcts, backgroundColor: '#2563eb' },
                    { label: 'Borough Average', data: bPcts, backgroundColor: '#d1d5db' },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label(ctx) {
                                return `${ctx.dataset.label}: ${ctx.parsed.y}%`;
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        ticks: { callback: v => v + '%' },
                        beginAtZero: true,
                    },
                },
            },
        });
    },

    /**
     * Side-by-side bar comparing judge vs borough average for rearrest outcomes.
     */
    renderJudgeRearrestComparison(canvasId, comparison) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx || !comparison) return;
        ctx.parentElement.style.height = '350px';

        const labels = ['No Rearrest', 'Misdemeanor', 'Non-Violent Felony', 'Violent Felony'];

        const jRa = comparison.judge.rearrest;
        const bRa = comparison.borough.rearrest;
        const jKnown = jRa[0] + jRa[1] + jRa[2] + jRa[3];
        const bKnown = bRa[0] + bRa[1] + bRa[2] + bRa[3];

        const jPcts = [jRa[0], jRa[1], jRa[2], jRa[3]].map(v => jKnown > 0 ? +(v / jKnown * 100).toFixed(1) : 0);
        const bPcts = [bRa[0], bRa[1], bRa[2], bRa[3]].map(v => bKnown > 0 ? +(v / bKnown * 100).toFixed(1) : 0);

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Selected Judge', data: jPcts, backgroundColor: '#2563eb' },
                    { label: 'Borough Average', data: bPcts, backgroundColor: '#d1d5db' },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label(ctx) {
                                return `${ctx.dataset.label}: ${ctx.parsed.y}%`;
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        ticks: { callback: v => v + '%' },
                        beginAtZero: true,
                    },
                },
            },
        });
    },
};
