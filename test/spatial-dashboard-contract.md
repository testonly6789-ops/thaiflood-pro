# Spatial dashboard metric contract

- Main recurrence unit: district, not province-year count.
- A recurring area is the same district reported in at least 2 comparable district-detail years.
- Comparable coverage for the current DDPM source: B.E. 2563-2567 (5 years).
- National headline: sum of recurring districts across provinces.
- Maximum recurrence: maximum number of comparable years for the same district.
- Province ranking: recurring district count descending, then same-district max years.
- Map marker size: recurring district count for the province.
- Province-year coverage counts must not be presented as recurrence frequency.
- If all 77 provinces cannot be checked, recurrence headline/map/ranking fail closed instead of showing legacy numbers.
