import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TourApiList, TourApiResponse } from './tour-api.types';

type QueryValue = string | number | undefined | null;

interface CacheEntry {
  expiresAt: number;
  data: unknown;
}

/**
 * 한국관광공사 TourAPI 호출을 담당하는 단일 진입점.
 * - serviceKey 주입(Encoding 키를 추가 인코딩 없이 그대로 사용)
 * - MobileOS/MobileApp/_type 등 공통 파라미터 자동 부여
 * - 단기 메모리 TTL 캐시(개발계정 일일 트래픽 보호)
 * - 응답 헤더 resultCode 검증 및 items 정규화(빈 문자열/단일객체 → 배열)
 *
 * 도메인 모듈은 이 서비스만 통해 외부를 호출한다. (원본 관광데이터는 DB에 적재하지 않음)
 */
@Injectable()
export class TourApiService {
  private readonly logger = new Logger(TourApiService.name);
  private readonly serviceKey: string;
  private readonly baseUrl: string;
  private readonly appName: string;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 1000 * 60 * 30; // 30분

  constructor(private readonly config: ConfigService) {
    this.serviceKey = this.config.get<string>('TOUR_API_KEY') ?? '';
    this.baseUrl =
      this.config.get<string>('TOUR_API_BASE_URL') ??
      'https://apis.data.go.kr/B551011';
    this.appName = this.config.get<string>('TOUR_API_APP_NAME') ?? 'PLANLOG';

    if (!this.serviceKey || this.serviceKey.startsWith('여기에')) {
      this.logger.warn(
        'TOUR_API_KEY 가 설정되지 않았습니다. .env 의 TOUR_API_KEY 에 발급키를 넣어주세요.',
      );
    }
  }

  /**
   * TourAPI 호출 후 정규화된 목록을 반환한다.
   * @param service  서비스 경로 (예: 'KorService2', 'GoCamping')
   * @param operation 오퍼레이션 (예: 'areaBasedList2', 'basedList')
   * @param params   오퍼레이션별 파라미터
   */
  async getList<T>(
    service: string,
    operation: string,
    params: Record<string, QueryValue> = {},
  ): Promise<TourApiList<T>> {
    const body = await this.request<T>(service, operation, params);
    return {
      items: this.normalizeItems<T>(body),
      pageNo: Number(body.response.body.pageNo ?? 1),
      numOfRows: Number(body.response.body.numOfRows ?? 0),
      totalCount: Number(body.response.body.totalCount ?? 0),
    };
  }

  private async request<T>(
    service: string,
    operation: string,
    params: Record<string, QueryValue>,
  ): Promise<TourApiResponse<T>> {
    const url = this.buildUrl(service, operation, params);
    const cacheKey = url;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as TourApiResponse<T>;
    }

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch (e) {
      this.logger.error(`TourAPI 네트워크 오류: ${operation}`, e as Error);
      throw new ServiceUnavailableException(
        '관광 정보 서버 연결에 실패했습니다.',
      );
    }

    if (!res.ok) {
      throw new ServiceUnavailableException(
        `관광 정보 서버 오류 (HTTP ${res.status})`,
      );
    }

    const text = await res.text();
    let json: TourApiResponse<T>;
    try {
      json = JSON.parse(text) as TourApiResponse<T>;
    } catch {
      // 키 오류 등은 XML(OpenApiServiceResponse)로 내려오는 경우가 많다.
      this.logger.error(
        `TourAPI 응답 파싱 실패(${operation}): ${text.slice(0, 200)}`,
      );
      throw new ServiceUnavailableException(
        '관광 정보 응답을 해석하지 못했습니다. (인증키/파라미터 확인)',
      );
    }

    const resultCode = json.response?.header?.resultCode;
    if (resultCode !== '0000') {
      const msg = json.response?.header?.resultMsg ?? 'UNKNOWN';
      this.logger.error(
        `TourAPI 결과코드 ${resultCode}: ${msg} (${operation})`,
      );
      throw new ServiceUnavailableException(`관광 정보 조회 실패: ${msg}`);
    }

    this.cache.set(cacheKey, {
      data: json,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
    return json;
  }

  private buildUrl(
    service: string,
    operation: string,
    params: Record<string, QueryValue>,
  ): string {
    const sp = new URLSearchParams();
    sp.set('MobileOS', 'ETC');
    sp.set('MobileApp', this.appName);
    sp.set('_type', 'json');
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      sp.set(k, String(v));
    }
    // serviceKey(Encoding 키)는 이미 URL 인코딩되어 있어 추가 인코딩 없이 직접 연결한다.
    return `${this.baseUrl}/${service}/${operation}?serviceKey=${this.serviceKey}&${sp.toString()}`;
  }

  /** items 가 ''(빈) / 단일 객체 / 배열 중 무엇이든 배열로 정규화 */
  private normalizeItems<T>(body: TourApiResponse<T>): T[] {
    const items = body.response?.body?.items;
    if (!items || typeof items === 'string') return [];
    const item = items.item;
    if (!item) return [];
    return Array.isArray(item) ? item : [item];
  }
}
