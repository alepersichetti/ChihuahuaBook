-- Impronta del contenuto arrivato da un import (es. una scheda di Bookpedia).
-- Reimportando "solo le novità" si aggiornano soltanto i libri la cui scheda è cambiata,
-- così le modifiche fatte nell'app sui libri invariati non vengono sovrascritte.

alter table public.books add column import_hash text;
