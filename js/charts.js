/**
 * Simplified chart rendering for the MI-style dashboard.
 */

const Charts = {
    instances: {},

    COLORS: {
        ror: '#6b9e6b',
        nmr: '#7fafd4',
        bail: '#d4a04a',
        remand: '#8b6b8b',
        disposed: '#b0b0b0',
        unknown: '#d0d0d0',

        noArrest: '#b0b0b0',
        misd: '#6a9bc3',
        nvf: '#2c5d8f',
        vf: '#1a3a5c',
    },

    destroy(id) {
        if (this.instances[id]) {
            this.instances[id].destroy();
            delete this.instances[id];
        }
    },

    sizeContainer(canvasId, height) {
        const canvas = document.getElementById(canvasId);
        if (canvas) canvas.parentElement.style.height = height + 'px';
    },

    /**
     * Donut chart: how defendants are released.
     */
    renderReleaseSummary(canvasId, totals) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        // Don't set a fixed height — let CSS grid equalize with sibling chart

        const r = totals.release;
        const labels = ['ROR', 'Nonmonetary Release', 'Bail Set', 'Remanded', 'Disposed at Arraign', 'Unknown'];
        const data = [r[0], r[2], r[3], r[5], r[1], r[4]];
        const colors = [this.COLORS.ror, this.COLORS.nmr, this.COLORS.bail, this.COLORS.remand, this.COLORS.disposed, this.COLORS.unknown];

        this.instances[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 1, borderColor: '#fff' }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '50%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", size: 11 },
                            padding: 10,
                            boxWidth: 12,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label(ctx) {
                                const v = ctx.parsed;
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? (v / total * 100).toFixed(1) : 0;
                                return `${ctx.label}: ${v.toLocaleString()} (${pct}%)`;
                            },
                        },
                    },
                },
            },
        });
    },

    /**
     * Horizontal bar: rearrest rate by crime category (sorted by rearrest rate).
     */
    renderRearrestByCrime(canvasId, crimeData) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const { labels, rearrestRate, felonyRate, vfRate } = crimeData;
        this.sizeContainer(canvasId, Math.max(300, labels.length * 32 + 80));

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Any Rearrest', data: rearrestRate, backgroundColor: this.COLORS.misd },
                    { label: 'Felony Rearrest', data: felonyRate, backgroundColor: this.COLORS.nvf },
                    { label: 'Violent Felony Rearrest', data: vfRate, backgroundColor: this.COLORS.vf },
                ],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", size: 12 },
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label(ctx) {
                                return `${ctx.dataset.label}: ${ctx.parsed.x}%`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: v => v + '%',
                            font: { family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
                        },
                        grid: { color: '#eee' },
                    },
                    y: {
                        ticks: {
                            font: { family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", size: 12 },
                        },
                        grid: { display: false },
                    },
                },
            },
        });
    },
};
