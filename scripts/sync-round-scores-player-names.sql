-- One-time fix: align round_scores.player_name with roster full names from players.
-- Run in Supabase → SQL Editor (requires sufficient privileges).
--
-- Logic: for each score row, join its round → season, then match players where
-- round_scores.player_name equals that player's first_name only; set player_name
-- to the same display format as the app: trim(concat_ws(' ', first_name, last_name)).
--
-- This fixes seeded first-name-only values (e.g. "Owen" → "Owen Wilson") once
-- players.first_name / players.last_name are updated.

UPDATE round_scores AS rs
SET player_name = TRIM(
  CONCAT_WS(
    ' ',
    pl.first_name,
    NULLIF(TRIM(pl.last_name), '')
  )
)
FROM rounds AS r
INNER JOIN players AS pl
  ON pl.season_name = r.season_name
  AND TRIM(rs.player_name) = TRIM(pl.first_name)
WHERE rs.round_id = r.id
  AND TRIM(
    CONCAT_WS(
      ' ',
      pl.first_name,
      NULLIF(TRIM(pl.last_name), '')
    )
  ) <> rs.player_name;

-- Optional: verify remaining first-name-only rows (should return 0 rows after fix):
-- SELECT DISTINCT rs.player_name
-- FROM round_scores rs
-- JOIN rounds r ON r.id = rs.round_id
-- JOIN players pl ON pl.season_name = r.season_name AND TRIM(rs.player_name) = TRIM(pl.first_name)
-- WHERE TRIM(CONCAT_WS(' ', pl.first_name, NULLIF(TRIM(pl.last_name), ''))) = rs.player_name;
