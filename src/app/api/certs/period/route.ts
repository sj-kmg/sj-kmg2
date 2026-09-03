import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import type { CertKind } from '@/lib/certExpiry';
import { aiAvailable, extractWithAi } from '@/lib/docAi';
import { expiryFromText, plateIn } from '@/lib/docDates';
import { firebaseReady } from '@/lib/firebaseAdmin';
import { pathFromUrl, readFile } from '@/lib/fileStore';
import { pdfText } from '@/lib/pdfRender';

/**
 * 이미 붙어 있는 서류에서 유효기간을 다시 읽는다 — `{ src, kind }`
 *
 * 기간 읽기는 파일을 **올리는 순간**에만 돌았다. 그래서 그 기능이 생기기 전에 붙여 둔 서류는
 * 아무리 기다려도 '미확인'으로 남는다. 파일을 다시 올리게 하는 대신, 저장돼 있는 그 파일을
 * 서버가 열어 읽는다.
 *
 * 읽는 방법은 두 가지 — 글자층이 있으면 그대로 읽고(정확·무료), 스캔본이면 AI로 읽는다.
 */
export const maxDuration = 120;

/** 서류를 못 찾거나 못 읽어도 첨부는 그대로 둔다 — 값만 비워 돌려준다 */
type Result = { expiresAt: string | null; plate: string | null; source: 'text' | 'ai' | 'none' };

export async function POST(req: Request) {
  // 만료일을 고치는 건 관리자만 하므로 읽기도 관리자에게만 연다
  const auth = await checkAuth(req);
  if (auth.notConfigured) {
    return NextResponse.json({ error: 'passcode_not_configured' }, { status: 503 });
  }
  if (auth.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let src = '';
  let kind: CertKind = 'inspection';
  try {
    const body = (await req.json()) as { src?: string; kind?: string };
    src = String(body.src ?? '');
    if (body.kind === 'insurance') kind = 'insurance';
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const pdf = await loadCert(src);
  if (!pdf) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const out: Result = { expiresAt: null, plate: null, source: 'none' };

  // 1) 글자층 — 전자 서류면 여기서 그대로 나온다
  const text = await pdfText(pdf);
  out.expiresAt = expiryFromText(text, kind);
  out.plate = plateIn(text);
  if (out.expiresAt) out.source = 'text';

  // 2) 스캔본 — 그림째 AI에게 읽힌다
  if (!out.expiresAt && aiAvailable()) {
    const hint = kind === 'inspection' ? '자동차등록증' : '보험증권';
    const dataUrl = pdf.toString('base64');
    const object = await extractWithAi(dataUrl, 'application/pdf', hint);
    if (object) {
      const end = object.periodEnd?.trim() ?? '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        out.expiresAt = end;
        out.source = 'ai';
      }
      out.plate = out.plate ?? (object.plate?.replace(/\s+/g, '') || null);
    }
  }

  return NextResponse.json(out);
}

/**
 * 첨부 주소로 파일을 읽어 온다.
 * 올린 서류는 저장소(Cloud Storage)에, 저장소에 함께 넣어 둔 서류는 `public/` 아래에 있다.
 * 둘 다 `certs` 아래 PDF만 허용한다 — 남의 주소를 넣어 서버로 읽게 하지 않는다.
 */
async function loadCert(src: string): Promise<Buffer | null> {
  if (!/\.pdf$/i.test(src.split('?')[0])) return null;

  if (/^https?:\/\//i.test(src)) {
    if (!firebaseReady()) return null;
    const p = pathFromUrl(src);
    if (!p || !p.startsWith('certs/')) return null;
    return readFile(p);
  }

  if (!src.startsWith('/certs/')) return null;
  try {
    const rel = decodeURIComponent(src).replace(/^\/+/, '');
    const full = path.join(process.cwd(), 'public', rel);
    // public 밖으로 새어 나가지 않게 한 번 더 확인한다
    if (!full.startsWith(path.join(process.cwd(), 'public', 'certs'))) return null;
    return await fs.readFile(full);
  } catch {
    return null;
  }
}
