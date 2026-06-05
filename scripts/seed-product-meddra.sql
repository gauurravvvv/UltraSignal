-- ============================================================================
-- SIMPLE INSERTS — paste one at a time if needed.
--
-- STEP 1: find your client id, copy the UUID it returns.
--   SELECT id, name FROM "client";
--
-- STEP 2: in this file, replace EVERY occurrence of
--   <<CLIENT_ID>>    with the UUID
--   <<CLIENT_NAME>>  with the name
-- (Use your editor's Find & Replace.)
--
-- STEP 3: run the file or paste each INSERT one at a time.
-- ============================================================================


-- ============================================================================
-- PRODUCT BROWSER  (10 rows)
-- ============================================================================

INSERT INTO "product_browser"
  (id, "clientId", "clientName", ingredient, "familyName", "prodNameDisplay", "tradeNameDisplay", country, language, "sourceId")
VALUES (gen_random_uuid(), '<<CLIENT_ID>>', '<<CLIENT_NAME>>', 'Atorvastatin', 'Statins', 'Lipitor', 'Lipitor', 'United States', 'en', 1);

INSERT INTO "product_browser"
  (id, "clientId", "clientName", ingredient, "familyName", "prodNameDisplay", "tradeNameDisplay", country, language, "sourceId")
VALUES (gen_random_uuid(), '<<CLIENT_ID>>', '<<CLIENT_NAME>>', 'Ibuprofen', 'NSAIDs', 'Advil', 'Advil', 'United States', 'en', 1);

INSERT INTO "product_browser"
  (id, "clientId", "clientName", ingredient, "familyName", "prodNameDisplay", "tradeNameDisplay", country, language, "sourceId")
VALUES (gen_random_uuid(), '<<CLIENT_ID>>', '<<CLIENT_NAME>>', 'Acetaminophen', 'Analgesics', 'Tylenol', 'Tylenol', 'United States', 'en', 1);

INSERT INTO "product_browser"
  (id, "clientId", "clientName", ingredient, "familyName", "prodNameDisplay", "tradeNameDisplay", country, language, "sourceId")
VALUES (gen_random_uuid(), '<<CLIENT_ID>>', '<<CLIENT_NAME>>', 'Metformin', 'Biguanides', 'Glucophage', 'Glucophage', 'United States', 'en', 1);

INSERT INTO "product_browser"
  (id, "clientId", "clientName", ingredient, "familyName", "prodNameDisplay", "tradeNameDisplay", country, language, "sourceId")
VALUES (gen_random_uuid(), '<<CLIENT_ID>>', '<<CLIENT_NAME>>', 'Lisinopril', 'ACE Inhibitors', 'Prinivil', 'Prinivil', 'United States', 'en', 1);

INSERT INTO "product_browser"
  (id, "clientId", "clientName", ingredient, "familyName", "prodNameDisplay", "tradeNameDisplay", country, language, "sourceId")
VALUES (gen_random_uuid(), '<<CLIENT_ID>>', '<<CLIENT_NAME>>', 'Sertraline', 'SSRIs', 'Zoloft', 'Zoloft', 'United States', 'en', 1);

INSERT INTO "product_browser"
  (id, "clientId", "clientName", ingredient, "familyName", "prodNameDisplay", "tradeNameDisplay", country, language, "sourceId")
VALUES (gen_random_uuid(), '<<CLIENT_ID>>', '<<CLIENT_NAME>>', 'Omeprazole', 'Proton Pump Inhibitors', 'Prilosec', 'Prilosec', 'United States', 'en', 1);

INSERT INTO "product_browser"
  (id, "clientId", "clientName", ingredient, "familyName", "prodNameDisplay", "tradeNameDisplay", country, language, "sourceId")
VALUES (gen_random_uuid(), '<<CLIENT_ID>>', '<<CLIENT_NAME>>', 'Amoxicillin', 'Penicillins', 'Amoxil', 'Amoxil', 'United States', 'en', 1);

INSERT INTO "product_browser"
  (id, "clientId", "clientName", ingredient, "familyName", "prodNameDisplay", "tradeNameDisplay", country, language, "sourceId")
VALUES (gen_random_uuid(), '<<CLIENT_ID>>', '<<CLIENT_NAME>>', 'Levothyroxine', 'Thyroid Hormones', 'Synthroid', 'Synthroid', 'United States', 'en', 1);

INSERT INTO "product_browser"
  (id, "clientId", "clientName", ingredient, "familyName", "prodNameDisplay", "tradeNameDisplay", country, language, "sourceId")
VALUES (gen_random_uuid(), '<<CLIENT_ID>>', '<<CLIENT_NAME>>', 'Albuterol', 'Bronchodilators', 'Ventolin', 'Ventolin', 'United States', 'en', 1);


-- ============================================================================
-- MEDDRA BROWSER  (10 rows — global, no client id needed)
-- ============================================================================

INSERT INTO "meddra_browser"
  (id, "socCode", "socName", "hlgtCode", "hlgtName", "hltCode", "hltName", "ptCode", "ptName", "lltCode", "lltName", "primaryPath", language)
VALUES (gen_random_uuid(), '10029205', 'Nervous system disorders', '10019231', 'Headaches', '10019233', 'Headaches NEC', '10019211', 'Headache', '10019231', 'Headache NOS', 'PT', 'en');

INSERT INTO "meddra_browser"
  (id, "socCode", "socName", "hlgtCode", "hlgtName", "hltCode", "hltName", "ptCode", "ptName", "lltCode", "lltName", "primaryPath", language)
VALUES (gen_random_uuid(), '10017947', 'Gastrointestinal disorders', '10017977', 'Gastrointestinal signs and symptoms', '10017985', 'Nausea and vomiting symptoms', '10028813', 'Nausea', '10028813', 'Nausea', 'PT', 'en');

INSERT INTO "meddra_browser"
  (id, "socCode", "socName", "hlgtCode", "hlgtName", "hltCode", "hltName", "ptCode", "ptName", "lltCode", "lltName", "primaryPath", language)
VALUES (gen_random_uuid(), '10029205', 'Nervous system disorders', '10029864', 'Neurological signs and symptoms NEC', '10013573', 'Dizziness and giddiness', '10013573', 'Dizziness', '10013573', 'Dizziness', 'PT', 'en');

INSERT INTO "meddra_browser"
  (id, "socCode", "socName", "hlgtCode", "hlgtName", "hltCode", "hltName", "ptCode", "ptName", "lltCode", "lltName", "primaryPath", language)
VALUES (gen_random_uuid(), '10019805', 'Hepatobiliary disorders', '10019799', 'Hepatic and hepatobiliary disorders', '10019837', 'Hepatocellular damage and hepatitis NEC', '10019851', 'Hepatotoxicity', '10019851', 'Hepatotoxicity', 'PT', 'en');

INSERT INTO "meddra_browser"
  (id, "socCode", "socName", "hlgtCode", "hlgtName", "hltCode", "hltName", "ptCode", "ptName", "lltCode", "lltName", "primaryPath", language)
VALUES (gen_random_uuid(), '10007541', 'Cardiac disorders', '10011082', 'Coronary artery disorders', '10011078', 'Ischaemic coronary artery disorders', '10028596', 'Myocardial infarction', '10028596', 'Myocardial infarction', 'PT', 'en');

INSERT INTO "meddra_browser"
  (id, "smqCode", "smqName", "termScope", "socCode", "socName", "hlgtCode", "hlgtName", "hltCode", "hltName", "ptCode", "ptName", "lltCode", "lltName", "primaryPath", language)
VALUES (gen_random_uuid(), '20000021', 'Anaphylactic reaction (SMQ)', 'Narrow', '10021428', 'Immune system disorders', '10001705', 'Allergic conditions', '10002021', 'Anaphylactic responses', '10002198', 'Anaphylactic reaction', '10002198', 'Anaphylactic reaction', 'SMQ', 'en');

INSERT INTO "meddra_browser"
  (id, "socCode", "socName", "hlgtCode", "hlgtName", "hltCode", "hltName", "ptCode", "ptName", "lltCode", "lltName", "primaryPath", language)
VALUES (gen_random_uuid(), '10040785', 'Skin and subcutaneous tissue disorders', '10040799', 'Epidermal and dermal conditions', '10037868', 'Rashes, eruptions and exanthems NEC', '10037844', 'Rash', '10037844', 'Rash', 'PT', 'en');

INSERT INTO "meddra_browser"
  (id, "socCode", "socName", "hlgtCode", "hlgtName", "hltCode", "hltName", "ptCode", "ptName", "lltCode", "lltName", "primaryPath", language)
VALUES (gen_random_uuid(), '10017947', 'Gastrointestinal disorders', '10017977', 'Gastrointestinal signs and symptoms', '10012736', 'Diarrhoea (excl infective)', '10012735', 'Diarrhoea', '10012735', 'Diarrhoea', 'PT', 'en');

INSERT INTO "meddra_browser"
  (id, "smqCode", "smqName", "termScope", "socCode", "socName", "hlgtCode", "hlgtName", "hltCode", "hltName", "ptCode", "ptName", "lltCode", "lltName", "primaryPath", language)
VALUES (gen_random_uuid(), '20000020', 'Severe cutaneous adverse reactions (SMQ)', 'Narrow', '10040785', 'Skin and subcutaneous tissue disorders', '10040799', 'Epidermal and dermal conditions', '10039839', 'Severe skin reactions', '10042033', 'Stevens-Johnson syndrome', '10042033', 'Stevens-Johnson syndrome', 'SMQ', 'en');

INSERT INTO "meddra_browser"
  (id, "socCode", "socName", "hlgtCode", "hlgtName", "hltCode", "hltName", "ptCode", "ptName", "lltCode", "lltName", "primaryPath", language)
VALUES (gen_random_uuid(), '10037175', 'Psychiatric disorders', '10040998', 'Sleep disorders and disturbances', '10022437', 'Insomnia (incl symptoms)', '10022437', 'Insomnia', '10022437', 'Insomnia', 'PT', 'en');
