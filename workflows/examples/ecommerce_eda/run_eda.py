"""E-Commerce Sales Analysis — EDA example that publishes real results to VTCONS Project Lab.

DATA NOTICE: unless --data points to a real CSV, this script generates a SYNTHETIC dataset with a
fixed random seed. Every number it produces describes that synthetic data, not a real business.

    export VTCONS_LAB_URL=http://127.0.0.1:8000
    export VTCONS_LAB_TOKEN=vtl_...
    python run_eda.py                      # generate, analyse, publish
    python run_eda.py --no-publish         # only write outputs to ./out

Outputs (all published as artifacts of one run):
    correlation.png        Pearson correlation heatmap of numeric columns
    dataset_preview.csv    first 200 rows of the dataset
    eda_report.md          Markdown EDA report with computed findings
    revenue_by_month.json  Plotly figure: monthly revenue by category
plus scalar metrics (rows, revenue_total, avg_order_value, return_rate, correlations ...).
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", str(Path(tempfile.gettempdir()) / "mpl-vtcons"))

import matplotlib  # noqa: E402

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

PROJECT_SLUG = "ecommerce-sales-analysis"
CATEGORIES = {  # name: (median unit price AUD, price spread, base return rate)
    "Electronics": (180.0, 0.55, 0.08),
    "Fashion": (55.0, 0.45, 0.14),
    "Home": (75.0, 0.50, 0.05),
    "Beauty": (32.0, 0.40, 0.04),
    "Sports": (90.0, 0.50, 0.06),
}
REGIONS = ["NSW", "VIC", "QLD", "WA", "SA"]
CHANNELS = ["Organic", "Paid search", "Social", "Email", "Referral"]


def generate_synthetic(n: int, seed: int) -> pd.DataFrame:
    """Synthetic orders with a few deliberate relationships (discount→quantity, delivery→rating)."""
    rng = np.random.default_rng(seed)
    cats = rng.choice(list(CATEGORIES), size=n, p=[0.24, 0.26, 0.2, 0.15, 0.15])
    median = np.array([CATEGORIES[c][0] for c in cats])
    spread = np.array([CATEGORIES[c][1] for c in cats])
    unit_price = np.round(median * np.exp(rng.normal(0, spread)), 2)
    discount = np.round(rng.choice([0, 0, 0, 0.05, 0.1, 0.15, 0.2, 0.3], size=n), 2)
    quantity = 1 + rng.poisson(0.6 + 4.0 * discount)
    days = rng.integers(0, 365, size=n)
    # mild seasonality: more orders late in the year
    days = np.where(rng.random(n) < 0.18, rng.integers(300, 365, size=n), days)
    order_date = pd.Timestamp("2025-01-01") + pd.to_timedelta(days, unit="D")
    delivery_days = np.clip(np.round(rng.gamma(2.2, 1.6, size=n)), 1, 14).astype(int)
    rating = np.clip(np.round(4.7 - 0.12 * delivery_days + rng.normal(0, 0.55, size=n)), 1, 5).astype(int)
    customer_age = np.clip(np.round(rng.normal(36, 11, size=n)), 18, 80).astype(int)
    base_return = np.array([CATEGORIES[c][2] for c in cats])
    returned = rng.random(n) < base_return + 0.02 * (rating <= 2)
    revenue = np.round(unit_price * quantity * (1 - discount), 2)
    df = pd.DataFrame(
        {
            "order_id": np.arange(100001, 100001 + n),
            "order_date": order_date.date,
            "category": cats,
            "region": rng.choice(REGIONS, size=n, p=[0.33, 0.27, 0.2, 0.11, 0.09]),
            "channel": rng.choice(CHANNELS, size=n),
            "customer_age": customer_age,
            "unit_price": unit_price,
            "quantity": quantity,
            "discount_pct": discount,
            "revenue": revenue,
            "delivery_days": delivery_days,
            "rating": rating,
            "returned": returned,
        }
    )
    # a little missingness, like real exports
    miss = rng.random(n) < 0.015
    df.loc[miss, "rating"] = np.nan
    return df.sort_values("order_date").reset_index(drop=True)


def correlation_png(df: pd.DataFrame, path: Path, synthetic: bool) -> pd.DataFrame:
    cols = ["unit_price", "quantity", "discount_pct", "revenue", "delivery_days", "rating", "customer_age"]
    corr = df[cols].corr(method="pearson")
    fig, ax = plt.subplots(figsize=(7.2, 6), dpi=150)
    im = ax.imshow(corr.values, cmap="RdBu_r", vmin=-1, vmax=1)
    ax.set_xticks(range(len(cols)), labels=cols, rotation=40, ha="right", fontsize=9)
    ax.set_yticks(range(len(cols)), labels=cols, fontsize=9)
    for i in range(len(cols)):
        for j in range(len(cols)):
            v = corr.values[i, j]
            ax.text(j, i, f"{v:.2f}", ha="center", va="center", fontsize=8, color="white" if abs(v) > 0.55 else "#1f2937")
    title = "Pearson correlation — numeric columns"
    ax.set_title(title + ("\n(SYNTHETIC demo data)" if synthetic else ""), fontsize=11)
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)
    return corr


def revenue_figure(df: pd.DataFrame, path: Path, synthetic: bool) -> None:
    month = pd.to_datetime(df["order_date"]).dt.to_period("M").astype(str)
    pivot = df.assign(month=month).pivot_table(index="month", columns="category", values="revenue", aggfunc="sum").fillna(0)
    fig = {
        "data": [
            {"type": "bar", "name": cat, "x": list(pivot.index), "y": [round(float(v), 2) for v in pivot[cat]]}
            for cat in pivot.columns
        ],
        "layout": {
            "title": {"text": "Monthly revenue by category (AUD)" + (" — synthetic" if synthetic else "")},
            "barmode": "stack",
            "xaxis": {"title": {"text": "Month"}},
            "yaxis": {"title": {"text": "Revenue (AUD)"}},
            "legend": {"orientation": "h", "y": -0.2},
        },
    }
    path.write_text(json.dumps(fig))


def _fmt(v: object) -> str:
    if isinstance(v, float):
        return f"{v:,.0f}" if v.is_integer() else f"{v:,.2f}"
    return str(v)


def md_table(df: pd.DataFrame) -> str:
    cols = [str(c) for c in df.columns]
    lines = ["| " + " | ".join([""] + cols) + " |", "|" + "---|" * (len(cols) + 1)]
    for idx, row in df.iterrows():
        lines.append("| " + " | ".join([str(idx)] + [_fmt(v) for v in row]) + " |")
    return "\n".join(lines)


def build_report(df: pd.DataFrame, corr: pd.DataFrame, metrics: dict[str, float], args, synthetic: bool) -> str:
    by_cat = df.groupby("category").agg(orders=("order_id", "count"), revenue=("revenue", "sum"), aov=("revenue", "mean"), return_rate=("returned", "mean"))
    by_cat = by_cat.sort_values("revenue", ascending=False)
    by_region = df.groupby("region")["revenue"].sum().sort_values(ascending=False)
    rating_by_delivery = df.groupby(pd.cut(df["delivery_days"], [0, 2, 4, 7, 14]), observed=True)["rating"].mean()
    top_cat = by_cat.index[0]
    banner = (
        "> **Synthetic data.** Generated by `run_eda.py` with seed "
        f"`{args.seed}` ({len(df):,} rows). Findings describe this generated dataset only — they are not real commerce results.\n"
        if synthetic
        else f"> Source: `{args.data}`\n"
    )
    return f"""# E-Commerce Sales — exploratory data analysis

{banner}
Generated {datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")} · Python {platform.python_version()} · pandas {pd.__version__}

## Dataset

- **Rows:** {len(df):,} orders, {df["order_date"].min()} → {df["order_date"].max()}
- **Columns:** {", ".join(f"`{c}`" for c in df.columns)}
- **Missing values:** {int(df.isna().sum().sum())} (all in `rating`, {df["rating"].isna().mean():.1%} of rows)

## Headline numbers

| Metric | Value |
|---|---|
| Total revenue | AUD {metrics["revenue_total"]:,.0f} |
| Average order value | AUD {metrics["avg_order_value"]:,.2f} |
| Return rate | {metrics["return_rate"]:.1%} |
| Mean rating | {metrics["mean_rating"]:.2f} / 5 |

## Revenue by category

{md_table(by_cat.round(3))}

**{top_cat}** brings the most revenue ({by_cat.loc[top_cat, "revenue"] / by_cat["revenue"].sum():.0%} of the total).
The highest return rate is in **{by_cat["return_rate"].idxmax()}** ({by_cat["return_rate"].max():.1%}).

## Revenue by region

{md_table(by_region.to_frame("revenue").round(2))}

## Relationships

- Discount vs quantity: Pearson r = **{corr.loc["discount_pct", "quantity"]:.2f}** — larger discounts go with larger baskets.
- Delivery days vs rating: r = **{corr.loc["delivery_days", "rating"]:.2f}** — slower deliveries get lower ratings.
- Mean rating by delivery time: {", ".join(f"{k}: {v:.2f}" for k, v in rating_by_delivery.items())}

See the correlation heatmap and the monthly revenue chart attached to this run.

## Next steps

1. Replace the synthetic generator with a real export (`--data path/to/orders.csv`).
2. Check whether the discount effect survives once category and channel are controlled for.
3. Model delivery time → rating → return probability as a chain.
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--project", default=PROJECT_SLUG, help="project slug or id in the Lab")
    parser.add_argument("--data", help="optional real CSV with the same columns; default: synthetic")
    parser.add_argument("--rows", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", default=str(Path(__file__).parent / "out"))
    parser.add_argument("--no-publish", action="store_true", help="write outputs locally, do not upload")
    args = parser.parse_args()

    synthetic = not args.data
    df = pd.read_csv(args.data) if args.data else generate_synthetic(args.rows, args.seed)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    corr = correlation_png(df, out / "correlation.png", synthetic)
    revenue_figure(df, out / "revenue_by_month.json", synthetic)
    df.head(200).to_csv(out / "dataset_preview.csv", index=False)
    metrics = {
        "rows": float(len(df)),
        "revenue_total": float(df["revenue"].sum()),
        "avg_order_value": float(df["revenue"].mean()),
        "return_rate": float(df["returned"].mean()),
        "mean_rating": float(df["rating"].mean()),
        "missing_values": float(df.isna().sum().sum()),
        "corr_discount_quantity": float(corr.loc["discount_pct", "quantity"]),
        "corr_delivery_rating": float(corr.loc["delivery_days", "rating"]),
    }
    (out / "eda_report.md").write_text(build_report(df, corr, metrics, args, synthetic))
    print(f"Wrote outputs to {out}")
    for k, v in metrics.items():
        print(f"  {k:24s} {v:,.4f}")
    if args.no_publish:
        return 0

    from vtcons_lab import LabClient, LabError

    try:
        with LabClient() as lab, lab.start_run(
            args.project,
            name=f"eda-{'synthetic' if synthetic else 'data'}-seed{args.seed}",
            params={"rows": len(df), "seed": args.seed, "synthetic": synthetic, "source": args.data or "generated"},
            tags=["eda", "synthetic" if synthetic else "real-data"],
            dataset_version=f"synthetic-v1-seed{args.seed}-n{len(df)}" if synthetic else Path(args.data).name,
            notes="Synthetic demo dataset — not real commerce data." if synthetic else None,
        ) as run:
            run.log_metrics(metrics)
            run.log_artifact(out / "correlation.png", description="Pearson correlation heatmap of numeric columns")
            run.log_artifact(out / "dataset_preview.csv", description="First 200 rows of the dataset")
            run.log_artifact(out / "eda_report.md", description="EDA report")
            run.log_artifact(out / "revenue_by_month.json", description="Monthly revenue by category (Plotly)")
            print(f"Published run {run.id} → {lab.base_url}/v1/runs/{run.id}")
    except LabError as exc:
        print(f"Publishing failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
