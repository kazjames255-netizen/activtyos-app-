# Oak purge, dry run (hubNotes bodies)

Generated 2026-09-27T04:35:52.032Z by `server/src/oak/purgeOakNoteBodies.ts` in DRY-RUN mode. Read-only: nothing was written.

Scanned 31565 hubNotes docs across 200 tenants. 62 contain the brand, across 24 tenants. Unchanged by scrub (would remain, needs a look): 0.

These strings are already hidden from every user at read time (`noOakResponse.ts`); the purge would remove them from storage. Exact removed text is quoted per field.

## Reading this report (added by hand)

- 62 notes listed. 62 of them are the old e2e fixture "Neurones and synapses ..." lesson (or this review's "Credit probe" notes), which wrote the credit line into the body: throwaway `@activityos-test.com` tenants, safe to purge or to remove with `e2e:cleanup`.
- Other notes (0): none.
- Every span quoted below is a whole sentence the noOak rules would delete. Before this report was regenerated, three REAL science notes ("Year 4: grouping living things and changing habitats", tenants 7jG2XO3cOD3VtoL8YfFY, jYp5XNZGT7bgSUMuEgHN and shared-library) were listed for a botanical sentence ("holly-or-oak question ... oak is wavy-lobed"). That was a detector false positive, fixed in `server/src/oak/noOak.ts`; they no longer appear.
- The earlier "68 notes across ~40 tenants" figure came from a looser scan. Scope here: the top-level `body` field of every hubNotes document in all tenants plus the shared library. Slide text (`lesson.*`) is a separate, much larger set; run with `--all-fields` to list it.
- To apply (NOT run, needs Kaz): `cd server && npx tsx src/oak/purgeOakNoteBodies.ts --apply --approved-by-kaz`.

## Tenant `uZQeP76bulabOWQQK5M7` (16 notes)

- note `63rQo3H7sWSpX48q0eve` "Neurones and synapses muj23vld"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `KMkXVxjoCSfTzWcxd8lG` "Neurones and synapses muj2c3s1"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `MCDXqotlusTUrtkYMUhR` "Neurones and synapses muj2whxr"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `N2Dfs7ESQ3onc97Aogxn` "Neurones and synapses muj3aba0"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `PUoJl2zcwjdzVs8TFl7A` "Neurones and synapses muj32smq"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `TOhgAajg52YzbNVxXl8T` "Neurones and synapses muj22wcm"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `UqtOTZ4d30yhshzxfNWv` "Neurones and synapses muj2q82c"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `WnYOKdEjtH303EqvsIQz` "Neurones and synapses muj2uu0v"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `Wp5LlZvm9tpRFTBwrXBI` "Neurones and synapses muj2kqd0"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `X9dVld0bLhW08vKytNm7` "Neurones and synapses muj2y6zc"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `Z9U8aSjqerVY6xCxEcwP` "Neurones and synapses muj30u4w"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `aPs6dr1YrbSN8E37c1TS` "Neurones and synapses muj38ktb"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `bceXNQ04n8KoxOxFJnbU` "Neurones and synapses muj2lqc8"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `hgKJxb5nH8jYGfMJD7Zl` "Neurones and synapses muj2sqn7"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `jgh4MRFnEQZmHtLuExJL` "Neurones and synapses muj35qxq"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `pP84Tgw8ZIWKcyNxpCpj` "Neurones and synapses muj349oz"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `H25jSba2LdcDyQBLhsUz` (11 notes)

- note `164ChqmavL2i0teqPQjZ` "Credit reader probe muja1mb1"
  - `body` remove: "A Maths lesson by Oak National Academy licensed under Open Government Licence (OGL)."
  - `body` remove: "See https://www.thenational.academy/lessons/x"
- note `5EYSVnkv9TY4Myt4bDa0` "Credit reader probe muj9yj6f"
  - `body` remove: "A Maths lesson by Oak National Academy licensed under Open Government Licence (OGL)."
  - `body` remove: "See https://www.thenational.academy/lessons/x"
- note `5fsoDd6tveDL6wOTaQ8k` "Credit reader probe mujali4h"
  - `body` remove: "A Maths lesson by Oak National Academy licensed under Open Government Licence (OGL)."
  - `body` remove: "See https://www.thenational.academy/lessons/x"
- note `684ylIsu5XxEu6kagVtc` "Credit reader probe mujajfi2"
  - `body` remove: "A Maths lesson by Oak National Academy licensed under Open Government Licence (OGL)."
  - `body` remove: "See https://www.thenational.academy/lessons/x"
- note `8FxKManRhKMfXrmeHsYH` "Credit reader probe muj9w987"
  - `body` remove: "A Maths lesson by Oak National Academy licensed under Open Government Licence (OGL)."
  - `body` remove: "See https://www.thenational.academy/lessons/x"
- note `8W1BAEsCx8LXow8qDyiY` "Credit reader probe mujagzgf"
  - `body` remove: "A Maths lesson by Oak National Academy licensed under Open Government Licence (OGL)."
  - `body` remove: "See https://www.thenational.academy/lessons/x"
- note `S91PDtE4xLUmkQfze2lm` "Credit reader probe muja0cdd"
  - `body` remove: "A Maths lesson by Oak National Academy licensed under Open Government Licence (OGL)."
  - `body` remove: "See https://www.thenational.academy/lessons/x"
- note `diGpWGfGVH9URo74Qpvw` "Credit reader probe muja8dkv"
  - `body` remove: "A Maths lesson by Oak National Academy licensed under Open Government Licence (OGL)."
  - `body` remove: "See https://www.thenational.academy/lessons/x"
- note `eHCCF5TaebldT3OdHEJP` "Credit reader probe muja9ne6"
  - `body` remove: "A Maths lesson by Oak National Academy licensed under Open Government Licence (OGL)."
  - `body` remove: "See https://www.thenational.academy/lessons/x"
- note `fzEESy3FMSxr8zaAM8QD` "Neurones and synapses mujaqfuq"
  - `body` remove: "A Maths lesson by Oak National Academy licensed under Open Government Licence (OGL)."
  - `body` remove: "See https://www.thenational.academy/lessons/x"
- note `t4b48rZWoYtJuiynbXrN` "Credit reader probe mujan3wz"
  - `body` remove: "A Maths lesson by Oak National Academy licensed under Open Government Licence (OGL)."
  - `body` remove: "See https://www.thenational.academy/lessons/x"

## Tenant `0h0Ud6sBvvKJgfVD5Lim` (4 notes)

- note `74sQCdvO5KfQB5af8tM6` "Neurones and synapses muiwg4xu"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `MYwaD1zjUHkm4ZytXsib` "Neurones and synapses muir9n18"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `jXEUREnWtVnwVHyIsWZt` "Neurones and synapses muj1txhf"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `mSvi1KPwzDMTGgLXqnFa` "Neurones and synapses muip4kb5"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `t4ZUuD2ZxiEU5gyOtXUC` (3 notes)

- note `DZkKKshoi9B2pjitr31a` "Neurones and synapses wsmuj25zw5"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `Euc5gCAtsPfSolt8zo6T` "Neurones and synapses muj2343e"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `dvmVykgwHGqmps8FvZnz` "Neurones and synapses muj25cyq"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `360jhJO74w6yFiPg3rFz` (2 notes)

- note `V8CIl8aZmpaDnBFrLJ0S` "Neurones and synapses"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `iaLR3UiNnnTincD85fnG` "Neurones and synapses muizxgum"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `LJ8ONtS4XDRWgoWDWJ35` (2 notes)

- note `4ZZj0uW7pfUFYkhXMrLc` "Credit probe muj5cgnc"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `cixbtITujVaSYlCKpvB8` "Credit probe muj609ef"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `OYjaPrCHuQW0ObTZzaSz` (2 notes)

- note `AQTXXJ1VqcYLkiHrsAg3` "Neurones and synapses wsmuj2sgx3"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `MMx6WKv83zqfCbv81u6H` "Neurones and synapses muj2ru2e"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `ndtjgpp5bCFQntGCHFXv` (2 notes)

- note `2jS83ozCb0CnZInjVAc2` "Neurones and synapses muj27m57"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `Sa27D8pLZYYLjmA5Do6a` "Neurones and synapses wsmuj28v17"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `orolwdPzTBGpDTnBSOW5` (2 notes)

- note `1SVkKv2xfMgHfCX56XzN` "Neurones and synapses wsmuj2yizz"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `9CuTvN9IqQfsbbNqbraQ` "Neurones and synapses muj2y22s"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `qerlmYBHjI9I87hGj7uO` (2 notes)

- note `bdEHOTwAjFiasRRpwi2b` "Neurones and synapses"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `qQXLdRbOQLKa29cxDNDD` "Neurones and synapses muiok9ma"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `szuvYVowug7xQs8MBb6D` (2 notes)

- note `MUqjcmJ1YwCmz7nZtJ4O` "Neurones and synapses wsmuj2wmhy"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `cyTAbsNh10eRzi2No9Gc` "Neurones and synapses muj2w5jo"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `xf1mnvIi6jAdeiRFWYX8` (2 notes)

- note `ZkpNhBLRQyRJy7ExOMhA` "Neurones and synapses wsmuj2e55d"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
- note `mSmW2ALfrUOLYogSz7Vz` "Neurones and synapses muj2byom"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `8DLrMXLZ1uTPsufLURBZ` (1 note)

- note `1ruCV1D6XirumEUrtow9` "Neurones and synapses muj12oyo"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `BWPzKKJEMgFuhKTXUhPH` (1 note)

- note `Ozp0nmJw0WmHzgjPvFwJ` "Neurones and synapses pcmuixx9rv"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `FWbtKl6ZjM4wzyyq5tpJ` (1 note)

- note `VqMStXZmpLMstse6OZuq` "Neurones and synapses muiz4yjk"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `RkqLOus07TgLATRI5cw2` (1 note)

- note `Mv5YaYPjmh6u7s0OnMm7` "Neurones and synapses muiy8ufu"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `RvS16MoriXDOi7lVfK2A` (1 note)

- note `eNe4o9TBUtCQfHJjVcbE` "Neurones and synapses muj2uf6h"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `V0aXkOhW6mtUXsGyvU8M` (1 note)

- note `4biQjnDES7kvnsnlwSNK` "Neurones and synapses muj1vrak"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `W7hO8K4jsaIS0kCBJbf3` (1 note)

- note `jQmDeTsGJzCJBRs3eqqc` "Neurones and synapses muiw84m9"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `etvm9bwc4SDodAcgYyJ9` (1 note)

- note `yvphi6lRr1QfNQOe3gCK` "Neurones and synapses muj1z3eb"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `igbWldlvP2MvVRgRYIUW` (1 note)

- note `SdKhRoKOOAlN5Wd751x7` "Neurones and synapses muiy2juf"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `qNP365sbIQEPkVJXeIMT` (1 note)

- note `G09EmOuzrQQAlXaQ4Mqv` "Neurones and synapses muj1q8dk"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `xuXjvhcLSMJL2L4hqJPa` (1 note)

- note `bFaj78a144Ri4XiSLddI` "Neurones and synapses muj1hg2v"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."

## Tenant `yl5ABUVZfb04MMTsOWmL` (1 note)

- note `qulQP6TN7fLqqevVjsqC` "Neurones and synapses muiy65jo"
  - `body` remove: "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL)."
