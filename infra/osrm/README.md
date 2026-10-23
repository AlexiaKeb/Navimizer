# Serveurs OSRM dédiés (production)

Les serveurs publics (`router.project-osrm.org`, `routing.openstreetmap.de`) n'offrent aucune garantie.
Pour un usage client, héberger ses propres instances (une par mode) sur un VPS (≈ 16 Go de RAM pour préparer
l'extrait France, moins pour le servir) puis renseigner les secrets de la fonction `optimize`.

> Commandes fournies à titre indicatif : non testées dans ce dépôt.

```bash
wget https://download.geofabrik.de/europe/france-latest.osm.pbf -O france.osm.pbf

# Une préparation par profil (car.lua, bicycle.lua, foot.lua), chacune dans son dossier
for p in car bicycle foot; do
  mkdir -p data/$p && cp france.osm.pbf data/$p/
  docker run --rm -v "$PWD/data/$p:/data" ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/$p.lua /data/france.osm.pbf
  docker run --rm -v "$PWD/data/$p:/data" ghcr.io/project-osrm/osrm-backend osrm-partition /data/france.osrm
  docker run --rm -v "$PWD/data/$p:/data" ghcr.io/project-osrm/osrm-backend osrm-customize /data/france.osrm
done

# Un serveur par profil (ports 5000 / 5001 / 5002), avec une limite de tables suffisante pour 100 points
docker run -d -p 5000:5000 -v "$PWD/data/car:/data"     ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld --max-table-size 100 /data/france.osrm
docker run -d -p 5001:5000 -v "$PWD/data/bicycle:/data" ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld --max-table-size 100 /data/france.osrm
docker run -d -p 5002:5000 -v "$PWD/data/foot:/data"    ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld --max-table-size 100 /data/france.osrm

supabase secrets set OSRM_URL_CAR=https://osrm-car.exemple.fr OSRM_URL_BIKE=https://osrm-bike.exemple.fr OSRM_URL_FOOT=https://osrm-foot.exemple.fr
```
