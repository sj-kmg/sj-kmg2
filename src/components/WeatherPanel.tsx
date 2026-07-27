'use client';

import { useEffect, useState } from 'react';

/**
 * 여수시 날씨 — Open-Meteo 무료 API (키 불필요, 브라우저에서 직접 호출).
 * 접속할 때마다 최신 예보로 자동 갱신된다 (30분 캐시).
 */
const LAT = 34.7604; // 전남 여수시
const LON = 127.6622;
const API =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
  '&timezone=Asia%2FSeoul&forecast_days=7';
const CACHE_KEY = 'sj-weather:v1';
const CACHE_MS = 30 * 60 * 1000;

interface WeatherData {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

function wmo(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: '맑음' };
  if (code <= 2) return { icon: '⛅', label: '구름 조금' };
  if (code === 3) return { icon: '☁️', label: '흐림' };
  if (code === 45 || code === 48) return { icon: '🌫️', label: '안개' };
  if (code <= 57) return { icon: '🌦️', label: '이슬비' };
  if (code <= 67) return { icon: '🌧️', label: '비' };
  if (code <= 77) return { icon: '🌨️', label: '눈' };
  if (code <= 82) return { icon: '🌦️', label: '소나기' };
  if (code <= 86) return { icon: '🌨️', label: '소낙눈' };
  return { icon: '⛈️', label: '뇌우' };
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 체감온도 — 기상청 공식 산식 (네이버 날씨와 동일 기준).
 * 여름철(5~9월): 습구온도(Stull) 기반, 겨울철(10~4월): 바람냉각 (기온 10℃ 이하·풍속 4.8km/h 이상일 때).
 */
function feelsLike(t: number, rh: number, windKmh: number, month: number): number {
  if (month >= 5 && month <= 9) {
    const tw =
      t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
      Math.atan(t + rh) -
      Math.atan(rh - 1.67633) +
      0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
      4.686035;
    return -0.2442 + 0.55399 * tw + 0.45535 * t - 0.0022 * tw * tw + 0.00278 * tw * t + 3.0;
  }
  if (t <= 10 && windKmh >= 4.8) {
    const v = Math.pow(windKmh, 0.16);
    return 13.12 + 0.6215 * t - 11.37 * v + 0.3965 * t * v;
  }
  return t;
}

export default function WeatherPanel() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { t, d } = JSON.parse(cached) as { t: number; d: WeatherData };
          if (Date.now() - t < CACHE_MS) {
            setData(d);
            return;
          }
        }
      } catch {
        // 캐시 손상 시 무시하고 새로 요청
      }
      try {
        const res = await fetch(API);
        if (!res.ok) throw new Error(String(res.status));
        const d = (await res.json()) as WeatherData;
        if (cancelled) return;
        setData(d);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d }));
        } catch {
          // 저장 실패는 무시
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="flex h-full min-h-24 items-center justify-center text-sm text-slate-400">
        날씨 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }
  if (!data) {
    return (
      <p className="flex h-full min-h-24 items-center justify-center text-sm text-slate-300">
        날씨 불러오는 중…
      </p>
    );
  }

  const c = data.current;
  const today = wmo(c.weather_code);
  const now = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} (${DOW[now.getDay()]})`;
  const feels = feelsLike(c.temperature_2m, c.relative_humidity_2m, c.wind_speed_10m, now.getMonth() + 1);

  return (
    <div>
      {/* 금일 */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <span className="text-4xl" aria-hidden>
            {today.icon}
          </span>
          <p className="mt-0.5 text-xs text-slate-500">{today.label}</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-slate-800">{Math.round(c.temperature_2m)}°C</p>
          <p className="text-xs text-slate-500">전남 여수시</p>
          <p className="text-xs font-semibold text-slate-600">{dateStr}</p>
        </div>
        <dl className="ml-auto space-y-1 text-right text-xs text-slate-600">
          <div>
            <dt className="inline text-slate-400">체감 </dt>
            <dd className="inline font-semibold">{Math.round(feels)}°C</dd>
          </div>
          <div>
            <dt className="inline text-slate-400">습도 </dt>
            <dd className="inline font-semibold">{c.relative_humidity_2m}%</dd>
          </div>
          <div>
            <dt className="inline text-slate-400">풍속 </dt>
            <dd className="inline font-semibold">{c.wind_speed_10m} km/h</dd>
          </div>
        </dl>
      </div>

      {/* 금주 */}
      <div className="mt-3 grid grid-cols-7 gap-1 border-t border-slate-100 pt-3 text-center">
        {data.daily.time.map((t, i) => {
          const d = new Date(`${t}T00:00:00`);
          const w = wmo(data.daily.weather_code[i]);
          const isToday = i === 0;
          return (
            <div key={t} className={`rounded-lg py-1 ${isToday ? 'bg-sky-50' : ''}`} title={w.label}>
              <p className={`text-[11px] ${d.getDay() === 0 ? 'text-red-500' : d.getDay() === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
                {isToday ? '오늘' : DOW[d.getDay()]}
              </p>
              <p className="text-lg" aria-label={w.label}>
                {w.icon}
              </p>
              <p className="text-[11px] font-semibold text-slate-700">{Math.round(data.daily.temperature_2m_max[i])}°</p>
              <p className="text-[11px] text-slate-400">{Math.round(data.daily.temperature_2m_min[i])}°</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
