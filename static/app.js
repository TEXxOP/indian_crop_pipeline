
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
                }
            }
        });
    }

    // Geographic scatter
    const heatData = await api(`/api/heatmap-data?crop=&year=`);
    const maxProd = Math.max(...heatData.map(d => d.Production), 1);

    getOrCreateChart('chart-geo-scatter', {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Districts',
                data: heatData.map(d => ({
                    x: d.Longitude,
                    y: d.Latitude,
                    r: Math.max(2, Math.min(20, (d.Production / maxProd) * 25)),
                    district: d.District,
                    state: d.State,
                    production: d.Production,
                })),
                backgroundColor: COLORS.primary + '44',
                borderColor: COLORS.primary + '88',
                borderWidth: 1,
            }]
        },
        options: {
            plugins: {
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const p = ctx.raw;
                            return `${p.district}, ${p.state}: ${formatNumber(p.production)} k tonnes`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Longitude', font: { weight: 600 } },
                    grid: { color: 'rgba(0,0,0,0.04)' },
                },
                y: {
                    title: { display: true, text: 'Latitude', font: { weight: 600 } },
                    grid: { color: 'rgba(0,0,0,0.04)' },
                }
            }
        }
    });
}

// ══════════════════════════════════════════════════════════════════════════
//  SECTION 4: PREDICT PRODUCTION
// ══════════════════════════════════════════════════════════════════════════

async function loadPredictForm() {
    const states = await api('/api/states');
    const crops = await api('/api/crops');

    const stateSelect = document.getElementById('pred-state');
    states.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.State;
        opt.textContent = s.State;
        stateSelect.appendChild(opt);
    });

    const cropSelect = document.getElementById('pred-crop');
    crops.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.Crop;
        opt.textContent = c.Crop;
        cropSelect.appendChild(opt);
    });

    // Load model info
    const modelInfo = await api('/api/model-info');
    document.getElementById('metric-r2').textContent = modelInfo.metrics.R2;
    document.getElementById('metric-rmse').textContent = modelInfo.metrics.RMSE;
    document.getElementById('metric-mae').textContent = modelInfo.metrics.MAE;

    // Feature importance bars — with staggered animation
    const importance = await api('/api/feature-importance');
    const container = document.getElementById('importance-bars');
    const maxImp = Math.max(...importance.map(f => f.importance));
    container.innerHTML = importance.slice(0, 10).map((f, i) => `
        <div class="importance-row" data-width="${(f.importance / maxImp * 100).toFixed(1)}%" style="transition-delay: ${i * 0.08}s">
            <span class="importance-label">${f.feature}</span>
            <div class="importance-bar-track">
                <div class="importance-bar-fill" data-target-width="${(f.importance / maxImp * 100).toFixed(1)}%"></div>
            </div>
            <span class="importance-value">${(f.importance * 100).toFixed(1)}%</span>
        </div>
    `).join('');

    // Trigger staggered animation after render
    requestAnimationFrame(() => {
        container.querySelectorAll('.importance-row').forEach((row, i) => {
            setTimeout(() => {
                row.classList.add('animate');
                const bar = row.querySelector('.importance-bar-fill');
                bar.classList.add('animate');
                bar.style.setProperty('width', bar.dataset.targetWidth, 'important');
            }, i * 80);
        });
    });
}

async function onPredStateChange() {
    const state = document.getElementById('pred-state').value;
    const distSelect = document.getElementById('pred-district');
    distSelect.innerHTML = '<option value="">Select District</option>';
    if (state) {
        const districts = await api(`/api/districts?state=${encodeURIComponent(state)}`);
        districts.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            distSelect.appendChild(opt);
        });
        // Attach auto-fill to district change
        distSelect.onchange = () => autoFillDistrictData(state, distSelect.value);
        showToast('info', `Loaded ${districts.length} districts for ${state}`);
    }
}

// Auto-fill soil & weather sliders when a district is selected
async function autoFillDistrictData(state, district) {
    if (!state || !district) return;
    try {
        const data = await api(`/api/soil-weather?state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}`);
        if (!data || Object.keys(data).length === 0) return;

        const sliderMap = {
            'Nitrogen (kg/ha)': 'nitrogen',
            'Phosphorus (kg/ha)': 'phosphorus',
            'Potassium (kg/ha)': 'potassium',
            'Organic Carbon (%)': 'organic_carbon',
            'Soil pH': 'soil_ph',
            'weather_temp_c': 'temperature',
            'weather_humidity_pct': 'humidity',
            'weather_precip_mm': 'precipitation',
            'weather_sunshine_hours': 'sunshine',
        };

        for (const [key, sliderId] of Object.entries(sliderMap)) {
            if (data[key] !== undefined) {
                const slider = document.getElementById(`pred-${sliderId}`);
                if (slider) {
                    animateSlider(slider, parseFloat(data[key]));
                    document.getElementById(`val-${sliderId}`).textContent = parseFloat(data[key]).toFixed(slider.step.includes('.') ? 1 : 0);
                }
            }
        }
        showToast('success', `Auto-filled soil & weather data for ${district}`);
    } catch (e) {
        console.warn('Auto-fill failed:', e);
    }
}

// Smoothly animate a slider to a target value
function animateSlider(slider, target) {
    const current = parseFloat(slider.value);
    const diff = target - current;
    const duration = 400;
    const start = performance.now();

    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        slider.value = current + diff * eased;
        if (progress < 1) requestAnimationFrame(step);
        else slider.value = target;
    }
    requestAnimationFrame(step);
}

function updateSliderVal(name) {
    const slider = document.getElementById(`pred-${name}`);
    const display = document.getElementById(`val-${name}`);
    display.textContent = slider.value;
}

async function runPrediction() {
    const btn = document.getElementById('predict-btn');
    btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;"><span class="loading-dot-anim"></span> Predicting...</span>';
    btn.classList.add('loading');

    const state = document.getElementById('pred-state').value;
    const district = document.getElementById('pred-district').value;

    // Get lat/lng for the district if selected
    let lat = 20.0, lng = 78.0;
    if (state && district) {
        const soilData = await api(`/api/soil-weather?state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}`);
        if (soilData.Latitude) lat = soilData.Latitude;
        if (soilData.Longitude) lng = soilData.Longitude;
    }

    const body = {
        state,
        district,
        crop: document.getElementById('pred-crop').value,
        year: document.getElementById('pred-year').value,
        latitude: lat,
        longitude: lng,
        nitrogen: parseFloat(document.getElementById('pred-nitrogen').value),
        phosphorus: parseFloat(document.getElementById('pred-phosphorus').value),
        potassium: parseFloat(document.getElementById('pred-potassium').value),
        organic_carbon: parseFloat(document.getElementById('pred-organic_carbon').value),
        soil_ph: parseFloat(document.getElementById('pred-soil_ph').value),
        temperature: parseFloat(document.getElementById('pred-temperature').value),
        humidity: parseFloat(document.getElementById('pred-humidity').value),
        precipitation: parseFloat(document.getElementById('pred-precipitation').value),
        sunshine: parseFloat(document.getElementById('pred-sunshine').value),
    };

    try {
        const result = await apiPost('/api/predict', body);
        if (result.success) {
            animateResultValue(result.predicted_production);
            document.getElementById('model-badge').style.display = 'inline-flex';
            document.getElementById('model-name-badge').textContent = result.model_used;
            document.getElementById('result-hero').classList.add('has-result');
            showToast('success', `Predicted: ${result.predicted_production.toFixed(2)} thousand tonnes`);
        } else {
            document.getElementById('result-value').textContent = 'Error';
            showToast('warning', 'Prediction failed — check inputs');
        }
    } catch (err) {
        document.getElementById('result-value').textContent = 'Error';
        showToast('warning', 'Prediction request failed');
    }

    btn.textContent = 'Predict Production';
    btn.classList.remove('loading');
}

// Add ripple effect to predict button
document.addEventListener('click', (e) => {
    if (e.target.closest('.predict-btn')) {
        const btn = e.target.closest('.predict-btn');
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }
});

function animateResultValue(target) {
    const el = document.getElementById('result-value');
    const duration = 1500;
    const start = performance.now();
    const startVal = 0;

    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        // More dramatic easing — elastic-like
        const eased = 1 - Math.pow(1 - progress, 4);
        const current = startVal + (target - startVal) * eased;
        el.textContent = current.toFixed(2);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ══════════════════════════════════════════════════════════════════════════
//  SECTION 5: MODEL PERFORMANCE
// ══════════════════════════════════════════════════════════════════════════

async function loadModelPerformance() {
    const models = await api('/api/compare-models');

    // R² bar chart
    getOrCreateChart('chart-model-r2', {
        type: 'bar',
        data: {
            labels: models.map(m => m.Model),
            datasets: [{
                data: models.map(m => m.R2),
                backgroundColor: models.map((_, i) =>
                    i === 0 ? COLORS.green :
                    i === 1 ? COLORS.primary :
                    i === 2 ? COLORS.amber :
                    PALETTE[i + 3] + '88'
                ),
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',
            plugins: {
                tooltip: { callbacks: { label: ctx => `R² = ${ctx.parsed.x.toFixed(4)}` } }
            },
            scales: {
                x: { min: 0, max: 1, grid: { color: 'rgba(0,0,0,0.04)' } },
                y: { grid: { display: false } }
            }
        }
    });

    // RMSE chart
    getOrCreateChart('chart-model-rmse', {
        type: 'bar',
        data: {
            labels: models.map(m => m.Model),
            datasets: [{
                data: models.map(m => m.RMSE),
                backgroundColor: models.map((_, i) => PALETTE[i] + '88'),
                borderColor: models.map((_, i) => PALETTE[i]),
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',
            plugins: {
                tooltip: { callbacks: { label: ctx => `RMSE = ${ctx.parsed.x.toFixed(4)}` } }
            },
            scales: {
                x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } },
                y: { grid: { display: false } }
            }
        }
    });

    // MAE chart
    getOrCreateChart('chart-model-mae', {
        type: 'bar',
        data: {
            labels: models.map(m => m.Model),
            datasets: [{
                data: models.map(m => m.MAE),
                backgroundColor: models.map((_, i) => PALETTE[i] + '88'),
                borderColor: models.map((_, i) => PALETTE[i]),
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',
            plugins: {
                tooltip: { callbacks: { label: ctx => `MAE = ${ctx.parsed.x.toFixed(4)}` } }
            },
            scales: {
                x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } },
                y: { grid: { display: false } }
            }
        }
    });

    // Comparison table
    const tbody = document.getElementById('model-table-body');
    tbody.innerHTML = models.map((m, i) => {
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const bestR2 = i === 0;
        return `
            <tr>
                <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
                <td style="font-weight:${i < 3 ? '600' : '400'}">${m.Model}</td>
                <td class="${bestR2 ? 'best-val' : ''}">${m.R2.toFixed(4)}</td>
                <td>${m.Adj_R2.toFixed(4)}</td>
                <td>${m.RMSE.toFixed(4)}</td>
                <td>${m.MAE.toFixed(4)}</td>
            </tr>
        `;
    }).join('');
}

// ══════════════════════════════════════════════════════════════════════════
//  SECTION 6: DATA EXPLORER
// ══════════════════════════════════════════════════════════════════════════

let currentPage = 1;
let currentSearch = '';
let currentSortBy = '';
let currentSortOrder = 'asc';
let searchTimeout = null;

async function loadDataTable(page = 1) {
    currentPage = page;
    const params = new URLSearchParams({
        page,
        per_page: 50,
        search: currentSearch,
        sort_by: currentSortBy,
        sort_order: currentSortOrder,
    });

    const data = await api(`/api/data?${params}`);

    // Header
    const headerRow = document.getElementById('data-table-header');
    if (data.columns) {
        headerRow.innerHTML = data.columns.map(col => {
            const sortClass = currentSortBy === col ? (currentSortOrder === 'asc' ? 'sorted-asc' : 'sorted-desc') : '';
            return `<th class="${sortClass}" onclick="sortTable('${col}')">${col}</th>`;
        }).join('');
    }

    // Body
    const tbody = document.getElementById('data-table-body');
    if (data.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${data.columns.length}" class="empty-state">No records found</td></tr>`;
    } else {
        tbody.innerHTML = data.data.map(row => `
            <tr>${data.columns.map(col => {
                let val = row[col];
                if (typeof val === 'number' && !Number.isInteger(val)) val = val.toFixed(2);
                return `<td>${val ?? ''}</td>`;
            }).join('')}</tr>
        `).join('');
    }

    // Pagination
    renderPagination(data.page, data.total_pages, data.total);
}

function renderPagination(page, totalPages, total) {
    const container = document.getElementById('data-pagination');
    let html = '';

    html += `<button class="page-btn" onclick="loadDataTable(1)" ${page <= 1 ? 'disabled' : ''}>«</button>`;
    html += `<button class="page-btn" onclick="loadDataTable(${page - 1})" ${page <= 1 ? 'disabled' : ''}>‹</button>`;

    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="loadDataTable(${i})">${i}</button>`;
    }

    html += `<button class="page-btn" onclick="loadDataTable(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>›</button>`;
    html += `<button class="page-btn" onclick="loadDataTable(${totalPages})" ${page >= totalPages ? 'disabled' : ''}>»</button>`;
    html += `<span class="page-info">${total.toLocaleString()} records</span>`;

    container.innerHTML = html;
}

function sortTable(col) {
    if (currentSortBy === col) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortBy = col;
        currentSortOrder = 'asc';
    }
    loadDataTable(1);
}

function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentSearch = document.getElementById('data-search').value;
        loadDataTable(1);
    }, 350);
}

// Distribution histogram
async function loadDistribution() {
    const col = document.getElementById('dist-column').value;
    const data = await api(`/api/distribution?column=${encodeURIComponent(col)}`);

    const labels = data.bin_edges.slice(0, -1).map((b, i) =>
        `${b.toFixed(1)}–${data.bin_edges[i + 1].toFixed(1)}`
    );

    getOrCreateChart('chart-distribution', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: data.counts,
                backgroundColor: COLORS.primary + '66',
                borderColor: COLORS.primary,
                borderWidth: 1,
                borderRadius: 2,
            }]
        },
        options: {
            plugins: {
                tooltip: {
                    callbacks: {
                        title: ctx => ctx[0].label,
                        label: ctx => `Count: ${ctx.parsed.y.toLocaleString()}`
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, title: { display: true, text: 'Count' } },
                x: { grid: { display: false }, ticks: { maxRotation: 45, maxTicksLimit: 15 } }
            }
        }
    });
}

// Correlation heatmap (using a grid of rectangles drawn on canvas)
async function loadCorrelation() {
    const data = await api('/api/correlation');
    const canvas = document.getElementById('chart-correlation');
    const ctx = canvas.getContext('2d');
    const cols = data.columns;
    const matrix = data.data;
    const n = cols.length;

    // Size the canvas
    const size = Math.min(500, canvas.parentElement.clientWidth - 20);
    canvas.width = size;
    canvas.height = size;
    const cellSize = (size - 80) / n;
    const offsetX = 80;
    const offsetY = 10;

    ctx.clearRect(0, 0, size, size);
    ctx.font = '9px Inter';
    ctx.textAlign = 'right';

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const val = matrix[i][j];
            const x = offsetX + j * cellSize;
            const y = offsetY + i * cellSize;

            // Color: blue for positive, red for negative
            if (val >= 0) {
                const intensity = Math.round(val * 200);
                ctx.fillStyle = `rgba(102, 126, 234, ${Math.abs(val) * 0.8 + 0.05})`;
            } else {
                ctx.fillStyle = `rgba(239, 68, 68, ${Math.abs(val) * 0.8 + 0.05})`;
            }

            ctx.fillRect(x, y, cellSize - 1, cellSize - 1);

            // Value text
            if (cellSize > 25) {
                ctx.fillStyle = Math.abs(val) > 0.5 ? '#fff' : '#475569';
                ctx.textAlign = 'center';
                ctx.font = `${Math.min(9, cellSize / 4)}px Inter`;
                ctx.fillText(val.toFixed(2), x + cellSize / 2, y + cellSize / 2 + 3);
            }
        }
    }

    // Column labels (top — rotated)
    ctx.fillStyle = '#475569';
    ctx.font = '8px Inter';
    for (let j = 0; j < n; j++) {
        ctx.save();
        ctx.translate(offsetX + j * cellSize + cellSize / 2, offsetY + n * cellSize + 8);
        ctx.rotate(Math.PI / 4);
        ctx.textAlign = 'left';
        ctx.fillText(shortLabel(cols[j]), 0, 0);
        ctx.restore();
    }

    // Row labels (left)
    ctx.textAlign = 'right';
    for (let i = 0; i < n; i++) {
        ctx.fillText(shortLabel(cols[i]), offsetX - 4, offsetY + i * cellSize + cellSize / 2 + 3);
    }
}

function shortLabel(label) {
    const map = {
        'Nitrogen (kg/ha)': 'Nitrogen',
        'Phosphorus (kg/ha)': 'Phosphorus',
        'Potassium (kg/ha)': 'Potassium',
        'Organic Carbon (%)': 'Org.Carbon',
        'weather_temp_c': 'Temp',
        'weather_humidity_pct': 'Humidity',
        'weather_precip_mm': 'Precip',
        'weather_sunshine_hours': 'Sunshine',
    };
    return map[label] || label;
}

// ══════════════════════════════════════════════════════════════════════════
//  NAVIGATION & ANIMATIONS
// ══════════════════════════════════════════════════════════════════════════

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === id);
    });
}

// Intersection Observer — animate sections on scroll & update nav
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Update nav active state
            const sectionId = entry.target.id;
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.toggle('active', item.dataset.section === sectionId);
            });
        }
    });
}, { threshold: 0.1, rootMargin: '-50px 0px' });

// ══════════════════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════

function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function formatCompact(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function animateCounter(el) {
    const text = el.getAttribute('data-target');
    // If it's not a pure number, just display it
    const numericValue = parseFloat(text.replace(/,/g, ''));
    if (isNaN(numericValue)) return;

    el.classList.add('counting');
    el.textContent = '0';

    const duration = 2000;
    const start = performance.now();

    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        // Springy easing for more satisfying feel
        const eased = 1 - Math.pow(1 - progress, 4);
        const current = numericValue * eased;
        el.textContent = formatNumber(current.toFixed(0));
        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            el.textContent = text; // Final exact value
            el.classList.remove('counting');
        }
    }
    requestAnimationFrame(step);
}

// ══════════════════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════

function showToast(type, message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { success: '\u2705', info: '\u2139\ufe0f', warning: '\u26a0\ufe0f' };
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ══════════════════════════════════════════════════════════════════════════
//  SCROLL PROGRESS BAR & BACK-TO-TOP
// ══════════════════════════════════════════════════════════════════════════

function updateScrollProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

    const bar = document.getElementById('scroll-progress');
    if (bar) bar.style.width = progress + '%';

    // Back to top button visibility
    const btn = document.getElementById('back-to-top');
    if (btn) {
        btn.classList.toggle('visible', scrollTop > 400);
    }
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Throttled scroll handler
let scrollTicking = false;
window.addEventListener('scroll', () => {
    if (!scrollTicking) {
        requestAnimationFrame(() => {
            updateScrollProgress();
            scrollTicking = false;
        });
        scrollTicking = true;
    }
});

// ══════════════════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════════════════════

const SECTION_IDS = ['overview', 'crop-analytics', 'geographic', 'predict', 'models', 'data-explorer'];

document.addEventListener('keydown', (e) => {
    // Don't trigger if user is typing in an input/select
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    // Number keys 1-6 navigate to sections
    const num = parseInt(e.key);
    if (num >= 1 && num <= 6) {
        e.preventDefault();
        scrollToSection(SECTION_IDS[num - 1]);
        showToast('info', `Navigated to section ${num}`);
    }

    // 'T' key goes to top
    if (e.key === 't' || e.key === 'T') {
        scrollToTop();
    }
});

// ══════════════════════════════════════════════════════════════════════════
//  PARALLAX-LITE ON KPI CARDS (mouse tilt)
// ══════════════════════════════════════════════════════════════════════════

document.addEventListener('mousemove', (e) => {
    const cards = document.querySelectorAll('.kpi-card');
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distX = (e.clientX - centerX) / rect.width;
        const distY = (e.clientY - centerY) / rect.height;

        // Only apply if mouse is reasonably close
        const distance = Math.sqrt(distX * distX + distY * distY);
        if (distance < 2) {
            const rotateX = distY * -3;
            const rotateY = distX * 3;
            card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
        } else {
            card.style.transform = '';
        }
    });
});

// Reset on mouse leave
document.getElementById('kpi-grid')?.addEventListener('mouseleave', () => {
    document.querySelectorAll('.kpi-card').forEach(card => {
        card.style.transform = '';
        card.style.transition = 'transform 0.5s ease';
    });
});

// ══════════════════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    // Observe all sections for scroll animations
    document.querySelectorAll('.dashboard-section').forEach(section => {
        observer.observe(section);
    });

    // Initialize scroll progress
    updateScrollProgress();

    // Load all sections
    try {
        await loadOverview();
        showToast('success', 'Dashboard loaded successfully!');
        await loadCropFilters();
        await updateCropAnalytics();
        await loadGeoFilters();
        await updateGeoCharts();
        await loadPredictForm();
        await loadModelPerformance();
        await loadDataTable();
        await loadDistribution();

        // Defer correlation heatmap
        setTimeout(loadCorrelation, 500);
    } catch (err) {
        console.error('Dashboard init error:', err);
        showToast('warning', 'Some dashboard sections failed to load');
    }
});
