/**
 * Filter UI logic - populates dropdowns and reads filter state.
 */

const Filters = {
    onChange: null,

    init(lookups, onChange) {
        this.onChange = onChange;
        this.populateBoroughs(lookups.counties, lookups.boroughs);
        this.populateCategories(lookups.categories);
        this.bindEvents();
    },

    populateBoroughs(counties, boroughs) {
        const sel = document.getElementById('filter-borough');
        // Keep the "All NYC" option
        counties.forEach((county, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = `${boroughs[idx]} (${county})`;
            sel.appendChild(opt);
        });
    },

    populateCategories(categories) {
        const sel = document.getElementById('filter-category');
        categories.forEach((cat, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = cat;
            sel.appendChild(opt);
        });
    },

    populateJudges(judges, filters) {
        const datalist = document.getElementById('judge-list');
        datalist.innerHTML = '';

        // If we have judge data, get judge stats to show case counts
        const table = DataStore.getJudgeTable(filters, 0);
        const byName = new Map(table.map(j => [j.name, j]));

        // Sort by total cases descending
        const sorted = [...byName.entries()].sort((a, b) => b[1].total - a[1].total);

        for (const [name, stats] of sorted) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.label = `${name} (${stats.total.toLocaleString()} cases)`;
            datalist.appendChild(opt);
        }
    },

    getFilters() {
        const year = document.getElementById('filter-year').value;
        const county = document.getElementById('filter-borough').value;
        const cat = document.getElementById('filter-category').value;
        const sev = document.getElementById('filter-severity').value;

        return {
            year: year === 'all' ? 'all' : parseInt(year),
            county: county === 'all' ? 'all' : parseInt(county),
            cat: cat === 'all' ? 'all' : parseInt(cat),
            sev: sev === 'all' ? 'all' : parseInt(sev),
        };
    },

    getSelectedJudge() {
        const input = document.getElementById('filter-judge');
        const name = input.value.trim();
        if (!name || !DataStore.judgeLookups) return null;
        const idx = DataStore.judgeLookups.judges.indexOf(name);
        return idx >= 0 ? idx : null;
    },

    bindEvents() {
        const selectors = ['filter-year', 'filter-borough', 'filter-category', 'filter-severity'];
        for (const id of selectors) {
            document.getElementById(id).addEventListener('change', () => {
                if (this.onChange) this.onChange();
            });
        }
    },
};
