import { createClient } from "npm:@supabase/supabase-js@2";

const DASHBOARD_ORIGIN = "https://dean8821321.github.io";
const GITHUB_OWNER = "dean8821321";
const GITHUB_REPO = "player-central-config";
const GITHUB_BRANCH = "main";
const CONFIG_PATH = "config.json";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";

const ALLOWED_VIDEO_HOSTS = new Set(["cdn.videy.co", "cdn2.videy.co"]);
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const LP_AD_POSITIONS = new Set(["top", "bottom", "both"]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin === DASHBOARD_ORIGIN ? origin : DASHBOARD_ORIGIN;

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function isAllowedVideoUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ALLOWED_VIDEO_HOSTS.has(url.hostname.toLowerCase()) &&
      /\.mp4$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}


function isHttpsUrlOrEmpty(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return true;

  try {
    return new URL(trimmed).protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikeBase64(value: string): boolean {
  const compact = value.replace(/\s+/g, "");
  return (
    compact.length >= 16 &&
    /^[A-Za-z0-9+/=_-]+$/.test(compact) &&
    !/^https?:\/\//i.test(value.trim())
  );
}

function decodeBase64Text(value: string): string | null {
  try {
    const compact = value
      .replace(/\s+/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padded = compact + "=".repeat((4 - (compact.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

// Direct link boleh dikirim sebagai URL HTTPS asli atau hasil Base64-nya.
function isHttpsUrlOrBase64(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (isHttpsUrlOrEmpty(trimmed)) return true;
  if (!looksLikeBase64(trimmed)) return false;

  const decoded = decodeBase64Text(trimmed);
  return decoded !== null && isHttpsUrlOrEmpty(decoded.trim());
}

function mergeAdSlot(
  incoming: unknown,
  existing: unknown,
  slotName: string,
): Record<string, unknown> {
  const previous = isPlainObject(existing) ? existing : {};

  if (incoming === undefined) return { ...previous };
  if (!isPlainObject(incoming)) {
    throw new Error(`Pengaturan ${slotName} harus berupa objek.`);
  }

  const result: Record<string, unknown> = { ...previous };

  if (incoming.enabled !== undefined) {
    if (typeof incoming.enabled !== "boolean") {
      throw new Error(`Status ${slotName} harus ON/OFF.`);
    }
    result.enabled = incoming.enabled;
  }

  if (incoming.script !== undefined) {
    if (typeof incoming.script !== "string" || incoming.script.length > 5000) {
      throw new Error(`Script ${slotName} tidak valid.`);
    }
    result.script = incoming.script.trim();
  }

  if (incoming.position !== undefined) {
    if (
      typeof incoming.position !== "string" ||
      !LP_AD_POSITIONS.has(incoming.position)
    ) {
      throw new Error("Posisi LP Ad hanya boleh top, bottom, atau both.");
    }
    result.position = incoming.position;
  }

  return result;
}

function mergePopunder(
  incoming: unknown,
  existing: unknown,
  slotName: string,
): Record<string, unknown> {
  const previous = isPlainObject(existing) ? existing : {};

  if (incoming === undefined) return { ...previous };
  if (!isPlainObject(incoming)) {
    throw new Error(`Pengaturan popunder ${slotName} harus berupa objek.`);
  }

  const result: Record<string, unknown> = { ...previous };

  if (incoming.enabled !== undefined) {
    if (typeof incoming.enabled !== "boolean") {
      throw new Error(`Status popunder ${slotName} harus ON/OFF.`);
    }
    result.enabled = incoming.enabled;
  }

  if (incoming.script !== undefined) {
    if (typeof incoming.script !== "string" || incoming.script.length > 5000) {
      throw new Error(`Script popunder ${slotName} tidak valid.`);
    }
    result.script = incoming.script.trim();
  }

  return result;
}

function mergeDirect(
  incoming: unknown,
  existing: unknown,
  slotName: string,
): Record<string, unknown> {
  const previous = isPlainObject(existing) ? existing : {};

  if (incoming === undefined) return { ...previous };
  if (!isPlainObject(incoming)) {
    throw new Error(`Pengaturan direct link ${slotName} harus berupa objek.`);
  }

  const result: Record<string, unknown> = { ...previous };

  if (incoming.enabled !== undefined) {
    if (typeof incoming.enabled !== "boolean") {
      throw new Error(`Status direct link ${slotName} harus ON/OFF.`);
    }
    result.enabled = incoming.enabled;
  }

  if (incoming.url !== undefined) {
    if (!isHttpsUrlOrBase64(incoming.url)) {
      throw new Error(
        `Target URL direct link ${slotName} harus menggunakan HTTPS atau Base64 dari URL HTTPS.`,
      );
    }
    result.url = incoming.url.trim();
  }

  return result;
}

function mergeLpAdSlot(
  incoming: unknown,
  existing: unknown,
): Record<string, unknown> {
  const merged = mergeAdSlot(incoming, existing, "LP Ad");

  if (merged.position === undefined) {
    merged.position = "top";
  }

  if (isPlainObject(incoming)) {
    merged.popunder = mergePopunder(incoming.popunder, isPlainObject(existing) ? (existing as Record<string, unknown>).popunder : {}, "LP");
    merged.direct = mergeDirect(incoming.direct, isPlainObject(existing) ? (existing as Record<string, unknown>).direct : {}, "LP");
  }

  return merged;
}

function mergeAdsSettings(
  incoming: unknown,
  existing: unknown,
): Record<string, unknown> {
  const previous = isPlainObject(existing) ? existing : {};

  if (!isPlainObject(incoming)) {
    throw new Error("Pengaturan Ads harus berupa objek.");
  }

  const result: Record<string, unknown> = { ...previous };

  if (incoming.enabled !== undefined) {
    if (typeof incoming.enabled !== "boolean") {
      throw new Error("Status Ads harus ON/OFF.");
    }
    result.enabled = incoming.enabled;
  }

  result.top = mergeAdSlot(incoming.top, previous.top, "Top Ad");
  result.bottom = mergeAdSlot(incoming.bottom, previous.bottom, "Bottom Ad");
  result.popunder = mergePopunder(incoming.popunder, previous.popunder, "Player");
  result.direct = mergeDirect(incoming.direct, previous.direct, "Player");

  if (incoming.lp !== undefined) {
    result.lp = mergeLpAdSlot(incoming.lp, previous.lp);
  }

  return result;
}

function mergeHistatsSettings(
  incoming: unknown,
  existing: unknown,
): Record<string, unknown> {
  const previous = isPlainObject(existing) ? existing : {};

  if (!isPlainObject(incoming)) {
    throw new Error("Pengaturan Histats harus berupa objek.");
  }

  const result: Record<string, unknown> = { ...previous };

  if (incoming.enabled !== undefined) {
    if (typeof incoming.enabled !== "boolean") {
      throw new Error("Status Histats harus ON/OFF.");
    }
    result.enabled = incoming.enabled;
  }

  if (incoming.script !== undefined) {
    if (typeof incoming.script !== "string" || incoming.script.length > 5000) {
      throw new Error("Script Histats tidak valid.");
    }
    result.script = incoming.script.trim();
  }

  for (const placement of ["player", "lp"] as const) {
    if (incoming[placement] !== undefined) {
      if (typeof incoming[placement] !== "boolean") {
        throw new Error(`Status Histats ${placement} harus ON/OFF.`);
      }
      result[placement] = incoming[placement];
    }
  }

  return result;
}

async function githubRequest(
  method: "GET" | "PUT",
  url: string,
  body?: Record<string, unknown>,
): Promise<Response> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "player-admin-config-publisher",
  };

  if (body) headers["Content-Type"] = "application/json";

  return await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  if (origin && origin !== DASHBOARD_ORIGIN) {
    return jsonResponse(403, { ok: false, error: "Origin tidak diizinkan." }, origin);
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method tidak diizinkan." }, origin);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GITHUB_TOKEN) {
    console.error("Environment secret belum lengkap.");
    return jsonResponse(500, {
      ok: false,
      error: "Konfigurasi server belum lengkap. Periksa secrets Edge Function.",
    }, origin);
  }

  try {
    const authorization = request.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse(401, { ok: false, error: "Sesi admin tidak ditemukan." }, origin);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: authorization },
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return jsonResponse(401, { ok: false, error: "Sesi admin tidak valid atau sudah kedaluwarsa." }, origin);
    }

    const { data: adminRecord, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (adminError || !adminRecord) {
      return jsonResponse(403, { ok: false, error: "Akun ini tidak memiliki akses administrator." }, origin);
    }

    const requestBody = await request.json().catch(() => null);

    if (!isPlainObject(requestBody) || requestBody.action !== "publish") {
      return jsonResponse(400, { ok: false, error: "Permintaan publish tidak valid." }, origin);
    }

    if (requestBody.ads !== undefined && !isPlainObject(requestBody.ads)) {
      return jsonResponse(400, { ok: false, error: "Format pengaturan Ads tidak valid." }, origin);
    }

    if (requestBody.histats !== undefined && !isPlainObject(requestBody.histats)) {
      return jsonResponse(400, { ok: false, error: "Format pengaturan Histats tidak valid." }, origin);
    }

    const { data: pages, error: pagesError } = await supabase
      .from("facebook_pages")
      .select("id, page_name, is_active, created_at")
      .order("created_at", { ascending: true });

    if (pagesError) {
      console.error("Gagal membaca facebook_pages:", pagesError);
      return jsonResponse(500, { ok: false, error: "Gagal membaca data Facebook Page." }, origin);
    }

    const { data: videos, error: videosError } = await supabase
      .from("videos")
      .select("video_id, title, video_url, page_id, is_active, facebook_pages(page_name, is_active)")
      .order("created_at", { ascending: true });

    if (videosError) {
      console.error("Gagal membaca videos:", videosError);
      return jsonResponse(500, { ok: false, error: "Gagal membaca data video." }, origin);
    }

    const pageConfig = (pages ?? []).map((page) => ({
      id: page.id,
      name: page.page_name,
      enabled: page.is_active === true,
    }));

    const videoConfig = [];

    for (const video of videos ?? []) {
      if (
        typeof video.video_id !== "string" ||
        !VIDEO_ID_PATTERN.test(video.video_id) ||
        !isAllowedVideoUrl(video.video_url)
      ) {
        console.warn("Video dilewati karena ID atau URL tidak valid:", video.video_id);
        continue;
      }

      const relatedPage = Array.isArray(video.facebook_pages)
        ? video.facebook_pages[0]
        : video.facebook_pages;

      const pageName =
        relatedPage &&
        typeof relatedPage.page_name === "string" &&
        relatedPage.page_name.trim()
          ? relatedPage.page_name.trim()
          : "";

      videoConfig.push({
        id: video.video_id,
        title: pageName
          ? `${pageName} - ${video.video_id}`
          : `My Video Player - ${video.video_id}`,
        url: video.video_url,
        pageId: video.page_id ?? null,
        enabled: video.is_active === true,
      });
    }

    const contentsUrl =
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${CONFIG_PATH}` +
      `?ref=${encodeURIComponent(GITHUB_BRANCH)}`;

    const getResponse = await githubRequest("GET", contentsUrl);

    if (!getResponse.ok) {
      const detail = await getResponse.text();
      console.error("GitHub GET config gagal:", getResponse.status, detail);
      return jsonResponse(502, {
        ok: false,
        error: "Gagal membaca config.json dari GitHub. Periksa token dan repository.",
      }, origin);
    }

    const githubFile = await getResponse.json();

    if (
      !isPlainObject(githubFile) ||
      typeof githubFile.sha !== "string" ||
      typeof githubFile.content !== "string"
    ) {
      return jsonResponse(502, { ok: false, error: "Respons file config.json dari GitHub tidak valid." }, origin);
    }

    const currentConfigText = decodeBase64Utf8(githubFile.content);
    const currentConfig: unknown = JSON.parse(currentConfigText);

    if (!isPlainObject(currentConfig)) {
      return jsonResponse(500, { ok: false, error: "Isi config.json saat ini bukan objek JSON yang valid." }, origin);
    }

    const nextConfig: Record<string, unknown> = {
      ...currentConfig,
      version: Number.isInteger(currentConfig.version)
        ? Number(currentConfig.version) + 1
        : 1,
      pages: pageConfig,
      videos: videoConfig,
    };

    if (requestBody.ads !== undefined) {
      nextConfig.ads = mergeAdsSettings(requestBody.ads, currentConfig.ads);
    }

    if (requestBody.histats !== undefined) {
      nextConfig.histats = mergeHistatsSettings(requestBody.histats, currentConfig.histats);
    }

    const site = isPlainObject(currentConfig.site) ? currentConfig.site : {};
    const currentDefaultId =
      typeof site.defaultVideoId === "string" ? site.defaultVideoId : "";
    const activeVideoIds = new Set(
      videoConfig.filter((video) => video.enabled).map((video) => video.id),
    );

    nextConfig.site = {
      ...site,
      defaultVideoId: activeVideoIds.has(currentDefaultId)
        ? currentDefaultId
        : (videoConfig.find((video) => video.enabled)?.id ?? ""),
    };

    const updatedConfigText = `${JSON.stringify(nextConfig, null, 2)}\n`;

    const putResponse = await githubRequest("PUT", contentsUrl, {
      message: "Publish player configuration from Admin Dashboard",
      content: encodeBase64Utf8(updatedConfigText),
      sha: githubFile.sha,
      branch: GITHUB_BRANCH,
    });

    if (!putResponse.ok) {
      const detail = await putResponse.text();
      console.error("GitHub PUT config gagal:", putResponse.status, detail);
      const status = putResponse.status === 409 ? 409 : 502;
      return jsonResponse(status, {
        ok: false,
        error: status === 409
          ? "config.json berubah bersamaan. Silakan tekan Publish sekali lagi."
          : "GitHub gagal menyimpan config.json. Periksa izin token GitHub.",
      }, origin);
    }

    const savedFile = await putResponse.json();

    return jsonResponse(200, {
      ok: true,
      message: "Konfigurasi berhasil diterbitkan ke GitHub. Cloudflare Pages akan memperbarui file statis.",
      version: nextConfig.version,
      pageCount: pageConfig.length,
      videoCount: videoConfig.length,
      activeVideoCount: videoConfig.filter((video) => video.enabled).length,
      adsUpdated: requestBody.ads !== undefined,
      histatsUpdated: requestBody.histats !== undefined,
      commit: savedFile.commit?.sha ?? null,
    }, origin);
  } catch (error) {
    console.error("Publish config error:", error);
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Terjadi kesalahan internal saat publish.",
    }, origin);
  }
});
