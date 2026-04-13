/**
 * Filter logic - Year only. DA_MAP used for prosecutor display names.
 */

const Filters = {
    onChange: null,

    // DA names by county index. Counties sorted alphabetically:
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
        const daName = year === 'all' ? entry.allYears : (entry.byYear[year] || entry.allYears);
        return `${daName} (${entry.borough})`;
    },

    init(lookups, onChange) {
        this.onChange = onChange;
        this.bindEvents();
    },

    getFilters() {
        const year = document.getElementById('filter-year').value;
        return {
            year: year === 'all' ? 'all' : parseInt(year),
            county: 'all',
            cat: 'all',
            sev: 'all',
        };
    },

    getYear() {
        const year = document.getElementById('filter-year').value;
        return year === 'all' ? 'all' : parseInt(year);
    },

    bindEvents() {
        document.getElementById('filter-year').addEventListener('change', () => {
            if (this.onChange) this.onChange();
        });
    },
};
