import { Transport } from './gangwon.constants';

export interface LatLng {
  lat: number;
  lng: number;
}

/** "mapx(경도)/mapy(위도)" 문자열을 좌표로. 유효하지 않으면 null */
export function toLatLng(mapX?: string, mapY?: string): LatLng | null {
  const lng = Number(mapX);
  const lat = Number(mapY);
  if (!mapX || !mapY || Number.isNaN(lng) || Number.isNaN(lat)) return null;
  if (lat === 0 || lng === 0) return null;
  return { lat, lng };
}

/** 두 좌표 간 거리(m) — 하버사인 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 이동수단별 평균 속도(km/h). 뚜벅이는 제안서 기준 도보 4km/h */
const SPEED_KMH: Record<Transport, number> = {
  [Transport.WALK]: 4,
  [Transport.KTX]: 30, // 지역 내 이동은 도보+대중교통 혼합 가정
  [Transport.CAR]: 40, // 지방 도로 평균
};

/** 거리(m) → 이동 소요(분) */
export function travelMinutes(meters: number, transport: Transport): number {
  const kmh = SPEED_KMH[transport] ?? 4;
  return Math.round((meters / 1000 / kmh) * 60);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
