
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#64748b';
Chart.defaults.plugins.legend.display = false;
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.animation = { duration: 800, easing: 'easeOutQuart' };

const COLORS = {
    primary: '#667eea',
    secondary: '#764ba2',
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    cyan: '#06b6d4',
    pink: '#ec4899',
    purple: '#8b5cf6',
    indigo: '#6366f1',
    teal: '#14b8a6',
};

const PALETTE = [
    '#667eea', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
    '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#6366f1',
    '#84cc16', '#e11d48', '#0891b2', '#a855f7', '#22c55e',
    '#eab308', '#3b82f6', '#d946ef', '#0ea5e9', '#f43f5e',
];

const GRADIENT_PAIRS = [
    ['#667eea', '#764ba2'],
    ['#10b981', '#06b6d4'],
    ['#f59e0b', '#ef4444'],
    ['#ec4899', '#8b5cf6'],
    ['#06b6d4', '#3b82f6'],
];

function createGradient(ctx, colorStart, colorEnd) {
    const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    g.addColorStop(0, colorStart);
    g.addColorStop(1, colorEnd);
    return g;
}

function createGradientBg(ctx, color, opacityStart = 0.3, opacityEnd = 0.02) {
    const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    g.addColorStop(0, color + hexOpacity(opacityStart));
    g.addColorStop(1, color + hexOpacity(opacityEnd));
    return g;
}

function hexOpacity(opacity) {
    return Math.round(opacity * 255).toString(16).padStart(2, '0');
}

// ── Chart Instance Registry ────────────────────────────────────────────────
const charts = {};

function getOrCreateChart(id, config) {
    if (charts[id]) {
        charts[id].destroy();
    }
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    charts[id] = new Chart(canvas.getContext('2d'), config);
    return charts[id];
}

// ── API Helper ─────────────────────────────────────────────────────────────
async function api(endpoint) {
    const res = await fetch(endpoint);
    return res.json();
}

async function apiPost(endpoint, body) {
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}

// ══════════════════════════════════════════════════════════════════════════
//  SECTION 1: OVERVIEW
// ══════════════════════════════════════════════════════════════════════════

async function loadOverview() {
    const summary = await api('/api/summary');

    // KPI Cards
    const kpiData = [
        { icon: '📦', value: formatNumber(summary.total_production), label: 'Total Production (k tonnes)' },
        { icon: '🏛️', value: summary.num_states, label: 'States' },
        { icon: '🏘️', value: summary.num_districts, label: 'Districts' },
        { icon: '🌾', value: summary.num_crops, label: 'Crop Types' },
        { icon: '📋', value: formatNumber(summary.num_records), label: 'Data Records' },
        { icon: '⚠️', value: summary.zero_production_pct + '%', label: 'Zero Production Rows' },
    ];

    const grid = document.getElementById('kpi-grid');
    grid.innerHTML = kpiData.map((kpi, i) => `
        <div class="kpi-card animate-in stagger-${i + 1}">
            <div class="kpi-icon">${kpi.icon}</div>
            <div class="kpi-value" data-target="${kpi.value}">${kpi.value}</div>
            <div class="kpi-label">${kpi.label}</div>
        </div>
    `).join('');

    // Animate number counters
    document.querySelectorAll('.kpi-value').forEach(el => animateCounter(el));

    // Year filter options
    summary.years.forEach(y => {
        ['crop-year-filter'].forEach(id => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            document.getElementById(id)?.appendChild(opt);
        });
    });

    // Charts
    loadYearlyChart();
    loadTopCropsChart();
    loadTopStatesChart();
}

async function loadYearlyChart() {
    const data = await api('/api/production-by-year');
    const ctx = document.getElementById('chart-yearly').getContext('2d');

    getOrCreateChart('chart-yearly', {
        type: 'bar',
        data: {
            labels: data.map(d => d.Year),
            datasets: [{
                label: 'Production',
                data: data.map(d => d.Production),
                backgroundColor: data.map((_, i) => PALETTE[i]),
                borderRadius: 8,
                borderSkipped: false,
                barThickness: 60,
            }]
        },
        options: {
            plugins: {
                tooltip: {
                    callbacks: {
                        label: ctx => `${formatNumber(ctx.parsed.y)} thousand tonnes`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { callback: v => formatCompact(v) }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

async function loadTopCropsChart() {
    const data = await api('/api/crops');
    const top10 = data.slice(0, 10);

    getOrCreateChart('chart-top-crops', {
        type: 'bar',
        data: {
            labels: top10.map(d => d.Crop),
            datasets: [{
                label: 'Production',
                data: top10.map(d => d.total),
                backgroundColor: PALETTE.slice(0, 10),
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',
            plugins: {
                tooltip: {
                    callbacks: {
                        label: ctx => `${formatNumber(ctx.parsed.x)} thousand tonnes`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { callback: v => formatCompact(v) }
                },
                y: { grid: { display: false } }
            }
        }
    });
}

async function loadTopStatesChart() {
    const data = await api('/api/states');
    const top10 = data.slice(0, 10);

    getOrCreateChart('chart-top-states', {
        type: 'bar',
        data: {
            labels: top10.map(d => d.State),
            datasets: [{
                label: 'Production',
                data: top10.map(d => d.total),
                backgroundColor: PALETTE.slice(0, 10).map(c => c + '99'),
                borderColor: PALETTE.slice(0, 10),
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            plugins: {
                tooltip: {
                    callbacks: {
                        label: ctx => `${formatNumber(ctx.parsed.y)} thousand tonnes`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { callback: v => formatCompact(v) }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// ══════════════════════════════════════════════════════════════════════════
//  SECTION 2: CROP ANALYTICS
// ══════════════════════════════════════════════════════════════════════════

async function loadCropFilters() {
    const crops = await api('/api/crops');
    const select = document.getElementById('crop-filter');
    crops.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.Crop;
        opt.textContent = c.Crop;
        select.appendChild(opt);
    });
}

async function updateCropAnalytics() {
    const crop = document.getElementById('crop-filter').value;
    const year = document.getElementById('crop-year-filter').value;

    // State-wise production
    const stateData = await api(`/api/production-by-state?crop=${encodeURIComponent(crop)}&year=${encodeURIComponent(year)}`);
    const topStates = stateData.slice(0, 12);

    getOrCreateChart('chart-crop-states', {
        type: 'bar',
        data: {
            labels: topStates.map(d => d.State),
            datasets: [{
                data: topStates.map(d => d.Production),
                backgroundColor: PALETTE.slice(0, 12),
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',
            plugins: {
                tooltip: { callbacks: { label: ctx => `${formatNumber(ctx.parsed.x)} k tonnes` } }
            },
            scales: {
                x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => formatCompact(v) } },
                y: { grid: { display: false } }
            }
        }
    });

    // Year-over-year trend
    const trendData = await api(`/api/production-by-year?crop=${encodeURIComponent(crop)}`);

    getOrCreateChart('chart-crop-trend', {
        type: 'line',
        data: {
            labels: trendData.map(d => d.Year),
            datasets: [{
                data: trendData.map(d => d.Production),
                borderColor: COLORS.primary,
                backgroundColor: COLORS.primary + '18',
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointBackgroundColor: '#fff',
                pointBorderColor: COLORS.primary,
                pointBorderWidth: 3,
                pointHoverRadius: 10,
            }]
        },
        options: {
            plugins: {
                tooltip: { callbacks: { label: ctx => `${formatNumber(ctx.parsed.y)} k tonnes` } }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => formatCompact(v) } },
                x: { grid: { display: false } }
            }
        }
    });

    // Top districts
    const distData = await api(`/api/top-districts?crop=${encodeURIComponent(crop)}&year=${encodeURIComponent(year)}&n=10`);

    getOrCreateChart('chart-top-districts', {
        type: 'bar',
        data: {
            labels: distData.map(d => `${d.District}, ${d.State}`),
            datasets: [{
                data: distData.map(d => d.Production),
                backgroundColor: PALETTE.slice(0, 10),
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',
            plugins: {
                tooltip: { callbacks: { label: ctx => `${formatNumber(ctx.parsed.x)} k tonnes` } }
            },
            scales: {
                x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => formatCompact(v) } },
                y: { grid: { display: false } }
            }
        }
    });

    // Soil & weather radar
    const soilData = await api(`/api/soil-weather?crop=${encodeURIComponent(crop)}`);
    if (soilData && Object.keys(soilData).length > 0) {
        const radarLabels = ['Nitrogen', 'Phosphorus', 'Potassium', 'Org. Carbon', 'Soil pH', 'Temp', 'Humidity', 'Precip', 'Sunshine'];
        const radarValues = [
            soilData['Nitrogen (kg/ha)'] / 5,
            soilData['Phosphorus (kg/ha)'],
            soilData['Potassium (kg/ha)'] / 5,
            soilData['Organic Carbon (%)'] * 50,
            soilData['Soil pH'] * 10,
            soilData['weather_temp_c'] * 3,
            soilData['weather_humidity_pct'],
            soilData['weather_precip_mm'] * 100,
            soilData['weather_sunshine_hours'] * 8,
        ];

        getOrCreateChart('chart-soil-radar', {
            type: 'radar',
            data: {
                labels: radarLabels,
                datasets: [{
                    data: radarValues,
                    backgroundColor: COLORS.primary + '22',
                    borderColor: COLORS.primary,
                    borderWidth: 2,
                    pointBackgroundColor: COLORS.primary,
                    pointRadius: 4,
                }]
            },
            options: {
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        angleLines: { color: 'rgba(0,0,0,0.05)' },
                        pointLabels: { font: { size: 11 } },
                        ticks: { display: false },
                    }
                }
            }
        });
    }
}

// ══════════════════════════════════════════════════════════════════════════
//  SECTION 3: GEOGRAPHIC EXPLORER
// ══════════════════════════════════════════════════════════════════════════

async function loadGeoFilters() {
    const states = await api('/api/states');
    const select = document.getElementById('geo-state');
    states.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.State;
        opt.textContent = s.State;
        select.appendChild(opt);
    });
}

async function onGeoStateChange() {
    const state = document.getElementById('geo-state').value;
    const distSelect = document.getElementById('geo-district');
    distSelect.innerHTML = '<option value="">All Districts</option>';

    if (state) {
        const districts = await api(`/api/districts?state=${encodeURIComponent(state)}`);
        districts.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            distSelect.appendChild(opt);
        });
    }
    updateGeoCharts();
}

function onGeoDistrictChange() {
    updateGeoCharts();
}

async function updateGeoCharts() {
    const state = document.getElementById('geo-state').value;
    const district = document.getElementById('geo-district').value;

    // Production by crop (doughnut)
    const cropData = await api(`/api/production-by-crop?state=${encodeURIComponent(state)}`);
    const topCrops = cropData.filter(d => d.Production > 0).slice(0, 8);

    getOrCreateChart('chart-geo-crops', {
        type: 'doughnut',
        data: {
            labels: topCrops.map(d => d.Crop),
            datasets: [{
                data: topCrops.map(d => d.Production),
                backgroundColor: PALETTE.slice(0, 8),
                borderWidth: 2,
                borderColor: '#fff',
                hoverOffset: 8,
            }]
        },
        options: {
            cutout: '55%',
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 12, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: { label: ctx => `${ctx.label}: ${formatNumber(ctx.parsed)} k tonnes` }
                }
            }
        }
    });

    // Soil & weather radar for area
    const soilData = await api(`/api/soil-weather?state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}`);
    if (soilData && Object.keys(soilData).length > 0) {
        const labels = ['Nitrogen', 'Phosphorus', 'Potassium', 'Org. Carbon', 'pH', 'Temp', 'Humidity', 'Precip', 'Sunshine'];
        const vals = [
            soilData['Nitrogen (kg/ha)'] / 5,
            soilData['Phosphorus (kg/ha)'],
            soilData['Potassium (kg/ha)'] / 5,
            soilData['Organic Carbon (%)'] * 50,
            soilData['Soil pH'] * 10,
            soilData['weather_temp_c'] * 3,
            soilData['weather_humidity_pct'],
            soilData['weather_precip_mm'] * 100,
            soilData['weather_sunshine_hours'] * 8,
        ];

        getOrCreateChart('chart-geo-radar', {
            type: 'radar',
            data: {
                labels,
                datasets: [{
                    label: district || state || 'All India',
                    data: vals,
                    backgroundColor: COLORS.green + '22',
                    borderColor: COLORS.green,
                    borderWidth: 2,
                    pointBackgroundColor: COLORS.green,
                    pointRadius: 4,
                }]
            },
            options: {
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        angleLines: { color: 'rgba(0,0,0,0.05)' },
                        pointLabels: { font: { size: 11 } },
                        ticks: { display: false },
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top' }