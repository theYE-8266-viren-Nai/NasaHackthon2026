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

The PSI repository records are [BASS-II / PSI-25](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25)
and [Saffire-I / PSI-98](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98).
