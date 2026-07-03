-- =============================================================================
-- ergane — org-wide output language.
--
-- Applied by `prisma migrate deploy` as the database OWNER.
--
-- 'locale' selects the language of org-wide output that has no browser
-- context: generated quote/invoice PDFs and outgoing e-mails (approval
-- notifications). 'en' | 'de', default 'en' — the platform default language
-- is English. The UI language is a per-browser cookie, never stored here.
-- RLS/GRANTs of the table (0012) unchanged.
-- =============================================================================

ALTER TABLE "org_settings"
    ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';

ALTER TABLE "org_settings"
    ADD CONSTRAINT "org_settings_locale_known"
        CHECK ("locale" IN ('en', 'de'));
