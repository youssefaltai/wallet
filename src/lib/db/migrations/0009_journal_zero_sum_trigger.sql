CREATE OR REPLACE FUNCTION check_journal_zero_sum()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  entry_id uuid;
BEGIN
  entry_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  IF (
    SELECT COALESCE(SUM(amount), 0)
    FROM journal_lines
    WHERE journal_entry_id = entry_id
  ) <> 0 THEN
    RAISE EXCEPTION 'Journal entry % lines do not sum to zero', entry_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE CONSTRAINT TRIGGER journal_lines_zero_sum
  AFTER INSERT OR UPDATE OR DELETE ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_journal_zero_sum();
