# ThaiFlood 14-year historical flood engine

## Coverage
- B.E. 2554–2567 (2011–2024), 14 years.
- 2011–2019: GISTDA flood recurrence polygons (`Y_2011` … `Y_2019`).
- 2020–2024: DDPM district-detail flood reports (B.E. 2563–2567).
- 2020 is available from both sources and is used as a calibration/bridge year; it is counted only once.

## Spatial method
GISTDA historical flood polygons are spatially intersected with GISTDA amphoe boundaries. A district-year is provisionally marked as flooded when at least one GISTDA flood polygon carrying that year flag intersects the district polygon.

This is a first-stage presence/intersection rule. It must pass bridge-year calibration against DDPM 2020 district reports before the 14-year metric replaces the current 5-year production metric.

## QC gate
Before production UI adoption:
1. Test Chiang Mai, Kanchanaburi and Nakhon Ratchasima.
2. Compare GISTDA 2020 vs DDPM 2020 at district level.
3. Record agreement %, Jaccard overlap, positive district counts and mismatched district names.
4. If border-sliver false positives are material, replace pure intersection with an area-overlap threshold using clipped geometry.
5. Only after calibration is acceptable, generate a static 77-province / all-district snapshot and run arithmetic consistency checks.
6. Keep source provenance per district-year; never synthesize damage/household/agriculture numbers where source data is absent.

## API test route
`/api/spatial-index?historical14y=1&province=<province>`

The default `/api/spatial-index` response remains the verified 5-year DDPM production snapshot until this gate passes.
