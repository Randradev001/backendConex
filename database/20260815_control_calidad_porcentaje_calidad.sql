SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.CALRECEP', 'CalRecPorCalidad') IS NULL
BEGIN
  ALTER TABLE dbo.CALRECEP ADD CalRecPorCalidad decimal(7,2) NULL;
END;

EXEC(N'UPDATE dbo.CALRECEP
SET CalRecPorCalidad = CASE
  WHEN COALESCE(CalRecTamMuestra,0) <= 0 THEN 0
  ELSE CASE
    WHEN 100.0 - (100.0 * COALESCE((
      SELECT SUM(d.CalDanFrutos)
      FROM dbo.CALRECEPDANO d
      WHERE d.EmpCod=CALRECEP.EmpCod AND d.CalRecId=CALRECEP.CalRecId
    ),0) / CalRecTamMuestra) < 0 THEN 0
    ELSE 100.0 - (100.0 * COALESCE((
      SELECT SUM(d.CalDanFrutos)
      FROM dbo.CALRECEPDANO d
      WHERE d.EmpCod=CALRECEP.EmpCod AND d.CalRecId=CALRECEP.CalRecId
    ),0) / CalRecTamMuestra)
  END
END
WHERE CalRecPorCalidad IS NULL;');

COMMIT TRANSACTION;
