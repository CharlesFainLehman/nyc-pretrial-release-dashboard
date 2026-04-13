/**
 * Simplified filter logic - Year and Prosecutor (DA).
 */

const Filters = {
    onChange: null,
    _counties: null,
    _boroughs: null,

    // DA names by county index. Counties are sorted alphabetically:
    // 0=Bronx, 1=Kings(Brooklyn), 2=New York(Manhattan), 3=Queens, 4=Richmond(Staten Island)
    DA_MAP: {
        0: { name: 'Darcel Clark', borough: 'Bronx' },
        1: { name: 'Eric Gonzalez', borough: 'Brooklyn' },
        2: {
            borough: 'Manhattan',
            byYear: {
                2020: 'Cyrus Vance Jr.',
                2021: 'Cyrus Vance Jr.',
                2022: 'Alvin Bragg',
                2023: 'Alvin Bragg',
                2024: 'Alvin Bragg',
                2025: 'Alvin Bragg',
            },
            allYears: 'Vance/Bragg',
        },
        3: { name: 'Melinda Katz', borough: 'Queens' },
        4: { name: 'Michael McMahon', borough: 'Staten Island' },
    },

    getDaLabel(countyIdx, year) {
        const entry = this.DA_MAP[countyIdx];
        if (!entry) return '';
        if (entry.name) {
            return `${entry.name} (${entry.borough})`;
        }
        // Manhattan - varies by year
        const daName = year === 'all' ? entry.allYears : (entry.byYear[year] || entry.allYears);
        return `${daName} (${entry.borough})`;
    },

    init(lookups, onChange) {
        this.onChange = onChange;
        this._counties = lookups.counties;
        this._boroughs = lookups.boroughs;
        this.populateProsecutors('all');
        this.bindEvents();
    },

    populateProsecutors(year) {
        const sel = document.getElementById('filter-borough');
        const currentVal = sel.value;
        // Clear all options except "All NYC"
        while (sel.options.length > 1) sel.remove(1);

        this._counties.forEach((county, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = this.getDaLabel(idx, year);
            sel.appendChild(opt);
        });

        // Restore selection if still valid
        if (currentVal !== 'all') {
            sel.value = currentVal;
        }
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
            const year = document.getElementById('filter-year').value;
            this.populateProsecutors(year === 'all' ? 'all' : parseInt(year));
            if (this.onChange) this.onChange();
        });
        document.getElementById('filter-borough').addEventListener('change', () => {
            if (this.onChange) this.onChange();
        });
    },
};
