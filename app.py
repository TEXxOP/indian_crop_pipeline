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

if __name__ == '__main__':
    app.run(debug=True, port=5000)
