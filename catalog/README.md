# Experiment catalog

The experiments.json file is the tracked source of truth for the small
hackathon subset. Run npm run prepare:data after changing it to regenerate the
dashboard view at dashboard/data/experiments.json.

## Data rules

- IDs are stable strings: BASS-II rows use test_sample; Saffire records use
  SAFFIRE-I_<test-id>, such as SAFFIRE-I_I-1.
- Numeric field names include their units: oxygen and CO2 are volume percent,
  CO is ppm, airflow is cm/s, spread rate is mm/s, duration is seconds, and
  sample dimensions use cm or mm as named.
- Unknown or unreported scalar values are null. They are never filled from
  another experiment.
- measurements contains actual time-series observations only. A reported
  average spread rate or burn duration belongs in its scalar field and must
  not be turned into a fake time-series point.
- data_provenance identifies the source and any uncertainty that matters to
  interpretation. Each record also includes a direct source URL.

## Current subset

- BASS-II B1_147 and B3_148: NASA/TM-20210011385, Appendix A, Table A.1.
- Saffire-I I-1 and I-2: NASA NTRS report 20180005168, Table 1 and result
  slides. Reported average spread rate, burn duration, and burn length are
  aggregate values, not video-derived traces. Table 1 gives I-1 a 420-second
  burn, while an earlier result slide rounds it to 400 seconds; the catalog
  retains the table value and records the discrepancy in its provenance.
- FLEX tests 1–274: NASA PSI-69 Version 5 experimental table, DOI
  `10.60555/mbq8-0451`. Stable IDs use the test number (`FLEX-TEST-001` etc.)
  because the PSI `FLEX Identifier` value `193F001` occurs twice. The
  downloadable CSV contains 274 data rows; the PSI table view reports 275
  entries and NASA/TP-2015-216046 presents the first 284 tests. These scopes
  are kept separate. The CSV's burning-rate header says `mm`, while the NTRS
  table labels the corresponding metric `mm²/s`; raw values and that unit
  discrepancy are preserved. The PSI CSV labels one composition field `CO`,
  while the report calls the species `CO₂`; the catalog retains the source
  field under a neutral name. Approximate burn-time entries are marked in
  `reported_metric_qualifiers`. The reported oxygen mole fraction is also
  converted to percent by multiplying by 100. FLEX rows have empty
  `measurements` arrays because the table contains per-test aggregates, not
  temporal samples.

The ACME [Burning Rate Emulator](https://science.nasa.gov/biological-physical/investigations/bre/)
is documented by NASA as a spacecraft fire-prevention study, but its NASA
operations page marks BRE data access for authorized users only. No public,
downloadable BRE test table was verified for this subset, so BRE remains
linked research context and is not represented as chartable test data.

The PSI repository records are [BASS-II / PSI-25](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25)
and [Saffire-I / PSI-98](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98).
