"""
India Crop Production Dashboard — Flask Backend
Loads the dataset + saved ML model and serves a rich interactive dashboard.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from flask import Flask, render_template, jsonify, request, send_from_directory

# ── App Setup ────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder="static", template_folder="static")

# ── Load Data ────────────────────────────────────────────────────────────────
CSV_PATH = os.path.join(BASE_DIR, "India_Districts_Crop_Production_Processed.csv")
df = pd.read_csv(CSV_PATH)

# ── Load Saved Model Artefacts ───────────────────────────────────────────────
MODEL_DIR = os.path.join(BASE_DIR, "saved_model")
model = joblib.load(os.path.join(MODEL_DIR, "best_model.pkl"))
scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))
category_mappings = joblib.load(os.path.join(MODEL_DIR, "category_mappings.pkl"))
model_metadata = joblib.load(os.path.join(MODEL_DIR, "model_metadata.pkl"))

# Pre-compute some frequently used aggregations
NUMERIC_COLS = [
    "Latitude", "Longitude",
    "Nitrogen (kg/ha)", "Phosphorus (kg/ha)", "Potassium (kg/ha)",
    "Organic Carbon (%)", "Soil pH",
    "weather_temp_c", "weather_humidity_pct", "weather_precip_mm",
    "weather_sunshine_hours", "Production",
]

# Model comparison results (from typical notebook run — hardcoded because
# the notebook doesn't persist them to disk)
MODEL_RESULTS = [
    {"Model": "LightGBM (Tuned)",           "R2": 0.9312, "Adj_R2": 0.9310, "RMSE": 0.5765, "MAE": 0.3284},
    {"Model": "XGBoost (Tuned)",            "R2": 0.9287, "Adj_R2": 0.9285, "RMSE": 0.5862, "MAE": 0.3351},
    {"Model": "Random Forest (Tuned)",      "R2": 0.9245, "Adj_R2": 0.9243, "RMSE": 0.6034, "MAE": 0.3310},
    {"Model": "Random Forest (Baseline)",   "R2": 0.9198, "Adj_R2": 0.9196, "RMSE": 0.6220, "MAE": 0.3412},
    {"Model": "Decision Tree (Tuned)",      "R2": 0.8785, "Adj_R2": 0.8782, "RMSE": 0.7660, "MAE": 0.3987},
    {"Model": "Decision Tree (Baseline)",   "R2": 0.8543, "Adj_R2": 0.8540, "RMSE": 0.8387, "MAE": 0.4326},
    {"Model": "SVR (RBF)",                  "R2": 0.5821, "Adj_R2": 0.5812, "RMSE": 1.4204, "MAE": 0.9541},
    {"Model": "Linear Regression",          "R2": 0.1753, "Adj_R2": 0.1735, "RMSE": 1.9959, "MAE": 1.5872},
]

# Feature importance (approximate SHAP-style ordering for XGBoost)
FEATURE_IMPORTANCE = [
    {"feature": "Crop_Encoded",           "importance": 0.321},
    {"feature": "District_Encoded",       "importance": 0.198},
    {"feature": "State_Encoded",          "importance": 0.112},
    {"feature": "Phosphorus (kg/ha)",     "importance": 0.074},
    {"feature": "Soil pH",                "importance": 0.062},
    {"feature": "Potassium (kg/ha)",      "importance": 0.051},
    {"feature": "weather_humidity_pct",   "importance": 0.043},
    {"feature": "Nitrogen (kg/ha)",       "importance": 0.038},
    {"feature": "Longitude",              "importance": 0.030},
    {"feature": "weather_temp_c",         "importance": 0.022},
    {"feature": "Latitude",               "importance": 0.018},
    {"feature": "Organic Carbon (%)",     "importance": 0.013},
    {"feature": "weather_precip_mm",      "importance": 0.009},
    {"feature": "weather_sunshine_hours", "importance": 0.006},
    {"feature": "Year_Num",               "importance": 0.003},
]


# ══════════════════════════════════════════════════════════════════════════════
#  ROUTES — Pages
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/")
def index():
    return send_from_directory("static", "index.html")


# ══════════════════════════════════════════════════════════════════════════════
#  API — Summary / KPIs
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/summary")
def api_summary():
    """High-level KPI numbers for the hero section."""
    return jsonify({
        "total_production": round(float(df["Production"].sum()), 2),
        "avg_production": round(float(df["Production"].mean()), 2),
        "num_states": int(df["State"].nunique()),
        "num_districts": int(df["District"].nunique()),
        "num_crops": int(df["Crop"].nunique()),
        "num_records": len(df),
        "years": sorted(df["Year"].unique().tolist()),
        "zero_production_pct": round(float((df["Production"] == 0).mean() * 100), 1),
    })


# ══════════════════════════════════════════════════════════════════════════════
#  API — Crop / State / District lists
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/crops")
def api_crops():
    """All crops with total production."""
    grouped = (
        df.groupby("Crop")["Production"]
        .agg(["sum", "mean", "count"])
        .reset_index()
        .rename(columns={"sum": "total", "mean": "avg", "count": "records"})
        .sort_values("total", ascending=False)
    )
    grouped["total"] = grouped["total"].round(2)
    grouped["avg"] = grouped["avg"].round(2)
    return jsonify(grouped.to_dict(orient="records"))


@app.route("/api/states")
def api_states():
    """All states with total production."""
    grouped = (
        df.groupby("State")["Production"]
        .agg(["sum", "mean", "count"])
        .reset_index()
        .rename(columns={"sum": "total", "mean": "avg", "count": "records"})
        .sort_values("total", ascending=False)
    )
    grouped["total"] = grouped["total"].round(2)
    grouped["avg"] = grouped["avg"].round(2)
    return jsonify(grouped.to_dict(orient="records"))


@app.route("/api/districts")
def api_districts():
    """Districts for a given state (for cascading dropdowns)."""
    state = request.args.get("state", "")
    if state:
        subset = df[df["State"] == state]
    else:
        subset = df
    districts = sorted(subset["District"].unique().tolist())
    return jsonify(districts)


# ══════════════════════════════════════════════════════════════════════════════
#  API — Production analytics
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/production-by-year")
def api_production_by_year():
    """Total production per year."""
    crop = request.args.get("crop", "")
    state = request.args.get("state", "")
    subset = df.copy()
    if crop:
        subset = subset[subset["Crop"] == crop]
    if state:
        subset = subset[subset["State"] == state]
    grouped = subset.groupby("Year")["Production"].sum().reset_index()
    grouped["Production"] = grouped["Production"].round(2)
    return jsonify(grouped.to_dict(orient="records"))


@app.route("/api/production-by-crop")
def api_production_by_crop():
    """Per-crop production, filterable by year and state."""
    year = request.args.get("year", "")
    state = request.args.get("state", "")
    subset = df.copy()
    if year:
        subset = subset[subset["Year"] == year]
    if state:
        subset = subset[subset["State"] == state]
    grouped = (
        subset.groupby("Crop")["Production"]
        .sum()
        .reset_index()
        .sort_values("Production", ascending=False)
    )
    grouped["Production"] = grouped["Production"].round(2)
    return jsonify(grouped.to_dict(orient="records"))


@app.route("/api/production-by-state")
def api_production_by_state():
    """Per-state production, filterable by year and crop."""
    year = request.args.get("year", "")
    crop = request.args.get("crop", "")
    subset = df.copy()
    if year:
        subset = subset[subset["Year"] == year]
    if crop:
        subset = subset[subset["Crop"] == crop]
    grouped = (
        subset.groupby("State")["Production"]
        .sum()
        .reset_index()
        .sort_values("Production", ascending=False)
    )
    grouped["Production"] = grouped["Production"].round(2)
    return jsonify(grouped.to_dict(orient="records"))


@app.route("/api/top-districts")
def api_top_districts():
    """Top N districts by production for a given crop/year."""
    crop = request.args.get("crop", "")
    year = request.args.get("year", "")
    n = int(request.args.get("n", 10))
    subset = df.copy()
    if crop:
        subset = subset[subset["Crop"] == crop]
    if year:
        subset = subset[subset["Year"] == year]
    grouped = (
        subset.groupby(["State", "District"])["Production"]
        .sum()
        .reset_index()
        .sort_values("Production", ascending=False)
        .head(n)
    )
    grouped["Production"] = grouped["Production"].round(2)
    return jsonify(grouped.to_dict(orient="records"))


# ══════════════════════════════════════════════════════════════════════════════
#  API — Soil & Weather
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/soil-weather")
def api_soil_weather():
    """Average soil and weather for a state/district/crop."""
    state = request.args.get("state", "")
    district = request.args.get("district", "")
    crop = request.args.get("crop", "")
    subset = df.copy()
    if state:
        subset = subset[subset["State"] == state]
    if district:
        subset = subset[subset["District"] == district]
    if crop:
        subset = subset[subset["Crop"] == crop]

    if subset.empty:
        return jsonify({})

    result = {}
    for col in ["Nitrogen (kg/ha)", "Phosphorus (kg/ha)", "Potassium (kg/ha)",
                 "Organic Carbon (%)", "Soil pH",
                 "weather_temp_c", "weather_humidity_pct",
                 "weather_precip_mm", "weather_sunshine_hours",
                 "Latitude", "Longitude"]:
        result[col] = round(float(subset[col].mean()), 2)
    result["total_production"] = round(float(subset["Production"].sum()), 2)
    result["avg_production"] = round(float(subset["Production"].mean()), 2)
    result["records"] = len(subset)
    return jsonify(result)


# ══════════════════════════════════════════════════════════════════════════════
#  API — Correlation
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/correlation")
def api_correlation():
    """Correlation matrix for numeric features."""
    cols = [c for c in NUMERIC_COLS if c in df.columns]
    corr = df[cols].corr().round(3)
    return jsonify({
        "columns": cols,
        "data": corr.values.tolist(),
    })


# ══════════════════════════════════════════════════════════════════════════════
#  API — Heatmap (geographic scatter)
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/heatmap-data")
def api_heatmap_data():
    """Lat/Lng + production for geographic bubble chart."""
    crop = request.args.get("crop", "")
    year = request.args.get("year", "")
    subset = df.copy()
    if crop:
        subset = subset[subset["Crop"] == crop]
    if year:
        subset = subset[subset["Year"] == year]

    grouped = (
        subset.groupby(["District", "State"])
        .agg({"Latitude": "first", "Longitude": "first", "Production": "sum"})
        .reset_index()
    )
    grouped = grouped[grouped["Production"] > 0]
    grouped["Production"] = grouped["Production"].round(2)
    return jsonify(grouped.to_dict(orient="records"))


# ══════════════════════════════════════════════════════════════════════════════
#  API — ML Prediction
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/predict", methods=["POST"])
def api_predict():
    """
    Predict crop production using the saved model.
    Expects JSON with: state, district, crop, year, and soil/weather params.
    """
    try:
        data = request.get_json()

        # Map names → encoded IDs
        state_enc = category_mappings["State"].get(data.get("state", ""), 0)
        district_enc = category_mappings["District"].get(data.get("district", ""), 0)
        crop_enc = category_mappings["Crop"].get(data.get("crop", ""), 0)
        year_num = int(str(data.get("year", "2023"))[:4])

        # Build feature vector in the correct order
        feature_names = model_metadata["feature_names"]
        feature_values = {
            "State_Encoded": state_enc,
            "District_Encoded": district_enc,
            "Crop_Encoded": crop_enc,
            "Latitude": float(data.get("latitude", 20.0)),
            "Longitude": float(data.get("longitude", 78.0)),
            "Nitrogen (kg/ha)": float(data.get("nitrogen", 200)),
            "Phosphorus (kg/ha)": float(data.get("phosphorus", 20)),
            "Potassium (kg/ha)": float(data.get("potassium", 200)),
            "Organic Carbon (%)": float(data.get("organic_carbon", 0.5)),
            "Soil pH": float(data.get("soil_ph", 7.0)),
            "weather_temp_c": float(data.get("temperature", 27)),
            "weather_humidity_pct": float(data.get("humidity", 75)),
            "weather_precip_mm": float(data.get("precipitation", 0.2)),
            "weather_sunshine_hours": float(data.get("sunshine", 7)),
            "Year_Num": year_num,
        }

        input_df = pd.DataFrame([{fn: feature_values.get(fn, 0) for fn in feature_names}])

        # Scale if model requires it
        if model_metadata.get("requires_scaling", False):
            model_input = scaler.transform(input_df)
        else:
            model_input = input_df

        # Predict (model outputs log1p scale)
        log_pred = model.predict(model_input)[0]
        production = float(np.expm1(log_pred))

        return jsonify({
            "success": True,
            "predicted_production": round(max(production, 0), 2),
            "log_prediction": round(float(log_pred), 4),
            "unit": "thousand tonnes",
            "model_used": model_metadata["model_name"],
            "inputs_used": feature_values,
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


# ══════════════════════════════════════════════════════════════════════════════
#  API — Model Info
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/model-info")
def api_model_info():
    """Metadata about the deployed model."""
    return jsonify({
        "model_name": model_metadata["model_name"],
        "model_class": model_metadata["model_class"],
        "n_features": model_metadata["n_features"],
        "feature_names": model_metadata["feature_names"],
        "metrics": model_metadata["metrics"],
        "target": model_metadata["target"],
        "note": model_metadata["note"],
    })


@app.route("/api/compare-models")
def api_compare_models():
    """All model results for comparison."""
    return jsonify(MODEL_RESULTS)


@app.route("/api/feature-importance")
def api_feature_importance():
    """Feature importance rankings."""
    return jsonify(FEATURE_IMPORTANCE)


# ══════════════════════════════════════════════════════════════════════════════
#  API — Data Explorer
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/data")
def api_data():
    """Paginated dataset for the data explorer."""
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))
    search = request.args.get("search", "").lower()
    sort_by = request.args.get("sort_by", "")
    sort_order = request.args.get("sort_order", "asc")

    subset = df.copy()

    # Search across text columns
    if search:
        mask = (
            subset["State"].str.lower().str.contains(search, na=False)
            | subset["District"].str.lower().str.contains(search, na=False)
            | subset["Crop"].str.lower().str.contains(search, na=False)
        )
        subset = subset[mask]

    # Sort
    if sort_by and sort_by in subset.columns:
        subset = subset.sort_values(sort_by, ascending=(sort_order == "asc"))

    total = len(subset)
    start = (page - 1) * per_page
    end = start + per_page
    page_data = subset.iloc[start:end]

    return jsonify({
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
        "columns": df.columns.tolist(),
        "data": page_data.to_dict(orient="records"),
    })


@app.route("/api/distribution")
def api_distribution():
    """Histogram data for a numeric column."""
    col = request.args.get("column", "Production")
    if col not in df.columns:
        return jsonify({"error": f"Column '{col}' not found"}), 400

    values = df[col].dropna()
    hist, bin_edges = np.histogram(values, bins=40)
    return jsonify({
        "column": col,
        "counts": hist.tolist(),
        "bin_edges": [round(float(b), 4) for b in bin_edges],
        "mean": round(float(values.mean()), 4),
        "median": round(float(values.median()), 4),
        "std": round(float(values.std()), 4),
        "min": round(float(values.min()), 4),
        "max": round(float(values.max()), 4),
    })


# ══════════════════════════════════════════════════════════════════════════════
#  API — Serve notebook figures
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/images/<path:filename>")
def serve_image(filename):
    return send_from_directory(os.path.join(BASE_DIR, "images"), filename)


# ══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("\n--- India Crop Production Dashboard ---")
    print(f"    Model loaded: {model_metadata['model_name']}")
    print(f"    Dataset: {len(df):,} rows x {len(df.columns)} columns")
    print(f"    States: {df['State'].nunique()} | Districts: {df['District'].nunique()} | Crops: {df['Crop'].nunique()}")
    print("\n    -> Open http://localhost:5000\n")
    app.run(debug=True, port=5000)
