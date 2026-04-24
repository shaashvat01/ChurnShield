# Data Storage Location

All dataset files are stored in S3 (too large for git).

**S3 Bucket:** `s3://economic-blast-radius-data-216989103356`
**AWS Profile:** `25-sandbox`
**Region:** `us-east-1`

## Folder Structure in S3

```
data/
├── lodes-arizona/
│   ├── az_od_main_JT00_2023.csv    (164 MB - commute flows)
│   └── az_xwalk.csv                (73 MB - geographic crosswalk)
├── cbp-business-patterns/
│   ├── cbp22co.txt                 (102 MB - county-level business patterns)
│   └── zbp22detail.txt             (274 MB - ZIP-level business patterns)
├── qcew-wages/
│   ├── maricopa_county_2024_q2.csv (459 KB - Q2 2024 wages)
│   └── maricopa_county_2024_annual.csv (428 KB - annual 2024 wages)
└── zcta-boundaries/
    ├── tl_2020_us_zcta520.shp      (781 MB - ZCTA boundary geometries)
    ├── tl_2020_us_zcta520.dbf      (2.3 MB - attribute data)
    ├── tl_2020_us_zcta520.shx      (264 KB - spatial index)
    ├── tl_2020_us_zcta520.prj      (165 B - projection info)
    └── tl_2020_us_zcta520.cpg      (5 B - character encoding)
```

## To Download Data Locally

```bash
aws s3 sync s3://economic-blast-radius-data-216989103356/data/ data/ --profile 25-sandbox
```
