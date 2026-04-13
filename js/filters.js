/**
 * Simplified filter logic - just Year and Borough.
 */

const Filters = {
    onChange: null,

    init(lookups, onChange) {
        this.onChange = onChange;
        this.populateBoroughs(lookups.counties, lookups.boroughs);
        this.bindEvents();
    },

    populateBoroughs(counties, boroughs) {
        const sel = document.getElementById('filter-borough');
        counties.forEach((county, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = `${boroughs[idx]} (${county})`;
            sel.appendChild(opt);
        });
    },

    getFilters() {
        const year = document.getElementById('filter-year').value;
        const county = document.getElementById('filter-borough').value;
        return {
            year: year === 'all' ? 'all' : parseInt(year),
            county: county === 'all' ? 'all' : parseInt(county),
            cat: 'all',
            sev: 'all',
        };
    },

    bindEvents() {
        document.getElementById('filter-year').addEventListener('change', () => {
            if (this.onChange) this.onChange();
        });
        document.getElementById('filter-borough').addEventListener('change', () => {
            if (this.onChange) this.onChange();
        });
    },
};
