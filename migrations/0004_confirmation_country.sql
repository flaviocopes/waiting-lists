ALTER TABLE subscribers ADD COLUMN confirmed_country TEXT
  CHECK (
    confirmed_country IS NULL OR
    (confirmed_country GLOB '[A-Z][A-Z]' AND confirmed_country <> 'XX')
  );
