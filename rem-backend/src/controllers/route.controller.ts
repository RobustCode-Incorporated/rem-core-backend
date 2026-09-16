import { Request, Response } from 'express';

/**
 * @desc Proxy vers un serveur OSRM public : reforme la réponse au format attendu
 * par gods-eye-view/search (`{ ok, geometry, distanceM, durationS }`), pour que
 * le globe de logistique (prototype) puisse calculer un vrai itinéraire routier
 * entre deux revendeurs/dépôts plutôt qu'une ligne droite.
 *
 * ⚠️ router.project-osrm.org est un service de démonstration, non garanti pour
 * de la production (quotas, disponibilité). Pour un usage réel, pointer OSRM_URL
 * vers une instance OSRM auto-hébergée ou un fournisseur commercial (Mapbox,
 * GraphHopper, etc.) — aucun autre changement n'est nécessaire côté frontend.
 */
const OSRM_BASE_URL = process.env.OSRM_URL || 'https://router.project-osrm.org';

const OSRM_PROFILE: Record<string, string> = {
  car: 'driving',
  foot: 'walking',
  bike: 'cycling',
};

const COORD_PAIR = /^-?\d{1,3}(\.\d+)?,-?\d{1,2}(\.\d+)?$/;

export const getRoute = async (req: Request, res: Response): Promise<void> => {
  const profile = OSRM_PROFILE[String(req.query.profile || '')];
  const coords = String(req.query.coords || '');
  const pairs = coords.split(';');

  if (!profile || pairs.length < 2 || !pairs.every((pair) => COORD_PAIR.test(pair))) {
    res.status(400).json({ ok: false, error: 'Paramètres profile/coords invalides.' });
    return;
  }

  try {
    const osrmUrl = `${OSRM_BASE_URL}/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;
    const response = await fetch(osrmUrl, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      res.status(200).json({ ok: false });
      return;
    }
    const data = await response.json();
    const route = data?.routes?.[0];
    if (data?.code !== 'Ok' || !route?.geometry?.coordinates?.length) {
      res.status(200).json({ ok: false });
      return;
    }

    res.status(200).json({
      ok: true,
      geometry: route.geometry.coordinates,
      distanceM: route.distance,
      durationS: route.duration,
    });
  } catch (error) {
    res.status(200).json({ ok: false });
  }
};
