-- Migration 0006: add logo_url to developers
alter table developers add column logo_url text;
